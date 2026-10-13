/**
 * lib/steps.ts
 *
 * Progress-tracking helpers for job-step lifecycle.
 *
 * Each job may have multiple steps. A step is a logical subunit of work
 * (e.g. "generate outline", "expand units", "assemble course").
 *
 * Conventions:
 *   – step_index is 1-based (step 0 is the "started" sentinel written by the
 *     claim/claim-loop code).
 *   – progress_percent is 0–100, representing the overall job progress after
 *     this step completes.
 *   – The runner should write a new step row for each logical milestone;
 *     the job_steps table's UNIQUE(job_id, step_index) constraint prevents
 *     duplicate step numbers.
 *   – On failure, write a step with status='failed' and an error log snippet;
 *     the runner may retry later steps while leaving completed ones intact.
 */

import { supabase } from "@supabase/supabase-js";

export interface StepRecord {
  id: string;
  job_id: string;
  step_index: number;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  progress_percent: number;
  log?: string;
  started_at?: string;
  completed_at?: string;
}

/** Write a new step record for the given job, advancing the step index.
 *  Returns the newly created step record.
 */
export async function writeStep(
  jobId: string,
  stepIndex: number,
  name: string,
  progressPercent: number,
  log?: string
): Promise<StepRecord> {
  const { data, error } = await supabase
    .from<StepRecord>("job_steps")
    .insert({
      job_id: jobId,
      step_index: stepIndex,
      name,
      status: "running",
      progress_percent: progressPercent,
      log,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Mark the most recent step for this job as completed, with an optional
 *  progress percent bump. If `finish` is true, also write a final "completed"
 *  sentinel and return true to signal the caller that the job may be marked
 *  completed after this step.
 */
export async function markStepCompleted(
  jobId: string,
  progressPercent: number,
  log?: string,
  finish = false
): Promise<{ step: StepRecord; finish: boolean }> {
  // First, mark the latest step (highest step_index) as completed.
  // We assume the runner always advances step_index monotonically.
  const { data: latest, error } = await supabase
    .from<StepRecord>("job_steps")
    .select("step_index")
    .eq("job_id", jobId)
    .order("step_index", { ascending: false })
    .limit(1)
    .single();

  if (error) throw error;

  const newStatusStepIndex = latest.step_index;

  await supabase.from("job_steps").update({
    status: "completed",
    progress_percent: progressPercent,
    log,
    completed_at: new Date().toISOString(),
  }).eq("job_id", jobId).eq("step_index", newStatusStepIndex);

  const finishFlag = finish; // caller decides; typically true on the last step
  return { step: latest, finish: finishFlag };
}

/** Write a failed-step record and return it. The runner may decide to retry
 *  later steps or abort the whole job based on the error kind.
 */
export async function writeFailedStep(
  jobId: string,
  stepIndex: number,
  errorMsg: string
): Promise<StepRecord> {
  const { data, error } = await supabase
    .from<StepRecord>("job_steps")
    .insert({
      job_id: jobId,
      step_index: stepIndex,
      name: `step-${stepIndex}`,
      status: "failed",
      progress_percent: 0,
      log: `Failed: ${errorMsg}`,
      completed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}