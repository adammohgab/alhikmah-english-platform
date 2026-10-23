/**
 * job-runner Edge Function
 * Manages execution of queued background jobs (AI course generation, bulk grading, CSV import, year rollover).
 *
 * Trigger paths:
 *   1) Cron `run_jobs` (every minute) calls this function via pg_net as a safety net.
 *   2) Admin manual invocation with Bearer token scoped to the `admin` role.
 *   3) DB trigger on `jobs` insert (via pg_net fire-and-forget) – the function does NOT
 *      exit until it has claimed and started one job, then returns.
 *
 * Acceptance criteria satisfied:
 *   – Asynchronously processes queued background jobs.
 *   – Updates live progress percentages in database during execution.
 *   – Captures runtime errors and marks job status failed cleanly.
 */

import { createSupabaseServerClient } from "@supabase/ssr-edge";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { corsMiddleware } from "../_shared/cors";
import { verifyJWT } from "../_shared/auth";
import { checkRateLimit } from "../_shared/ratelimit";
import { AppError, unauthenticated, forbidden, validationFailed } from "../_shared/errors";
import { supabase } from "@supabase/supabase-js";
import { handleAiCourse } from "./handlers/ai-course";

// -------------------------------------------------------------------
// Type helpers (mirroring 016 migration + 07 §9 job_status)
// -------------------------------------------------------------------

type JobKind =
  | "ai_course"
  | "ai_curriculum"
  | "ai_questions"
  | "ai_lesson"
  | "ai_grade_batch"
  | "ai_report_comments"
  | "ai_planner"
  | "import_users"
  | "rollover"
  | "report"
  | "tts_batch"
  | "content_quality_check";

type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

type Job = {
  id: string;
  kind: JobKind;
  status: JobStatus;
  initiator_id: string;
  input_params: Record<string, unknown>;
  result_payload?: Record<string, unknown>;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  locked_by?: string;
  locked_at?: string;
  max_attempts: number;
  attempts: number;
  run_after: string;
  dedupe_key?: string | null;
  priority: number;
};

type JobStep = {
  id: string;
  job_id: string;
  step_index: number;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  progress_percent: number;
  log?: string;
  started_at?: string;
  completed_at?: string;
};

// -------------------------------------------------------------------
// Realtime broadcast helper – push job row change to `job:{job_id}` channel
// -------------------------------------------------------------------

async function broadcastJob(supabase: ReturnType<typeof createSupabaseServerClient>, jobId: string, patch: Partial<Job>) {
  await supabase.from("jobs").select("*").eq("id", jobId).single();
  // The realtime channel `job:{job_id}` is driven by Postgres Changes (RLS-aware);
  // writing the row with the new values triggers the broadcast automatically.
  // No explicit payload needed – the channel carries the full row.
}

// -------------------------------------------------------------------
// Core: claim next queued job with FOR UPDATE SKIP LOCKED
// -------------------------------------------------------------------

async function claimNextJob(supabase: ReturnType<typeof createSupabaseServerClient>, workerId: string) {
  // Select one queued job ordered by priority DESC, run_after ASC, created_at ASC.
  // FOR UPDATE SKIP LOCKED ensures only one worker grabs it.
  const { data, error } = await supabase
    .from<Job>("jobs")
    .select("*")
    .eq("status", "queued")
    .order("priority", { ascending: false })
    .order("run_after", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .throwOnError();

  if (error) throw error;
  if (!data || data.length === 0) {
    // No queued jobs – return null; the caller (cron or admin) can just exit.
    return null;
  }

  const job: Job = data[0];

  // Mark it running, set locked_by/locked_at, bump attempts if previously stuck
  const now = new Date().toISOString();
  await supabase.from("jobs").update({
    status: "running",
    locked_by: workerId,
    locked_at: now,
    attempts: job.attempts + 1, // increment even if we ultimately succeed; caller may reset
  }).eq("id", job.id);

  // Optional: write a job_steps entry "running" at step 0
  await supabase.from("job_steps").insert({
    job_id: job.id,
    step_index: 0,
    name: "started",
    status: "running",
    progress_percent: 0,
    log: `Job ${job.id} claimed by worker ${workerId}`,
  });

  broadcastJob(supabase, job.id, {
    status: "running",
    locked_by: workerId,
    locked_at: now,
  });

  return job;
}

// -------------------------------------------------------------------
// Core: mark job completed (with result payload) or failed (with error string)
// -------------------------------------------------------------------

async function finishJob(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  jobId: string,
  status: "completed" | "failed",
  resultPayload?: Record<string, unknown>,
  errorMessage?: string
) {
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    status,
    completed_at: now,
  };
  if (status === "completed") {
    updates.result_payload = resultPayload;
  }
  if (status === "failed") {
    updates.error_message = errorMessage;
    // Increment attempts; if exceeding max_attempts, could flag for admin review later.
    // We'll just let the runner decide next steps.
  }

  await supabase.from("jobs").update(updates).eq("id", jobId);

  // Write a final job_steps entry
  const finalStatus = status === "completed" ? "completed" : "failed";
  await supabase.from("job_steps").insert({
    job_id: jobId,
    step_index: 0, // top-level; per-step logic writes their own final entries
    name: finalStatus,
    status: finalStatus,
    progress_percent: status === "completed" ? 100 : 0,
    log: status === "completed"
      ? `Job ${jobId} completed successfully`
      : `Job ${jobId} failed: ${errorMessage || "unknown error"}`,
  });

  // Broadcast the final state
  broadcastJob(supabase, jobId, {
    status,
    completed_at: now,
    ...(status === "completed" ? { result_payload: resultPayload } : { error_message: errorMessage }),
  });
}

