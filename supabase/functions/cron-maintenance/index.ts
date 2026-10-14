declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
} | undefined;

import { corsMiddleware, getCorsHeaders } from "../_shared/cors";
import { verifyJWT, extractRole } from "../_shared/auth";

export type CronJobType = "all" | "midnight_rollover" | "auto_submit_quizzes" | "weekly_cleanup";

export interface CronRequest {
  job?: CronJobType;
  dry_run?: boolean;
  school_date?: string; // Optional override for testing
}

export interface CronJobExecutionResult {
  job: string;
  success: boolean;
  duration_ms: number;
  details: Record<string, unknown>;
  error?: string;
}

export interface CronResponse {
  ok: boolean;
  triggered_at: string;
  results: CronJobExecutionResult[];
}

/**
 * Helper to get a Supabase Service Client
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
 * Log job execution status and duration in scheduler_state
 * Creates table if not yet present in database.
 */
export async function logSchedulerState(
  supa: any,
  key: string,
  lastPeriod: string,
  durationMs: number,
  status: "success" | "failed" | "skipped",
  details: Record<string, unknown>
): Promise<void> {
  if (!supa) return;

  try {
    // Upsert into scheduler_state
    const { error } = await supa.from("scheduler_state").upsert({
      key,
      last_period: lastPeriod,
      last_run_at: new Date().toISOString(),
      duration_ms: durationMs,
      status,
      details,
    });

    if (error && error.code === "42P01") {
      // Table doesn't exist; create via rpc or log warning
      console.warn("scheduler_state table does not exist yet.");
    }
  } catch (err) {
    console.warn("Could not write to scheduler_state:", err);
  }
}

/**
 * Fetch the configured school timezone, default to Africa/Tripoli (Libya) or UTC.
 */
export async function getSchoolTimezone(supa: any): Promise<string> {
  if (!supa) return "Africa/Tripoli";

  try {
    const { data } = await supa
      .from("platform_settings")
      .select("value")
      .eq("key", "region")
      .maybeSingle();

    if (data?.value?.timezone) {
      return data.value.timezone;
    }
  } catch {
    // fallback
  }

  return "Africa/Tripoli";
}

/**
 * Get current date in given timezone (YYYY-MM-DD)
 */
export function getDateInTimezone(timeZone: string = "Africa/Tripoli"): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Job 1: Midnight Streak Updates & Daily Quests Rollover
 * - Evaluates inactive students
 * - Consumes streak freezes or resets streaks to 0
 * - Generates fresh daily quests for active students
 * - Idempotent via scheduler_state(day_rollover, school_date)
 */
