-- Migration: 009_09_learning_progress.sql
-- Task: BE-CORE-09

create table if not exists lesson_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id),
  lesson_id uuid not null references lessons(id) on delete cascade,
  course_id uuid references courses(id),
  is_completed boolean not null default false,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed')),
  completed_at timestamptz,
  first_completed_at timestamptz,
  last_accessed_at timestamptz not null default app_now(),
  last_opened_at timestamptz not null default app_now(),
  notes text,
  xp_awarded boolean not null default false,
  unique (student_id, lesson_id)
);

create table if not exists activity_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id),
  activity_id uuid not null,
  course_id uuid references courses(id),
  answers jsonb,
  state jsonb,
  score numeric(5,2),
  best_score_pct numeric,
  last_score_pct numeric,
  attempts smallint not null default 0,
  completed_at timestamptz,
  first_completed_at timestamptz,
  xp_awarded_pct numeric,
  updated_at timestamptz not null default app_now(),
  unique (student_id, activity_id)
);

create trigger activity_progress_updated_at
  before update on activity_progress
  for each row
  execute function set_updated_at();

create table if not exists writing_drafts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id),
  prompt_id uuid,
  title text,
  content text,
  text text,
  word_count integer not null default 0,
  status text not null default 'draft'
    check (status in ('draft', 'finished')),
  ai_feedback jsonb,
  feedback_at timestamptz,
  last_saved_at timestamptz not null default app_now()
);

create index if not exists idx_lesson_progress_student_last_accessed
  on lesson_progress (student_id, last_accessed_at desc);

create index if not exists idx_lesson_progress_student_last_opened
  on lesson_progress (student_id, last_opened_at desc);

create index if not exists idx_activity_progress_student_updated
  on activity_progress (student_id, updated_at desc);

create index if not exists idx_writing_drafts_student_saved
  on writing_drafts (student_id, last_saved_at desc);

create index if not exists idx_writing_drafts_student_prompt
  on writing_drafts (student_id, prompt_id);