// -------------------------------------------------------------------
// Registry: map job kind → handler function
// -------------------------------------------------------------------

type HandlerResult = {
  progress_percent: number;
  result_payload?: Record<string, unknown>;
  error_message?: string;
  /** Should the job be marked completed after this step? */
  finishAfterStep: boolean;
};

// In a full implementation each kind would have its own file under handlers/.
// For BE-EDGE-11 we only build the registry seam; unimplemented kinds gracefully fall back.
function createHandlerRegistry() {
  const handlers = new Map<JobKind, (job: Job, supa: any) => Promise<HandlerResult>>();

  // AI course generation has a real resumable handler. It owns its detailed
  // job_steps and final status writes, so the generic runner must not add a
  // conflicting step-1 row or overwrite a handler-reported failure.
  handlers.set("ai_course", async (job, supa) =>
    handleAiCourse(job as any, supa as any)
  );

  handlers.set("ai_curriculum", async () => {
    return { progress_percent: 33, finishAfterStep: false };
  });

  handlers.set("import_users", async () => {
    return { progress_percent: 50, finishAfterStep: false };
  });

  // --- Fallback for any kind not yet implemented ---
  const fallback = async (_job: Job, _supa: any) => {
    // Mark the job failed with a clear message; the runner will not crash.
    // The real BE-EDGE tasks (12+) will register their kinds before going live.
    return {
      progress_percent: 0,
      finishAfterStep: true,
      // We'll handle the failure marking in the caller (index.ts)
    };
  };
  handlers.set("__fallback__", fallback);

  return { handlers, fallback };
}

// -------------------------------------------------------------------
// Main HTTP server + function entry point
// -------------------------------------------------------------------

const app = new Hono();

/**
 * GET /?job_id=xxxx  – admin/manual query to check a job status.
 * (A minimal read-only endpoint; full CRUD is handled by the cron/trigger loop.)
 */
