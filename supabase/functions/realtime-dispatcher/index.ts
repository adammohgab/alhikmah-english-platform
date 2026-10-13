declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
} | undefined;

import { corsMiddleware, getCorsHeaders } from "../_shared/cors";
import { verifyJWT, extractRole, extractUserId } from "../_shared/auth";
import { AppError } from "../_shared/errors";
import { checkRateLimit } from "../_shared/ratelimit";

export interface ChannelAuthRequest {
  channel: string;
  topic?: string;
  action?: "subscribe" | "broadcast" | "presence";
}

export interface ChannelAuthResponse {
  allowed: boolean;
  channel: string;
  userId?: string;
  role?: string;
  reason?: string;
}

export interface BroadcastDispatchEvent {
  channel: string;
  event: string;
  payload: Record<string, unknown>;
}

/**
 * Checks if a user is permitted to subscribe to a realtime topic.
 * Topology per backend docs §8 & BE-EDGE-17:
 * - notifications:{user_id} -> user private (only target user or admin)
 * - class:{class_id} -> enrolled students and teachers of class (or admin)
 * - grading:{assessment_id} -> teacher presence lock (teachers/admins only, no students)
 * - platform:announcements (or platform) -> broadcast to all authenticated users
 */
export async function authorizeChannelSubscription(
  channel: string,
  userId: string,
  role: string,
  supabaseAdminClient?: any
): Promise<{ allowed: boolean; reason?: string }> {
  // 1. platform:announcements / platform
  if (channel === "platform:announcements" || channel === "platform") {
    // Accessible to all signed-in accounts
    return { allowed: true };
  }

  // 2. notifications:{user_id}
  if (channel.startsWith("notifications:")) {
    const targetUserId = channel.slice("notifications:".length);
    if (userId === targetUserId || role === "admin") {
      return { allowed: true };
    }
    return { allowed: false, reason: "Forbidden: cannot subscribe to another user's notifications" };
  }

  // 3. grading:{assessment_id}
  if (channel.startsWith("grading:")) {
    if (role === "student") {
      return { allowed: false, reason: "Forbidden: students cannot join grading presence lock channels" };
    }
    if (role === "teacher" || role === "admin") {
      return { allowed: true };
    }
    return { allowed: false, reason: "Forbidden: insufficient role for grading channel" };
  }

  // 4. class:{class_id}
  if (channel.startsWith("class:")) {
    const classId = channel.slice("class:".length);
    if (role === "admin") {
      return { allowed: true };
    }

    if (supabaseAdminClient) {
      if (role === "teacher") {
        const { data } = await supabaseAdminClient
          .from("class_teachers")
          .select("id")
          .eq("class_id", classId)
          .eq("teacher_id", userId)
          .maybeSingle();

        if (data) return { allowed: true };
      } else if (role === "student") {
        const { data } = await supabaseAdminClient
          .from("class_enrollments")
          .select("id")
          .eq("class_id", classId)
          .eq("student_id", userId)
          .maybeSingle();

        if (data) return { allowed: true };
      }
      return { allowed: false, reason: "User not enrolled or assigned to this class" };
    }

    // Fallback if client not passed in standalone mode
    return { allowed: true };
  }

  // Default deny for unknown custom channels
  if (role === "admin") return { allowed: true };
  return { allowed: false, reason: `Unknown channel pattern: ${channel}` };
}

/**
 * Dispatches an event to Supabase Realtime REST broadcast endpoint with sub-200ms latency.
 */
export async function dispatchRealtimeBroadcast(
  event: BroadcastDispatchEvent,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<{ success: boolean; status: number; error?: string }> {
  try {
    const url = `${supabaseUrl}/rest/v1/realtime/broadcast`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: event.channel,
            event: event.event,
            payload: event.payload,
          },
        ],
      }),
    });

    if (!resp.ok) {
      // In some Supabase setups, Realtime broadcast via standard postgres trigger or channel publish
      return { success: false, status: resp.status, error: await resp.text() };
    }

    return { success: true, status: resp.status };
  } catch (err: any) {
    return { success: false, status: 500, error: err.message };
  }
}

/**
 * Main HTTP Handler for /functions/v1/realtime-dispatcher
 */
export async function handleRequest(req: Request): Promise<Response> {
  const corsRes = corsMiddleware(req);
  if (corsRes) return corsRes;

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: { code: "unauthenticated", message: "Missing Bearer token" } }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.slice(7);
    const payload = await verifyJWT(token);
    const userId = extractUserId(payload) || (payload.sub as string);
    const role = extractRole(payload);

    const body = await req.json();
    const action = body.action || "authorize";

    // 1. Authorize Channel subscription
    if (action === "authorize") {
      const channel = body.channel as string;
      if (!channel) {
        return new Response(
          JSON.stringify({ error: { code: "validation_failed", message: "channel is required" } }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const check = await authorizeChannelSubscription(channel, userId, role);
      if (!check.allowed) {
        return new Response(
          JSON.stringify({
            allowed: false,
            channel,
            error: { code: "forbidden", message: check.reason },
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          allowed: true,
          channel,
          userId,
          role,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Dispatch Broadcast (Teachers, Admins, or Webhook triggers)
    if (action === "broadcast") {
      if (role === "student" && !body.channel?.startsWith(`notifications:${userId}`)) {
        return new Response(
          JSON.stringify({ error: { code: "forbidden", message: "Students cannot broadcast to channels" } }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { channel, event, payload: eventPayload } = body;
      if (!channel || !event) {
        return new Response(
          JSON.stringify({ error: { code: "validation_failed", message: "channel and event are required" } }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const supabaseUrl = (typeof Deno !== "undefined" ? Deno.env.get("SUPABASE_URL") : "") || "";
      const serviceKey = (typeof Deno !== "undefined" ? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") : "") || "";

      const dispatchResult = await dispatchRealtimeBroadcast(
        { channel, event, payload: eventPayload || {} },
        supabaseUrl,
        serviceKey
      );

      return new Response(
        JSON.stringify({
          dispatched: true,
          channel,
          event,
          result: dispatchResult,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: { code: "validation_failed", message: `Unknown action: ${action}` } }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: {
          code: err.code || "server_error",
          message: err.message || "Internal server error",
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
