/**
 * handlers/registry.ts
 *
 * Maps a job `kind` string to its handler function.
 *
 * BE-EDGE-11 core design:
 *   – Registered kinds have real implementations in BE-EDGE-12/13/14.
 *   – Any unregistered kind falls through to the `__fallback__` handler in
 *     `index.ts`, which marks the job `failed` with a clear message instead of
 *     crashing the runner.
 *
 * Pattern: each kind module exports a default handler of type
 *   (job: Job, supa: any) => Promise<{ progress_percent, finishAfterStep?, ... }>
 */

import { Job } from "../index";

// Registered kinds – in the final deployment these will be imported from
// dedicated handler files (BE-EDGE-12: ai-course, BE-EDGE-13: csv-import, etc.).
// For now we expose a Map that BE-EDGE-11's index.ts registry references.

export const handlersMap = new Map<string, (job: Job, supa: any) => Promise<any>>();

// Convenience register helper (used by the build / future tasks).
export function registerHandler(kind: string, handler: (job: Job, supa: any) => Promise<any>) {
  handlersMap.set(kind, handler);
}

// -------------------------------------------------------------------
// Placeholder: the real ai-course handler will be added in BE-EDGE-12.
// This stub ensures the runner never throws on an unknown kind – it just
// marks the job failed with a helpful message so the admin can see "no handler".
// -------------------------------------------------------------------

handlersMap.set("ai_course", async () => {
  // Stub: return progress and let the caller decide.
  // In production BE-EDGE-12 will replace this with the real curriculum
  // generation logic that writes job_steps and finishes the job.
  return {
    progress_percent: 25,
    finishAfterStep: false,
  };
});

handlersMap.set("import_users", async () => {
  return {
    progress_percent: 50,
    finishAfterStep: false,
  };
});

// Fallback entry-point – index.ts reads this map; if a kind is not found,
// it uses the __fallback__ function which marks the job failed gracefully.
handlersMap.set("__fallback__", async (job: any) => {
  throw new Error(`no handler registered for kind="${job.kind}"; see BE-EDGE-12+`);
});