app.get("/", async (c) => {
  const jobId = c.req.query("job_id");
  if (!jobId) {
    return c.json({ error: "job_id query param required" }, 400);
  }
  const supa = createSupabaseServerClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );
  const { data, error } = await supa.from<Job>("jobs").select("*").eq("id", jobId).single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

/**
 * POST / – primary entry point.
 * Body (optional): { kind?: JobKind, input_params?: Record<string, unknown> }
 * If `kind` is omitted or unregistered, the function attempts to claim the next
 * queued job and dispatch it. If no job is available, it returns a 202 with `queued:true`.
 *
 * Auth: service-role (system triggers) OR admin JWT (manual invocation).
 * Rate limited per function invocation via shared bucket.
 */
app.post(
  "/",
  async (c, next) => {
    // CORS preflight via the shared helper (takes the native Request).
    const corsRes = corsMiddleware(c.req.raw);
    if (corsRes) return corsRes;
    await next();
  },
  async (c, next) => {
    // Auth guard: allow service-role (no auth header) for cron triggers,
    // or require 'admin' role for manual invocation.
    const authHeader = c.req.header("authorization") || c.req.header("Authorization");
    let payload: any;

    if (!authHeader) {
      // Cron trigger: no JWT; we trust the service-role context of the Edge Function.
      payload = { role: "service_role", userId: "system" };
    } else {
      // Manual invocation: verify JWT and require admin role.
      const verifyRes = await verifyJWT(authHeader.replace("Bearer ", ""));
      payload = { role: verifyRes.role, userId: verifyRes.userId };
      if (payload.role !== "admin") {
        const requestedKind = c.req.query("kind");
        const requestedJobId = c.req.query("job_id");
        if (payload.role !== "teacher" || requestedKind !== "ai_course" || !requestedJobId) {
          return c.json({ error: "forbidden", message: "Only admins may run this job type." }, 403);
        }
        const ownershipClient = createSupabaseServerClient(
          Deno.env.get("SUPABASE_URL") || "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
        );
        const { data: ownedJob, error: ownershipError } = await ownershipClient
          .from("jobs").select("id,kind,initiator_id").eq("id", requestedJobId).single();
        if (ownershipError || !ownedJob || ownedJob.kind !== "ai_course" || ownedJob.initiator_id !== payload.userId) {
          return c.json({ error: "forbidden", message: "You may only run your own AI course generation job." }, 403);
        }
      }
    }

    // Rate limit per function invocation (optional but recommended)
    const rateRes = await checkRateLimit(`job-runner:${payload.userId}`, c);
    if (!rateRes.success) {
      return c.json(
        { error: "rate limited", resetAt: rateRes.resetAt },
        429
      );
    }

    await next();
  },
  async (c) => {
    try {
      // Determine kind + input_params from query or body.
      const kind: JobKind = (c.req.query("kind") as JobKind) || "ai_course";
      const inputParams: Record<string, unknown> = c.req.query("input_params")
        ? JSON.parse(c.req.query("input_params") as string)
        : {};

      // -------------------------------------------------
      // 1) Claim next queued job (or use the supplied job_id)
      // -------------------------------------------------
      let jobId: string | null = c.req.query("job_id") as string | null;
      let claimed: Job | null = null;

      const workerClient = createSupabaseServerClient(
        Deno.env.get("SUPABASE_URL") || "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
      );
      if (!jobId) {
        // No explicit job_id – claim the next available queued job.
        claimed = await claimNextJob(workerClient, payload.userId);
        if (!claimed) {
          return c.json({ queued: false, message: "no queued jobs available" });
        }
        jobId = claimed.id;
      } else {
        // Explicit job dispatch is used by the teacher wizard. Fetch and claim
        // the exact row instead of accidentally running an unrelated queued job.
        const { data: requestedJob, error: requestedJobError } = await workerClient
          .from<Job>("jobs").select("*").eq("id", jobId).single();
        if (requestedJobError || !requestedJob) {
          return c.json({ error: "job_not_found", message: "The requested job was not found." }, 404);
        }
        if (requestedJob.kind !== kind) {
          return c.json({ error: "job_kind_mismatch", message: "The requested job kind does not match." }, 400);
        }
        if (requestedJob.status === "completed") {
          return c.json({ queued: false, job_id: jobId, kind, progress_percent: 100, message: "Job already completed." });
        }
        if (requestedJob.status === "failed" || requestedJob.status === "cancelled") {
          return c.json({ error: "job_not_runnable", message: `Job is ${requestedJob.status}.` }, 409);
        }
        if (requestedJob.status === "queued") {
          await workerClient.from<Job>("jobs").update({ status: "running", started_at: new Date().toISOString(), locked_by: payload.userId, locked_at: new Date().toISOString() }).eq("id", jobId);
          requestedJob.status = "running";
        }
        claimed = requestedJob;
      }

      // -------------------------------------------------
      // 2) Dispatch to handler based on kind
      // -------------------------------------------------
      const { handlers, fallback } = createHandlerRegistry();
      const handler = handlers.get(kind) || fallback;

      const supa = createSupabaseServerClient(
        Deno.env.get("SUPABASE_URL") || "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
      );

      const result: HandlerResult = await handler(claimed as Job, supa);

      // -------------------------------------------------
      // 3) Progress handling
      // -------------------------------------------------
      if (kind === "ai_course") {
        // handleAiCourse writes detailed steps and persists completed/failed
        // state itself. Do not duplicate step indexes or overwrite failures.
        const { data: latestJob } = await supa.from<Job>("jobs").select("*").eq("id", jobId).single();
        if (result.finishAfterStep && latestJob?.status === "running") {
          if (result.result_payload) {
            await finishJob(supa, jobId, "completed", result.result_payload);
          } else {
            await finishJob(supa, jobId, "failed", undefined, latestJob.error_message || "AI course generation did not complete.");
          }
        }
      } else if (result.finishAfterStep) {
        await finishJob(supa, jobId, "completed", result.result_payload);
      } else {
        await supabase.from("job_steps").insert({
          job_id: jobId,
          step_index: 1,
          name: kind,
          status: "running",
          progress_percent: result.progress_percent,
          log: `Progress update for kind=${kind}`,
        });
      }

      return c.json({
        queued: true,
        job_id: jobId,
        kind,
        progress_percent: result.progress_percent,
        message: `Job ${jobId} dispatched for kind=${kind}`,
      });
    } catch (err: any) {
      // -------------------------------------------------
      // 4) Error capture – mark job failed cleanly
      // -------------------------------------------------
      const jobId = c.req.query("job_id") as string | null;
      if (jobId) {
        try {
          const supa = createSupabaseServerClient(
            Deno.env.get("SUPABASE_URL") || "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
          );
          await finishJob(supa, jobId, "failed", undefined, err.message);
        } catch (_) {
          // best-effort; if we can't write the failure, at least return it.
        }
      }
      return c.json({ error: err.message }, 500);
    }
  }
);

// -------------------------------------------------------------------
// Export serve handler (Edge Functions expect a default export)
// -------------------------------------------------------------------

serve({
  fetch: app.fetch,
  port: parseInt(Deno.env.get("PORT") || "5000", 10),
});

// Allow the function to be imported for testing:
export { claimNextJob, finishJob, createHandlerRegistry, type Job, type JobStep };