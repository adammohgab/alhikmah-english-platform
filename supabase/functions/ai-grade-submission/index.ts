declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
} | undefined;

import { corsMiddleware, getCorsHeaders } from "../_shared/cors";
import { verifyJWT, extractRole } from "../_shared/auth";
import { preCheck, postCheck, getNeutralMessage } from "../_shared/ai/safety";
import { defaultAIAdapter } from "../_shared/ai/adapter";

export interface RubricCriterionScore {
  criterion_id?: string;
  criterion_name: string;
  score: number; // e.g. 0 to 4
  max_score: number;
  explanation: string;
  confidence: number; // 0.0 to 1.0
  is_borderline?: boolean;
}

export interface AIGradeSubmissionOutput {
  suggested_score: number;
  max_score: number;
  overall_feedback: string;
  criteria_evaluations: RubricCriterionScore[];
  borderline_flag: boolean;
  borderline_reason?: string;
  suggested_teacher_comment: string;
  is_ai_draft: true;
}

export interface GradeSubmissionRequest {
  attempt_id: string;
  question_id: string;
  student_answer: string | Record<string, unknown>;
  rubric_id?: string;
  rubric_criteria?: Array<{
    id?: string;
    name: string;
    description: string;
    max_score: number;
  }>;
  question_prompt?: string;
}

export interface GradeSubmissionResponse {
  success: boolean;
  draft_grade: AIGradeSubmissionOutput;
  attempt_id: string;
  question_id: string;
  saved_to_db: boolean;
  human_in_the_loop_notice: string;
  usage?: {
    tokensIn: number;
    tokensOut: number;
    model: string;
  };
}

/**
 * Strict validator for AI grading output
 */