export async function runMidnightRollover(
  supa: any,
  overrideDate?: string
): Promise<CronJobExecutionResult> {
  const start = Date.now();
  if (!supa) {
    return {
      job: "midnight_rollover",
      success: false,
      duration_ms: Date.now() - start,
      details: {},
      error: "Supabase service client unavailable",
    };
  }

  const timezone = await getSchoolTimezone(supa);
  const todayStr = overrideDate || getDateInTimezone(timezone);

  // 1. Idempotency check with scheduler_state
  try {
    const { data: state } = await supa
      .from("scheduler_state")
      .select("last_period, status")
      .eq("key", "day_rollover")
      .maybeSingle();

    if (state && state.last_period === todayStr && state.status === "success") {
      return {
        job: "midnight_rollover",
        success: true,
        duration_ms: Date.now() - start,
        details: { skipped: true, reason: `Day rollover already executed for ${todayStr}` },
      };
    }
  } catch {
    // Proceed if scheduler_state check fails
  }

  let streaksEvaluated = 0;
  let freezesConsumed = 0;
  let streaksReset = 0;
  let questsGenerated = 0;

  try {
    // Calculate yesterday's date in school timezone
    const todayDate = new Date(`${todayStr}T00:00:00Z`);
    const yesterdayDate = new Date(todayDate.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

    // 2. Fetch all active student stats whose streak > 0
    const { data: statsList, error: statsErr } = await supa
      .from("student_stats")
      .select("student_id, current_streak, longest_streak, streak_freeze_count, last_active_date")
      .gt("current_streak", 0);

    if (statsErr) {
      throw new Error(`Failed to load student stats: ${statsErr.message}`);
    }

    if (statsList && statsList.length > 0) {
      for (const st of statsList) {
        streaksEvaluated++;
        const lastActive = st.last_active_date;

        // If student was active yesterday or today, their streak is safe
        if (lastActive === yesterdayStr || lastActive === todayStr) {
          continue;
        }

        // Student was inactive: check if they have streak freeze count available
        if (st.streak_freeze_count > 0) {
          freezesConsumed++;
          // Consume a freeze
          await supa
            .from("student_stats")
            .update({
              streak_freeze_count: st.streak_freeze_count - 1,
              updated_at: new Date().toISOString(),
            })
            .eq("student_id", st.student_id);

          // Insert or update frozen day in streak_days
          await supa
            .from("streak_days")
            .upsert({
              student_id: st.student_id,
              activity_date: yesterdayStr,
              xp_earned: 0,
              is_frozen: true,
            }, { onConflict: "student_id,activity_date" });
        } else {
          // No freeze available: reset streak to 0
          streaksReset++;
          await supa
            .from("student_stats")
            .update({
              current_streak: 0,
              updated_at: new Date().toISOString(),
            })
            .eq("student_id", st.student_id);
        }
      }
    }

    // 3. Generate fresh daily quests
    // Fetch active daily quest templates
    const { data: templates } = await supa
      .from("quest_templates")
      .select("id, title, quest_type")
      .eq("quest_type", "daily")
      .eq("is_active", true)
      .limit(3);

    if (templates && templates.length > 0) {
      // Fetch active students
      const { data: activeStudents } = await supa
        .from("profiles")
        .select("id")
        .eq("role", "student")
        .eq("status", "active")
        .limit(500);

      const expiresAt = new Date(`${todayStr}T23:59:59Z`).toISOString();

      if (activeStudents) {
        for (const student of activeStudents) {
          for (const tmpl of templates) {
            const { error: insErr } = await supa
              .from("quest_instances")
              .upsert({
                student_id: student.id,
                quest_template_id: tmpl.id,
                current_count: 0,
                is_completed: false,
                is_claimed: false,
                expires_at: expiresAt,
              }, { onConflict: "student_id,quest_template_id" });

            if (!insErr) questsGenerated++;
          }
        }
      }
    }

    const duration = Date.now() - start;
    const details = {
      school_date: todayStr,
      timezone,
      streaks_evaluated: streaksEvaluated,
      freezes_consumed: freezesConsumed,
      streaks_reset: streaksReset,
      quests_generated: questsGenerated,
    };

    await logSchedulerState(supa, "day_rollover", todayStr, duration, "success", details);

    return {
      job: "midnight_rollover",
      success: true,
      duration_ms: duration,
      details,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const duration = Date.now() - start;
    await logSchedulerState(supa, "day_rollover", todayStr, duration, "failed", { error: errorMsg });

    return {
      job: "midnight_rollover",
      success: false,
      duration_ms: duration,
      details: {},
      error: errorMsg,
    };
  }
}

/**
 * Job 2: Auto-submit Expired Quiz Attempts (Every 5 minutes)
 * - Scans assessment_attempts where expires_at < app_now() and status = 'in_progress'
 * - Invokes or replicates submit_quiz_attempt logic with automatic scoring
 * - Sets status = 'auto_submitted' / 'submitted'
 */
export async function runAutoSubmitQuizzes(supa: any): Promise<CronJobExecutionResult> {
  const start = Date.now();
  if (!supa) {
    return {
      job: "auto_submit_quizzes",
      success: false,
      duration_ms: Date.now() - start,
      details: {},
      error: "Supabase service client unavailable",
    };
  }

  const nowIso = new Date().toISOString();
  let scannedCount = 0;
  let autoSubmittedCount = 0;
  const processedAttempts: string[] = [];

  try {
    // 1. Scan for expired in_progress attempts
    const { data: expiredAttempts, error: fetchErr } = await supa
      .from("assessment_attempts")
      .select("id, assessment_id, student_id, question_order, expires_at")
      .eq("status", "in_progress")
      .lt("expires_at", nowIso)
      .limit(100);

    if (fetchErr) {
      throw new Error(`Failed to query expired quiz attempts: ${fetchErr.message}`);
    }

    if (expiredAttempts && expiredAttempts.length > 0) {
      scannedCount = expiredAttempts.length;

      for (const attempt of expiredAttempts) {
        try {
          // Attempt calling RPC submit_quiz_attempt if supported by database
          const { error: rpcErr } = await supa.rpc("submit_quiz_attempt", {
            attempt_id: attempt.id,
          });

          if (!rpcErr) {
            // Also ensure status reflects auto_submitted if permissible
            await supa
              .from("assessment_attempts")
              .update({
                status: "auto_submitted",
                submitted_at: nowIso,
              })
              .eq("id", attempt.id)
              .in("status", ["in_progress", "submitted"]);

            autoSubmittedCount++;
            processedAttempts.push(attempt.id);
            continue;
          }

          // Fallback: Grade recorded answers directly if RPC raised authentication/service guard
          let totalScore = 0;
          let maxScore = 0;

          // Fetch questions and answers
          const questionIds = Array.isArray(attempt.question_order)
            ? attempt.question_order
            : [];

          if (questionIds.length > 0) {
            const { data: questions } = await supa
              .from("questions")
              .select("id, points, correct_answer")
              .in("id", questionIds);

            const { data: answers } = await supa
              .from("attempt_answers")
              .select("question_id, answer")
              .eq("attempt_id", attempt.id);

            const answerMap = new Map((answers || []).map((a: any) => [a.question_id, a.answer]));

            for (const q of questions || []) {
              const qPoints = Number(q.points || 1);
              maxScore += qPoints;
              const given = answerMap.get(q.id);

              if (given && q.correct_answer) {
                // Quick multiple choice check
                const correct = JSON.stringify(q.correct_answer.correct || q.correct_answer);
                const givenObj = typeof given === "object" && given !== null ? (given as Record<string, unknown>) : null;
                const answered = JSON.stringify(givenObj ? (givenObj.selected || givenObj.answer || given) : given);
                if (correct === answered) {
                  totalScore += qPoints;
                  await supa
                    .from("attempt_answers")
                    .update({ is_correct: true, points_awarded: qPoints })
                    .eq("attempt_id", attempt.id)
                    .eq("question_id", q.id);
                } else {
                  await supa
                    .from("attempt_answers")
                    .update({ is_correct: false, points_awarded: 0 })
                    .eq("attempt_id", attempt.id)
                    .eq("question_id", q.id);
                }
              }
            }
          }

          // Update attempt row to auto_submitted
          await supa
            .from("assessment_attempts")
            .update({
              status: "auto_submitted",
              submitted_at: nowIso,
              score: totalScore,
              max_score: maxScore > 0 ? maxScore : 100,
            })
            .eq("id", attempt.id);

          autoSubmittedCount++;
          processedAttempts.push(attempt.id);
        } catch (innerErr) {
          console.warn(`Error auto-submitting attempt ${attempt.id}:`, innerErr);
        }
      }
    }

    const duration = Date.now() - start;
    const details = {
      scanned_count: scannedCount,
      auto_submitted_count: autoSubmittedCount,
      attempt_ids: processedAttempts,
    };

    await logSchedulerState(
      supa,
      "autosubmit_expired_attempts",
      nowIso.slice(0, 16), // YYYY-MM-DDTHH:mm
      duration,
      "success",
      details
    );

    return {
      job: "auto_submit_quizzes",
      success: true,
      duration_ms: duration,
      details,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const duration = Date.now() - start;
    await logSchedulerState(
      supa,
      "autosubmit_expired_attempts",
      nowIso.slice(0, 16),
      duration,
      "failed",
      { error: errorMsg }
    );

    return {
      job: "auto_submit_quizzes",
      success: false,
      duration_ms: duration,
      details: {},
      error: errorMsg,
    };
  }
}

/**
 * Job 3: Weekly Cleanup & Maintenance
 * - Refreshes materialized views (if defined)
 * - Prunes expired upload tokens and temporary files
 * - Cleans up old idempotency keys older than 7 days
 * - Archives finished jobs older than 7 days
 */
export async function runWeeklyCleanup(supa: any): Promise<CronJobExecutionResult> {
  const start = Date.now();
  if (!supa) {
    return {
      job: "weekly_cleanup",
      success: false,
      duration_ms: Date.now() - start,
      details: {},
      error: "Supabase service client unavailable",
    };
  }

  const now = new Date();
  const weekStartStr = now.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  let cleanedIdempotencyKeys = 0;
  let cleanedOldJobs = 0;
  let refreshedViews = false;
  let prunedUploads = 0;

  try {
    // 1. Delete idempotency keys older than 7 days
    try {
      const { data, error } = await supa
        .from("idempotency_keys")
        .delete()
        .lt("created_at", sevenDaysAgo);
      if (!error && Array.isArray(data)) cleanedIdempotencyKeys = data.length;
    } catch {
      // table might not be populated yet
    }

    // 2. Delete or archive old completed jobs older than 7 days
    try {
      const { data, error } = await supa
        .from("jobs")
        .delete()
        .in("status", ["completed", "failed", "cancelled"])
        .lt("finished_at", sevenDaysAgo);
      if (!error && Array.isArray(data)) cleanedOldJobs = data.length;
    } catch {
      // non-fatal
    }

    // 3. Prune expired upload tokens or abandoned uploads older than 24 hours
    try {
      const { data, error } = await supa
        .from("media_assets")
        .delete()
        .eq("status", "uploading")
        .lt("created_at", oneDayAgo);
      if (!error && Array.isArray(data)) prunedUploads = data.length;
    } catch {
      // non-fatal
    }

    // 4. Refresh materialized views if RPC is available
    try {
      await supa.rpc("refresh_materialized_views");
      refreshedViews = true;
    } catch {
      // RPC may not be present in current migration batch
    }

    const duration = Date.now() - start;
    const details = {
      week: weekStartStr,
      cleaned_idempotency_keys: cleanedIdempotencyKeys,
      cleaned_old_jobs: cleanedOldJobs,
      pruned_abandoned_uploads: prunedUploads,
      materialized_views_refreshed: refreshedViews,
    };

    await logSchedulerState(supa, "cleanup", weekStartStr, duration, "success", details);

    return {
      job: "weekly_cleanup",
      success: true,
      duration_ms: duration,
      details,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const duration = Date.now() - start;
    await logSchedulerState(supa, "cleanup", weekStartStr, duration, "failed", { error: errorMsg });

    return {
      job: "weekly_cleanup",
      success: false,
      duration_ms: duration,
      details: {},
      error: errorMsg,
    };
  }
}

/**
 * Edge Function HTTP handler for /functions/v1/cron-maintenance
 */
export async function handleRequest(req: Request): Promise<Response> {
  const corsRes = corsMiddleware(req);
  if (corsRes) return corsRes;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Authenticate invocation: either via valid service_role / bearer token,
  // or via secret cron header (e.g. x-cron-secret / CRON_SECRET)
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const cronSecretHeader = req.headers.get("x-cron-secret");
  const expectedSecret =
    (typeof Deno !== "undefined" ? Deno.env.get("CRON_SECRET") : "") || "";

  let isAuthorized = false;

  if (expectedSecret && cronSecretHeader === expectedSecret) {
    isAuthorized = true;
  } else if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice(7);
      const serviceRoleKey =
        (typeof Deno !== "undefined" ? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") : "") || "";

      if (serviceRoleKey && token === serviceRoleKey) {
        isAuthorized = true;
      } else {
        const payload = await verifyJWT(token);
        const role = extractRole(payload);
        if (role === "admin" || payload.role === "service_role") {
          isAuthorized = true;
        }
      }
    } catch {
      isAuthorized = false;
    }
  }

  if (!isAuthorized) {
    return new Response(
      JSON.stringify({
        error: {
          code: "unauthenticated",
          message: "Unauthorized: Cron maintenance endpoint requires service_role or admin privileges.",
        },
      }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let body: CronRequest = {};
  if (req.method === "POST") {
    try {
      body = await req.json();
    } catch {
      // Empty or non-JSON body is acceptable for automated triggers
    }
  }

  const jobType: CronJobType = body.job || "all";
  const supa = await getSupabaseServiceClient();

  const results: CronJobExecutionResult[] = [];

  if (jobType === "all" || jobType === "midnight_rollover") {
    results.push(await runMidnightRollover(supa, body.school_date));
  }

  if (jobType === "all" || jobType === "auto_submit_quizzes") {
    results.push(await runAutoSubmitQuizzes(supa));
  }

  if (jobType === "all" || jobType === "weekly_cleanup") {
    results.push(await runWeeklyCleanup(supa));
  }

  const allPassed = results.every((r) => r.success);
  const responsePayload: CronResponse = {
    ok: allPassed,
    triggered_at: new Date().toISOString(),
    results,
  };

  return new Response(JSON.stringify(responsePayload), {
    status: allPassed ? 200 : 207,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

if (typeof Deno !== "undefined" && "serve" in Deno) {
  // @ts-ignore
  Deno.serve(handleRequest);
}
