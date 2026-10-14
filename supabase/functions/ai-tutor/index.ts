declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
} | undefined;

import { corsMiddleware, getCorsHeaders } from "../_shared/cors";
import { verifyJWT, extractRole } from "../_shared/auth";
import { preCheck, postCheck, getNeutralMessage } from "../_shared/ai/safety";
import { defaultAIAdapter } from "../_shared/ai/adapter";
import { pipTutor } from "../_shared/ai/prompts";

export interface TutorChatRequest {
  conversation_id?: string;
  message: string;
  lesson_context?: {
    lesson_id?: string;
    lesson_title?: string;
    grade_level?: string;
    topic?: string;
    previous_mistakes?: Array<{ pattern: string; count: number }>;
  };
  attachments?: Array<{ type: "lesson" | "word" | "text"; id?: string; text?: string }>;
}

export interface StreamMetaPayload {
  conversation_id: string;
  message_id: string;
  request_id: string;
  model_tier: "fast" | "smart";
}

export interface StreamStatusPayload {
  phase: "checking" | "thinking" | "writing";
}

export interface StreamChunkPayload {
  chunk: string;
  delta?: string;
}

export interface StreamSafetyPayload {
  blocked: boolean;
  message: string;
}

export interface StreamUsagePayload {
  tokens_in: number;
  tokens_out: number;
}

export interface StreamDonePayload {
  message_id: string;
}

export interface StreamErrorPayload {
  code: string;
  message: string;
}

/** Max student message length per conversation turns */
export const MAX_TUTOR_MESSAGE_CHARS = 1000;
/** Daily quota floor per student */
export const DEFAULT_STUDENT_DAILY_LIMIT = 50;

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
 * Check if the student has exceeded their daily message limit.
 * Uses ai_limit_counters or fallback rate limits table.
 */
export async function checkStudentQuota(
  userId: string,
  todayDateStr: string = new Date().toISOString().slice(0, 10)
): Promise<{ allowed: boolean; count: number; limit: number }> {
  const supa = await getSupabaseServiceClient();
  const limit = Number(
    (typeof Deno !== "undefined" ? Deno.env.get("STUDENT_DAILY_AI_LIMIT") : "") ||
      DEFAULT_STUDENT_DAILY_LIMIT
  );

  if (!supa) {
    return { allowed: true, count: 0, limit };
  }

  const period = `day:${todayDateStr}`;

  try {
    const { data, error } = await supa
      .from("ai_limit_counters")
      .select("count")
      .eq("user_id", userId)
      .eq("feature", "tutor")
      .eq("period", period)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      // Table might not exist or network error: fail open safely with cap
      return { allowed: true, count: 0, limit };
    }

    const currentCount = Number(data?.count || 0);
    if (currentCount >= limit) {
      return { allowed: false, count: currentCount, limit };
    }

    return { allowed: true, count: currentCount, limit };
  } catch {
    return { allowed: true, count: 0, limit };
  }
}

/**
 * Increment student daily quota counter after message processing
 */
export async function incrementStudentQuota(
  userId: string,
  tokensIn: number,
  tokensOut: number,
  todayDateStr: string = new Date().toISOString().slice(0, 10)
): Promise<void> {
  const supa = await getSupabaseServiceClient();
  if (!supa) return;

  const period = `day:${todayDateStr}`;

  try {
    // Attempt upsert on ai_limit_counters
    const { data: existing } = await supa
      .from("ai_limit_counters")
      .select("count, tokens")
      .eq("user_id", userId)
      .eq("feature", "tutor")
      .eq("period", period)
      .maybeSingle();

    const newCount = (existing?.count || 0) + 1;
    const newTokens = (Number(existing?.tokens) || 0) + tokensIn + tokensOut;

    await supa.from("ai_limit_counters").upsert({
      user_id: userId,
      feature: "tutor",
      period,
      count: newCount,
      tokens: newTokens,
    });
  } catch {
    // Non-fatal
  }
}

/**
 * Persists the final assistant message and writes to ai_usage_logs
 */
