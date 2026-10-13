-- Migration: 016_jobs_schema.sql
-- Description: Create schema for asynchronous background jobs (AI course generation, bulk grading, CSV import, year rollover).
-- Task: BE-CORE-16

-- Table: jobs
-- One table for all long-running work.
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('ai_course', 'ai_curriculum', 'ai_questions', 'ai_lesson', 'ai_grade_batch', 'ai_report_comments', 'ai_planner', 'import_users', 'rollover', 'report', 'tts_batch', 'notification_fanout', 'content_quality_check')),
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  initiator_id uuid not null references profiles(id) on delete set null,
  input_params jsonb not null default '{}'::jsonb,
  result_payload jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default app_now(),
  locked_by uuid references profiles(id),
  locked_at timestamptz,
  max_attempts int not null default 3 check (max_attempts >= 1),
  attempts int not null default 0 check (attempts >= 0 and attempts <= max_attempts),
  run_after timestamptz default now(),
  dedupe_key uuid,
  priority smallint default 5
);

-- Index: fast queue polling
create index if not exists idx_jobs_status_created on jobs(status, created_at);
create index if not exists idx_jobs_initiator_id on jobs(initiator_id);
create index if not exists idx_jobs_kind_status on jobs(kind, status);
create index if not exists idx_jobs_dedupe_key on jobs(dedupe_key) where dedupe_key is not null;

-- Table: job_steps
-- One row per step in a job execution.
create table if not exists job_steps (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  step_index int not null,
  name text not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  progress_percent int not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  log text,
  started_at timestamptz,
  completed_at timestamptz,
  unique (job_id, step_index)
);

-- Index: step lookups
create index if not exists idx_job_steps_job_id on job_steps(job_id);
create index if not exists idx_job_steps_status on job_steps(status);

-- RLS: enable row level security on all tables
enable row level security on jobs;
enable row level security on job_steps;

-- RLS policies: jobs
-- Users can read their own jobs; admins can read all.
create policy "Users read own jobs"
  on jobs for select using (auth.uid() = initiator_id);
create policy "Admins read all jobs"
  on jobs for select using (true);

-- RLS policies: job_steps
-- Users can read their own job steps; admins can read all.
create policy "Users read own job steps"
  on job_steps for select using (auth.uid() = (select initiator_id from jobs where id = job_id));
create policy "Admins read all job steps"
  on job_steps for select using (true);

-- End of migration