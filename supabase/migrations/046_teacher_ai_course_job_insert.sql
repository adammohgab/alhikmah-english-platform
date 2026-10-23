-- Allow teachers to enqueue only their own AI course-generation jobs.
-- The job-runner uses the service role for execution; teachers receive read-only
-- access to their own job and job_steps rows for progress tracking.

create policy teacher_insert_own_ai_course_jobs
  on public.jobs
  for insert
  to authenticated
  with check (
    initiator_id = public.uid()
    and kind = 'ai_course'
    and status = 'queued'
  );