export function validateGradingJson(json: unknown): AIGradeSubmissionOutput {
  if (!json || typeof json !== "object") {
    throw new Error("Invalid output: expected JSON object");
  }

  const raw = json as Record<string, unknown>;
  const suggested_score = typeof raw.suggested_score === "number" ? raw.suggested_score : 0;
  const max_score = typeof raw.max_score === "number" ? raw.max_score : 4;

  const rawCriteria = Array.isArray(raw.criteria_evaluations) ? raw.criteria_evaluations : [];
  const criteria_evaluations: RubricCriterionScore[] = [];
  let hasBorderline = Boolean(raw.borderline_flag);

  for (const item of rawCriteria) {
    if (item && typeof item === "object") {
      const c = item as Record<string, unknown>;
      const score = typeof c.score === "number" ? c.score : 0;
      const max = typeof c.max_score === "number" ? c.max_score : 4;
      const confidence = typeof c.confidence === "number" ? c.confidence : 0.85;
      const is_borderline = Boolean(c.is_borderline) || confidence < 0.7;

      if (is_borderline) {
        hasBorderline = true;
      }

      criteria_evaluations.push({
        criterion_id: typeof c.criterion_id === "string" ? c.criterion_id : undefined,
        criterion_name: String(c.criterion_name || "Content and Accuracy"),
        score,
        max_score: max,
        explanation: String(c.explanation || "Demonstrates partial understanding."),
        confidence,
        is_borderline,
      });
    }
  }

  const overall_feedback = typeof raw.overall_feedback === "string" && raw.overall_feedback.trim().length > 0
    ? raw.overall_feedback
    : "Draft evaluation completed based on provided rubric.";

  const suggested_teacher_comment = typeof raw.suggested_teacher_comment === "string" && raw.suggested_teacher_comment.trim().length > 0
    ? raw.suggested_teacher_comment
    : `[AI Draft Suggestion]: ${overall_feedback} (Requires teacher verification)`;

  return {
    suggested_score,
    max_score,
    overall_feedback,
    criteria_evaluations,
    borderline_flag: hasBorderline,
    borderline_reason: hasBorderline
      ? (typeof raw.borderline_reason === "string" ? raw.borderline_reason : "One or more criteria have low confidence (<70%) or borderline boundaries requiring human judgement.")
      : undefined,
    suggested_teacher_comment,
    is_ai_draft: true,
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
 * Save draft AI suggestions to attempt_answers.teacher_comment flagged with is_ai_draft
 * Enforces human-in-the-loop guarantee: AI never finalizes or overrides points_awarded directly.
 */
export async function saveDraftGradeSuggestion(
  attemptId: string,
  questionId: string,
  draftGrade: AIGradeSubmissionOutput
): Promise<boolean> {
  const supa = await getSupabaseServiceClient();
  if (!supa) return false;

  try {
    const structuredComment = JSON.stringify({
      is_ai_draft: true,
      draft_score: draftGrade.suggested_score,
      max_score: draftGrade.max_score,
      borderline_flag: draftGrade.borderline_flag,
      borderline_reason: draftGrade.borderline_reason,
      overall_feedback: draftGrade.overall_feedback,
      criteria_evaluations: draftGrade.criteria_evaluations,
      suggested_comment: draftGrade.suggested_teacher_comment,
      generated_at: new Date().toISOString(),
    });

    const { error } = await supa
      .from("attempt_answers")
      .update({
        teacher_comment: structuredComment,
        updated_at: new Date().toISOString(),
      })
      .eq("attempt_id", attemptId)
      .eq("question_id", questionId);

    if (error) {
      console.warn("Could not save AI draft grade to attempt_answers:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Error saving AI draft grade:", err);
    return false;
  }
}

/**
 * Edge Function HTTP handler for /functions/v1/ai-grade-submission
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
  let userRole = "";

  try {
    const token = authHeader.slice(7);
    const payload = await verifyJWT(token);
    userId = (payload.userId as string | undefined) || (payload.sub as string | undefined) || "";
    userRole = extractRole(payload);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Authentication failed";
    return new Response(
      JSON.stringify({
        error: { code: "unauthenticated", message: msg, requestId },
      }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Authorization: Only teachers and admins can invoke auto-grading
  if (userRole !== "teacher" && userRole !== "admin") {
    return new Response(
      JSON.stringify({
        error: {
          code: "forbidden",
          message: "Only teachers and admins are authorized to trigger AI submission grading.",
          requestId,
        },
      }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let body: GradeSubmissionRequest;
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

  if (!body.attempt_id || !body.question_id) {
    return new Response(
      JSON.stringify({
        error: {
          code: "validation_failed",
          message: "Both attempt_id and question_id are required fields",
          requestId,
        },
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const rawAnswer = typeof body.student_answer === "object"
    ? JSON.stringify(body.student_answer)
    : String(body.student_answer || "").trim();

  if (!rawAnswer) {
    return new Response(
      JSON.stringify({
        error: {
          code: "validation_failed",
          message: "Student answer is required for grading evaluation",
          requestId,
        },
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Safety pre-check on student answer
  const safetyCheck = preCheck(rawAnswer, "B2");
  if (safetyCheck.status === "blocked") {
    return new Response(
      JSON.stringify({
        error: {
          code: "safety_blocked",
          message: "Student answer contains prohibited content and cannot be evaluated automatically.",
          requestId,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const criteriaList = (body.rubric_criteria && body.rubric_criteria.length > 0)
    ? body.rubric_criteria
    : [
        { name: "Task Completion & Relevance", description: "Answers all parts of the prompt directly", max_score: 4 },
        { name: "Grammar & Mechanics", description: "Correct syntax, punctuation, and tense usage", max_score: 4 },
        { name: "Vocabulary & Word Choice", description: "Appropriate academic and contextual vocabulary", max_score: 4 },
        { name: "Organization & Cohesion", description: "Logical flow and clear connective transitions", max_score: 4 },
      ];

  const systemInstruction = `You are an AI pedagogical grading assistant for English teachers at Al Hikmah English platform.
Your task is to provide objective, criterion-based draft evaluations of open-ended student answers.

Strict Human-in-the-Loop Guarantee:
1. You only propose draft suggestions for the teacher's review. You do NOT finalize grades.
2. If an answer is borderline, ambiguous, or near a grade boundary, set borderline_flag = true and explain why in borderline_reason.
3. Be clear, constructive, and concise (each explanation under 30 words).

Respond ONLY with a valid JSON object matching:
{
  "suggested_score": <total score earned across criteria>,
  "max_score": <total possible points across criteria>,
  "overall_feedback": "<summary of overall assessment in 2-3 sentences>",
  "criteria_evaluations": [
    {
      "criterion_name": "<name of the criterion>",
      "score": <score earned>,
      "max_score": <max points for this criterion>,
      "explanation": "<rationale for the score>",
      "confidence": <float between 0.0 and 1.0>,
      "is_borderline": <boolean true if borderline or uncertain>
    }
  ],
  "borderline_flag": <boolean, true if any criterion is uncertain or borderline>,
  "borderline_reason": "<explanation if borderline_flag is true, otherwise omit or empty>",
  "suggested_teacher_comment": "<draft feedback ready for teacher to edit and release to student>",
  "is_ai_draft": true
}`;

  const userContent = `Question / Assignment Prompt:
${body.question_prompt || "Evaluate the student's open-ended English response against the rubric criteria."}

Rubric Criteria:
${criteriaList.map((c, i) => `${i + 1}. ${c.name} (Max: ${c.max_score} pts) - ${c.description}`).join("\n")}

Student Answer:
"""
${safetyCheck.redactedMessage}
"""`;

  try {
    const structuredResult = await defaultAIAdapter.generateStructured<AIGradeSubmissionOutput>(
      {
        tier: "smart",
        systemInstruction,
        messages: [{ role: "user", content: userContent }],
        temperature: 0.1,
        maxTokens: 1200,
        metadata: { feature: "ai_grade_submission", requestId, userId },
      },
      validateGradingJson
    );

    // Save draft suggestions to attempt_answers table
    const saved = await saveDraftGradeSuggestion(
      body.attempt_id,
      body.question_id,
      structuredResult.data
    );

    // Record AI usage in ai_usage_logs
    getSupabaseServiceClient().then((supa) => {
      if (supa) {
        supa.from("ai_usage_logs").insert({
          user_id: userId,
          role: userRole,
          feature: "grading",
          model: structuredResult.model,
          tokens_in: structuredResult.tokensIn,
          tokens_out: structuredResult.tokensOut,
          cost_micro: Math.round((structuredResult.tokensIn * 0.15 + structuredResult.tokensOut * 0.6) * 10),
          status: "ok",
          request_id: requestId,
        }).then(() => {});
      }
    }).catch(() => {});

    const responsePayload: GradeSubmissionResponse = {
      success: true,
      draft_grade: structuredResult.data,
      attempt_id: body.attempt_id,
      question_id: body.question_id,
      saved_to_db: saved,
      human_in_the_loop_notice: "AI grades are draft suggestions only (is_ai_draft = true). Scores are not released to the student until reviewed and approved by the teacher.",
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
    const message = err instanceof Error ? err.message : "Grading evaluation failed";
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
