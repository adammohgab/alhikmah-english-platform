declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
} | undefined;

import { corsMiddleware, getCorsHeaders } from "../_shared/cors";
import { verifyJWT, extractRole } from "../_shared/auth";
import { preCheck, postCheck, getNeutralMessage } from "../_shared/ai/safety";
import { defaultAIAdapter } from "../_shared/ai/adapter";

export interface InlineCorrection {
  original: string;
  suggestion: string;
  explanation: string;
  category: "grammar" | "spelling" | "punctuation" | "vocabulary" | "style";
}

export interface WritingFeedbackOutput {
  overall_score: number; // 0 to 4 or 0 to 100
  cefr_level: "A1" | "A2" | "B1" | "B2" | "C1";
  strengths: string[];
  areas_for_improvement: string[];
  inline_corrections: InlineCorrection[];
  praise: string;
  summary: string;
}

export interface WritingFeedbackRequest {
  text: string;
  grade_level?: string;
  prompt?: string;
  draft_id?: string;
}

export interface WritingFeedbackResponse {
  feedback: WritingFeedbackOutput;
  draft_id?: string;
  cached?: boolean;
  usage?: {
    tokensIn: number;
    tokensOut: number;
    model: string;
  };
}

export const MAX_ESSAY_CHARS = 5000;

/**
 * Zod-compatible / strict schema validation function for WritingFeedbackOutput
 */
export function validateWritingFeedbackJson(json: unknown): WritingFeedbackOutput {
  if (!json || typeof json !== "object") {
    throw new Error("Invalid output: expected JSON object");
  }

  const raw = json as Record<string, unknown>;

  const score = typeof raw.overall_score === "number" ? raw.overall_score : 3;
  const cefrRaw = String(raw.cefr_level || "B1").toUpperCase();
  const validCefr = ["A1", "A2", "B1", "B2", "C1"];
  const cefr_level = (validCefr.includes(cefrRaw) ? cefrRaw : "B1") as WritingFeedbackOutput["cefr_level"];

  const strengths = Array.isArray(raw.strengths)
    ? raw.strengths.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    : ["Good effort expressing clear ideas."];

  const areas_for_improvement = Array.isArray(raw.areas_for_improvement)
    ? raw.areas_for_improvement.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    : ["Review sentence variety and verb agreement."];

  const rawCorrections = Array.isArray(raw.inline_corrections) ? raw.inline_corrections : [];
  const inline_corrections: InlineCorrection[] = [];

  for (const item of rawCorrections) {
    if (item && typeof item === "object") {
      const c = item as Record<string, unknown>;
      const cat = String(c.category || "grammar").toLowerCase();
      const validCat = ["grammar", "spelling", "punctuation", "vocabulary", "style"];
      const category = (validCat.includes(cat) ? cat : "grammar") as InlineCorrection["category"];

      inline_corrections.push({
        original: String(c.original || ""),
        suggestion: String(c.suggestion || ""),
        explanation: String(c.explanation || ""),
        category,
      });
    }
  }

  const praise = typeof raw.praise === "string" && raw.praise.trim().length > 0
    ? raw.praise
    : "Great work completing your writing task! Keep building on these foundations.";

  const summary = typeof raw.summary === "string" && raw.summary.trim().length > 0
    ? raw.summary
    : "Your draft demonstrates strong communication with opportunities for refinement in grammar and vocabulary.";

  return {
    overall_score: score,
    cefr_level,
    strengths: strengths.length ? strengths : ["Good effort communicating ideas clearly."],
    areas_for_improvement: areas_for_improvement.length ? areas_for_improvement : ["Continue practicing sentence structure."],
    inline_corrections,
    praise,
    summary,
  };
}

/**
 * Helper to get a Supabase Service Client safely if available
 */
