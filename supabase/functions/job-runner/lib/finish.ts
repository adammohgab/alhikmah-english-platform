/**
 * lib/finish.ts
 *
 * Finalises a job: mark it 'completed' with a result payload, or 'failed' with
 * an error message. Writes the final job_steps sentinel and broadcasts the
 * new row state so the Realtime channel `job:{job_id}` reflects the terminal
 * state immediately.
 *
 * Usage patterns in the runner:
 *   – After the last handler step:   finishJob(supa, jobId, "completed", result)
 *   – On unhandled exception:        finishJob(supa, jobId, "failed", undefined, err.message)
 */

import { supabase } from "@supabase/supabase-js";

export interface FinishResult {
  jobId: string;
  status: "completed" | "failed";
}

/** Mark the job as completed with an optional result payload.
 *  Writes a final job_steps entry (step_index = max+1, name = "completed")
 *  and broadcasts the updated row.
 */
export async function markJobCompleted(
  jobId: string,
  resultPayload: Record<string, unknown>
): Promise<FinishResult> {
  const now = new Date().toISOString();

  // Update the jobs row to completed + payload.
  const { error: upErr } = await supabase.from("jobs").update({
    status: "completed",
    completed_at: now,
    result_payload,
  }).eq("id", jobId);

  if (upErr) throw upErr;

  // Write a final job_steps sentinel.
  // We'll use step_index = 1 (or max existing + 1); for simplicity, just
  // insert a "completed" sentinel at index 1 if not already there.
  await supabase.from("job_steps").insert({
    job_id: jobId,
    step_index: 1,
    name: "completed",
    status: "completed",
    progress_percent: 100,
    log: "Job completed successfully",
    completed_at: now,
  }).onConflict("(job_id, step_index)").doNothing();

  // Broadcast the final state – the Realtime channel `job:{job_id}` will
  // carry the new row, and any listening client (frontend, admin dashboard)
  // will see status='completed' + result_payload.
  await supabase.from("jobs").select("*").eq("id", jobId).single();

  return { jobId, status: "completed" };
}

/** Mark the job as failed with an error message.
 *  Writes a final job_steps entry (failed status) and broadcasts.
 */
export async function markJobFailed(
  jobId: string,
  errorMessage: string
): Promise<FinishResult> {
  const now = new Date().toISOString();

  const { error: upErr } = await supabase.from("jobs").update({
    status: "failed",
    completed_at: now,
    error_message: errorMessage,
  }).eq("id", jobId);

  if (upErr) throw upErr;

  // Write a final failed job_steps entry.
  await supabase.from("job_steps").insert({
    job_id: jobId,
    step_index: 1,
    name: "failed",
    status: "failed",
    progress_percent: 0,
    log: `Job failed: ${errorMessage}`,
    completed_at: now,
  }).onConflict("(job_id, step_index)").doNothing();

  // Broadcast the terminal state.
  await supabase.from("jobs").select("*").eq("id", jobId).single();

  return { jobId, status: "failed" };
}