export async function persistConversationAndUsage(params: {
  userId: string;
  role: string;
  conversationId: string;
  assistantMessageId: string;
  content: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
  requestId: string;
  cancelled?: boolean;
}): Promise<void> {
  const supa = await getSupabaseServiceClient();
  if (!supa) return;

  try {
    // 1. Write assistant reply to ai_messages
    await supa.from("ai_messages").insert({
      id: params.assistantMessageId,
      conversation_id: params.conversationId,
      role: "assistant",
      content: params.content,
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
    // 2. Write to ai_usage_logs / ai_usage
    await supa.from("ai_usage_logs").insert({
      user_id: params.userId,
      role: params.role,
      feature: "tutor",
      model: params.model,
      tokens_in: params.tokensIn,
      tokens_out: params.tokensOut,
      cost_micro: Math.round((params.tokensIn * 0.15 + params.tokensOut * 0.6) * 10),
      status: params.cancelled ? "cancelled" : "ok",
      request_id: params.requestId,
    });
  } catch (e) {
    console.warn("Could not insert to ai_usage_logs:", e);
  }
}

/**
 * Edge Function HTTP handler for /functions/v1/ai-tutor
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

  let body: TutorChatRequest;
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

  const userQuery = (body.message || "").trim();
  if (!userQuery) {
    return new Response(
      JSON.stringify({
        error: { code: "validation_failed", message: "Message is required", requestId },
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (userQuery.length > MAX_TUTOR_MESSAGE_CHARS) {
    return new Response(
      JSON.stringify({
        error: {
          code: "validation_failed",
          message: `Message exceeds maximum allowed length of ${MAX_TUTOR_MESSAGE_CHARS} characters`,
          requestId,
        },
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check student daily AI message limit; return 429 if quota exceeded
  const quotaCheck = await checkStudentQuota(userId);
  if (!quotaCheck.allowed) {
    return new Response(
      JSON.stringify({
        error: {
          code: "limit_reached",
          message: `Daily message quota exceeded (${quotaCheck.count}/${quotaCheck.limit}). Please try again tomorrow.`,
          requestId,
          details: { limit: quotaCheck.limit, used: quotaCheck.count },
        },
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": "86400",
        },
      }
    );
  }

  const conversationId = body.conversation_id || crypto.randomUUID();
  const assistantMessageId = crypto.randomUUID();
  const userMessageId = crypto.randomUUID();

  // Safety pre-check
  const gradeLevel = body.lesson_context?.grade_level || "B1";
  const preCheckResult = preCheck(userQuery, gradeLevel as any);

  // If safety blocked, return immediately with safety event or neutral response
  if (preCheckResult.status === "blocked") {
    const neutralMsg = getNeutralMessage();

    // SSE streaming format even for blocked responses per API contract §1.6
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            formatSSE("meta", {
              conversation_id: conversationId,
              message_id: assistantMessageId,
              request_id: requestId,
              model_tier: "fast",
            })
          )
        );
        controller.enqueue(
          new TextEncoder().encode(
            formatSSE("status", { phase: "checking" })
          )
        );
        controller.enqueue(
          new TextEncoder().encode(
            formatSSE("safety", {
              blocked: true,
              message: neutralMsg,
            })
          )
        );
        controller.enqueue(
          new TextEncoder().encode(
            formatSSE("done", { message_id: assistantMessageId })
          )
        );
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

  // Assemble Pip tutor prompt
  const baseSystemPrompt = pipTutor.system();
  const contextPrompt = pipTutor.buildContext({
    gradeLevel,
    lessonTopic: body.lesson_context?.topic || body.lesson_context?.lesson_title || "General English",
    previousMistakes: body.lesson_context?.previous_mistakes,
  });
  const fullSystemInstruction = `${baseSystemPrompt}\n\n${contextPrompt}`;

  // Log user message to ai_messages in background
  getSupabaseServiceClient().then((supa) => {
    if (supa) {
      supa.from("ai_messages").insert({
        id: userMessageId,
        conversation_id: conversationId,
        role: "user",
        content: preCheckResult.redactedMessage,
        request_id: requestId,
      }).then(() => {});
    }
  }).catch(() => {});

  // Create SSE ReadableStream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Emit initial meta event (<500ms initial latency)
      controller.enqueue(
        encoder.encode(
          formatSSE("meta", {
            conversation_id: conversationId,
            message_id: assistantMessageId,
            request_id: requestId,
            model_tier: "fast",
          })
        )
      );

      controller.enqueue(
        encoder.encode(
          formatSSE("status", { phase: "thinking" })
        )
      );

      let accumulatedText = "";
      let totalTokensIn = Math.ceil((userQuery.length + fullSystemInstruction.length) / 4);
      let totalTokensOut = 0;
      let modelUsed = "gemini-1.5-flash";

      try {
        controller.enqueue(
          encoder.encode(
            formatSSE("status", { phase: "writing" })
          )
        );

        const chunks = defaultAIAdapter.streamCompletion({
          tier: "fast",
          systemInstruction: fullSystemInstruction,
          messages: [{ role: "user", content: preCheckResult.redactedMessage }],
          temperature: 0.6,
          maxTokens: 500,
          metadata: { feature: "tutor", requestId, userId },
        });

        for await (const chunk of chunks) {
          if (chunk.delta) {
            accumulatedText += chunk.delta;
            // SSE event format per API contract §1.6 and task spec:
            // "data: { chunk: '...' }" along with event: delta
            const eventPayload = {
              chunk: chunk.delta,
              delta: chunk.delta,
            };
            controller.enqueue(
              encoder.encode(
                formatSSE("delta", eventPayload)
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
        const post = postCheck(accumulatedText, gradeLevel as any, true);
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

        // Persist final conversation message and token counts
        await persistConversationAndUsage({
          userId,
          role: userRole,
          conversationId,
          assistantMessageId,
          content: post.status === "blocked" ? getNeutralMessage() : accumulatedText,
          tokensIn: totalTokensIn,
          tokensOut: totalTokensOut,
          model: modelUsed,
          requestId,
        });

        // Increment student daily quota
        await incrementStudentQuota(userId, totalTokensIn, totalTokensOut);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "Error streaming response";
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