async function getSupabaseServiceClient() {
  const supabaseUrl = (typeof Deno !== "undefined" ? Deno.env.get("SUPABASE_URL") : "") || "";
  const serviceKey =
    (typeof Deno !== "undefined" ? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") : "") || "";
  if (!supabaseUrl || !serviceKey) return null;

  try {
    const { createClient } = await import("@supabase/supabase-js");
    return createClient(supabaseUrl, serviceKey);
  } catch {
    return null;
  }
}

/**
 * Store feedback in writing_drafts table if student_id and draft_id or recent draft exists
 */
export async function storeDraftFeedback(
  studentId: string,
  draftId: string | undefined,
  feedback: WritingFeedbackOutput
): Promise<string | undefined> {
  const supa = await getSupabaseServiceClient();
  if (!supa) return draftId;

  try {
    if (draftId) {
      await supa
        .from("writing_drafts")
        .update({
          ai_feedback: feedback,
          feedback_at: new Date().toISOString(),
        })
        .eq("id", draftId)
        .eq("student_id", studentId);
      return draftId;
    } else {
      // Find the student's most recently updated draft or create a draft record
      const { data } = await supa
        .from("writing_drafts")
        .select("id")
        .eq("student_id", studentId)
        .order("last_saved_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.id) {
        await supa
          .from("writing_drafts")
          .update({
            ai_feedback: feedback,
            feedback_at: new Date().toISOString(),
          })
          .eq("id", data.id);
        return data.id;
      }
    }
  } catch (e) {
    console.warn("Could not save to writing_drafts:", e);
  }
  return draftId;
}

/**
 * Edge Function HTTP handler for /functions/v1/ai-writing-feedback
 */
export async function handleRequest(req: Request): Promise<Response> {
  const corsRes = corsMiddleware(req);
  if (corsRes) return corsRes;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const requestId = crypto.randomUUID();
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({
        error: { code: "unauthenticated", message: "Missing or invalid Bearer token", requestId },
      }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let userId = "";
  let userRole = "student";

  try {
    const token = authHeader.slice(7);
    const payload = await verifyJWT(token);
    userId = (payload.userId as string | undefined) || (payload.sub as string | undefined) || "";
    userRole = extractRole(payload) || "student";
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Authentication failed";
    return new Response(
      JSON.stringify({
        error: { code: "unauthenticated", message: msg, requestId },
      }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let body: WritingFeedbackRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({
        error: { code: "validation_failed", message: "Invalid JSON body", requestId },
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const rawText = (body.text || "").trim();
  if (!rawText) {
    return new Response(
      JSON.stringify({
        error: { code: "validation_failed", message: "Text for writing feedback is required", requestId },
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (rawText.length > MAX_ESSAY_CHARS) {
    return new Response(
      JSON.stringify({
        error: {
          code: "validation_failed",
          message: `Text exceeds maximum allowed length of ${MAX_ESSAY_CHARS} characters`,
          requestId,
        },
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const gradeLevel = body.grade_level || "B1";

  // Safety pre-check
  const safetyCheck = preCheck(rawText, gradeLevel as any);
  if (safetyCheck.status === "blocked") {
    return new Response(
      JSON.stringify({
        error: {
          code: "safety_blocked",
          message: getNeutralMessage(),
          requestId,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const systemInstruction = `You are a supportive, expert English writing mentor for secondary students (Grades 7–12) at Al Hikmah English platform.
Analyze the student's essay or paragraph and provide constructive, age-appropriate praise, structured grammar, spelling, clarity suggestions, and CEFR level estimations.

You must respond ONLY with a valid JSON object matching this schema:
{
  "overall_score": <number between 1 and 4, representing overall performance rubric (1: Emerging, 2: Developing, 3: Proficient, 4: Advanced)>,
  "cefr_level": <"A1" | "A2" | "B1" | "B2" | "C1">,
  "strengths": [<string array of 2-3 genuine strengths in their writing>],
  "areas_for_improvement": [<string array of 2-3 actionable areas to improve>],
  "inline_corrections": [
    {
      "original": "<exact phrase from text that has an issue>",
      "suggestion": "<improved version>",
      "explanation": "<short, friendly explanation why>",
      "category": "<'grammar' | 'spelling' | 'punctuation' | 'vocabulary' | 'style'>"
    }
  ],
  "praise": "<encouraging, uplifting comment highlighting their effort>",
  "summary": "<2 sentence overview of the writing performance>"
}`;

  const userContent = `Student Target Grade/Level: ${gradeLevel}
${body.prompt ? `Writing Prompt / Assignment Topic: "${body.prompt}"\n` : ""}
Student Essay:
"""
${safetyCheck.redactedMessage}
"""`;

  try {
    const structuredResult = await defaultAIAdapter.generateStructured<WritingFeedbackOutput>(
      {
        tier: "smart",
        systemInstruction,
        messages: [{ role: "user", content: userContent }],
        temperature: 0.2,
        maxTokens: 1500,
        metadata: { feature: "writing_feedback", requestId, userId },
      },
      validateWritingFeedbackJson
    );

    // Safety post-check
    const post = postCheck(structuredResult.data.summary, gradeLevel as any, true);
    if (post.status === "blocked") {
      return new Response(
        JSON.stringify({
          error: {
            code: "safety_blocked",
            message: getNeutralMessage(),
            requestId,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Persist to writing_drafts if applicable
    const updatedDraftId = await storeDraftFeedback(userId, body.draft_id, structuredResult.data);

    // Also record usage in ai_usage_logs if Supabase service is available
    getSupabaseServiceClient().then((supa) => {
      if (supa) {
        supa.from("ai_usage_logs").insert({
          user_id: userId,
          role: userRole,
          feature: "writing_feedback",
          model: structuredResult.model,
          tokens_in: structuredResult.tokensIn,
          tokens_out: structuredResult.tokensOut,
          cost_micro: Math.round((structuredResult.tokensIn * 0.15 + structuredResult.tokensOut * 0.6) * 10),
          status: "ok",
          request_id: requestId,
        }).then(() => {});
      }
    }).catch(() => {});

    const responsePayload: WritingFeedbackResponse = {
      feedback: structuredResult.data,
      draft_id: updatedDraftId,
      cached: false,
      usage: {
        tokensIn: structuredResult.tokensIn,
        tokensOut: structuredResult.tokensOut,
        model: structuredResult.model,
      },
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "X-Request-Id": requestId,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to evaluate writing";
    return new Response(
      JSON.stringify({
        error: {
          code: "provider_error",
          message,
          requestId,
        },
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

if (typeof Deno !== "undefined" && "serve" in Deno) {
  // @ts-ignore
  Deno.serve(handleRequest);
}
