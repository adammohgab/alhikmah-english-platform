declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
} | undefined;

import { corsMiddleware, getCorsHeaders } from "../_shared/cors";
import { verifyJWT, extractRole } from "../_shared/auth";
import { preCheck, postCheck, getNeutralMessage } from "../_shared/ai/safety";
import { defaultAIAdapter } from "../_shared/ai/adapter";
import { novaCounselor } from "../_shared/ai/prompts";

export interface ActionCardChange {
  entity: "questions" | "assessments" | "lessons" | "lesson_blocks" | "class_enrollments";
  action: "create_draft" | "insert" | "update";
  data?: Record<string, unknown>;
  id?: string;
  patch?: Record<string, unknown>;
}

export interface ActionCardPayload {
  kind:
    | "create_quiz"
    | "create_assignment"
    | "create_questions"
    | "create_lesson"
    | "create_course"
    | "create_announcement"
    | "grade_draft";
  summary: string;
  preview: Record<string, unknown>;
  changes: ActionCardChange[];
  sources?: Record<string, unknown>;
  notes?: string[];
  status?: "pending" | "ready" | "applied";
}

export interface TeacherCopilotRequest {
  conversation_id?: string;
  message: string;
  workspace_state?: {
    page?: string;
    class_id?: string;
    course_id?: string;
    lesson_id?: string;
    quiz_id?: string;
    assignment_id?: string;
    grade_level?: string;
    subject?: string;
  };
}

export const MAX_COPILOT_MESSAGE_CHARS = 2000;

/**
 * Format SSE event string
 */
