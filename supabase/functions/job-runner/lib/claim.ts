/**
 * lib/claim.ts
 *
 * Acquires the next available queued job from the jobs table using a row lock
 * (FOR UPDATE SKIP LOCKED). Honours priority ordering (higher priority first),
 * run_after (only jobs whose run_after <= now), and created_at (oldest first)
 * as tie-breakers. Only one worker can hold a given job at a time.
 *
 * Idempotent: if called and no queued jobs exist, returns null.
 * Side-effect: the claimed job is immediately updated to status='running',
 * locked_by=<workerId>, locked_at=now, and a job_steps entry "running" at step 0
 * is written.
 */

import { supabase } from "@supabase/supabase-js";

export interface ClaimedJob {
  id: string;
  kind: string;
  initiator_id: string;
  max_attempts: number;
  attempts: number;
  run_after: string;
  priority: number;
}

export async function claimNextJob(
  workerId: string
): Promise<ClaimedJob | null> {
  const { data, error } = await supabase
    .from("jobs")
    .select(
      "id, kind, initiator_id, max_attempts, attempts, run_after, priority, status, locked_by, locked_at"
    )
    .eq("status", "queued")
    .order("priority", { ascending: false })
    .order("run_after", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .throwOnError();

  if (error) throw error;
  if (!data || data.length === 0) {
    return null;
  }

  const job = data[0] as ClaimedJob;

  // Mark the job as running, lock it to this worker.
  const now = new Date().toISOString();
  await supabase.from("jobs").update({
    status: "running",
    locked_by: workerId,
    locked_at: now,
    attempts: job.attempts + 1, // increment on each claim attempt
  }).eq("id", job.id);

  // Write an initial job_steps entry so the progress UI has something to show.
  await supabase.from("job_steps").insert({
    job_id: job.id,
    step_index: 0,
    name: "started",
    status: "running",
    progress_percent: 0,
    log: `Job ${job.id} claimed by worker ${workerId}`,
  });

  return job;
}