-- Migration: 008_attempts_grading.sql
-- Description: Student assessment attempts, autosaved answers, teacher grades and feedback history.
-- Task: BE-CORE-08
-- Depends On: BE-CORE-07 (assessments), BE-CORE-06 (questions), BE-CORE-02 (profiles)
-- Notes:
--   - Task-literal tables (assessment_attempts, attempt_answers, grade_history) with
--     spec-superset columns (question_id, source on grade_history; created_at/updated_at).
--   - RLS intentionally deferred to BE-CORE-18 per task ownership.

-- Table: assessment_attempts
-- One row per student attempt at an assessment. attempt_number is scoped per (assessment, student).
create table if not exists assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  attempt_number int not null check (attempt_number >= 1),
  status submission_status not null default 'in_progress',
  started_at timestamptz not null default app_now(),
  submitted_at timestamptz,
  score numeric(5,2) check (score is null or score >= 0),
  max_score numeric(5,2) check (max_score is null or max_score >= 0),
  feedback text,
  graded_by uuid references profiles(id) on delete set null,
  graded_at timestamptz,
  created_at timestamptz not null default app_now(),
  updated_at timestamptz not null default app_now(),
  unique (assessment_id, student_id, attempt_number),
  check (submitted_at is null or submitted_at >= started_at),
  check (graded_at is null or graded_by is not null)
);

-- Table: attempt_answers
-- Autosaved per-question answers. student_answer is JSONB to support all
-- question formats (multiple_choice, fill_blank, matching, reorder, short_answer, etc.).
create table if not exists attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references assessment_attempts(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  student_answer jsonb not null default '{}'::jsonb,
  is_correct boolean,
  points_awarded numeric(5,2) check (points_awarded is null or points_awarded >= 0),
  teacher_comment text,
  created_at timestamptz not null default app_now(),
  updated_at timestamptz not null default app_now(),
  unique (attempt_id, question_id)
);

-- Table: grade_history
-- Append-only audit trail of every score change on an attempt.
-- question_id nullable: null = overall attempt override, not null = per-question regrade.
-- grader_id mirrors spec changed_by; source mirrors spec grade_history.source.
create table if not exists grade_history (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references assessment_attempts(id) on delete cascade,
  question_id uuid references questions(id) on delete set null,
  grader_id uuid references profiles(id) on delete set null,
  source text not null default 'teacher'
    check (source in ('ai_accept', 'teacher', 'override', 'penalty', 'system', 'bulk_approve', 'manual', 'auto')),
  old_score numeric(5,2) check (old_score is null or old_score >= 0),
  new_score numeric(5,2) check (new_score is null or new_score >= 0),
  reason text,
  changed_at timestamptz not null default app_now()
);

-- Conflict Prevention: rapid progress lookups by (assessment_id, student_id)
create index if not exists idx_assessment_attempts_assessment_student
  on assessment_attempts (assessment_id, student_id);

-- Supporting indexes for dashboard, grading queue, and audit queries
create index if not exists idx_assessment_attempts_student_status
  on assessment_attempts (student_id, status);

create index if not exists idx_assessment_attempts_assessment_status
  on assessment_attempts (assessment_id, status);

create index if not exists idx_assessment_attempts_graded_by
  on assessment_attempts (graded_by);

create index if not exists idx_attempt_answers_attempt_id
  on attempt_answers (attempt_id);

create index if not exists idx_attempt_answers_question_id
  on attempt_answers (question_id);

-- GIN index on JSONB answers for analysis across question formats
create index if not exists idx_attempt_answers_student_answer_gin
  on attempt_answers using gin (student_answer);

create index if not exists idx_grade_history_attempt_changed
  on grade_history (attempt_id, changed_at desc);

create index if not exists idx_grade_history_grader
  on grade_history (grader_id);

-- Triggers for updated_at (uses set_updated_at() from 002_identity_profiles)
create trigger assessment_attempts_updated_at
  before update on assessment_attempts
  for each row
  execute function set_updated_at();

create trigger attempt_answers_updated_at
  before update on attempt_answers
  for each row
  execute function set_updated_at();