export function formatSSE(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
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
 * Inserts an ActionCard into ai_action_cards table with status 'pending' (per task spec)
 */
export async function insertActionCard(
  userId: string,
  conversationId: string | undefined,
  card: ActionCardPayload
): Promise<string> {
  const cardId = crypto.randomUUID();
  const supa = await getSupabaseServiceClient();
  if (!supa) return cardId;

  try {
    await supa.from("ai_action_cards").insert({
      id: cardId,
      user_id: userId,
      conversation_id: conversationId || null,
      feature: "copilot",
      kind: card.kind,
      summary: card.summary,
      preview: card.preview,
      changes: card.changes,
      sources: card.sources || {},
      notes: card.notes || [],
      status: card.status || "pending",
      stamps: {},
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("Could not insert action card to ai_action_cards:", err);
  }

  return cardId;
}

/**
 * Check if the text contains an embedded ActionCard proposal or parse tool call
 */
export function extractActionCardFromText(text: string): ActionCardPayload | null {
  // Look for ```action_card or ```json action card markers
  const cardMatch = text.match(/```(?:action_card|json:action_card|card)\s*([\s\S]*?)```/i);
  if (cardMatch && cardMatch[1]) {
    try {
      const parsed = JSON.parse(cardMatch[1].trim());
      if (parsed && parsed.kind && parsed.summary && Array.isArray(parsed.changes)) {
        return {
          kind: parsed.kind,
          summary: parsed.summary,
          preview: parsed.preview || { description: parsed.summary },
          changes: parsed.changes,
          sources: parsed.sources || {},
          notes: parsed.notes || [],
          status: "pending",
        };
      }
    } catch {
      // parse error, ignore
    }
  }

  // Heuristic detection: if the teacher asks for quiz/question additions
  // and the assistant generated formatted questions
  if (text.includes("### Action Proposal:") || text.includes("ActionCard:")) {
    const quizMatch = text.match(/Quiz Title:\s*(.*)/i);
    if (quizMatch) {
      return {
        kind: "create_questions",
        summary: `Add questions to ${quizMatch[1].trim()}`,
        preview: { title: quizMatch[1].trim(), count: 5 },
        changes: [
          {
            entity: "questions",
            action: "create_draft",
            data: { prompt: "Auto-generated question draft", type: "multiple_choice" },
          },
        ],
        status: "pending",
      };
    }
  }

  return null;
}

/**
 * Persist teacher conversation message
 */
export async function persistTeacherConversation(params: {
  userId: string;
  conversationId: string;
  assistantMessageId: string;
  content: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
  requestId: string;
  cardId?: string;
}): Promise<void> {
  const supa = await getSupabaseServiceClient();
  if (!supa) return;

  try {
    await supa.from("ai_messages").insert({
      id: params.assistantMessageId,
      conversation_id: params.conversationId,
      role: "assistant",
      content: params.content,
      card_ids: params.cardId ? [params.cardId] : [],
      tokens_in: params.tokensIn,
      tokens_out: params.tokensOut,
      model: params.model,
      request_id: params.requestId,
      flagged: false,
    });
  } catch (e) {
    console.warn("Could not insert to ai_messages:", e);
  }

  try {
    await supa.from("ai_usage_logs").insert({
      user_id: params.userId,
      role: "teacher",
      feature: "copilot",
      model: params.model,
      tokens_in: params.tokensIn,
      tokens_out: params.tokensOut,
      cost_micro: Math.round((params.tokensIn * 0.15 + params.tokensOut * 0.6) * 10),
      status: "ok",
      request_id: params.requestId,
    });
  } catch (e) {
    console.warn("Could not insert to ai_usage_logs:", e);
  }
}

/**
 * Edge Function HTTP handler for /functions/v1/ai-copilot
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

  // Strict Teacher & Admin Authorization Enforcement
  if (userRole !== "teacher" && userRole !== "admin") {
    return new Response(
      JSON.stringify({
        error: {
          code: "forbidden",
          message: "Forbidden: Teacher AI Copilot is exclusively available to authenticated teachers and administrators.",
          requestId,
        },
      }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let body: TeacherCopilotRequest;
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

  const teacherMessage = (body.message || "").trim();
  if (!teacherMessage) {
    return new Response(
      JSON.stringify({
        error: { code: "validation_failed", message: "Message is required", requestId },
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (teacherMessage.length > MAX_COPILOT_MESSAGE_CHARS) {
    return new Response(
      JSON.stringify({
        error: {
          code: "validation_failed",
          message: `Message exceeds maximum allowed length of ${MAX_COPILOT_MESSAGE_CHARS} characters`,
          requestId,
        },
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const conversationId = body.conversation_id || crypto.randomUUID();
  const assistantMessageId = crypto.randomUUID();
  const userMessageId = crypto.randomUUID();

  // Safety pre-check
  const safetyCheck = preCheck(teacherMessage, "B2");
  if (safetyCheck.status === "blocked") {
    const neutral = getNeutralMessage();
    const stream = new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        controller.enqueue(enc.encode(formatSSE("meta", {
          conversation_id: conversationId,
          message_id: assistantMessageId,
          request_id: requestId,
          model_tier: "smart",
        })));
        controller.enqueue(enc.encode(formatSSE("safety", {
          blocked: true,
          message: neutral,
        })));
        controller.enqueue(enc.encode(formatSSE("done", { message_id: assistantMessageId })));
        controller.close();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Request-Id": requestId,
      },
    });
  }

  // System prompt setup
  const baseNova = novaCounselor.system();
  const ws = body.workspace_state || {};
  const context = novaCounselor.buildContext({
    gradeLevel: ws.grade_level || "Grade 8",
    lessonTopic: ws.subject || "English Curriculum",
    unit: ws.course_id ? `Course ${ws.course_id}` : undefined,
  });

  const toolInstructions = `You are equipped with powerful teacher tools:
1. Course Generation & Lesson Structuring
2. Quiz Builder & Question Generation
3. Grading Assistant & Rubric Builder

ACTION CARDS:
Whenever you propose a concrete database modification (such as generating questions, structuring a quiz, adding a lesson draft, or updating curriculum), you MUST generate a structured action card block at the end of your response formatted exactly as follows:
\`\`\`action_card
{
  "kind": "create_questions" | "create_quiz" | "create_lesson" | "create_assignment",
  "summary": "Short 1-line description of the action",
  "preview": {
    "title": "Item title",
    "details": "Explanation of proposed changes"
  },
  "changes": [
    {
      "entity": "questions" | "assessments" | "lessons" | "lesson_blocks",
      "action": "create_draft" | "insert" | "update",
      "data": { ... }
    }
  ]
}
\`\`\`
Before the action card, stream your pedagogical conversational reasoning to the teacher clearly and concisely.`;

  const fullSystemInstruction = `${baseNova}\n\n${context}\n\n${toolInstructions}`;

  // Log user message
  getSupabaseServiceClient().then((supa) => {
    if (supa) {
      supa.from("ai_messages").insert({
        id: userMessageId,
        conversation_id: conversationId,
        role: "user",
        content: safetyCheck.redactedMessage,
        request_id: requestId,
      }).then(() => {});
    }
  }).catch(() => {});

  // Streaming SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // meta event
      controller.enqueue(
        encoder.encode(
          formatSSE("meta", {
            conversation_id: conversationId,
            message_id: assistantMessageId,
            request_id: requestId,
            model_tier: "smart",
          })
        )
      );

      controller.enqueue(
        encoder.encode(
          formatSSE("status", { phase: "thinking" })
        )
      );

      let accumulatedText = "";
      let totalTokensIn = Math.ceil((teacherMessage.length + fullSystemInstruction.length) / 4);
      let totalTokensOut = 0;
      let modelUsed = "gemini-1.5-pro";

      try {
        controller.enqueue(
          encoder.encode(
            formatSSE("status", { phase: "writing" })
          )
        );

        const chunks = defaultAIAdapter.streamCompletion({
          tier: "smart",
          systemInstruction: fullSystemInstruction,
          messages: [{ role: "user", content: safetyCheck.redactedMessage }],
          temperature: 0.5,
          maxTokens: 2000,
          metadata: { feature: "copilot", requestId, userId },
        });

        for await (const chunk of chunks) {
          if (chunk.delta) {
            accumulatedText += chunk.delta;
            controller.enqueue(
              encoder.encode(
                formatSSE("delta", {
                  chunk: chunk.delta,
                  delta: chunk.delta,
                  text: chunk.delta,
                })
              )
            );
          }
          if (chunk.model) modelUsed = chunk.model;
          if (chunk.tokensIn) totalTokensIn = chunk.tokensIn;
          if (chunk.tokensOut) totalTokensOut = chunk.tokensOut;
        }

        if (!totalTokensOut) {
          totalTokensOut = Math.ceil(accumulatedText.length / 4);
        }

        // Post-check for safety
        const post = postCheck(accumulatedText, "B2", true);
        if (post.status === "blocked") {
          controller.enqueue(
            encoder.encode(
              formatSSE("safety", {
                blocked: true,
                message: getNeutralMessage(),
              })
            )
          );
        }

        // Check if Copilot proposed an action card
        let generatedCardId: string | undefined;
        const proposedCard = extractActionCardFromText(accumulatedText);
        if (proposedCard) {
          // Insert into ai_action_cards table with status 'pending'
          generatedCardId = await insertActionCard(userId, conversationId, proposedCard);

          // Emit structured action_card / card event in stream per API contract §1.6 and task spec
          const cardEventPayload = {
            card_id: generatedCardId,
            ...proposedCard,
            status: "pending",
          };

          controller.enqueue(
            encoder.encode(
              formatSSE("action_card", cardEventPayload)
            )
          );
          controller.enqueue(
            encoder.encode(
              formatSSE("card", cardEventPayload)
            )
          );
        }

        // Send usage event
        controller.enqueue(
          encoder.encode(
            formatSSE("usage", {
              tokens_in: totalTokensIn,
              tokens_out: totalTokensOut,
            })
          )
        );

        // Send done event
        controller.enqueue(
          encoder.encode(
            formatSSE("done", { message_id: assistantMessageId })
          )
        );

        // Persist final assistant reply
        await persistTeacherConversation({
          userId,
          conversationId,
          assistantMessageId,
          content: post.status === "blocked" ? getNeutralMessage() : accumulatedText,
          tokensIn: totalTokensIn,
          tokensOut: totalTokensOut,
          model: modelUsed,
          requestId,
          cardId: generatedCardId,
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "Error streaming Copilot response";
        controller.enqueue(
          encoder.encode(
            formatSSE("error", {
              code: "provider_error",
              message: errorMsg,
            })
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Request-Id": requestId,
    },
  });
}

if (typeof Deno !== "undefined" && "serve" in Deno) {
  // @ts-ignore
  Deno.serve(handleRequest);
}
