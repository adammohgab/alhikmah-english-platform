
-- Migration: 001_extensions_enums.sql
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create type user_role as enum ('admin', 'super_admin', 'student', 'teacher');

create type user_status as enum ('active', 'locked', 'archived');

create type content_status as enum ('archived', 'draft', 'published');

create type question_type as enum ('audio_spelling', 'drag_drop', 'fill_blank', 'matching', 'multiple_choice', 'reorder', 'short_answer');

create type assessment_kind as enum ('assignment', 'quiz');

create type submission_status as enum ('graded', 'in_progress', 'returned', 'submitted');

create or replace function app_now()
returns timestamptz
language sql
as $$select now();$$;



-- Migration: 002_identity_profiles.sql
-- Table: profiles
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  username citext unique,
  display_name text not null,
  -- Read-only alias for screens that call the display name "full_name".
  full_name text generated always as (display_name) stored,
  role user_role not null default 'student',
  status user_status not null default 'active',
  avatar_url text,
  equipped_theme text,
  must_change_password boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table: user_settings
create table user_settings (
  user_id uuid primary key references profiles on delete cascade,
  sound_enabled boolean default true,
  effects_tier text default 'balanced',
  prefers_reduced_motion boolean default false,
  notifications_json jsonb,
  updated_at timestamptz not null default now()
);

-- Table: admin_notes
create table admin_notes (
  id uuid primary key,
  user_id uuid references profiles not null,
  author_id uuid references profiles not null,
  note text not null,
  created_at timestamptz not null default now()
);

-- Trigger: set updated_at on profiles
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on profiles
  for each row
  execute function set_updated_at();

-- Trigger: set updated_at on user_settings
create trigger user_settings_updated_at
  before update on user_settings
  for each row
  execute function set_updated_at();



-- Migration: 003_school_structure.sql
-- Migration: 003_school_structure.sql
-- Description: Define school hierarchy database tables: academic years, terms, classes, teacher assignments, and student enrollments.
-- Task: BE-CORE-03

-- Table: school_years
create table if not exists school_years (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean default false,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table: terms
create table if not exists terms (
  id uuid primary key default gen_random_uuid(),
  year_id uuid not null references school_years(id) on delete cascade,
  name text not null,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table: classes
create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  term_id uuid references terms(id) on delete set null,
  name text not null,
  join_code text unique,
  grade_level text,
  is_archived boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table: class_teachers (co-teaching / teacher assignments)
create table if not exists class_teachers (
  class_id uuid not null references classes(id) on delete cascade,
  teacher_id uuid not null references profiles(id) on delete cascade,
  is_primary boolean default false,
  primary key (class_id, teacher_id)
);

-- Table: class_enrollments (student enrollments)
create table if not exists class_enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  enrolled_at timestamptz not null default app_now(),
  status text not null default 'active',
  unique (class_id, student_id)
);

-- Foreign Key & Join Indexes
create index if not exists idx_terms_year_id on terms(year_id);
create index if not exists idx_classes_term_id on classes(term_id);
create index if not exists idx_classes_join_code on classes(join_code);
create index if not exists idx_classes_grade_level on classes(grade_level);
create index if not exists idx_classes_is_archived on classes(is_archived);

create index if not exists idx_class_teachers_teacher_id on class_teachers(teacher_id);
create index if not exists idx_class_enrollments_student_id on class_enrollments(student_id);
create index if not exists idx_class_enrollments_class_id on class_enrollments(class_id);
create index if not exists idx_class_enrollments_status on class_enrollments(status);

-- Triggers for updated_at
create trigger school_years_updated_at
  before update on school_years
  for each row
  execute function set_updated_at();

create trigger terms_updated_at
  before update on terms
  for each row
  execute function set_updated_at();

create trigger classes_updated_at
  before update on classes
  for each row
  execute function set_updated_at();



-- Migration: 004_04_class_rules.sql
-- Migration: 004_04_class_rules.sql
-- Description: Class-specific rules, curriculum assignments, and unlock overrides.
-- Task: BE-CORE-04

create table if not exists class_rules (
  class_id uuid primary key references classes(id) on delete cascade,
  games_enabled boolean not null default true,
  ai_tutor_enabled boolean not null default true,
  late_submission_allowed boolean not null default true,
  late_penalty_percent integer not null default 10,
  bonus_multiplier numeric(3,2) not null default 1.0,
  updated_at timestamptz not null default now()
);

-- Give existing classes the same defaults as new classes.
insert into class_rules (class_id)
select id from classes
on conflict (class_id) do nothing;

-- Give each new class a default rule row.
create or replace function create_default_class_rules()
returns trigger
language plpgsql
as $$
begin
  insert into class_rules (class_id) values (new.id);
  return new;
end;
$$;

create trigger classes_create_default_rules
  after insert on classes
  for each row
  execute function create_default_class_rules();

create trigger class_rules_updated_at
  before update on class_rules
  for each row
  execute function set_updated_at();

create table if not exists class_courses (
  class_id uuid not null references classes(id) on delete cascade,
  course_id uuid not null,
  is_active boolean not null default true,
  assigned_at timestamptz not null default now(),
  primary key (class_id, course_id)
);

create table if not exists class_unlock_overrides (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id),
  student_id uuid not null references profiles(id),
  target_type text not null,
  target_id uuid not null,
  is_unlocked boolean not null,
  reason text
);

create index if not exists idx_class_unlock_overrides_class_target
  on class_unlock_overrides (class_id, target_type, target_id);

create index if not exists idx_class_unlock_overrides_student_target
  on class_unlock_overrides (student_id, target_type, target_id);



-- Migration: 005_curriculum_content.sql
-- Migration: 005_curriculum_content.sql
-- Description: Curriculum and content hierarchy tables: courses, units, lessons, blocks, and version snapshots.
-- Task: BE-CORE-05

-- Table: courses
create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references profiles(id) on delete set null,
  title text not null,
  slug text unique not null,
  description text,
  grade_level text,
  is_official boolean not null default false,
  status content_status not null default 'draft',
  cover_image text,
  position int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table: units
create table if not exists units (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  title text not null,
  description text,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table: lessons
create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  title text not null,
  description text,
  xp_reward int not null default 20,
  coin_reward int not null default 5,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table: lesson_blocks
create table if not exists lesson_blocks (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  block_type text not null,
  content jsonb not null default '{}'::jsonb,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table: content_snapshots
create table if not exists content_snapshots (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  version_number int not null default 1,
  snapshot_data jsonb not null default '{}'::jsonb,
  published_by uuid references profiles(id) on delete set null,
  published_at timestamptz not null default app_now(),
  unique (course_id, version_number)
);

-- Indexes
create index if not exists idx_courses_slug on courses(slug);
create index if not exists idx_courses_author_id on courses(author_id);
create index if not exists idx_courses_status on courses(status);
create index if not exists idx_courses_grade_level on courses(grade_level);

create index if not exists idx_units_course_id on units(course_id);
create index if not exists idx_units_order_index on units(order_index);

create index if not exists idx_lessons_unit_id on lessons(unit_id);
create index if not exists idx_lessons_order_index on lessons(order_index);

create index if not exists idx_lesson_blocks_lesson_id on lesson_blocks(lesson_id);
create index if not exists idx_lesson_blocks_order_index on lesson_blocks(order_index);

create index if not exists idx_content_snapshots_course_id on content_snapshots(course_id);
create index if not exists idx_content_snapshots_version on content_snapshots(course_id, version_number);

-- Triggers for updated_at
create trigger courses_updated_at
  before update on courses
  for each row
  execute function set_updated_at();

create trigger units_updated_at
  before update on units
  for each row
  execute function set_updated_at();

create trigger lessons_updated_at
  before update on lessons
  for each row
  execute function set_updated_at();

create trigger lesson_blocks_updated_at
  before update on lesson_blocks
  for each row
  execute function set_updated_at();



-- Migration: 006_questions_rubrics.sql
-- Migration: 006_questions_rubrics.sql
-- Description: Questions and rubrics schema supporting all interactive exercise types.
-- Task: BE-CORE-06

-- Table: rubrics
create table if not exists rubrics (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  criteria jsonb not null default '[]'::jsonb,
  max_score numeric(5,2) not null check (max_score >= 0),
  author_id uuid references profiles(id) on delete set null,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table: questions
create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references profiles(id) on delete set null,
  question_type question_type not null,
  prompt text not null,
  options jsonb default '{}'::jsonb,
  correct_answer jsonb default '{}'::jsonb,
  explanation text,
  points numeric(5,2) not null default 1.0 check (points >= 0),
  difficulty text,
  tags text[] default '{}'::text[],
  rubric_id uuid references rubrics(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for performance and question bank search
create index if not exists idx_rubrics_author_id on rubrics(author_id);
create index if not exists idx_rubrics_is_public on rubrics(is_public);

create index if not exists idx_questions_author_id on questions(author_id);
create index if not exists idx_questions_type on questions(question_type);
create index if not exists idx_questions_difficulty on questions(difficulty);
create index if not exists idx_questions_rubric_id on questions(rubric_id);

-- GIN index on tags and correct_answer JSONB fields for rapid bank filtering
create index if not exists idx_questions_tags_gin on questions using gin(tags);
create index if not exists idx_questions_correct_answer_gin on questions using gin(correct_answer);

-- Triggers for updated_at
create trigger rubrics_updated_at
  before update on rubrics
  for each row
  execute function set_updated_at();

create trigger questions_updated_at
  before update on questions
  for each row
  execute function set_updated_at();



-- Migration: 007_assessments_schema.sql
-- Migration: 007_assessments_schema.sql
-- Description: Assessments schema: quizzes, assignments, questions linkage and settings.
-- Task: BE-CORE-07

-- Table: assessments
create table if not exists assessments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  title text not null,
  description text,
  kind assessment_kind not null,
  due_date timestamptz,
  time_limit_minutes int check (time_limit_minutes is null or time_limit_minutes > 0),
  max_attempts int not null default 1 check (max_attempts > 0),
  pass_percentage numeric(5,2) not null default 60.00 check (pass_percentage >= 0 and pass_percentage <= 100),
  shuffle_questions boolean not null default false,
  show_feedback_mode text not null default 'immediate',
  status content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table: assessment_questions (composite PK linkage)
create table if not exists assessment_questions (
  assessment_id uuid not null references assessments(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  order_index int not null default 0,
  points_override numeric(5,2) check (points_override is null or points_override >= 0),
  primary key (assessment_id, question_id)
);

-- Foreign Key and query performance indexes
create index if not exists idx_assessments_class_id on assessments(class_id);
create index if not exists idx_assessments_author_id on assessments(author_id);
create index if not exists idx_assessments_kind on assessments(kind);
create index if not exists idx_assessments_status on assessments(status);
create index if not exists idx_assessments_due_date on assessments(due_date);

create index if not exists idx_assessment_questions_question_id on assessment_questions(question_id);
create index if not exists idx_assessment_questions_order on assessment_questions(assessment_id, order_index);

-- Trigger for updated_at
create trigger assessments_updated_at
  before update on assessments
  for each row
  execute function set_updated_at();



-- Migration: 008_attempts_grading.sql
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



-- Migration: 009_learning_progress.sql
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



-- Migration: 010_gamification_ledgers.sql
-- Migration: 010_gamification_ledgers.sql
-- Description: Core gamification ledger tables: student statistics, immutable XP and Coin transactional ledgers, and streak history.
-- Task: BE-CORE-10

-- Table: student_stats
create table if not exists student_stats (
  student_id uuid primary key references profiles(id) on delete cascade,
  total_xp bigint not null default 0,
  current_level int not null default 1 check (current_level >= 1 and current_level <= 60),
  current_coins bigint not null default 0 check (current_coins >= 0),
  current_streak int not null default 0 check (current_streak >= 0),
  longest_streak int not null default 0 check (longest_streak >= 0),
  streak_freeze_count int not null default 0 check (streak_freeze_count >= 0 and streak_freeze_count <= 3),
  last_active_date date,
  updated_at timestamptz not null default now()
);

-- Table: xp_ledger (strictly append-only)
create table if not exists xp_ledger (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  amount int not null,
  source text not null,
  reference_id uuid,
  created_at timestamptz not null default app_now()
);

-- Table: coin_ledger (strictly append-only)
create table if not exists coin_ledger (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  amount int not null,
  source text not null,
  reference_id uuid,
  created_at timestamptz not null default app_now()
);

-- Table: streak_days
create table if not exists streak_days (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  activity_date date not null,
  xp_earned int not null default 0,
  is_frozen boolean not null default false,
  created_at timestamptz not null default now(),
  unique (student_id, activity_date)
);

-- Prevent update and delete on xp_ledger (append-only enforcement)
create or replace function forbid_ledger_mutation()
returns trigger as $$
begin
  raise exception 'Ledger tables are append-only. Mutation or deletion is not allowed.';
end;
$$ language plpgsql;

create trigger xp_ledger_no_mutation
  before update or delete on xp_ledger
  for each row
  execute function forbid_ledger_mutation();

create trigger coin_ledger_no_mutation
  before update or delete on coin_ledger
  for each row
  execute function forbid_ledger_mutation();

-- Trigger: synchronize student_stats on xp_ledger insert
create or replace function sync_xp_ledger_to_stats()
returns trigger as $$
begin
  insert into student_stats (student_id, total_xp, last_active_date)
  values (new.student_id, new.amount, current_date)
  on conflict (student_id) do update
  set total_xp = student_stats.total_xp + new.amount,
      last_active_date = current_date,
      updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_sync_xp_ledger
  after insert on xp_ledger
  for each row
  execute function sync_xp_ledger_to_stats();

-- Trigger: synchronize student_stats on coin_ledger insert
create or replace function sync_coin_ledger_to_stats()
returns trigger as $$
begin
  insert into student_stats (student_id, current_coins, last_active_date)
  values (new.student_id, greatest(0, new.amount), current_date)
  on conflict (student_id) do update
  set current_coins = greatest(0, student_stats.current_coins + new.amount),
      last_active_date = current_date,
      updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_sync_coin_ledger
  after insert on coin_ledger
  for each row
  execute function sync_coin_ledger_to_stats();

-- Indexes for performance
create index if not exists idx_student_stats_total_xp on student_stats(total_xp desc);
create index if not exists idx_student_stats_current_streak on student_stats(current_streak desc);

create index if not exists idx_xp_ledger_student_id on xp_ledger(student_id, created_at desc);
create index if not exists idx_xp_ledger_source on xp_ledger(source);

create index if not exists idx_coin_ledger_student_id on coin_ledger(student_id, created_at desc);
create index if not exists idx_coin_ledger_source on coin_ledger(source);

create index if not exists idx_streak_days_student_id on streak_days(student_id, activity_date desc);

-- Trigger for student_stats updated_at
create trigger student_stats_updated_at
  before update on student_stats
  for each row
  execute function set_updated_at();



-- Migration: 011_quests_badges.sql
-- Migration: 011_quests_badges.sql
-- Description: Create schema for quest templates, quest instances, badge definitions, user badges, and leaderboard snapshots.
-- Task: BE-CORE-11

-- Table: quest_templates
create table if not exists quest_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  quest_type text not null check (quest_type in ('daily', 'weekly')),
  target_count int not null default 1,
  xp_reward int not null default 0,
  coin_reward int not null default 0,
  is_active boolean default true,
  created_at timestamptz default app_now()
);

-- Table: quest_instances
create table if not exists quest_instances (
  id uuid primary key default gen_random_uuid(),
  quest_template_id uuid not null references quest_templates(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  current_count int not null default 0,
  is_completed boolean not null default false,
  is_claimed boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz default app_now(),
  unique (student_id, quest_template_id)
);

-- Table: badge_definitions
create table if not exists badge_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  icon_url text,
  category text not null,
  requirement_json jsonb not null,
  created_at timestamptz default app_now()
);

-- Table: user_badges
create table if not exists user_badges (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  badge_id uuid not null references badge_definitions(id) on delete cascade,
  awarded_at timestamptz default app_now(),
  is_pinned boolean not null default false,
  unique (student_id, badge_id)
);

-- Table: leaderboard_snapshots
create table if not exists leaderboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes(id) on delete set null,
  period text not null check (period in ('daily', 'weekly', 'monthly')),
  ranking_data jsonb not null,
  generated_at timestamptz default app_now()
);

-- Indexes
create index if not exists idx_quest_templates_active on quest_templates(is_active);
create index if not exists idx_quest_instances_student on quest_instances(student_id);
create index if not exists idx_quest_instances_template on quest_instances(quest_template_id);
create index if not exists idx_badge_definitions_category on badge_definitions(category);
create index if not exists idx_user_badges_student on user_badges(student_id);
create index if not exists idx_leaderboard_snapshots_class_period on leaderboard_snapshots(class_id, period);

-- RLS Policies
alter table quest_templates enable row level security;
create policy "Quest templates are readable by all authenticated users"
  on quest_templates for select using (true);

alter table quest_instances enable row level security;
create policy "Students manage own quest instances"
  on quest_instances for all using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

alter table badge_definitions enable row level security;
create policy "Badge definitions are readable by all authenticated users"
  on badge_definitions for select using (true);

alter table user_badges enable row level security;
create policy "Students manage own badges"
  on user_badges for all using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

alter table leaderboard_snapshots enable row level security;
create policy "Leaderboard snapshots are readable by all authenticated users"
  on leaderboard_snapshots for select using (true);

-- Check constraint for max 3 pinned badges per student
-- Implemented at application level; DB constraint would require more complex logic
-- A trigger could enforce this, but per spec we support the flag up to limit of 3



-- Migration: 012_games_schema.sql
-- Migration: 012_games_schema.sql
-- Description: Create schema for minigames: game catalog, player sessions, high scores, and daily featured game tracking.
-- Task: BE-CORE-12

-- Table: games
create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  icon_url text,
  instructions text,
  is_active boolean default true,
  created_at timestamptz default app_now()
);

-- Table: game_sessions
create table if not exists game_sessions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  score int not null,
  accuracy numeric(5,2),
  xp_awarded int default 0,
  coins_awarded int default 0,
  time_spent_seconds int,
  played_at timestamptz default app_now()
);

-- Table: game_daily_featured
create table if not exists game_daily_featured (
  featured_date date primary key,
  game_id uuid not null references games(id) on delete cascade,
  bonus_multiplier numeric(3,2) default 1.5
);

-- Indexes
create index if not exists idx_game_sessions_student_game on game_sessions(student_id, game_id);
create index if not exists idx_game_sessions_game_id on game_sessions(game_id);
create index if not exists idx_game_sessions_student on game_sessions(student_id);
create index if not exists idx_game_daily_featured_game_id on game_daily_featured(game_id);

-- RLS Policies
alter table games enable row level security;
create policy "Games are readable by all authenticated users"
  on games for select using (true);

alter table game_sessions enable row level security;
create policy "Students manage own game sessions"
  on game_sessions for all using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

alter table game_daily_featured enable row level security;
create policy "Daily featured games are readable by all authenticated users"
  on game_daily_featured for select using (true);



-- Migration: 013_shop_inventory.sql
-- Migration: 013_shop_inventory.sql
-- Description: Create schema for virtual arcade shop catalog, student item inventories, themes, and avatar cosmetics.
-- Task: BE-CORE-13

-- Table: shop_items
create table if not exists shop_items (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null check (sku ~ '^[a-z0-9]+(_[a-z0-9]+)*$'),
  name text not null,
  description text,
  category text not null,
  coin_price int not null,
  required_level int default 1,
  asset_url text,
  metadata jsonb,
  is_available boolean default true
);

-- Table: user_inventory
create table if not exists user_inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  item_id uuid not null references shop_items(id),
  purchased_at timestamptz default app_now(),
  is_equipped boolean default false,
  unique (user_id, item_id)
);

-- Table: avatar_assets
create table if not exists avatar_assets (
  id uuid primary key default gen_random_uuid(),
  asset_type text not null,
  name text not null,
  svg_data text,
  coin_price int default 0,
  is_default boolean default false
);

-- Indexes
create index if not exists idx_shop_items_sku on shop_items(sku);
create index if not exists idx_shop_items_category on shop_items(category);
create index if not exists idx_shop_items_available on shop_items(is_available);
create index if not exists idx_user_inventory_user on user_inventory(user_id);
create index if not exists idx_avatar_assets_type on avatar_assets(asset_type);

-- RLS Policies
alter table shop_items enable row level security;
create policy "Shop items are readable by all authenticated users"
  on shop_items for select using (true);

alter table user_inventory enable row level security;
create policy "Students manage own inventory"
  on user_inventory for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table avatar_assets enable row level security;
create policy "Avatar assets are readable by all authenticated users"
  on avatar_assets for select using (true);



-- Migration: 014_communication_notifications.sql
-- Migration: 014_communication_notifications.sql
-- Description: Create schema for school and class announcements, recipient lists, and user in-app notifications.
-- Task: BE-CORE-14

-- Table: announcements
-- School and class announcements published by teachers/admins.
-- Audience resolves to whole school, specific classes, students, teachers, grades, or individual users.
-- target_type + target_class_id satisfy the "target whole school or specific class" acceptance criterion.
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references profiles(id) on delete set null,
  title text not null,
  body text not null,
  priority text not null default 'normal',
  audience jsonb not null default '{}'::jsonb,
  target_type text not null check (target_type in ('school', 'class')),
  target_class_id uuid references classes(id) on delete set null,
  status text not null default 'published',
  publish_at timestamptz not null default app_now(),
  -- Read-only name from the BE-CORE-14 task text.
  published_at timestamptz generated always as (publish_at) stored,
  expires_at timestamptz,
  link jsonb,
  created_at timestamptz not null default app_now()
);

-- Index: announcements â€” author and target lookups
create index if not exists idx_announcements_author_id on announcements(author_id);
create index if not exists idx_announcements_target_type on announcements(target_type);
create index if not exists idx_announcements_target_class_id on announcements(target_class_id);
create index if not exists idx_announcements_publish_at on announcements(publish_at);

-- Table: announcement_recipients
-- One row per (announcement, user) pairing. read_at is null => unread.
-- delivered_at records when the notification was sent; read_at records when the user marked it read.
create table if not exists announcement_recipients (
  announcement_id uuid not null references announcements(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  delivered_at timestamptz not null default app_now(),
  read_at timestamptz,
  primary key (announcement_id, user_id)
);

-- Index: unread badge counter + FK lookup
create index if not exists idx_announcement_recipients_user_id on announcement_recipients(user_id);
create index if not exists idx_announcement_recipients_announcement_id on announcement_recipients(announcement_id);

-- Table: notifications
-- In-app notifications delivered to individual users.
-- Realtime delivers via `notifications:{uid}` channel; bell and notifications page read this table.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  -- Read-only names from the BE-CORE-14 task text.
  notification_type text generated always as (kind) stored,
  data jsonb generated always as (payload) stored,
  link text,
  priority text not null default 'normal',
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default app_now()
);

-- Index: fast unread count query (critical for badge counter)
create index if not exists idx_notifications_user_unread on notifications(user_id) where is_read = false;
create index if not exists idx_notifications_user_created on notifications(user_id, created_at desc);
create index if not exists idx_notifications_kind_priority on notifications(kind, priority);

-- Foreign key index for user_id (RLS + lookups)
create index if not exists idx_notifications_user_id on notifications(user_id);

-- RLS: enable row level security on all three tables
alter table announcements enable row level security;
alter table announcement_recipients enable row level security;
alter table notifications enable row level security;

-- RLS policies: announcements
-- Read published announcements addressed to the user (through announcement_recipients) or public ones.
create policy "Announcements are readable by authenticated users"
  on announcements for select using (true);
-- Teachers and admins can insert announcements they author (author_id check handled at app level; policy keeps it simple).

-- RLS policies: announcement_recipients
-- Users can read their own recipients and update their own read_at.
create policy "Students manage own announcement recipients"
  on announcement_recipients for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- RLS policies: notifications
-- Users can read and update their own notifications.
create policy "Students manage own notifications"
  on notifications for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- End of migration



-- Migration: 015_ai_system_tables.sql
-- Migration: 015_ai_system_tables.sql
-- Description: AI Tutor dialogues, Copilot sessions, streamed messages, action cards, token metering.
-- Task: BE-CORE-15
-- Depends On: BE-CORE-02 (profiles)
-- Notes:
--   - Columns follow the task text. ai_action_cards also carries user_id, changes, result,
--     resolved_at and resolved_by, which the action card RPCs (BE-OPS-20) read and write.
--   - Policies live in 039_rls_policies_indexes.sql.

create table if not exists ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  conversation_type text not null default 'tutor',
  context_data jsonb not null default '{}'::jsonb,
  is_archived boolean not null default false,
  created_at timestamptz not null default app_now()
);

create table if not exists ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null default '',
  tokens_used int not null default 0 check (tokens_used >= 0),
  safety_flag boolean not null default false,
  created_at timestamptz not null default app_now()
);

create table if not exists ai_action_cards (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references ai_conversations(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  card_type text not null,
  payload jsonb not null default '{}'::jsonb,
  changes jsonb not null default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'ready', 'accepted', 'discarded', 'applied', 'edited', 'undone')),
  result jsonb,
  applied_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default app_now(),
  check (conversation_id is not null or user_id is not null)
);

create table if not exists ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  feature text not null,
  model text not null,
  prompt_tokens int not null default 0 check (prompt_tokens >= 0),
  completion_tokens int not null default 0 check (completion_tokens >= 0),
  estimated_cost numeric(8,5) not null default 0 check (estimated_cost >= 0),
  created_at timestamptz not null default app_now()
);

-- Role ordering inside a conversation and per-user history reads.
create index if not exists idx_ai_conversations_user_created on ai_conversations(user_id, created_at desc);
create index if not exists idx_ai_messages_conversation_created on ai_messages(conversation_id, created_at);
create index if not exists idx_ai_action_cards_conversation on ai_action_cards(conversation_id);
create index if not exists idx_ai_action_cards_user_status on ai_action_cards(user_id, status);
create index if not exists idx_ai_action_cards_resolved_by on ai_action_cards(resolved_by);
-- Token logs stay apart from conversation reads (conflict prevention in the task).
create index if not exists idx_ai_usage_logs_user_created on ai_usage_logs(user_id, created_at desc);
create index if not exists idx_ai_usage_logs_feature_created on ai_usage_logs(feature, created_at desc);



-- Migration: 016_jobs_schema.sql
-- Migration: 016_jobs_schema.sql
-- Description: Create schema for asynchronous background jobs (AI course generation, bulk grading, CSV import, year rollover).
-- Task: BE-CORE-16

-- Table: jobs
-- One table for all long-running work.
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('ai_course', 'ai_curriculum', 'ai_questions', 'ai_lesson', 'ai_grade_batch', 'ai_report_comments', 'ai_planner', 'import_users', 'rollover', 'report', 'tts_batch', 'notification_fanout', 'content_quality_check')),
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  initiator_id uuid references profiles(id) on delete set null,
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
alter table jobs enable row level security;
alter table job_steps enable row level security;

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



-- Migration: 017_admin_audit_moderation.sql
-- Migration: 017_admin_audit_moderation.sql
-- Description: Platform settings, immutable audit history, and moderation queue.
-- Task: BE-CORE-17

-- Table: platform_settings
create table if not exists platform_settings (
  key text primary key,
  value jsonb not null,
  description text,
  version integer not null default 1,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default app_now()
);

create trigger platform_settings_updated_at
  before update on platform_settings
  for each row
  execute function set_updated_at();

-- Table: audit_log
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  actor_id uuid references profiles(id),
  actor_role user_role,
  actor_admin_level text
    check (actor_admin_level is null or actor_admin_level in ('super', 'school')),
  action text not null,
  action_type text,
  target_table text,
  target_type text,
  target_id uuid,
  ip_address text,
  ip_hash text,
  old_values jsonb,
  new_values jsonb,
  before jsonb,
  after jsonb,
  summary text,
  reason text,
  device text,
  view_as_session_id uuid,
  created_at timestamptz not null default app_now()
);

create or replace function forbid_audit_log_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only; updates and deletes are not allowed.';
end;
$$;

create trigger audit_log_no_mutation
  before update or delete on audit_log
  for each row
  execute function forbid_audit_log_mutation();

revoke update, delete, truncate on audit_log from public, anon, authenticated;

-- Table: moderation_queue
create table if not exists moderation_queue (
  id uuid primary key default gen_random_uuid(),
  reported_by uuid references profiles(id),
  reporter_id uuid references profiles(id),
  entity_type text not null,
  entity_id uuid not null,
  reason text,
  type text check (type is null or type in ('flagged', 'reported', 'failed_job')),
  severity text check (severity is null or severity in ('low', 'medium', 'high')),
  status text not null default 'pending'
    check (status in ('pending', 'new', 'in_review', 'resolved', 'dismissed')),
  source_type text,
  source_id uuid,
  assignee_id uuid references profiles(id),
  reviewed_by uuid references profiles(id),
  summary text,
  snapshot jsonb,
  ai_triage jsonb,
  safety_category text,
  resolution text,
  resolution_note text,
  resolution_notes text,
  resolved_at timestamptz,
  resolved_by uuid references profiles(id),
  created_at timestamptz not null default app_now()
);

create index if not exists idx_audit_log_created_at
  on audit_log (created_at desc);
create index if not exists idx_audit_log_user_created_at
  on audit_log (user_id, created_at desc);
create index if not exists idx_audit_log_actor_created_at
  on audit_log (actor_id, created_at desc);
create index if not exists idx_audit_log_action_type_created_at
  on audit_log (action_type, created_at desc);
create index if not exists idx_audit_log_action_created_at
  on audit_log (action, created_at desc);
create index if not exists idx_audit_log_target
  on audit_log (target_type, target_id);
create index if not exists idx_audit_log_table_target
  on audit_log (target_table, target_id);

create index if not exists idx_moderation_queue_open_severity_created_at
  on moderation_queue (severity, created_at desc)
  where status in ('pending', 'new', 'in_review');
create index if not exists idx_moderation_queue_entity
  on moderation_queue (entity_type, entity_id);
create index if not exists idx_moderation_queue_status_created_at
  on moderation_queue (status, created_at desc);
create index if not exists idx_moderation_queue_reporter_created_at
  on moderation_queue (reported_by, created_at desc);



-- Migration: 019_ops_20_action_cards.sql
-- Migration: 018_ops_20_action_cards.sql
-- Task: BE-OPS-20
-- Supported entities: questions, assessments, lessons, lesson_blocks, class_enrollments.

do $$
begin
  if to_regtype('public.card_status') is not null then
    execute 'alter type public.card_status add value if not exists ''applied''';
    execute 'alter type public.card_status add value if not exists ''undone''';
  end if;
end;
$$;

create or replace function public._apply_action_card_change(p_change jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_entity text := p_change->>'entity';
  v_action text := p_change->>'action';
  v_data jsonb;
  v_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_column text;
  v_assignments text := '';
  v_allowed boolean;
begin
  if pg_catalog.current_setting('app.action_card_internal', true) is distinct from 'true' then
    raise exception 'Internal action-card operation only' using errcode = '42501';
  end if;

  if v_entity is null or v_entity not in ('questions', 'assessments', 'lessons', 'lesson_blocks', 'class_enrollments') then
    raise exception 'Unsupported action-card entity: %', v_entity using errcode = '22023';
  end if;

  if v_action in ('create_draft', 'insert') then
    v_data := p_change->'data';
    if jsonb_typeof(v_data) <> 'object' then
      raise exception 'Insert action requires an object in data' using errcode = '22023';
    end if;

    for v_column in select jsonb_object_keys(v_data) loop
      select exists (
        select 1 from pg_catalog.pg_attribute a
        where a.attrelid = pg_catalog.to_regclass('public.' || v_entity)
          and a.attname = v_column and a.attnum > 0 and not a.attisdropped
          and a.attgenerated = ''
      ) into v_allowed;
      if not v_allowed then
        raise exception 'Invalid or generated column % for %', v_column, v_entity using errcode = '22023';
      end if;
    end loop;

    execute pg_catalog.format(
      'insert into public.%1$I as inserted select (pg_catalog.jsonb_populate_record(null::public.%1$I, $1)).* returning pg_catalog.to_jsonb(inserted)',
      v_entity
    ) into v_after using v_data;

    v_id := (v_after->>'id')::uuid;
    return pg_catalog.jsonb_build_object(
      'action', 'insert', 'entity', v_entity, 'id', v_id, 'after', v_after
    );

  elsif v_action = 'update' then
    v_id := (p_change->>'id')::uuid;
    v_data := p_change->'patch';

    if v_id is null or jsonb_typeof(v_data) <> 'object' or v_data = '{}'::jsonb or v_data ? 'id' then
      raise exception 'Update action requires id and a non-empty patch without id' using errcode = '22023';
    end if;

    for v_column in select jsonb_object_keys(v_data) loop
      select exists (
        select 1 from pg_catalog.pg_attribute a
        where a.attrelid = pg_catalog.to_regclass('public.' || v_entity)
          and a.attname = v_column and a.attnum > 0 and not a.attisdropped
          and a.attgenerated = '' and a.attidentity = ''
      ) into v_allowed;

      if not v_allowed then
        raise exception 'Invalid or immutable column % for %', v_column, v_entity using errcode = '22023';
      end if;

      v_assignments := v_assignments
        || case when v_assignments = '' then '' else ', ' end
        || pg_catalog.format(
          '%1$I = (pg_catalog.jsonb_populate_record(null::public.%2$I, $1)).%1$I',
          v_column, v_entity
        );
    end loop;

    execute pg_catalog.format(
      'select pg_catalog.to_jsonb(t) from public.%I t where t.id = $1 for update',
      v_entity
    ) into v_before using v_id;

    if v_before is null then
      raise exception 'Target row does not exist in %', v_entity using errcode = 'P0002';
    end if;

    execute pg_catalog.format(
      'update public.%1$I t set %2$s where t.id = $2 returning pg_catalog.to_jsonb(t)',
      v_entity, v_assignments
    ) into v_after using v_data, v_id;

    return pg_catalog.jsonb_build_object(
      'action', 'update', 'entity', v_entity, 'id', v_id,
      'before', v_before, 'after', v_after
    );
  else
    raise exception 'Unsupported action-card operation: %', v_action using errcode = '22023';
  end if;
end;
$$;

create or replace function public.apply_action_card(card_id uuid, edits jsonb default null)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_card record;
  v_owner uuid;
  v_changes jsonb;
  v_change jsonb;
  v_undo jsonb := '[]'::jsonb;
  v_status text;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_card
  from public.ai_action_cards
  where id = card_id
  for update;

  if not found then
    raise exception 'Action card not found' using errcode = 'P0002';
  end if;

  if v_card.conversation_id is not null then
    select user_id into v_owner
    from public.ai_conversations
    where id = v_card.conversation_id;

    if v_owner is distinct from auth.uid() then
      raise exception 'Not authorized to apply this action card' using errcode = '42501';
    end if;
  elsif v_card.user_id is distinct from auth.uid() then
    raise exception 'Not authorized to apply this action card' using errcode = '42501';
  end if;

  if v_card.status::text <> 'ready' then
    raise exception 'Action card is not ready' using errcode = '55000';
  end if;

  v_changes := coalesce(edits->'changes', edits, v_card.changes);
  if jsonb_typeof(v_changes) <> 'array' then
    raise exception 'Action-card changes must be a JSON array' using errcode = '22023';
  end if;

  perform pg_catalog.set_config('app.action_card_internal', 'true', true);

  for v_change in
    select value from pg_catalog.jsonb_array_elements(v_changes)
  loop
    v_undo := v_undo || pg_catalog.jsonb_build_array(
      public._apply_action_card_change(v_change)
    );
  end loop;

  v_status := case when edits is null then 'applied' else 'edited' end;
  v_result := pg_catalog.jsonb_build_object('undo', v_undo);

  update public.ai_action_cards
  set status = v_status,
      result = v_result,
      resolved_at = pg_catalog.now(),
      resolved_by = auth.uid()
  where id = card_id;

  return pg_catalog.jsonb_build_object('status', v_status, 'result', v_result);
end;
$$;

create or replace function public.undo_action_card(card_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_card record;
  v_owner uuid;
  v_item jsonb;
  v_current jsonb;
  v_entity text;
  v_id uuid;
  v_assignments text;
  v_column text;
  v_index integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_card
  from public.ai_action_cards
  where id = card_id
  for update;

  if not found then
    raise exception 'Action card not found' using errcode = 'P0002';
  end if;

  if v_card.conversation_id is not null then
    select user_id into v_owner
    from public.ai_conversations
    where id = v_card.conversation_id;

    if v_owner is distinct from auth.uid() then
      raise exception 'Not authorized to undo this action card' using errcode = '42501';
    end if;
  elsif v_card.user_id is distinct from auth.uid() then
    raise exception 'Not authorized to undo this action card' using errcode = '42501';
  end if;

  if v_card.status::text not in ('applied', 'edited') then
    raise exception 'Action card cannot be undone in its current state' using errcode = '55000';
  end if;

  for v_index in reverse pg_catalog.jsonb_array_length(v_card.result->'undo')..1 loop
    v_item := v_card.result->'undo'->(v_index - 1);
    v_entity := v_item->>'entity';
    v_id := (v_item->>'id')::uuid;

    if v_entity is null or v_entity not in ('questions', 'assessments', 'lessons', 'lesson_blocks', 'class_enrollments') then
      raise exception 'Unsupported undo entity: %', v_entity using errcode = '22023';
    end if;

    execute pg_catalog.format(
      'select pg_catalog.to_jsonb(t) from public.%I t where t.id = $1 for update',
      v_entity
    ) into v_current using v_id;

    if v_current is distinct from v_item->'after' then
      raise exception 'Target row changed after action-card application; undo refused' using errcode = '55000';
    end if;

    if v_item->>'action' = 'insert' then
      execute pg_catalog.format(
        'delete from public.%I where id = $1', v_entity
      ) using v_id;
    else
      v_assignments := '';

      for v_column in
        select a.attname
        from pg_catalog.pg_attribute a
        where a.attrelid = pg_catalog.to_regclass('public.' || v_entity)
          and a.attnum > 0 and not a.attisdropped
          and a.attname <> 'id'
          and a.attgenerated = '' and a.attidentity = ''
        order by a.attnum
      loop
        v_assignments := v_assignments
          || case when v_assignments = '' then '' else ', ' end
          || pg_catalog.format(
            '%1$I = (pg_catalog.jsonb_populate_record(null::public.%2$I, $1)).%1$I',
            v_column, v_entity
          );
      end loop;

      execute pg_catalog.format(
        'update public.%1$I t set %2$s where t.id = $2',
        v_entity, v_assignments
      ) using v_item->'before', v_id;
    end if;
  end loop;

  update public.ai_action_cards
  set status = 'undone',
      resolved_at = pg_catalog.now(),
      resolved_by = auth.uid()
  where id = card_id;

  return pg_catalog.jsonb_build_object('status', 'undone');
end;
$$;

create or replace function public.discard_action_card(card_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_card record;
  v_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_card
  from public.ai_action_cards
  where id = card_id
  for update;

  if not found then
    raise exception 'Action card not found' using errcode = 'P0002';
  end if;

  if v_card.conversation_id is not null then
    select user_id into v_owner
    from public.ai_conversations
    where id = v_card.conversation_id;

    if v_owner is distinct from auth.uid() then
      raise exception 'Not authorized to discard this action card' using errcode = '42501';
    end if;
  elsif v_card.user_id is distinct from auth.uid() then
    raise exception 'Not authorized to discard this action card' using errcode = '42501';
  end if;

  if v_card.status::text <> 'ready' then
    raise exception 'Only ready action cards can be discarded' using errcode = '55000';
  end if;

  update public.ai_action_cards
  set status = 'discarded',
      resolved_at = pg_catalog.now(),
      resolved_by = auth.uid()
  where id = card_id;

  return pg_catalog.jsonb_build_object('status', 'discarded');
end;
$$;

revoke all on function public._apply_action_card_change(jsonb) from public;
revoke all on function public.apply_action_card(uuid, jsonb) from public;
revoke all on function public.undo_action_card(uuid) from public;
revoke all on function public.discard_action_card(uuid) from public;

grant execute on function public._apply_action_card_change(jsonb) to authenticated;
grant execute on function public.apply_action_card(uuid, jsonb) to authenticated;
grant execute on function public.undo_action_card(uuid) to authenticated;
grant execute on function public.discard_action_card(uuid) to authenticated;



-- Migration: 020_ops_19_announcements.sql
-- Task: BE-OPS-19

-- Allow active users to receive school-wide or their own class broadcasts.
do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
      and policyname = 'Active users can receive announcement broadcasts'
  ) then
    execute $policy$
      create policy "Active users can receive announcement broadcasts"
      on realtime.messages
      for select
      to authenticated
      using (
        extension = 'broadcast'
        and exists (
          select 1
          from public.profiles p
          where p.id = (select auth.uid())
            and p.status::text = 'active'
            and (
              (select realtime.topic()) = 'platform'
              or exists (
                select 1
                from public.class_enrollments ce
                where (select realtime.topic()) = 'class:' || ce.class_id::text
                  and ce.student_id = p.id
                  and ce.status = 'active'
              )
              or exists (
                select 1
                from public.class_teachers ct
                where (select realtime.topic()) = 'class:' || ct.class_id::text
                  and ct.teacher_id = p.id
              )
            )
        )
      )
    $policy$;
  end if;
end;
$$;

-- Fan out recipients in batches and broadcast urgent announcements.
create or replace function public._fanout_announcement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_ids uuid[];
  v_offset integer := 0;
begin
  loop
    if new.target_type = 'school' then
      select coalesce(
        pg_catalog.array_agg(targets.id order by targets.id),
        array[]::uuid[]
      )
      into v_user_ids
      from (
        select p.id
        from public.profiles p
        where p.status::text = 'active'
        order by p.id
        limit 500 offset v_offset
      ) targets;
    else
      select coalesce(
        pg_catalog.array_agg(targets.id order by targets.id),
        array[]::uuid[]
      )
      into v_user_ids
      from (
        select distinct p.id
        from public.profiles p
        where p.status::text = 'active'
          and (
            exists (
              select 1
              from public.class_enrollments ce
              where ce.class_id = new.target_class_id
                and ce.student_id = p.id
                and ce.status = 'active'
            )
            or exists (
              select 1
              from public.class_teachers ct
              where ct.class_id = new.target_class_id
                and ct.teacher_id = p.id
            )
          )
        order by p.id
        limit 500 offset v_offset
      ) targets;
    end if;

    exit when pg_catalog.cardinality(v_user_ids) = 0;

    insert into public.announcement_recipients (announcement_id, user_id)
    select new.id, recipient_id
    from pg_catalog.unnest(v_user_ids) as recipients(recipient_id)
    on conflict (announcement_id, user_id) do nothing;

    insert into public.notifications (
      user_id, kind, title, body, payload, link, priority
    )
    select
      recipient_id,
      'announcement',
      new.title,
      new.body,
      pg_catalog.jsonb_build_object('announcement_id', new.id),
      '/announcements/' || new.id::text,
      new.priority
    from pg_catalog.unnest(v_user_ids) as recipients(recipient_id);

    v_offset := v_offset + 500;
  end loop;

  if new.priority = 'urgent' and new.status = 'published' then
    perform realtime.send(
      pg_catalog.jsonb_build_object(
        'announcement_id', new.id,
        'title', new.title,
        'body', new.body,
        'priority', new.priority,
        'target_type', new.target_type,
        'target_class_id', new.target_class_id
      ),
      'urgent_announcement',
      case
        when new.target_type = 'class'
          then 'class:' || new.target_class_id::text
        else 'platform'
      end,
      true
    );
  end if;

  return new;
end;
$$;

create trigger announcements_fanout_after_insert
after insert on public.announcements
for each row
when (new.status = 'published')
execute function public._fanout_announcement();

create or replace function public.publish_announcement(
  p_title text,
  p_body text,
  p_priority text,
  p_target_type text,
  p_target_class_id uuid default null,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_announcement_id uuid;
  v_recipient_count bigint;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_title is null
     or pg_catalog.length(pg_catalog.btrim(p_title)) = 0
     or pg_catalog.length(p_title) > 200 then
    raise exception 'Title must contain 1 to 200 characters' using errcode = '22023';
  end if;

  if p_body is null
     or pg_catalog.length(pg_catalog.btrim(p_body)) = 0
     or pg_catalog.length(p_body) > 20000 then
    raise exception 'Body must contain 1 to 20000 characters' using errcode = '22023';
  end if;

  if p_priority is null
     or p_priority not in ('normal', 'important', 'urgent') then
    raise exception 'Invalid announcement priority' using errcode = '22023';
  end if;

  if p_target_type is null
     or p_target_type not in ('school', 'class') then
    raise exception 'Target type must be school or class' using errcode = '22023';
  end if;

  if (p_target_type = 'class' and p_target_class_id is null)
     or (p_target_type = 'school' and p_target_class_id is not null) then
    raise exception 'A class target requires a class id; a school target must not include one'
      using errcode = '22023';
  end if;

  if p_expires_at is not null and p_expires_at <= pg_catalog.now() then
    raise exception 'Expiry time must be in the future' using errcode = '22023';
  end if;

  select p.role::text
  into v_role
  from public.profiles p
  where p.id = v_user_id
    and p.status::text = 'active';

  if v_role is null then
    raise exception 'Active profile required' using errcode = '42501';
  end if;

  if v_role not in ('admin', 'super_admin') then
    if v_role <> 'teacher'
       or p_target_type <> 'class'
       or not exists (
         select 1
         from public.class_teachers ct
         where ct.class_id = p_target_class_id
           and ct.teacher_id = v_user_id
       ) then
      raise exception 'Not authorized to publish for this audience' using errcode = '42501';
    end if;
  end if;

  if p_target_type = 'class' and not exists (
    select 1
    from public.classes c
    where c.id = p_target_class_id
  ) then
    raise exception 'Target class does not exist' using errcode = '23503';
  end if;

  insert into public.announcements (
    author_id,
    title,
    body,
    priority,
    audience,
    target_type,
    target_class_id,
    status,
    publish_at,
    expires_at
  )
  values (
    v_user_id,
    pg_catalog.btrim(p_title),
    p_body,
    p_priority,
    case
      when p_target_type = 'school' then '{"type":"all"}'::jsonb
      else pg_catalog.jsonb_build_object(
        'type', 'classes',
        'ids', pg_catalog.jsonb_build_array(p_target_class_id)
      )
    end,
    p_target_type,
    p_target_class_id,
    'published',
    pg_catalog.now(),
    p_expires_at
  )
  returning id into v_announcement_id;

  select count(*)
  into v_recipient_count
  from public.announcement_recipients ar
  where ar.announcement_id = v_announcement_id;

  return pg_catalog.jsonb_build_object(
    'announcement_id', v_announcement_id,
    'recipients', v_recipient_count,
    'status', 'published'
  );
end;
$$;

revoke all on function public._fanout_announcement() from public;
revoke all on function public.publish_announcement(
  text, text, text, text, uuid, timestamptz
) from public;

grant execute on function public.publish_announcement(
  text, text, text, text, uuid, timestamptz
) to authenticated;



-- Migration: 021_ops_05_award_xp.sql
-- Task: BE-OPS-05

create or replace function public.award_xp(
  student_id uuid,
  amount integer,
  source text,
  ref_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_student_role text;
  v_daily_cap integer;
  v_xp_earned_today bigint;
  v_awarded integer;
  v_total_xp bigint;
  v_level_before integer;
  v_level_after integer;
  v_bonus_coins integer := 0;
  v_xp_ledger_id uuid;
  v_current_coins bigint;
begin
  if amount is null or amount < 0 then
    raise exception 'XP amount must be zero or greater' using errcode = '22023';
  end if;

  if source is null
     or pg_catalog.length(pg_catalog.btrim(source)) = 0
     or pg_catalog.length(source) > 100 then
    raise exception 'Source must contain 1 to 100 characters' using errcode = '22023';
  end if;

  select p.role::text into v_student_role
  from public.profiles p
  where p.id = student_id and p.status::text = 'active';

  if v_student_role is distinct from 'student' then
    raise exception 'An active student profile is required' using errcode = '22023';
  end if;

  if coalesce(auth.role(), '') <> 'service_role' then
    if v_actor is null then
      raise exception 'Authentication required' using errcode = '42501';
    end if;

    select p.role::text into v_actor_role
    from public.profiles p
    where p.id = v_actor and p.status::text = 'active';

    if v_actor_role in ('admin', 'super_admin') then
      null;
    elsif v_actor_role = 'teacher' and exists (
      select 1
      from public.class_teachers ct
      join public.class_enrollments ce on ce.class_id = ct.class_id
      where ct.teacher_id = v_actor
        and ce.student_id = student_id
        and ce.status = 'active'
    ) then
      null;
    else
      raise exception 'Not authorized to award XP to this student' using errcode = '42501';
    end if;
  end if;

  select coalesce((ps.value #>> '{}')::integer, 1000)
  into v_daily_cap
  from public.platform_settings ps
  where ps.key = 'xp_daily_cap';

  v_daily_cap := coalesce(v_daily_cap, 1000);

  if v_daily_cap < 0 then
    raise exception 'Configured daily XP cap cannot be negative' using errcode = '22023';
  end if;

  insert into public.student_stats (student_id)
  values (student_id)
  on conflict (student_id) do nothing;

  select ss.total_xp, ss.current_level
  into v_total_xp, v_level_before
  from public.student_stats ss
  where ss.student_id = student_id
  for update;

  select coalesce(sum(xl.amount), 0)::bigint
  into v_xp_earned_today
  from public.xp_ledger xl
  where xl.student_id = student_id
    and xl.created_at >= pg_catalog.date_trunc('day', pg_catalog.now())
    and xl.created_at < pg_catalog.date_trunc('day', pg_catalog.now()) + interval '1 day';

  v_awarded := greatest(
    0,
    least(amount::bigint, v_daily_cap::bigint - v_xp_earned_today)
  );

  insert into public.xp_ledger (student_id, amount, source, reference_id)
  values (student_id, v_awarded, pg_catalog.btrim(source), ref_id)
  returning id into v_xp_ledger_id;

  select ss.total_xp
  into v_total_xp
  from public.student_stats ss
  where ss.student_id = student_id;

  v_level_after := least(
    60,
    floor(pg_catalog.sqrt(v_total_xp::numeric / 100))::integer + 1
  );
  v_level_before := least(60, greatest(1, v_level_before));

  update public.student_stats
  set current_level = v_level_after
  where student_stats.student_id = award_xp.student_id;

  if v_level_after > v_level_before then
    select coalesce(sum(25 + level_number), 0)::integer
    into v_bonus_coins
    from pg_catalog.generate_series(v_level_before + 1, v_level_after)
      as levels(level_number);

    if v_bonus_coins > 0 then
      insert into public.coin_ledger (student_id, amount, source, reference_id)
      values (student_id, v_bonus_coins, 'level_up_bonus', v_xp_ledger_id);
    end if;

    insert into public.notifications (
      user_id, kind, title, body, payload, priority
    )
    values (
      student_id,
      'level_up',
      'Level up!',
      'You reached level ' || v_level_after::text || '.',
      pg_catalog.jsonb_build_object(
        'event', 'level_up',
        'level_before', v_level_before,
        'level_after', v_level_after,
        'bonus_coins', v_bonus_coins
      ),
      'important'
    );
  end if;

  select ss.current_coins into v_current_coins
  from public.student_stats ss
  where ss.student_id = student_id;

  return pg_catalog.jsonb_build_object(
    'student_id', student_id,
    'requested_xp', amount,
    'awarded_xp', v_awarded,
    'daily_xp_cap', v_daily_cap,
    'xp_earned_today', v_xp_earned_today + v_awarded,
    'capped', v_awarded < amount,
    'total_xp', v_total_xp,
    'level_before', v_level_before,
    'level_after', v_level_after,
    'level_up_bonus_coins', v_bonus_coins,
    'current_coins', v_current_coins,
    'xp_ledger_id', v_xp_ledger_id
  );
end;
$$;

revoke all on function public.award_xp(uuid, integer, text, uuid) from public;
grant execute on function public.award_xp(uuid, integer, text, uuid)
  to authenticated, service_role;



-- Migration: 022_ops_08_publish_course.sql
-- Task: BE-OPS-08

alter table public.courses
  add column if not exists published_at timestamptz;

create or replace function public._prevent_content_snapshot_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Content snapshots are immutable' using errcode = '55000';
end;
$$;

drop trigger if exists content_snapshots_immutable
  on public.content_snapshots;

create trigger content_snapshots_immutable
before update or delete on public.content_snapshots
for each row
execute function public._prevent_content_snapshot_mutation();

create or replace function public._publish_course_snapshot(p_course_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_course public.courses%rowtype;
  v_lesson_count integer;
  v_unit_count integer;
  v_version integer;
  v_snapshot jsonb;
  v_class_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select p.role::text into v_role
  from public.profiles p
  where p.id = v_user_id
    and p.status::text = 'active';

  if v_role is null then
    raise exception 'Active profile required' using errcode = '42501';
  end if;

  select c.* into v_course
  from public.courses c
  where c.id = p_course_id
  for update;

  if not found then
    raise exception 'Course not found' using errcode = 'P0002';
  end if;

  if v_role not in ('admin', 'super_admin')
     and (v_role <> 'teacher' or v_course.author_id is distinct from v_user_id) then
    raise exception 'Only the course author or an admin can publish this course'
      using errcode = '42501';
  end if;

  select count(*) into v_unit_count
  from public.units u
  where u.course_id = p_course_id;

  if v_unit_count < 1 then
    raise exception 'A course must contain at least one unit' using errcode = '22023';
  end if;

  select count(*) into v_lesson_count
  from public.units u
  join public.lessons l on l.unit_id = u.id
  where u.course_id = p_course_id;

  if v_lesson_count < 1 then
    raise exception 'A course must contain at least one lesson' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.units u
    join public.lessons l on l.unit_id = u.id
    where u.course_id = p_course_id
      and (
        pg_catalog.length(pg_catalog.btrim(l.title)) = 0
        or not exists (
          select 1
          from public.lesson_blocks b
          where b.lesson_id = l.id
            and pg_catalog.jsonb_typeof(b.content) = 'object'
            and b.content <> '{}'::jsonb
        )
      )
  ) then
    raise exception 'Every lesson must have a title and at least one non-empty content block'
      using errcode = '22023';
  end if;

  select coalesce(max(cs.version_number), 0) + 1
  into v_version
  from public.content_snapshots cs
  where cs.course_id = p_course_id;

  update public.courses
  set status = 'published',
      published_at = pg_catalog.now()
  where id = p_course_id;

  select pg_catalog.jsonb_build_object(
    'course', pg_catalog.to_jsonb(c),
    'units', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.to_jsonb(u) || pg_catalog.jsonb_build_object(
          'lessons', coalesce((
            select pg_catalog.jsonb_agg(
              pg_catalog.to_jsonb(l) || pg_catalog.jsonb_build_object(
                'blocks', coalesce((
                  select pg_catalog.jsonb_agg(
                    pg_catalog.to_jsonb(b)
                    order by b.order_index, b.id
                  )
                  from public.lesson_blocks b
                  where b.lesson_id = l.id
                ), '[]'::jsonb)
              )
              order by l.order_index, l.id
            )
            from public.lessons l
            where l.unit_id = u.id
          ), '[]'::jsonb)
        )
        order by u.order_index, u.id
      )
      from public.units u
      where u.course_id = p_course_id
    ), '[]'::jsonb),
    'question_references', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(q) order by q.id)
      from (
        select distinct questions.*
        from public.class_courses cc
        join public.assessments a on a.class_id = cc.class_id
        join public.assessment_questions aq on aq.assessment_id = a.id
        join public.questions on questions.id = aq.question_id
        where cc.course_id = p_course_id
      ) q
    ), '[]'::jsonb)
  )
  into v_snapshot
  from public.courses c
  where c.id = p_course_id;

  insert into public.content_snapshots (
    course_id,
    version_number,
    snapshot_data,
    published_by,
    published_at
  )
  values (
    p_course_id,
    v_version,
    v_snapshot,
    v_user_id,
    pg_catalog.now()
  );

  for v_class_id in
    select cc.class_id
    from public.class_courses cc
    where cc.course_id = p_course_id
      and cc.is_active = true
    order by cc.class_id
  loop
    perform realtime.send(
      pg_catalog.jsonb_build_object(
        'course_id', p_course_id,
        'version', v_version,
        'title', v_course.title
      ),
      'course_published',
      'class:' || v_class_id::text,
      true
    );
  end loop;

  return pg_catalog.jsonb_build_object(
    'course_id', p_course_id,
    'published_version', v_version,
    'published_at', pg_catalog.now(),
    'snapshot_id', (
      select cs.id
      from public.content_snapshots cs
      where cs.course_id = p_course_id
        and cs.version_number = v_version
    )
  );
end;
$$;

create or replace function public.publish_course(course_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public._publish_course_snapshot($1);
$$;

create or replace function public.publish_course_changes(course_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public._publish_course_snapshot($1);
$$;

revoke all on function public._prevent_content_snapshot_mutation() from public;
revoke all on function public._publish_course_snapshot(uuid) from public;
revoke all on function public.publish_course(uuid) from public;
revoke all on function public.publish_course_changes(uuid) from public;

grant execute on function public._publish_course_snapshot(uuid) to authenticated;
grant execute on function public.publish_course(uuid) to authenticated;
grant execute on function public.publish_course_changes(uuid) to authenticated;



-- Migration: 023_ops_10_start_quiz.sql
-- Task: BE-OPS-10

create table if not exists public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  attempt_number smallint not null check (attempt_number > 0),
  status text not null default 'in_progress'
    check (status in ('in_progress', 'submitted', 'auto_submitted', 'returned', 'graded')),
  started_at timestamptz not null default public.app_now(),
  expires_at timestamptz,
  submitted_at timestamptz,
  score numeric(5,2),
  max_score numeric(5,2),
  question_order jsonb not null default '[]'::jsonb,
  unique (assessment_id, student_id, attempt_number)
);

create index if not exists idx_assessment_attempts_student_status
  on public.assessment_attempts(student_id, status);

create index if not exists idx_assessment_attempts_assessment_student
  on public.assessment_attempts(assessment_id, student_id, attempt_number);

alter table public.assessment_attempts enable row level security;

create policy "Students read own assessment attempts"
  on public.assessment_attempts
  for select to authenticated
  using (student_id = (select auth.uid()));

grant select on public.assessment_attempts to authenticated;

create or replace function public.start_quiz_attempt(assessment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := auth.uid();
  v_student_role text;
  v_assessment public.assessments%rowtype;
  v_attempt public.assessment_attempts%rowtype;
  v_attempt_count integer;
  v_attempt_number smallint;
  v_started_at timestamptz;
  v_expires_at timestamptz;
  v_question_order jsonb;
  v_questions jsonb;
begin
  if v_student_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select p.role::text into v_student_role
  from public.profiles p
  where p.id = v_student_id
    and p.status::text = 'active';

  if v_student_role is distinct from 'student' then
    raise exception 'An active student profile is required' using errcode = '42501';
  end if;

  select a.* into v_assessment
  from public.assessments a
  where a.id = start_quiz_attempt.assessment_id
    and a.kind = 'quiz'
  for update;

  if not found then
    raise exception 'Quiz not found' using errcode = 'P0002';
  end if;

  if v_assessment.status::text <> 'published' then
    raise exception 'Quiz is not published' using errcode = '55000';
  end if;

  if v_assessment.class_id is null then
    raise exception 'Quiz is not assigned to a class' using errcode = '55000';
  end if;

  if v_assessment.due_date is not null
     and public.app_now() >= v_assessment.due_date then
    raise exception 'Quiz closing time has passed' using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.class_enrollments ce
    where ce.class_id = v_assessment.class_id
      and ce.student_id = v_student_id
      and ce.status = 'active'
  ) then
    raise exception 'Student is not actively enrolled in this class'
      using errcode = '42501';
  end if;

  select aa.* into v_attempt
  from public.assessment_attempts aa
  where aa.assessment_id = v_assessment.id
    and aa.student_id = v_student_id
    and aa.status = 'in_progress'
    and (aa.expires_at is null or aa.expires_at > public.app_now())
  order by aa.attempt_number desc
  limit 1;

  if found then
    v_attempt_number := v_attempt.attempt_number;
    v_started_at := v_attempt.started_at;
    v_expires_at := v_attempt.expires_at;
    v_question_order := v_attempt.question_order;
  else
    select count(*)::integer into v_attempt_count
    from public.assessment_attempts aa
    where aa.assessment_id = v_assessment.id
      and aa.student_id = v_student_id;

    if v_attempt_count >= v_assessment.max_attempts then
      raise exception 'Maximum quiz attempts reached' using errcode = '55000';
    end if;

    v_attempt_number := (v_attempt_count + 1)::smallint;
    v_started_at := public.app_now();

    v_expires_at := case
      when v_assessment.time_limit_minutes is not null then
        least(
          v_started_at + pg_catalog.make_interval(mins => v_assessment.time_limit_minutes),
          v_assessment.due_date
        )
      else v_assessment.due_date
    end;

    select coalesce(
      pg_catalog.jsonb_agg(
        aq.question_id
        order by
          case when v_assessment.shuffle_questions then pg_catalog.random() end,
          aq.order_index,
          aq.question_id
      ),
      '[]'::jsonb
    )
    into v_question_order
    from public.assessment_questions aq
    join public.questions q on q.id = aq.question_id
    where aq.assessment_id = v_assessment.id;

    if pg_catalog.jsonb_array_length(v_question_order) = 0 then
      raise exception 'Quiz has no valid questions' using errcode = '22023';
    end if;

    insert into public.assessment_attempts (
      assessment_id,
      student_id,
      class_id,
      attempt_number,
      status,
      started_at,
      expires_at,
      question_order
    )
    values (
      v_assessment.id,
      v_student_id,
      v_assessment.class_id,
      v_attempt_number,
      'in_progress',
      v_started_at,
      v_expires_at,
      v_question_order
    )
    returning * into v_attempt;
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', q.id,
        'question_type', q.question_type,
        'prompt', q.prompt,
        'options', q.options,
        'points', coalesce(aq.points_override, q.points),
        'difficulty', q.difficulty,
        'tags', q.tags
      )
      order by ord.position
    ),
    '[]'::jsonb
  )
  into v_questions
  from pg_catalog.jsonb_array_elements_text(v_question_order)
       with ordinality as ord(question_id, position)
  join public.questions q on q.id = ord.question_id::uuid
  join public.assessment_questions aq
    on aq.assessment_id = v_assessment.id
   and aq.question_id = q.id;

  return pg_catalog.jsonb_build_object(
    'attempt_id', v_attempt.id,
    'attempt_number', v_attempt_number,
    'started_at', v_started_at,
    'expires_at', v_expires_at,
    'server_time', public.app_now(),
    'questions', v_questions,
    'order', v_question_order
  );
end;
$$;

revoke all on function public.start_quiz_attempt(uuid) from public;
grant execute on function public.start_quiz_attempt(uuid) to authenticated;



-- Migration: 024_ops_01_public_state.sql
create or replace function public.get_public_state()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'maintenance_mode',
    coalesce(
      (select (ps.value ->> 'enabled')::boolean
       from public.platform_settings ps
       where ps.key = 'maintenance'),
      false
    ),
    'registration_enabled',
    coalesce(
      (select (ps.value ->> 'enabled')::boolean
       from public.platform_settings ps
       where ps.key = 'registration'),
      true
    ),
    'school_name',
    coalesce(
      (select ps.value ->> 'school_name'
       from public.platform_settings ps
       where ps.key = 'general'),
      ''
    ),
    'current_academic_year',
    coalesce(
      (select sy.name
       from public.school_years sy
       where sy.is_active is true
       order by sy.start_date desc nulls last
       limit 1),
      ''
    )
  );
$$;

create or replace function public.server_time()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select public.app_now();
$$;

revoke all on function public.get_public_state() from public;
revoke all on function public.server_time() from public;

grant execute on function public.get_public_state() to anon, authenticated;
grant execute on function public.server_time() to anon, authenticated;



-- Migration: 025_ops_06_coins.sql
create or replace function public.award_coins(
  student_id uuid,
  amount integer,
  source text,
  ref_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_student_role text;
  v_balance bigint;
  v_ledger_id uuid;
begin
  if amount is null or amount <= 0 then
    raise exception 'Coin award must be greater than zero'
      using errcode = '22023';
  end if;

  if source is null or length(btrim(source)) = 0 or length(source) > 100 then
    raise exception 'Source must contain 1 to 100 characters'
      using errcode = '22023';
  end if;

  select p.role::text
    into v_student_role
  from public.profiles p
  where p.id = award_coins.student_id
    and p.status::text = 'active';

  if v_student_role is distinct from 'student' then
    raise exception 'An active student profile is required'
      using errcode = '22023';
  end if;

  if coalesce(auth.role(), '') <> 'service_role' then
    if v_actor_id is null then
      raise exception 'Authentication required' using errcode = '42501';
    end if;

    if v_actor_id <> award_coins.student_id then
      select p.role::text
        into v_actor_role
      from public.profiles p
      where p.id = v_actor_id
        and p.status::text = 'active';

      if v_actor_role not in ('admin', 'super_admin')
         and not (
           v_actor_role = 'teacher'
           and exists (
             select 1
             from public.class_teachers ct
             join public.class_enrollments ce
               on ce.class_id = ct.class_id
             where ct.teacher_id = v_actor_id
               and ce.student_id = award_coins.student_id
               and ce.status = 'active'
           )
         ) then
        raise exception 'Not authorized to award coins to this student'
          using errcode = '42501';
      end if;
    end if;
  end if;

  insert into public.student_stats (student_id)
  values (award_coins.student_id)
  on conflict (student_id) do nothing;

  perform 1
  from public.student_stats ss
  where ss.student_id = award_coins.student_id
  for update;

  insert into public.coin_ledger (student_id, amount, source, reference_id)
  values (
    award_coins.student_id,
    amount,
    btrim(source),
    ref_id
  )
  returning id into v_ledger_id;

  select ss.current_coins
    into v_balance
  from public.student_stats ss
  where ss.student_id = award_coins.student_id;

  return jsonb_build_object(
    'student_id', award_coins.student_id,
    'amount_awarded', amount,
    'balance', v_balance,
    'ledger_id', v_ledger_id
  );
end;
$$;


create or replace function public.spend_coins(
  student_id uuid,
  amount integer,
  reason text,
  item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_balance bigint;
  v_ledger_id uuid;
begin
  if amount is null or amount <= 0 then
    raise exception 'Spend amount must be greater than zero'
      using errcode = '22023';
  end if;

  if reason is null or length(btrim(reason)) = 0 or length(reason) > 200 then
    raise exception 'A reason of 1 to 200 characters is required'
      using errcode = '22023';
  end if;

  if v_actor_id is null or v_actor_id <> spend_coins.student_id then
    raise exception 'You can only spend your own coins'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = spend_coins.student_id
      and p.role::text = 'student'
      and p.status::text = 'active'
  ) then
    raise exception 'An active student profile is required'
      using errcode = '22023';
  end if;

  insert into public.student_stats (student_id)
  values (spend_coins.student_id)
  on conflict (student_id) do nothing;

  select ss.current_coins
    into v_balance
  from public.student_stats ss
  where ss.student_id = spend_coins.student_id
  for update;

  if v_balance < amount then
    raise exception 'Insufficient coins'
      using errcode = 'P0001';
  end if;

  if item_id is not null and not exists (
    select 1
    from public.shop_items si
    where si.id = spend_coins.item_id
      and si.is_available is true
      and si.coin_price = spend_coins.amount
  ) then
    raise exception 'Shop item is unavailable or price does not match'
      using errcode = 'P0001';
  end if;

  insert into public.coin_ledger (student_id, amount, source, reference_id)
  values (
    spend_coins.student_id,
    -amount,
    btrim(reason),
    item_id
  )
  returning id into v_ledger_id;

  select ss.current_coins
    into v_balance
  from public.student_stats ss
  where ss.student_id = spend_coins.student_id;

  return jsonb_build_object(
    'student_id', spend_coins.student_id,
    'amount_spent', amount,
    'balance', v_balance,
    'ledger_id', v_ledger_id
  );
end;
$$;


revoke all on function public.award_coins(uuid, integer, text, uuid) from public;
revoke all on function public.spend_coins(uuid, integer, text, uuid) from public;

grant execute on function public.award_coins(uuid, integer, text, uuid)
  to authenticated, service_role;
grant execute on function public.spend_coins(uuid, integer, text, uuid)
  to authenticated;



-- Migration: 026_ops_07_streaks.sql
create or replace function public.record_daily_activity(student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_timezone text;
  v_today date;
  v_latest_activity date;
  v_current_streak integer;
  v_longest_streak integer;
  v_freezes integer;
  v_used_freeze boolean := false;
  v_already_active_today boolean;
begin
  if v_actor_id is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if v_actor_id is not null
     and v_actor_id <> student_id
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'You can only record your own activity' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = student_id
      and p.role::text = 'student'
      and p.status::text = 'active'
  ) then
    raise exception 'An active student profile is required' using errcode = '22023';
  end if;

  select coalesce(nullif(ps.value ->> 'timezone', ''), 'UTC')
    into v_timezone
  from public.platform_settings ps
  where ps.key = 'region';

  v_timezone := coalesce(v_timezone, 'UTC');

  begin
    v_today := (public.app_now() at time zone v_timezone)::date;
  exception
    when invalid_parameter_value then
      v_today := (public.app_now() at time zone 'UTC')::date;
      v_timezone := 'UTC';
  end;

  insert into public.student_stats (student_id)
  values (student_id)
  on conflict (student_id) do nothing;

  -- Serialize activity and freeze updates for this student.
  select ss.current_streak, ss.longest_streak, ss.streak_freeze_count
    into v_current_streak, v_longest_streak, v_freezes
  from public.student_stats ss
  where ss.student_id = record_daily_activity.student_id
  for update;

  select exists (
    select 1
    from public.streak_days sd
    where sd.student_id = record_daily_activity.student_id
      and sd.activity_date = v_today
      and sd.xp_earned > 0
  ) into v_already_active_today;

  if v_already_active_today then
    update public.streak_days
       set xp_earned = xp_earned + 1
     where streak_days.student_id = record_daily_activity.student_id
       and streak_days.activity_date = v_today;
  else
    select max(sd.activity_date)
      into v_latest_activity
    from public.streak_days sd
    where sd.student_id = record_daily_activity.student_id
      and sd.xp_earned > 0;

    if v_latest_activity = v_today - 1 then
      v_current_streak := v_current_streak + 1;
    elsif v_latest_activity = v_today - 2 and v_freezes > 0 then
      insert into public.streak_days (student_id, activity_date, xp_earned, is_frozen)
      values (record_daily_activity.student_id, v_today - 1, 0, true)
      on conflict (student_id, activity_date)
      do update set is_frozen = true;

      v_freezes := v_freezes - 1;
      v_current_streak := v_current_streak + 1;
      v_used_freeze := true;
    else
      v_current_streak := 1;
    end if;

    insert into public.streak_days (student_id, activity_date, xp_earned)
    values (record_daily_activity.student_id, v_today, 1)
    on conflict (student_id, activity_date)
    do update set xp_earned = streak_days.xp_earned + 1;

    v_longest_streak := greatest(v_longest_streak, v_current_streak);

    update public.student_stats
       set current_streak = v_current_streak,
           longest_streak = v_longest_streak,
           streak_freeze_count = v_freezes,
           last_active_date = v_today
     where student_stats.student_id = record_daily_activity.student_id;
  end if;

  return jsonb_build_object(
    'student_id', record_daily_activity.student_id,
    'activity_date', v_today,
    'timezone', v_timezone,
    'current_streak', v_current_streak,
    'longest_streak', v_longest_streak,
    'streak_freeze_count', v_freezes,
    'freeze_used', v_used_freeze
  );
end;
$$;


create or replace function public.buy_streak_freeze(student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_freeze_price integer;
  v_current_coins bigint;
  v_freeze_count integer;
begin
  if v_actor_id is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if v_actor_id is not null
     and v_actor_id <> student_id
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'You can only buy a freeze for your own account' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = student_id
      and p.role::text = 'student'
      and p.status::text = 'active'
  ) then
    raise exception 'An active student profile is required' using errcode = '22023';
  end if;

  -- Configure this setting as a JSON number; defaults to 100 coins.
  select coalesce((ps.value #>> '{}')::integer, 100)
    into v_freeze_price
  from public.platform_settings ps
  where ps.key = 'streak_freeze_price';

  v_freeze_price := coalesce(v_freeze_price, 100);

  if v_freeze_price < 0 then
    raise exception 'Streak freeze price cannot be negative' using errcode = '22023';
  end if;

  insert into public.student_stats (student_id)
  values (student_id)
  on conflict (student_id) do nothing;

  select ss.current_coins, ss.streak_freeze_count
    into v_current_coins, v_freeze_count
  from public.student_stats ss
  where ss.student_id = buy_streak_freeze.student_id
  for update;

  if v_freeze_count >= 3 then
    raise exception 'Streak freeze limit reached' using errcode = 'P0001';
  end if;

  if v_current_coins < v_freeze_price then
    raise exception 'Insufficient coins' using errcode = 'P0001';
  end if;

  -- The coin-ledger trigger atomically updates student_stats.current_coins.
  insert into public.coin_ledger (student_id, amount, source, reference_id)
  values (
    buy_streak_freeze.student_id,
    -v_freeze_price,
    'streak_freeze_purchase',
    null
  );

  update public.student_stats
     set streak_freeze_count = streak_freeze_count + 1
   where student_stats.student_id = buy_streak_freeze.student_id
  returning current_coins, streak_freeze_count
       into v_current_coins, v_freeze_count;

  return jsonb_build_object(
    'student_id', buy_streak_freeze.student_id,
    'coins_spent', v_freeze_price,
    'current_coins', v_current_coins,
    'streak_freeze_count', v_freeze_count
  );
end;
$$;

revoke all on function public.record_daily_activity(uuid) from public;
revoke all on function public.buy_streak_freeze(uuid) from public;

grant execute on function public.record_daily_activity(uuid)
  to authenticated, service_role;
grant execute on function public.buy_streak_freeze(uuid)
  to authenticated, service_role;



-- Migration: 027_ops_09_lesson_progress.sql
create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  is_completed boolean not null default false,
  completed_at timestamptz,
  last_accessed_at timestamptz not null default public.app_now(),
  unique (student_id, lesson_id)
);

create table if not exists public.activity_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  activity_id uuid not null,
  answers jsonb not null default '{}'::jsonb,
  score numeric(5,2),
  completed_at timestamptz,
  unique (student_id, activity_id)
);

create index if not exists idx_lesson_progress_student
  on public.lesson_progress(student_id, last_accessed_at desc);
create index if not exists idx_activity_progress_student
  on public.activity_progress(student_id, completed_at desc);

create or replace function public.complete_lesson(lesson_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := auth.uid();
  v_unit_id uuid;
  v_course_id uuid;
  v_xp integer;
  v_coins integer;
  v_first boolean;
  v_xp_result jsonb;
  v_coin_result jsonb;
  v_unlocked uuid[] := '{}';
begin
  if v_student_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select l.unit_id, u.course_id, l.xp_reward, l.coin_reward
    into v_unit_id, v_course_id, v_xp, v_coins
  from public.lessons l
  join public.units u on u.id = l.unit_id
  where l.id = complete_lesson.lesson_id;

  if not found then
    raise exception 'Lesson not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.profiles p
    join public.class_enrollments ce on ce.student_id = p.id
    join public.class_courses cc on cc.class_id = ce.class_id
    where p.id = v_student_id
      and p.role::text = 'student'
      and p.status::text = 'active'
      and ce.status = 'active'
      and cc.course_id = v_course_id
      and cc.is_active
  ) then
    raise exception 'Active enrollment in this course is required'
      using errcode = '42501';
  end if;

  insert into public.lesson_progress(student_id, lesson_id)
  values (v_student_id, complete_lesson.lesson_id)
  on conflict (student_id, lesson_id) do nothing;

  select not lp.is_completed
    into v_first
  from public.lesson_progress lp
  where lp.student_id = v_student_id
    and lp.lesson_id = complete_lesson.lesson_id
  for update;

  update public.lesson_progress
     set is_completed = true,
         completed_at = coalesce(completed_at, public.app_now()),
         last_accessed_at = public.app_now()
   where student_id = v_student_id
     and lesson_id = complete_lesson.lesson_id;

  if v_first then
    v_xp_result := public.award_xp(
      v_student_id, coalesce(v_xp, 20), 'lesson', complete_lesson.lesson_id
    );
    v_coin_result := public.award_coins(
      v_student_id, coalesce(v_coins, 5), 'lesson', complete_lesson.lesson_id
    );
  else
    v_xp_result := jsonb_build_object('awarded_xp', 0, 'repeat', true);
    v_coin_result := jsonb_build_object('amount_awarded', 0);
  end if;

  perform public.record_daily_activity(v_student_id);

  with completed_unit as (
    select u.id, u.course_id, u.order_index
    from public.units u
    where u.id = v_unit_id
      and not exists (
        select 1
        from public.lessons l
        left join public.lesson_progress lp
          on lp.lesson_id = l.id
         and lp.student_id = v_student_id
        where l.unit_id = u.id
          and coalesce(lp.is_completed, false) = false
      )
  ),
  next_unit as (
    select u.id, u.course_id
    from completed_unit cu
    join lateral (
      select un.id, un.course_id
      from public.units un
      where un.course_id = cu.course_id
        and un.order_index > cu.order_index
      order by un.order_index
      limit 1
    ) u on true
  )
  insert into public.class_unlock_overrides
    (class_id, student_id, target_type, target_id, is_unlocked, reason)
  select ce.class_id, v_student_id, 'unit', nu.id, true, 'Previous unit completed'
  from next_unit nu
  join public.class_courses cc on cc.course_id = nu.course_id and cc.is_active
  join public.class_enrollments ce
    on ce.class_id = cc.class_id
   and ce.student_id = v_student_id
   and ce.status = 'active'
  where not exists (
    select 1
    from public.class_unlock_overrides o
    where o.class_id = ce.class_id
      and o.student_id = v_student_id
      and o.target_type = 'unit'
      and o.target_id = nu.id
      and o.is_unlocked
  )
  returning target_id into v_unlocked;

  return jsonb_build_object(
    'lesson_id', complete_lesson.lesson_id,
    'completed', true,
    'first_completion', v_first,
    'xp', v_xp_result,
    'coins', v_coin_result,
    'unlocked_unit_ids', to_jsonb(v_unlocked)
  );
end;
$$;

create or replace function public.submit_activity(
  activity_id uuid,
  answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := auth.uid();
  v_lesson_id uuid;
  v_score numeric(5,2);
begin
  if v_student_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if answers is null or jsonb_typeof(answers) not in ('object', 'array') then
    raise exception 'Answers must be a JSON object or array'
      using errcode = '22023';
  end if;

  select lb.lesson_id
    into v_lesson_id
  from public.lesson_blocks lb
  where lb.id = submit_activity.activity_id
    and lb.block_type = 'check';

  if not found then
    raise exception 'Activity not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.lesson_progress lp
    where lp.student_id = v_student_id
      and lp.lesson_id = v_lesson_id
  ) then
    insert into public.lesson_progress(student_id, lesson_id)
    values (v_student_id, v_lesson_id)
    on conflict (student_id, lesson_id) do nothing;
  end if;

  v_score := null;

  insert into public.activity_progress
    (student_id, activity_id, answers, score, completed_at)
  values
    (v_student_id, submit_activity.activity_id, answers, v_score, public.app_now())
  on conflict (student_id, activity_id)
  do update set
    answers = excluded.answers,
    score = excluded.score,
    completed_at = excluded.completed_at;

  perform public.record_daily_activity(v_student_id);

  return jsonb_build_object(
    'activity_id', submit_activity.activity_id,
    'completed', true,
    'score', v_score
  );
end;
$$;

revoke all on function public.complete_lesson(uuid) from public;
revoke all on function public.submit_activity(uuid, jsonb) from public;
grant execute on function public.complete_lesson(uuid) to authenticated;
grant execute on function public.submit_activity(uuid, jsonb) to authenticated;



-- Migration: 028_ops_11_submit_quiz.sql
-- Stores student answers and server-calculated scores for each question.
create table if not exists public.attempt_answers (
  attempt_id uuid not null
    references public.assessment_attempts(id) on delete cascade,
  question_id uuid not null
    references public.questions(id) on delete cascade,
  answer jsonb not null default 'null'::jsonb,
  is_correct boolean,
  points_awarded numeric(7,2) not null default 0,
  updated_at timestamptz not null default public.app_now(),
  primary key (attempt_id, question_id)
);

alter table public.attempt_answers enable row level security;

create policy "Students read their own attempt answers"
  on public.attempt_answers
  for select to authenticated
  using (
    exists (
      select 1
      from public.assessment_attempts aa
      where aa.id = attempt_answers.attempt_id
        and aa.student_id = (select auth.uid())
    )
  );

revoke all on public.attempt_answers from public, anon, authenticated;
grant select on public.attempt_answers to authenticated;


create or replace function public.save_quiz_answers(
  attempt_id uuid,
  answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.assessment_attempts%rowtype;
  v_entry record;
  v_question_id uuid;
  v_now timestamptz := public.app_now();
  v_saved integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if answers is null or jsonb_typeof(answers) <> 'object' then
    raise exception 'Answers must be a JSON object keyed by question ID'
      using errcode = '22023';
  end if;

  select aa.*
    into v_attempt
  from public.assessment_attempts aa
  where aa.id = save_quiz_answers.attempt_id
    and aa.student_id = auth.uid()
  for update;

  if not found then
    raise exception 'Quiz attempt not found' using errcode = 'P0002';
  end if;

  if v_attempt.status <> 'in_progress' then
    raise exception 'Quiz attempt is not in progress' using errcode = '55000';
  end if;

  if v_attempt.expires_at is not null and v_now > v_attempt.expires_at then
    raise exception 'Quiz attempt has expired' using errcode = '55000';
  end if;

  for v_entry in
    select key, value
    from jsonb_each(answers)
  loop
    begin
      v_question_id := v_entry.key::uuid;
    exception when invalid_text_representation then
      raise exception 'Invalid question ID in answers'
        using errcode = '22023';
    end;

    if not (v_attempt.question_order @> jsonb_build_array(v_question_id::text)) then
      raise exception 'Answer includes a question outside this attempt'
        using errcode = '22023';
    end if;

    insert into public.attempt_answers (attempt_id, question_id, answer, updated_at)
    values (v_attempt.id, v_question_id, v_entry.value, v_now)
    on conflict (attempt_id, question_id)
    do update set
      answer = excluded.answer,
      updated_at = excluded.updated_at;

    v_saved := v_saved + 1;
  end loop;

  return jsonb_build_object('ok', true, 'saved', v_saved);
end;
$$;


create or replace function public.submit_quiz_attempt(attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.assessment_attempts%rowtype;
  v_assessment public.assessments%rowtype;
  v_question record;
  v_answer jsonb;
  v_given jsonb;
  v_expected jsonb;
  v_accepted jsonb;
  v_expected_ids text[];
  v_given_ids text[];
  v_expected_count integer;
  v_correct_count integer;
  v_blank_index integer;
  v_ratio numeric;
  v_points numeric;
  v_awarded numeric := 0;
  v_max_score numeric := 0;
  v_score_pct numeric := 0;
  v_all_auto_graded boolean := true;
  v_is_correct boolean;
  v_now timestamptz := public.app_now();
  v_previous_best_pct numeric := 0;
  v_new_best_pct numeric;
  v_xp_for_best integer;
  v_xp_for_previous_best integer;
  v_xp_delta integer;
  v_coin_reward integer := 0;
  v_coin_ledger_id uuid;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select aa.*
    into v_attempt
  from public.assessment_attempts aa
  where aa.id = submit_quiz_attempt.attempt_id
    and aa.student_id = auth.uid()
  for update;

  if not found then
    raise exception 'Quiz attempt not found' using errcode = 'P0002';
  end if;

  if v_attempt.status <> 'in_progress' then
    raise exception 'Quiz attempt is not in progress' using errcode = '55000';
  end if;

  if v_attempt.expires_at is not null
     and v_now > v_attempt.expires_at + interval '30 seconds' then
    raise exception 'Quiz attempt time limit exceeded' using errcode = '55000';
  end if;

  -- Serialize submissions for this quiz so attempts cannot double-award rewards.
  select a.*
    into v_assessment
  from public.assessments a
  where a.id = v_attempt.assessment_id
  for update;

  if not found then
    raise exception 'Quiz not found' using errcode = 'P0002';
  end if;

  for v_question in
    select
      q.id as question_id,
      q.question_type::text as question_type,
      q.correct_answer,
      coalesce(aq.points_override, q.points)::numeric as points
    from jsonb_array_elements_text(v_attempt.question_order)
         with ordinality as ord(question_id, position)
    join public.questions q on q.id = ord.question_id::uuid
    join public.assessment_questions aq
      on aq.assessment_id = v_attempt.assessment_id
     and aq.question_id = q.id
    order by ord.position
  loop
    v_points := greatest(coalesce(v_question.points, 0), 0);
    v_max_score := v_max_score + v_points;
    v_ratio := 0;
    v_is_correct := false;

    select aa.answer
      into v_answer
    from public.attempt_answers aa
    where aa.attempt_id = v_attempt.id
      and aa.question_id = v_question.question_id;

    if not found then
      v_answer := 'null'::jsonb;
    end if;

    if v_question.question_type = 'multiple_choice' then
      v_expected := v_question.correct_answer -> 'correct';
      v_given := case
        when jsonb_typeof(v_answer) = 'object'
          then coalesce(v_answer -> 'selected', v_answer -> 'answer', '[]'::jsonb)
        else v_answer
      end;

      if jsonb_typeof(v_expected) <> 'array' then
        raise exception 'Invalid answer key for question %', v_question.question_id
          using errcode = '22023';
      end if;

      if jsonb_typeof(v_given) <> 'array' then
        v_given := case
          when v_given = 'null'::jsonb then '[]'::jsonb
          else jsonb_build_array(v_given)
        end;
      end if;

      select coalesce(array_agg(value order by value), array[]::text[])
        into v_expected_ids
      from jsonb_array_elements_text(v_expected);

      select coalesce(array_agg(value order by value), array[]::text[])
        into v_given_ids
      from jsonb_array_elements_text(v_given);

      if v_expected_ids = v_given_ids and cardinality(v_expected_ids) > 0 then
        v_ratio := 1;
      end if;

    elsif v_question.question_type = 'matching' then
      v_expected := v_question.correct_answer -> 'pairs';
      v_given := case
        when jsonb_typeof(v_answer) = 'object'
          then coalesce(v_answer -> 'pairs', '[]'::jsonb)
        else v_answer
      end;

      if jsonb_typeof(v_expected) <> 'array' then
        raise exception 'Invalid answer key for question %', v_question.question_id
          using errcode = '22023';
      end if;

      if jsonb_typeof(v_given) <> 'array' then
        v_given := '[]'::jsonb;
      end if;

      select count(*)::integer
        into v_expected_count
      from jsonb_array_elements(v_expected);

      if v_expected_count > 0 then
        select count(*)::integer
          into v_correct_count
        from jsonb_array_elements(v_expected) expected_pair(value)
        where exists (
          select 1
          from jsonb_array_elements(v_given) given_pair(value)
          where given_pair.value = expected_pair.value
        );

        v_ratio := v_correct_count::numeric / v_expected_count;
      end if;

    elsif v_question.question_type = 'fill_blank' then
      v_expected := v_question.correct_answer -> 'blanks';
      v_given := case
        when jsonb_typeof(v_answer) = 'object'
          then coalesce(v_answer -> 'blanks', '[]'::jsonb)
        else v_answer
      end;

      if jsonb_typeof(v_expected) <> 'array' then
        raise exception 'Invalid answer key for question %', v_question.question_id
          using errcode = '22023';
      end if;

      if jsonb_typeof(v_given) <> 'array' then
        v_given := '[]'::jsonb;
      end if;

      v_expected_count := jsonb_array_length(v_expected);
      v_correct_count := 0;

      if v_expected_count > 0 then
        for v_blank_index in 0 .. v_expected_count - 1 loop
          v_accepted := v_expected -> v_blank_index;

          if jsonb_typeof(v_accepted) <> 'array' then
            raise exception 'Invalid fill-blank answer key for question %',
              v_question.question_id
              using errcode = '22023';
          end if;

          if v_blank_index < jsonb_array_length(v_given)
             and jsonb_typeof(v_given -> v_blank_index) = 'string'
             and exists (
               select 1
               from jsonb_array_elements_text(v_accepted) accepted(value)
               where lower(regexp_replace(btrim(accepted.value), '[[:space:]]+', ' ', 'g'))
                   = lower(regexp_replace(
                       btrim(v_given ->> v_blank_index),
                       '[[:space:]]+',
                       ' ',
                       'g'
                     ))
             ) then
            v_correct_count := v_correct_count + 1;
          end if;
        end loop;

        v_ratio := v_correct_count::numeric / v_expected_count;
      end if;

    else
      -- Non-objective question types remain available for teacher grading.
      v_all_auto_graded := false;
      v_is_correct := null;
      v_ratio := 0;
    end if;

    v_ratio := greatest(0, least(v_ratio, 1));
    v_awarded := v_awarded + round(v_points * v_ratio, 2);

    if v_is_correct is not null then
      v_is_correct := v_ratio = 1;
    end if;

    insert into public.attempt_answers (
      attempt_id,
      question_id,
      answer,
      is_correct,
      points_awarded,
      updated_at
    )
    values (
      v_attempt.id,
      v_question.question_id,
      v_answer,
      v_is_correct,
      round(v_points * v_ratio, 2),
      v_now
    )
    on conflict (attempt_id, question_id)
    do update set
      is_correct = excluded.is_correct,
      points_awarded = excluded.points_awarded,
      updated_at = excluded.updated_at;
  end loop;

  if v_max_score > 0 then
    v_score_pct := round((v_awarded / v_max_score) * 100, 2);
  end if;

  v_status := case when v_all_auto_graded then 'graded' else 'submitted' end;

  update public.assessment_attempts
     set status = v_status,
         submitted_at = v_now,
         score = round(v_awarded, 2),
         max_score = round(v_max_score, 2)
   where id = v_attempt.id;

  -- Pay only the improvement over the student's previous best quiz result.
  select coalesce(max(
    case
      when aa.max_score > 0 then round((aa.score / aa.max_score) * 100, 2)
      else 0
    end
  ), 0)
    into v_previous_best_pct
  from public.assessment_attempts aa
  where aa.assessment_id = v_attempt.assessment_id
    and aa.student_id = v_attempt.student_id
    and aa.id <> v_attempt.id
    and aa.status = 'graded';

  v_new_best_pct := greatest(v_previous_best_pct, v_score_pct);

  v_xp_for_best := 20 + round(30 * v_new_best_pct / 100)::integer;
  if v_new_best_pct = 100 then
    v_xp_for_best := v_xp_for_best + 10;
  end if;

  v_xp_for_previous_best := 0;
  if v_previous_best_pct > 0 then
    v_xp_for_previous_best := 20 + round(30 * v_previous_best_pct / 100)::integer;
    if v_previous_best_pct = 100 then
      v_xp_for_previous_best := v_xp_for_previous_best + 10;
    end if;
  end if;

  v_xp_delta := greatest(v_xp_for_best - v_xp_for_previous_best, 0);

  perform public.award_xp(
    v_attempt.student_id,
    v_xp_delta,
    'quiz',
    v_attempt.id
  );

  if v_score_pct >= v_assessment.pass_percentage
     and not exists (
       select 1
       from public.coin_ledger cl
       where cl.student_id = v_attempt.student_id
         and cl.source = 'quiz_pass'
         and cl.reference_id = v_assessment.id
     ) then
    v_coin_reward := 15;
    if v_score_pct = 100 then
      v_coin_reward := v_coin_reward + 10;
    end if;

    insert into public.coin_ledger (student_id, amount, source, reference_id)
    values (
      v_attempt.student_id,
      v_coin_reward,
      'quiz_pass',
      v_assessment.id
    )
    returning id into v_coin_ledger_id;
  end if;

  return jsonb_build_object(
    'attempt_id', v_attempt.id,
    'status', v_status,
    'score', round(v_awarded, 2),
    'max_score', round(v_max_score, 2),
    'score_percentage', v_score_pct,
    'xp_awarded', v_xp_delta,
    'coins_awarded', v_coin_reward,
    'coin_ledger_id', v_coin_ledger_id
  );
end;
$$;

revoke all on function public.save_quiz_answers(uuid, jsonb) from public;
revoke all on function public.submit_quiz_attempt(uuid) from public;

grant execute on function public.save_quiz_answers(uuid, jsonb) to authenticated;
grant execute on function public.submit_quiz_attempt(uuid) to authenticated;



-- Migration: 029_ops_12_assignment_submission.sql
create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'submitted', 'graded', 'returned')),
  draft_data jsonb not null default '{}'::jsonb,
  submitted_data jsonb,
  draft_version integer not null default 0 check (draft_version >= 0),
  started_at timestamptz not null default public.app_now(),
  submitted_at timestamptz,
  is_late boolean not null default false,
  late_penalty_pct numeric(5,2) not null default 0
    check (late_penalty_pct >= 0 and late_penalty_pct <= 100),
  created_at timestamptz not null default public.app_now(),
  updated_at timestamptz not null default public.app_now(),
  unique (assessment_id, student_id)
);

create table if not exists public.assignment_submission_revisions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null
    references public.assignment_submissions(id) on delete cascade,
  revision_number integer not null,
  revision_type text not null check (revision_type in ('draft', 'submitted')),
  data jsonb not null,
  created_at timestamptz not null default public.app_now(),
  unique (submission_id, revision_number, revision_type)
);

create index if not exists idx_assignment_submissions_class_status
  on public.assignment_submissions (class_id, status, submitted_at);

create index if not exists idx_assignment_submissions_student_status
  on public.assignment_submissions (student_id, status);

create index if not exists idx_assignment_submission_revisions_submission
  on public.assignment_submission_revisions (submission_id, revision_number desc);

alter table public.assignment_submissions enable row level security;
alter table public.assignment_submission_revisions enable row level security;

create policy "Students and class teachers read assignment submissions"
  on public.assignment_submissions
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or exists (
      select 1
      from public.class_teachers ct
      where ct.class_id = assignment_submissions.class_id
        and ct.teacher_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role::text in ('admin', 'super_admin')
        and p.status::text = 'active'
    )
  );

create policy "Students and class teachers read submission revisions"
  on public.assignment_submission_revisions
  for select to authenticated
  using (
    exists (
      select 1
      from public.assignment_submissions s
      where s.id = assignment_submission_revisions.submission_id
        and (
          s.student_id = (select auth.uid())
          or exists (
            select 1
            from public.class_teachers ct
            where ct.class_id = s.class_id
              and ct.teacher_id = (select auth.uid())
          )
          or exists (
            select 1
            from public.profiles p
            where p.id = (select auth.uid())
              and p.role::text in ('admin', 'super_admin')
              and p.status::text = 'active'
          )
        )
    )
  );

revoke all on public.assignment_submissions from public, anon, authenticated;
revoke all on public.assignment_submission_revisions from public, anon, authenticated;
grant select on public.assignment_submissions to authenticated;
grant select on public.assignment_submission_revisions to authenticated;


create or replace function public.save_assignment_draft(
  assessment_id uuid,
  draft_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := auth.uid();
  v_assessment public.assessments%rowtype;
  v_submission public.assignment_submissions%rowtype;
begin
  if v_student_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if draft_data is null
     or jsonb_typeof(draft_data) not in ('object', 'array') then
    raise exception 'Draft data must be a JSON object or array'
      using errcode = '22023';
  end if;

  select a.*
    into v_assessment
  from public.assessments a
  where a.id = save_assignment_draft.assessment_id
    and a.kind::text = 'assignment'
  for update;

  if not found then
    raise exception 'Assignment not found' using errcode = 'P0002';
  end if;

  if v_assessment.status::text <> 'published'
     or v_assessment.class_id is null then
    raise exception 'Assignment is not available' using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.profiles p
    join public.class_enrollments ce
      on ce.student_id = p.id
    where p.id = v_student_id
      and p.role::text = 'student'
      and p.status::text = 'active'
      and ce.class_id = v_assessment.class_id
      and ce.status = 'active'
  ) then
    raise exception 'Active enrollment in this class is required'
      using errcode = '42501';
  end if;

  insert into public.assignment_submissions (
    assessment_id,
    student_id,
    class_id,
    status,
    draft_data,
    draft_version
  )
  values (
    v_assessment.id,
    v_student_id,
    v_assessment.class_id,
    'in_progress',
    draft_data,
    1
  )
  on conflict (assessment_id, student_id)
  do update set
    status = 'in_progress',
    draft_data = excluded.draft_data,
    draft_version = assignment_submissions.draft_version + 1,
    updated_at = public.app_now()
  where assignment_submissions.status in ('in_progress', 'returned')
  returning * into v_submission;

  if not found then
    raise exception 'This assignment has already been submitted'
      using errcode = '55000';
  end if;

  insert into public.assignment_submission_revisions (
    submission_id,
    revision_number,
    revision_type,
    data
  )
  values (
    v_submission.id,
    v_submission.draft_version,
    'draft',
    draft_data
  );

  return jsonb_build_object(
    'submission_id', v_submission.id,
    'draft_version', v_submission.draft_version,
    'saved_at', v_submission.updated_at
  );
end;
$$;


create or replace function public.submit_assignment(
  assessment_id uuid,
  submission_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := auth.uid();
  v_assessment public.assessments%rowtype;
  v_submission public.assignment_submissions%rowtype;
  v_late_allowed boolean := true;
  v_late_penalty integer := 10;
  v_is_late boolean := false;
  v_penalty_pct numeric(5,2) := 0;
  v_now timestamptz := public.app_now();
  v_teacher record;
begin
  if v_student_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if submission_data is null
     or jsonb_typeof(submission_data) not in ('object', 'array') then
    raise exception 'Submission data must be a JSON object or array'
      using errcode = '22023';
  end if;

  -- Lock the assignment so its deadline and class rules stay consistent
  -- through the submission transaction.
  select a.*
    into v_assessment
  from public.assessments a
  where a.id = submit_assignment.assessment_id
    and a.kind::text = 'assignment'
  for update;

  if not found then
    raise exception 'Assignment not found' using errcode = 'P0002';
  end if;

  if v_assessment.status::text <> 'published'
     or v_assessment.class_id is null then
    raise exception 'Assignment is not available' using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.profiles p
    join public.class_enrollments ce
      on ce.student_id = p.id
    where p.id = v_student_id
      and p.role::text = 'student'
      and p.status::text = 'active'
      and ce.class_id = v_assessment.class_id
      and ce.status = 'active'
  ) then
    raise exception 'Active enrollment in this class is required'
      using errcode = '42501';
  end if;

  select
    coalesce(cr.late_submission_allowed, true),
    coalesce(cr.late_penalty_percent, 10)
    into v_late_allowed, v_late_penalty
  from public.class_rules cr
  where cr.class_id = v_assessment.class_id;

  v_late_allowed := coalesce(v_late_allowed, true);
  v_late_penalty := coalesce(v_late_penalty, 10);

  v_is_late :=
    v_assessment.due_date is not null
    and v_now > v_assessment.due_date;

  if v_is_late and not v_late_allowed then
    raise exception 'Late submissions are not allowed for this class'
      using errcode = '55000';
  end if;

  if v_is_late then
    v_penalty_pct := greatest(0, least(v_late_penalty, 100));
  end if;

  insert into public.assignment_submissions (
    assessment_id,
    student_id,
    class_id,
    status,
    draft_data,
    submitted_data,
    draft_version,
    submitted_at,
    is_late,
    late_penalty_pct,
    updated_at
  )
  values (
    v_assessment.id,
    v_student_id,
    v_assessment.class_id,
    'submitted',
    submission_data,
    submission_data,
    1,
    v_now,
    v_is_late,
    v_penalty_pct,
    v_now
  )
  on conflict (assessment_id, student_id) do nothing;

  select s.*
    into v_submission
  from public.assignment_submissions s
  where s.assessment_id = v_assessment.id
    and s.student_id = v_student_id
  for update;

  if v_submission.status = 'submitted' or v_submission.status = 'graded' then
    return jsonb_build_object(
      'ok', true,
      'already_submitted', true,
      'submission_id', v_submission.id,
      'status', v_submission.status,
      'submitted_at', v_submission.submitted_at
    );
  end if;

  if v_submission.status not in ('in_progress', 'returned') then
    raise exception 'Submission cannot be submitted in its current state'
      using errcode = '55000';
  end if;

  update public.assignment_submissions
     set status = 'submitted',
         submitted_data = submission_data,
         draft_data = submission_data,
         draft_version = draft_version + 1,
         submitted_at = v_now,
         is_late = v_is_late,
         late_penalty_pct = v_penalty_pct,
         updated_at = v_now
   where id = v_submission.id
  returning * into v_submission;

  insert into public.assignment_submission_revisions (
    submission_id,
    revision_number,
    revision_type,
    data
  )
  values (
    v_submission.id,
    v_submission.draft_version,
    'submitted',
    submission_data
  );

  -- A submitted row in this indexed state is the teacher grading queue entry.
  for v_teacher in
    select ct.teacher_id
    from public.class_teachers ct
    where ct.class_id = v_assessment.class_id
  loop
    insert into public.notifications (
      user_id,
      kind,
      title,
      body,
      payload,
      link
    )
    values (
      v_teacher.teacher_id,
      'assignment_submission',
      'Assignment submitted',
      'A student submitted an assignment for grading.',
      jsonb_build_object(
        'submission_id', v_submission.id,
        'assessment_id', v_assessment.id,
        'class_id', v_assessment.class_id,
        'student_id', v_student_id,
        'is_late', v_is_late,
        'late_penalty_pct', v_penalty_pct
      ),
      'assignment'
    );
  end loop;

  return jsonb_build_object(
    'ok', true,
    'already_submitted', false,
    'submission_id', v_submission.id,
    'status', v_submission.status,
    'submitted_at', v_submission.submitted_at,
    'is_late', v_submission.is_late,
    'late_penalty_pct', v_submission.late_penalty_pct,
    'draft_version', v_submission.draft_version
  );
end;
$$;

revoke all on function public.save_assignment_draft(uuid, jsonb) from public;
revoke all on function public.submit_assignment(uuid, jsonb) from public;

grant execute on function public.save_assignment_draft(uuid, jsonb)
  to authenticated;
grant execute on function public.submit_assignment(uuid, jsonb)
  to authenticated;



-- Migration: 030_ops_02_session_context.sql
create or replace function public.get_session_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_context jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;

  select p.*
    into v_profile
  from public.profiles p
  where p.id = v_user_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'account_inactive';
  end if;

  if v_profile.status <> 'active' then
    raise exception using errcode = 'P0001', message = 'account_inactive';
  end if;

  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'display_name', v_profile.display_name,
      'avatar_url', v_profile.avatar_url,
      'equipped_theme', v_profile.equipped_theme,
      'must_change_password', v_profile.must_change_password,
      'role', v_profile.role
    ),
    'active_role', v_profile.role,
    'permissions', jsonb_build_object(
      'can_administer', v_profile.role in ('admin', 'super_admin'),
      'can_teach', v_profile.role = 'teacher',
      'can_learn', v_profile.role = 'student'
    ),
    'enrolled_classes',
      case when v_profile.role = 'student' then
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'class_id', c.id,
            'name', c.name,
            'grade_level', c.grade_level
          ) order by c.name)
          from public.class_enrollments ce
          join public.classes c on c.id = ce.class_id
          where ce.student_id = v_user_id
            and ce.status = 'active'
            and c.is_archived is not true
        ), '[]'::jsonb)
      else '[]'::jsonb end,
    'teaching_classes',
      case when v_profile.role = 'teacher' then
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'class_id', c.id,
            'name', c.name,
            'grade_level', c.grade_level,
            'is_primary', ct.is_primary
          ) order by c.name)
          from public.class_teachers ct
          join public.classes c on c.id = ct.class_id
          where ct.teacher_id = v_user_id
            and c.is_archived is not true
        ), '[]'::jsonb)
      else '[]'::jsonb end,
    'unread_notifications', (
      select count(*) from public.notifications n
      where n.user_id = v_user_id and n.is_read = false
    ),
    'active_streak', coalesce((
      select ss.current_streak
      from public.student_stats ss
      where ss.student_id = v_user_id
    ), 0)
  )
  into v_context;

  return v_context;
end;
$$;

revoke all on function public.get_session_context() from public;
grant execute on function public.get_session_context() to authenticated;



-- Migration: 031_ops_16_leaderboards.sql
create index if not exists idx_xp_ledger_student_created
  on public.xp_ledger (student_id, created_at);

create or replace function public.get_leaderboard(
  class_id uuid,
  timeframe text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_start timestamptz;
  v_is_private boolean := false;
  v_rows jsonb;
  v_my_rank bigint;
begin
  if v_actor_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if timeframe not in ('week', 'month', 'all_time') then
    raise exception 'Timeframe must be week, month, or all_time'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.class_enrollments ce
    where ce.class_id = get_leaderboard.class_id
      and ce.student_id = v_actor_id
      and ce.status = 'active'
  ) and not exists (
    select 1
    from public.class_teachers ct
    where ct.class_id = get_leaderboard.class_id
      and ct.teacher_id = v_actor_id
  ) and not exists (
    select 1
    from public.profiles p
    where p.id = v_actor_id
      and p.role::text in ('admin', 'super_admin')
      and p.status::text = 'active'
  ) then
    raise exception 'Not authorized to view this class leaderboard'
      using errcode = '42501';
  end if;

  if timeframe = 'week' then
    v_start := date_trunc('week', public.app_now());
  elsif timeframe = 'month' then
    v_start := date_trunc('month', public.app_now());
  end if;

  -- The current schema has no class-specific privacy column.
  -- Use the documented platform default for leaderboard privacy.
  select coalesce((ps.value #>> '{preferences,leaderboard_privacy_default}')::boolean, false)
    into v_is_private
  from public.platform_settings ps
  where ps.key = 'preferences';

  v_is_private := coalesce(v_is_private, false);

  with class_students as (
    select ce.student_id
    from public.class_enrollments ce
    where ce.class_id = get_leaderboard.class_id
      and ce.status = 'active'
  ),
  scores as (
    select
      cs.student_id,
      coalesce(sum(xl.amount), 0)::bigint as xp,
      min(xl.created_at) as first_xp_at
    from class_students cs
    left join public.xp_ledger xl
      on xl.student_id = cs.student_id
     and (v_start is null or xl.created_at >= v_start)
    group by cs.student_id
  ),
  ranked as (
    select
      row_number() over (
        order by s.xp desc, s.first_xp_at asc nulls last, s.student_id
      ) as rank,
      s.student_id,
      s.xp
    from scores s
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'rank', r.rank,
          'student_id', r.student_id,
          'display_name',
            case
              when v_is_private and r.student_id <> v_actor_id
                then 'Student ' || r.rank::text
              else p.display_name
            end,
          'avatar_url',
            case
              when v_is_private and r.student_id <> v_actor_id then null
              else p.avatar_url
            end,
          'equipped_badge', badge.badge,
          'xp', r.xp
        )
        order by r.rank
      ),
      '[]'::jsonb
    ),
    max(r.rank) filter (where r.student_id = v_actor_id)
  into v_rows, v_my_rank
  from ranked r
  join public.profiles p on p.id = r.student_id
  left join lateral (
    select jsonb_build_object(
      'id', bd.id,
      'name', bd.name,
      'icon_url', bd.icon_url
    ) as badge
    from public.user_badges ub
    join public.badge_definitions bd on bd.id = ub.badge_id
    where ub.student_id = r.student_id
      and ub.is_pinned is true
    order by ub.awarded_at desc
    limit 1
  ) badge on true;

  return jsonb_build_object(
    'class_id', get_leaderboard.class_id,
    'timeframe', timeframe,
    'my_rank', v_my_rank,
    'entries', v_rows
  );
end;
$$;

revoke all on function public.get_leaderboard(uuid, text) from public;
grant execute on function public.get_leaderboard(uuid, text) to authenticated;



-- Migration: 032_ops_18_shop_purchase.sql
create or replace function public.purchase_shop_item(item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := auth.uid();
  v_item public.shop_items%rowtype;
  v_level integer;
  v_spend jsonb;
  v_inventory_id uuid;
begin
  if v_student_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_item
  from public.shop_items si
  where si.id = purchase_shop_item.item_id
  for update;

  if not found or v_item.is_available is not true then
    raise exception 'Shop item is unavailable' using errcode = 'P0002';
  end if;

  insert into public.student_stats(student_id)
  values (v_student_id)
  on conflict (student_id) do nothing;

  select ss.current_level into v_level
  from public.student_stats ss
  where ss.student_id = v_student_id
  for update;

  if v_level < coalesce(v_item.required_level, 1) then
    raise exception 'Required level not reached' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.user_inventory ui
    where ui.user_id = v_student_id and ui.item_id = v_item.id
  ) then
    raise exception 'Item already owned' using errcode = '23505';
  end if;

  v_spend := public.spend_coins(
    v_student_id, v_item.coin_price, 'shop_purchase', v_item.id
  );

  insert into public.user_inventory(user_id, item_id)
  values (v_student_id, v_item.id)
  returning id into v_inventory_id;

  return jsonb_build_object(
    'inventory_id', v_inventory_id,
    'item_id', v_item.id,
    'coins', v_spend
  );
end;
$$;

create or replace function public.equip_inventory_item(item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := auth.uid();
  v_item public.shop_items%rowtype;
  v_inventory_id uuid;
begin
  if v_student_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select ui.id
    into v_inventory_id
  from public.user_inventory ui
  where ui.user_id = v_student_id
    and ui.item_id = equip_inventory_item.item_id
  for update;

  if not found then
    raise exception 'Item is not in your inventory' using errcode = 'P0002';
  end if;

  select si.* into v_item
  from public.shop_items si
  where si.id = equip_inventory_item.item_id;

  if v_item.category = 'theme' then
    update public.profiles
       set equipped_theme = coalesce(v_item.metadata ->> 'theme', v_item.sku)
     where id = v_student_id;
  elsif v_item.category = 'avatar' then
    update public.profiles
       set avatar_url = v_item.asset_url
     where id = v_student_id;
  else
    raise exception 'This item cannot be equipped' using errcode = '22023';
  end if;

  update public.user_inventory
     set is_equipped = false
   where user_id = v_student_id
     and item_id in (
       select si.id from public.shop_items si
       where si.category = v_item.category
     );

  update public.user_inventory
     set is_equipped = true
   where id = v_inventory_id;

  return jsonb_build_object('ok', true, 'item_id', item_id);
end;
$$;

revoke all on function public.purchase_shop_item(uuid) from public;
revoke all on function public.equip_inventory_item(uuid) from public;
grant execute on function public.purchase_shop_item(uuid) to authenticated;
grant execute on function public.equip_inventory_item(uuid) to authenticated;



-- Migration: 033_ops_03_enrollment_rpcs.sql
create or replace function public.join_class_by_code(code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_class_id uuid;
  v_role public.user_role;
  v_inserted integer;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_user_id and p.status = 'active';

  if v_role is distinct from 'student' then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  select c.id into v_class_id
  from public.classes c
  where upper(c.join_code) = upper(trim(code))
    and c.is_archived is not true
  for update;

  if v_class_id is null then
    raise exception using errcode = 'P0001', message = 'invalid_or_expired_code';
  end if;

  insert into public.class_enrollments(class_id, student_id, status)
  values (v_class_id, v_user_id, 'active')
  on conflict (class_id, student_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    insert into public.notifications(user_id, kind, title, body, payload)
    values (
      v_user_id,
      'class_enrollment',
      'Joined class',
      'You joined a class.',
      jsonb_build_object('class_id', v_class_id)
    );
  end if;

  return jsonb_build_object('ok', true, 'class_id', v_class_id);
end;
$$;

create or replace function public.respond_class_invite(class_id uuid, accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated integer;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;

  if accept then
    update public.class_enrollments
       set status = 'active'
     where class_enrollments.class_id = respond_class_invite.class_id
       and student_id = v_user_id
       and status = 'invited';
    get diagnostics v_updated = row_count;
  else
    delete from public.class_enrollments
     where class_enrollments.class_id = respond_class_invite.class_id
       and student_id = v_user_id
       and status = 'invited';
    get diagnostics v_updated = row_count;
  end if;

  if v_updated = 0 then
    raise exception using errcode = 'P0001', message = 'invite_not_found';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.rotate_join_code(class_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.user_role;
  v_code text;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_user_id and p.status = 'active';

  perform 1
  from public.classes c
  where c.id = rotate_join_code.class_id
    and c.is_archived is not true
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'class_not_found';
  end if;

  if v_role not in ('admin', 'super_admin')
     and not exists (
       select 1 from public.class_teachers ct
       where ct.class_id = rotate_join_code.class_id
         and ct.teacher_id = v_user_id
     ) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  loop
    v_code := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 6));
    begin
      update public.classes
         set join_code = v_code
       where id = rotate_join_code.class_id;
      exit;
    exception when unique_violation then
      -- Generate another code if the unique class join code is already taken.
      null;
    end;
  end loop;

  return v_code;
end;
$$;

revoke all on function public.join_class_by_code(text) from public;
revoke all on function public.respond_class_invite(uuid, boolean) from public;
revoke all on function public.rotate_join_code(uuid) from public;

grant execute on function public.join_class_by_code(text) to authenticated;
grant execute on function public.respond_class_invite(uuid, boolean) to authenticated;
grant execute on function public.rotate_join_code(uuid) to authenticated;



-- Migration: 034_ops_15_badges.sql
create or replace function public.evaluate_badges_for_student(
  student_id uuid,
  event_type text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_badge record;
  v_stats public.student_stats%rowtype;
  v_new_badges jsonb := '[]'::jsonb;
  v_threshold integer;
  v_met boolean;
begin
  if auth.uid() is null
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if auth.uid() is not null
     and auth.uid() <> evaluate_badges_for_student.student_id
     and coalesce(auth.role(), '') <> 'service_role'
     and not exists (
       select 1 from public.profiles p
       where p.id = auth.uid()
         and p.role::text in ('admin', 'super_admin')
         and p.status::text = 'active'
     ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  insert into public.student_stats(student_id)
  values (evaluate_badges_for_student.student_id)
  on conflict (student_id) do nothing;

  select * into v_stats
  from public.student_stats ss
  where ss.student_id = evaluate_badges_for_student.student_id;

  for v_badge in
    select bd.*
    from public.badge_definitions bd
    where not exists (
      select 1 from public.user_badges ub
      where ub.student_id = evaluate_badges_for_student.student_id
        and ub.badge_id = bd.id
    )
  loop
    v_threshold := coalesce(
      (v_badge.requirement_json ->> 'threshold')::integer,
      (v_badge.requirement_json ->> 'days')::integer,
      (v_badge.requirement_json ->> 'count')::integer,
      0
    );

    v_met := case
      when event_type = 'streak'
        and v_badge.category = 'streak'
        then v_stats.current_streak >= v_threshold
      when event_type = 'xp'
        and v_badge.category in ('xp', 'milestone')
        then v_stats.total_xp >= v_threshold
      when event_type = 'quiz'
        and v_badge.category = 'quiz'
        then exists (
          select 1
          from public.assessment_attempts aa
          where aa.student_id = evaluate_badges_for_student.student_id
            and aa.status = 'graded'
            and aa.max_score > 0
            and aa.score = aa.max_score
        )
      when event_type = 'lesson'
        and v_badge.category in ('reading', 'lessons')
        then (
          select count(*) >= v_threshold
          from public.lesson_progress lp
          where lp.student_id = evaluate_badges_for_student.student_id
            and lp.is_completed
        )
      else false
    end;

    if v_threshold > 0 and v_met then
      insert into public.user_badges(student_id, badge_id)
      values (evaluate_badges_for_student.student_id, v_badge.id)
      on conflict (student_id, badge_id) do nothing;

      if found then
        insert into public.notifications(user_id, kind, title, body, payload)
        values (
          evaluate_badges_for_student.student_id,
          'badge_earned',
          'New badge earned',
          v_badge.name,
          jsonb_build_object('badge_id', v_badge.id, 'code', v_badge.code)
        );

        v_new_badges := v_new_badges || jsonb_build_array(
          jsonb_build_object('id', v_badge.id, 'code', v_badge.code, 'name', v_badge.name)
        );
      end if;
    end if;
  end loop;

  return jsonb_build_object('student_id', student_id, 'earned', v_new_badges);
end;
$$;

create or replace function public.pin_badges(student_id uuid, badge_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_count integer;
begin
  if v_actor is null or v_actor <> pin_badges.student_id then
    raise exception 'You can only pin your own badges' using errcode = '42501';
  end if;

  if coalesce(cardinality(badge_ids), 0) > 3
     or cardinality(badge_ids) <> (
       select count(distinct x) from unnest(coalesce(badge_ids, '{}')) x
     ) then
    raise exception 'Choose up to three distinct badges' using errcode = '22023';
  end if;

  perform 1 from public.user_badges ub
  where ub.student_id = pin_badges.student_id
  for update;

  if exists (
    select 1 from unnest(coalesce(badge_ids, '{}')) requested(id)
    where not exists (
      select 1 from public.user_badges ub
      where ub.student_id = pin_badges.student_id
        and ub.badge_id = requested.id
    )
  ) then
    raise exception 'You can only pin badges you have earned' using errcode = '22023';
  end if;

  update public.user_badges
     set is_pinned = (badge_id = any(coalesce(badge_ids, '{}')))
   where user_badges.student_id = pin_badges.student_id;

  get diagnostics v_count = row_count;

  return jsonb_build_object('pinned', coalesce(to_jsonb(badge_ids), '[]'::jsonb));
end;
$$;

revoke all on function public.evaluate_badges_for_student(uuid, text) from public;
revoke all on function public.pin_badges(uuid, uuid[]) from public;
grant execute on function public.evaluate_badges_for_student(uuid, text)
  to authenticated, service_role;
grant execute on function public.pin_badges(uuid, uuid[]) to authenticated;



-- Migration: 035_ops_04_teacher_roster.sql
create or replace function public.add_students_to_class(class_id uuid, student_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.user_role;
  v_added integer := 0;
  v_requested integer;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_user_id and p.status = 'active';

  if v_role not in ('admin', 'super_admin')
     and not exists (
       select 1 from public.class_teachers ct
       where ct.class_id = add_students_to_class.class_id
         and ct.teacher_id = v_user_id
         and ct.is_primary is true
     ) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  if student_ids is null then
    raise exception using errcode = '22023', message = 'student_ids_required';
  end if;

  v_requested := cardinality(student_ids);

  if exists (
    select 1
    from unnest(student_ids) requested(id)
    left join public.profiles p
      on p.id = requested.id
     and p.role = 'student'
     and p.status = 'active'
    where p.id is null
  ) then
    raise exception using errcode = 'P0001', message = 'invalid_student';
  end if;

  insert into public.class_enrollments(class_id, student_id, status)
  select add_students_to_class.class_id, requested.id, 'active'
  from (select distinct unnest(student_ids) as id) requested
  on conflict (class_id, student_id) do nothing;

  get diagnostics v_added = row_count;

  insert into public.audit_log(user_id, actor_id, action, target_table, target_id, new_values)
  values (
    v_user_id,
    v_user_id,
    'class_students_added',
    'classes',
    add_students_to_class.class_id,
    jsonb_build_object('student_ids', student_ids, 'added', v_added)
  );

  return jsonb_build_object(
    'added', v_added,
    'skipped', greatest(v_requested - v_added, 0)
  );
end;
$$;

create or replace function public.remove_student_from_class(
  class_id uuid,
  student_id uuid,
  reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.user_role;
  v_old_status text;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_user_id and p.status = 'active';

  if v_role not in ('admin', 'super_admin')
     and not exists (
       select 1 from public.class_teachers ct
       where ct.class_id = remove_student_from_class.class_id
         and ct.teacher_id = v_user_id
         and ct.is_primary is true
     ) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  select ce.status into v_old_status
  from public.class_enrollments ce
  where ce.class_id = remove_student_from_class.class_id
    and ce.student_id = remove_student_from_class.student_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'enrollment_not_found';
  end if;

  update public.class_enrollments
     set status = 'archived'
   where class_enrollments.class_id = remove_student_from_class.class_id
     and class_enrollments.student_id = remove_student_from_class.student_id;

  insert into public.audit_log(user_id, actor_id, action, target_table, target_id, old_values, new_values, reason)
  values (
    v_user_id,
    v_user_id,
    'student_removed_from_class',
    'class_enrollments',
    remove_student_from_class.student_id,
    jsonb_build_object('class_id', remove_student_from_class.class_id, 'status', v_old_status),
    jsonb_build_object('class_id', remove_student_from_class.class_id, 'status', 'archived'),
    reason
  );

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.transfer_class_ownership(class_id uuid, new_teacher_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.user_role;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_user_id and p.status = 'active';

  if v_role not in ('admin', 'super_admin')
     and not exists (
       select 1 from public.class_teachers ct
       where ct.class_id = transfer_class_ownership.class_id
         and ct.teacher_id = v_user_id
         and ct.is_primary is true
     ) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = new_teacher_id
      and p.role = 'teacher'
      and p.status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'invalid_teacher';
  end if;

  perform 1
  from public.classes c
  where c.id = transfer_class_ownership.class_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'class_not_found';
  end if;

  insert into public.class_teachers(class_id, teacher_id, is_primary)
  values (transfer_class_ownership.class_id, new_teacher_id, true)
  on conflict (class_id, teacher_id) do update set is_primary = true;

  update public.class_teachers
     set is_primary = false
   where class_teachers.class_id = transfer_class_ownership.class_id
     and class_teachers.teacher_id <> new_teacher_id;

  insert into public.audit_log(user_id, actor_id, action, target_table, target_id, new_values)
  values (
    v_user_id,
    v_user_id,
    'class_ownership_transferred',
    'classes',
    transfer_class_ownership.class_id,
    jsonb_build_object('new_teacher_id', new_teacher_id)
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.add_students_to_class(uuid, uuid[]) from public;
revoke all on function public.remove_student_from_class(uuid, uuid, text) from public;
revoke all on function public.transfer_class_ownership(uuid, uuid) from public;

grant execute on function public.add_students_to_class(uuid, uuid[]) to authenticated;
grant execute on function public.remove_student_from_class(uuid, uuid, text) to authenticated;
grant execute on function public.transfer_class_ownership(uuid, uuid) to authenticated;



-- Migration: 036_ops_17_game_session.sql
create or replace function public.record_game_session(
  game_slug text,
  score integer,
  accuracy numeric,
  duration integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := auth.uid();
  v_game_id uuid;
  v_featured_multiplier numeric := 1;
  v_xp integer;
  v_coins integer;
  v_session_id uuid;
begin
  if v_student_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if score < 0 or duration < 1 or duration > 3600
     or accuracy < 0 or accuracy > 100
     or score > duration * 1000 then
    raise exception 'Game result is outside valid limits' using errcode = '22023';
  end if;

  select g.id into v_game_id
  from public.games g
  where g.slug = record_game_session.game_slug
    and g.is_active is true;

  if not found then
    raise exception 'Game is unavailable' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.game_sessions gs
    where gs.student_id = v_student_id
      and gs.game_id = v_game_id
      and gs.played_at > public.app_now() - interval '10 seconds'
  ) then
    raise exception 'Please wait before submitting another game result'
      using errcode = 'P0001';
  end if;

  select coalesce(gdf.bonus_multiplier, 1.5)
    into v_featured_multiplier
  from public.game_daily_featured gdf
  where gdf.game_id = v_game_id
    and gdf.featured_date = public.app_now()::date;

  v_featured_multiplier := coalesce(v_featured_multiplier, 1);

  v_xp := floor((5 + 20 * greatest(0, least(accuracy, 100)) / 100)
                * v_featured_multiplier)::integer;
  v_coins := floor((2 + 8 * greatest(0, least(accuracy, 100)) / 100)
                   * v_featured_multiplier)::integer;

  insert into public.game_sessions(
    game_id, student_id, score, accuracy, xp_awarded,
    coins_awarded, time_spent_seconds
  )
  values (
    v_game_id, v_student_id, score, accuracy, v_xp,
    v_coins, duration
  )
  returning id into v_session_id;

  insert into public.xp_ledger(student_id, amount, source, reference_id)
  values (v_student_id, v_xp, 'game', v_session_id);

  insert into public.coin_ledger(student_id, amount, source, reference_id)
  values (v_student_id, v_coins, 'game', v_session_id);

  perform public.record_daily_activity(v_student_id);

  return jsonb_build_object(
    'session_id', v_session_id,
    'score', score,
    'accuracy', accuracy,
    'xp_awarded', v_xp,
    'coins_awarded', v_coins,
    'featured_multiplier', v_featured_multiplier
  );
end;
$$;

revoke all on function public.record_game_session(text, integer, numeric, integer) from public;
grant execute on function public.record_game_session(text, integer, numeric, integer)
  to authenticated;



-- Migration: 037_ops_14_quests_claim.sql
alter table public.quest_instances
  add column if not exists quest_date date;

update public.quest_instances
   set quest_date = created_at::date
 where quest_date is null;

alter table public.quest_instances
  alter column quest_date set default current_date,
  alter column quest_date set not null;

alter table public.quest_instances
  drop constraint if exists quest_instances_student_id_quest_template_id_key;

create unique index if not exists uq_quest_instances_student_template_date
  on public.quest_instances(student_id, quest_template_id, quest_date);

create or replace function public.generate_daily_quests(student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_timezone text := 'UTC';
  v_today date;
  v_expires timestamptz;
  v_ids uuid[];
begin
  if v_actor is null or v_actor <> generate_daily_quests.student_id then
    raise exception 'You can only generate your own quests' using errcode = '42501';
  end if;

  select coalesce(ps.value ->> 'timezone', 'UTC')
    into v_timezone
  from public.platform_settings ps
  where ps.key = 'region';

  v_timezone := coalesce(v_timezone, 'UTC');
  v_today := (public.app_now() at time zone v_timezone)::date;
  v_expires := ((v_today + 1)::timestamp at time zone v_timezone);

  insert into public.quest_instances(
    quest_template_id, student_id, current_count, expires_at, quest_date
  )
  select chosen.id, student_id, 0, v_expires, v_today
  from (
    select qt.id
    from public.quest_templates qt
    where qt.is_active
      and qt.quest_type = 'daily'
      and not exists (
        select 1
        from public.quest_instances qi
        where qi.student_id = generate_daily_quests.student_id
          and qi.quest_template_id = qt.id
          and qi.quest_date = v_today
      )
    order by random()
    limit 3
  ) chosen
  on conflict (student_id, quest_template_id, quest_date) do nothing;

  select coalesce(array_agg(qi.id order by qi.created_at), '{}')
    into v_ids
  from public.quest_instances qi
  where qi.student_id = generate_daily_quests.student_id
    and qi.quest_date = v_today;

  return jsonb_build_object(
    'quest_date', v_today,
    'expires_at', v_expires,
    'instance_ids', to_jsonb(v_ids)
  );
end;
$$;

create or replace function public.claim_quest_reward(instance_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student uuid := auth.uid();
  v_quest public.quest_instances%rowtype;
  v_template public.quest_templates%rowtype;
  v_freeze_awarded boolean := false;
begin
  if v_student is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_quest
  from public.quest_instances qi
  where qi.id = claim_quest_reward.instance_id
    and qi.student_id = v_student
  for update;

  if not found then
    raise exception 'Quest not found' using errcode = 'P0002';
  end if;

  if not v_quest.is_completed or v_quest.is_claimed then
    raise exception 'Quest is incomplete or already claimed' using errcode = '55000';
  end if;

  if v_quest.expires_at is not null and v_quest.expires_at <= public.app_now() then
    raise exception 'Quest has expired' using errcode = '55000';
  end if;

  select * into v_template
  from public.quest_templates qt
  where qt.id = v_quest.quest_template_id;

  update public.quest_instances
     set is_claimed = true
   where id = v_quest.id;

  if v_template.xp_reward > 0 then
    insert into public.xp_ledger(student_id, amount, source, reference_id)
    values (v_student, v_template.xp_reward, 'quest', v_quest.id);
  end if;

  if v_template.coin_reward > 0 then
    insert into public.coin_ledger(student_id, amount, source, reference_id)
    values (v_student, v_template.coin_reward, 'quest', v_quest.id);
  end if;

  if random() < 0.05 then
    update public.student_stats
       set streak_freeze_count = least(streak_freeze_count + 1, 3)
     where student_id = v_student
       and streak_freeze_count < 3;
    v_freeze_awarded := found;
  end if;

  return jsonb_build_object(
    'quest_instance_id', v_quest.id,
    'xp', v_template.xp_reward,
    'coins', v_template.coin_reward,
    'streak_freeze_awarded', v_freeze_awarded
  );
end;
$$;

revoke all on function public.generate_daily_quests(uuid) from public;
revoke all on function public.claim_quest_reward(uuid) from public;
grant execute on function public.generate_daily_quests(uuid) to authenticated;
grant execute on function public.claim_quest_reward(uuid) to authenticated;



-- Migration: 038_ops_13_teacher_grading.sql
alter table public.assessment_attempts
  add column if not exists grading_locked_by uuid references public.profiles(id),
  add column if not exists grading_locked_at timestamptz,
  add column if not exists grades_released_at timestamptz;

create index if not exists idx_assessment_attempts_grading_queue
  on public.assessment_attempts(assessment_id, status, submitted_at);

create or replace function public.lock_submission_for_grading(attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teacher uuid := auth.uid();
  v_attempt public.assessment_attempts%rowtype;
  v_class_id uuid;
begin
  if v_teacher is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select aa.* into v_attempt
  from public.assessment_attempts aa
  where aa.id = lock_submission_for_grading.attempt_id
  for update;

  if not found then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;

  select a.class_id into v_class_id
  from public.assessments a
  where a.id = v_attempt.assessment_id;

  if not exists (
    select 1 from public.class_teachers ct
    where ct.class_id = v_class_id
      and ct.teacher_id = v_teacher
  ) and not exists (
    select 1 from public.profiles p
    where p.id = v_teacher
      and p.role::text in ('admin', 'super_admin')
      and p.status::text = 'active'
  ) then
    raise exception 'Not authorized to grade this class'
      using errcode = '42501';
  end if;

  if v_attempt.status not in ('submitted', 'graded') then
    raise exception 'Submission is not ready for grading' using errcode = '55000';
  end if;

  if v_attempt.grading_locked_at > public.app_now() - interval '10 minutes'
     and v_attempt.grading_locked_by <> v_teacher then
    raise exception 'Submission is already locked by another teacher'
      using errcode = '55P03';
  end if;

  update public.assessment_attempts
     set grading_locked_by = v_teacher,
         grading_locked_at = public.app_now()
   where id = v_attempt.id;

  return jsonb_build_object(
    'attempt_id', v_attempt.id,
    'locked_by', v_teacher,
    'locked_at', public.app_now()
  );
end;
$$;

create or replace function public.save_grade(
  attempt_id uuid,
  rubric_scores jsonb,
  feedback text,
  final_score numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teacher uuid := auth.uid();
  v_attempt public.assessment_attempts%rowtype;
  v_old_score numeric;
  v_class_id uuid;
  v_max_score numeric;
  v_question record;
  v_score numeric;
begin
  if v_teacher is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if rubric_scores is null or jsonb_typeof(rubric_scores) <> 'object'
     or final_score is null or final_score < 0 then
    raise exception 'Invalid grade data' using errcode = '22023';
  end if;

  select aa.* into v_attempt
  from public.assessment_attempts aa
  where aa.id = save_grade.attempt_id
  for update;

  if not found then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;

  select a.class_id into v_class_id
  from public.assessments a
  where a.id = v_attempt.assessment_id;

  if not exists (
    select 1 from public.class_teachers ct
    where ct.class_id = v_class_id
      and ct.teacher_id = v_teacher
  ) and not exists (
    select 1 from public.profiles p
    where p.id = v_teacher
      and p.role::text in ('admin', 'super_admin')
      and p.status::text = 'active'
  ) then
    raise exception 'Not authorized to grade this class'
      using errcode = '42501';
  end if;

  if v_attempt.grading_locked_by <> v_teacher
     or v_attempt.grading_locked_at < public.app_now() - interval '10 minutes' then
    raise exception 'You must hold the active grading lock'
      using errcode = '55P03';
  end if;

  select coalesce(sum(coalesce(aq.points_override, q.points)), 0)
    into v_max_score
  from public.assessment_questions aq
  join public.questions q on q.id = aq.question_id
  where aq.assessment_id = v_attempt.assessment_id;

  if final_score > v_max_score then
    raise exception 'Final score exceeds the assessment maximum'
      using errcode = '22023';
  end if;

  v_old_score := v_attempt.score;

  for v_question in
    select q.id, coalesce(aq.points_override, q.points) as max_points
    from public.assessment_questions aq
    join public.questions q on q.id = aq.question_id
    where aq.assessment_id = v_attempt.assessment_id
  loop
    if rubric_scores ? v_question.id::text then
      v_score := (rubric_scores ->> v_question.id::text)::numeric;
      if v_score < 0 or v_score > v_question.max_points then
        raise exception 'Question score is outside its allowed range'
          using errcode = '22023';
      end if;

      insert into public.attempt_answers(
        attempt_id, question_id, student_answer, points_awarded, is_correct
      )
      values (
        v_attempt.id,
        v_question.id,
        coalesce((
          select aa.student_answer from public.attempt_answers aa
          where aa.attempt_id = v_attempt.id and aa.question_id = v_question.id
        ), '{}'::jsonb),
        v_score,
        (v_score = v_question.max_points)
      )
      on conflict (attempt_id, question_id)
      do update set
        points_awarded = excluded.points_awarded,
        is_correct = excluded.is_correct,
        updated_at = public.app_now();
    end if;
  end loop;

  update public.assessment_attempts
     set score = final_score,
         status = 'graded',
         grading_locked_by = null,
         grading_locked_at = null
   where id = v_attempt.id;

  update public.assessment_attempts
     set feedback = save_grade.feedback,
         graded_by = v_teacher,
         graded_at = public.app_now()
   where id = v_attempt.id;

  insert into public.grade_history(
    attempt_id, grader_id, source, old_score, new_score, reason
  )
  values (
    v_attempt.id, v_teacher, 'teacher', v_old_score, final_score, feedback
  );

  return jsonb_build_object('attempt_id', v_attempt.id, 'score', final_score);
end;
$$;

create or replace function public.release_grades(assessment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teacher uuid := auth.uid();
  v_class_id uuid;
  v_released integer;
  v_student record;
begin
  if v_teacher is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select a.class_id into v_class_id
  from public.assessments a
  where a.id = release_grades.assessment_id
    and a.kind::text in ('quiz', 'assignment')
  for update;

  if not found then
    raise exception 'Assessment not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.class_teachers ct
    where ct.class_id = v_class_id and ct.teacher_id = v_teacher
  ) and not exists (
    select 1 from public.profiles p
    where p.id = v_teacher
      and p.role::text in ('admin', 'super_admin')
      and p.status::text = 'active'
  ) then
    raise exception 'Not authorized to release grades'
      using errcode = '42501';
  end if;

  update public.assessment_attempts
     set grades_released_at = public.app_now()
   where assessment_id = release_grades.assessment_id
     and status = 'graded'
     and grades_released_at is null;

  get diagnostics v_released = row_count;

  for v_student in
    select distinct aa.student_id
    from public.assessment_attempts aa
    where aa.assessment_id = release_grades.assessment_id
      and aa.status = 'graded'
      and aa.grades_released_at is not null
  loop
    insert into public.notifications(user_id, kind, title, body, payload)
    values (
      v_student.student_id,
      'grade_released',
      'Your grade is ready',
      'A teacher released your assessment grade.',
      jsonb_build_object('assessment_id', release_grades.assessment_id)
    );
  end loop;

  return jsonb_build_object('assessment_id', assessment_id, 'released', v_released);
end;
$$;

revoke all on function public.lock_submission_for_grading(uuid) from public;
revoke all on function public.save_grade(uuid, jsonb, text, numeric) from public;
revoke all on function public.release_grades(uuid) from public;

grant execute on function public.lock_submission_for_grading(uuid) to authenticated;
grant execute on function public.save_grade(uuid, jsonb, text, numeric) to authenticated;
grant execute on function public.release_grades(uuid) to authenticated;



-- Migration: 039_rls_policies_indexes.sql
-- Migration: 039_rls_policies_indexes.sql
-- Description: Helper functions, forced Row Level Security, restrictive gates, per-table policies
--              and the foreign key indexes that earlier migrations did not create.
-- Task: BE-CORE-18
-- Spec: backend/docs/04-AUTH-AND-ACCESS.md sections 6 and 7
-- Depends On: every earlier migration (it must run last, after the RPC files create their tables)
-- Notes:
--   - Earlier migrations created a few permissive policies of their own (for example "for all"
--     on user_inventory). They are removed here, so this file is the single source of truth.
--   - Tables of BE-CORE-15 (AI) do not exist yet. They get RLS in their own migration, using the
--     helpers defined here.
--   - Writes that the spec routes through RPCs have no client policy on purpose.

-- ============================================================
-- Step 1: Helper functions (04-AUTH-AND-ACCESS section 6)
-- All are STABLE, SECURITY DEFINER and use an empty search_path.
-- ============================================================

create or replace function public.uid()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$ select (select auth.uid()) $$;

create or replace function public.app_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    case
      when (auth.jwt() ->> 'app_role') in ('student', 'teacher', 'admin', 'super_admin')
        then (auth.jwt() ->> 'app_role')::public.user_role
    end,
    (select p.role from public.profiles p where p.id = (select auth.uid()))
  )
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select coalesce(public.app_role() in ('admin', 'super_admin'), false) $$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select coalesce(public.app_role() = 'super_admin', false) $$;

create or replace function public.is_school_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select coalesce(public.app_role() = 'admin', false) $$;

create or replace function public.is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.status = 'active' from public.profiles p where p.id = (select auth.uid())),
    false
  )
$$;

create or replace function public.not_view_as()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select coalesce(jsonb_typeof(auth.jwt() -> 'view_as'), 'null') = 'null' $$;

create or replace function public.must_change()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select coalesce((auth.jwt() ->> 'must_change_password')::boolean, false) $$;

create or replace function public.teaches_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.class_teachers ct
    where ct.class_id = p_class_id and ct.teacher_id = (select auth.uid())
  )
$$;

create or replace function public.in_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.class_enrollments ce
    where ce.class_id = p_class_id
      and ce.student_id = (select auth.uid())
      and ce.status = 'active'
  )
$$;

create or replace function public.teaches_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.class_enrollments ce
    join public.class_teachers ct on ct.class_id = ce.class_id
    where ce.student_id = p_student_id
      and ce.status = 'active'
      and ct.teacher_id = (select auth.uid())
  )
$$;

create or replace function public.can_see_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_student_id = (select auth.uid())
      or public.teaches_student(p_student_id)
      or public.is_admin()
$$;

create or replace function public.can_manage_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select public.teaches_student(p_student_id) or public.is_admin() $$;

create or replace function public.my_class_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ce.class_id from public.class_enrollments ce
  where ce.student_id = (select auth.uid()) and ce.status = 'active'
  union
  select ct.class_id from public.class_teachers ct
  where ct.teacher_id = (select auth.uid())
$$;

create or replace function public.student_can_see_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.class_courses cc
    join public.class_enrollments ce on ce.class_id = cc.class_id
    where cc.course_id = p_course_id
      and cc.is_active
      and ce.student_id = (select auth.uid())
      and ce.status = 'active'
  )
$$;

create or replace function public.feature_enabled(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select case jsonb_typeof(ps.value -> p_key)
        when 'boolean' then (ps.value ->> p_key)::boolean
        when 'object' then coalesce((ps.value -> p_key ->> 'enabled')::boolean, true)
        else true
      end
      from public.platform_settings ps
      where ps.key = 'features'
    ),
    true
  )
$$;

create or replace function public.maintenance_blocks()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
           (select (ps.value ->> 'enabled')::boolean
              from public.platform_settings ps
             where ps.key = 'maintenance'),
           false
         )
         and not public.is_admin()
$$;

create or replace function public.require_writable()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.not_view_as() then
    raise exception 'read_only_session' using errcode = '42501';
  end if;
  if not public.is_active() then
    raise exception 'account_inactive' using errcode = '42501';
  end if;
  if public.maintenance_blocks() then
    raise exception 'maintenance' using errcode = '55000';
  end if;
  if public.must_change() then
    raise exception 'must_change_password' using errcode = '42501';
  end if;
end;
$$;

-- Ownership helpers used by the policies below. They avoid recursive policy checks.

create or replace function public.profile_is_admin(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role in ('admin', 'super_admin') from public.profiles p where p.id = p_profile_id),
    false
  )
$$;

create or replace function public.class_teacher_count(p_class_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$ select count(*)::integer from public.class_teachers ct where ct.class_id = p_class_id $$;

create or replace function public.owns_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.courses c
    where c.id = p_course_id and c.author_id = (select auth.uid())
  )
$$;

create or replace function public.owns_unit(p_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.units u
    join public.courses c on c.id = u.course_id
    where u.id = p_unit_id and c.author_id = (select auth.uid())
  )
$$;

create or replace function public.owns_lesson(p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.lessons l
    join public.units u on u.id = l.unit_id
    join public.courses c on c.id = u.course_id
    where l.id = p_lesson_id and c.author_id = (select auth.uid())
  )
$$;

create or replace function public.course_is_published(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.courses c where c.id = p_course_id and c.status = 'published'
  )
$$;

create or replace function public.can_edit_assessment(p_assessment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.assessments a
    where a.id = p_assessment_id
      and (
        a.author_id = (select auth.uid())
        or (a.class_id is not null and public.teaches_class(a.class_id))
      )
  )
$$;

create or replace function public.teaches_assessment(p_assessment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.assessments a
    where a.id = p_assessment_id
      and a.class_id is not null
      and public.teaches_class(a.class_id)
  )
$$;

create or replace function public.owns_attempt(p_attempt_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.assessment_attempts aa
    where aa.id = p_attempt_id and aa.student_id = (select auth.uid())
  )
$$;

create or replace function public.teaches_attempt(p_attempt_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.assessment_attempts aa
    where aa.id = p_attempt_id and public.teaches_assessment(aa.assessment_id)
  )
$$;

create or replace function public.owns_submission(p_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.assignment_submissions s
    where s.id = p_submission_id and s.student_id = (select auth.uid())
  )
$$;

create or replace function public.teaches_submission(p_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.assignment_submissions s
    where s.id = p_submission_id and public.teaches_class(s.class_id)
  )
$$;

create or replace function public.is_announcement_recipient(p_announcement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.announcement_recipients ar
    join public.announcements a on a.id = ar.announcement_id
    where ar.announcement_id = p_announcement_id
      and ar.user_id = (select auth.uid())
      and a.status = 'published'
  )
$$;

create or replace function public.owns_announcement(p_announcement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.announcements a
    where a.id = p_announcement_id and a.author_id = (select auth.uid())
  )
$$;

create or replace function public.owns_job(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.jobs j
    where j.id = p_job_id and j.initiator_id = (select auth.uid())
  )
$$;

create or replace function public.owns_conversation(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.ai_conversations c
    where c.id = p_conversation_id and c.user_id = (select auth.uid())
  )
$$;

revoke all on function
  public.owns_conversation(uuid), public.uid(), public.app_role(), public.is_admin(), public.is_super_admin(),
  public.is_school_admin(), public.is_active(), public.not_view_as(), public.must_change(),
  public.teaches_class(uuid), public.in_class(uuid), public.teaches_student(uuid),
  public.can_see_student(uuid), public.can_manage_student(uuid), public.my_class_ids(),
  public.student_can_see_course(uuid), public.feature_enabled(text),
  public.maintenance_blocks(), public.require_writable(), public.profile_is_admin(uuid),
  public.class_teacher_count(uuid), public.owns_course(uuid), public.owns_unit(uuid),
  public.owns_lesson(uuid), public.course_is_published(uuid), public.can_edit_assessment(uuid),
  public.teaches_assessment(uuid), public.owns_attempt(uuid), public.teaches_attempt(uuid),
  public.owns_submission(uuid), public.teaches_submission(uuid),
  public.is_announcement_recipient(uuid), public.owns_announcement(uuid), public.owns_job(uuid)
  from public, anon;

grant execute on function
  public.owns_conversation(uuid), public.uid(), public.app_role(), public.is_admin(), public.is_super_admin(),
  public.is_school_admin(), public.is_active(), public.not_view_as(), public.must_change(),
  public.teaches_class(uuid), public.in_class(uuid), public.teaches_student(uuid),
  public.can_see_student(uuid), public.can_manage_student(uuid), public.my_class_ids(),
  public.student_can_see_course(uuid), public.feature_enabled(text),
  public.maintenance_blocks(), public.require_writable(), public.profile_is_admin(uuid),
  public.class_teacher_count(uuid), public.owns_course(uuid), public.owns_unit(uuid),
  public.owns_lesson(uuid), public.course_is_published(uuid), public.can_edit_assessment(uuid),
  public.teaches_assessment(uuid), public.owns_attempt(uuid), public.teaches_attempt(uuid),
  public.owns_submission(uuid), public.teaches_submission(uuid),
  public.is_announcement_recipient(uuid), public.owns_announcement(uuid), public.owns_job(uuid)
  to authenticated, service_role;

-- ============================================================
-- Step 2: Reset policies, then enable and force RLS on every table
-- ============================================================

do $$
declare
  r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;

  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
    execute format('alter table public.%I force row level security', r.tablename);
  end loop;
end
$$;

-- The anonymous role never reads or writes application tables.
revoke all on all tables in schema public from anon;

-- ============================================================
-- Step 3: Restrictive gates (04-AUTH-AND-ACCESS section 7, general rules)
--   active_only          any command, active accounts only
--   no_writes_in_view_as insert, update and delete are blocked while viewing as another user
--   password_gate        blocked until the password is changed
-- profiles keeps its own select path so sign-in can read the status and the password flag.
-- ============================================================

do $$
declare
  r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    if r.tablename <> 'profiles' then
      execute format(
        'create policy active_only on public.%I as restrictive for all to authenticated using (public.is_active())',
        r.tablename);
      execute format(
        'create policy password_gate on public.%I as restrictive for all to authenticated using (not public.must_change())',
        r.tablename);
    end if;
    execute format(
      'create policy no_writes_in_view_as_insert on public.%I as restrictive for insert to authenticated with check (public.not_view_as())',
      r.tablename);
    execute format(
      'create policy no_writes_in_view_as_update on public.%I as restrictive for update to authenticated using (public.not_view_as()) with check (public.not_view_as())',
      r.tablename);
    execute format(
      'create policy no_writes_in_view_as_delete on public.%I as restrictive for delete to authenticated using (public.not_view_as())',
      r.tablename);
  end loop;
end
$$;

create policy active_only_write on public.profiles as restrictive
  for insert to authenticated with check (public.is_active());
create policy active_only_update on public.profiles as restrictive
  for update to authenticated using (public.is_active()) with check (public.is_active());
create policy active_only_delete on public.profiles as restrictive
  for delete to authenticated using (public.is_active());

-- ============================================================
-- Step 4: Permissive policies per table (spec section 7)
-- ============================================================

-- 7.1 Identity and settings ----------------------------------

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = public.uid());
create policy profiles_select_teacher on public.profiles
  for select to authenticated using (public.teaches_student(id));
create policy profiles_select_admin on public.profiles
  for select to authenticated using (
    public.is_super_admin() or (public.is_school_admin() and role in ('student', 'teacher'))
  );

create policy user_settings_select_own on public.user_settings
  for select to authenticated using (user_id = public.uid());
create policy user_settings_insert_own on public.user_settings
  for insert to authenticated with check (user_id = public.uid());
create policy user_settings_update_own on public.user_settings
  for update to authenticated using (user_id = public.uid()) with check (user_id = public.uid());

create policy admin_notes_select on public.admin_notes
  for select to authenticated using (
    public.is_super_admin() or (public.is_school_admin() and not public.profile_is_admin(user_id))
  );
create policy admin_notes_insert on public.admin_notes
  for insert to authenticated with check (
    author_id = public.uid()
    and (public.is_super_admin() or (public.is_school_admin() and not public.profile_is_admin(user_id)))
  );
create policy admin_notes_update on public.admin_notes
  for update to authenticated
  using (public.is_super_admin() or (public.is_school_admin() and not public.profile_is_admin(user_id)))
  with check (public.is_super_admin() or (public.is_school_admin() and not public.profile_is_admin(user_id)));

create policy platform_settings_select_admin on public.platform_settings
  for select to authenticated using (public.is_admin());
create policy platform_settings_write_super on public.platform_settings
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- 7.2 School structure ---------------------------------------

create policy school_years_select on public.school_years
  for select to authenticated using (true);
create policy school_years_write_admin on public.school_years
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy terms_select on public.terms
  for select to authenticated using (true);
create policy terms_write_admin on public.terms
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy classes_select on public.classes
  for select to authenticated using (
    public.in_class(id) or public.teaches_class(id) or public.is_admin()
  );
create policy classes_insert_teacher on public.classes
  for insert to authenticated with check (public.app_role() = 'teacher' or public.is_admin());
create policy classes_update on public.classes
  for update to authenticated
  using (public.teaches_class(id) or public.is_admin())
  with check (public.teaches_class(id) or public.is_admin());
create policy classes_delete_admin on public.classes
  for delete to authenticated using (
    public.is_admin()
    and not exists (select 1 from public.class_enrollments ce where ce.class_id = classes.id)
  );

create policy class_rules_select on public.class_rules
  for select to authenticated using (
    public.in_class(class_id) or public.teaches_class(class_id) or public.is_admin()
  );
create policy class_rules_write on public.class_rules
  for all to authenticated
  using (public.teaches_class(class_id) or public.is_admin())
  with check (public.teaches_class(class_id) or public.is_admin());

create policy class_teachers_select on public.class_teachers
  for select to authenticated using (
    public.in_class(class_id) or public.teaches_class(class_id) or public.is_admin()
  );
create policy class_teachers_insert on public.class_teachers
  for insert to authenticated with check (
    public.teaches_class(class_id)
    or public.is_admin()
    or (
      teacher_id = public.uid()
      and public.app_role() = 'teacher'
      and public.class_teacher_count(class_id) = 0
    )
  );
create policy class_teachers_delete on public.class_teachers
  for delete to authenticated using (
    public.is_admin()
    or (public.teaches_class(class_id) and public.class_teacher_count(class_id) > 1)
  );
create policy class_teachers_update_admin on public.class_teachers
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy class_enrollments_select on public.class_enrollments
  for select to authenticated using (
    student_id = public.uid() or public.teaches_class(class_id) or public.is_admin()
  );
create policy class_enrollments_insert on public.class_enrollments
  for insert to authenticated with check (public.teaches_class(class_id) or public.is_admin());
create policy class_enrollments_update on public.class_enrollments
  for update to authenticated
  using (public.teaches_class(class_id) or public.is_admin())
  with check (public.teaches_class(class_id) or public.is_admin());
create policy class_enrollments_delete_admin on public.class_enrollments
  for delete to authenticated using (public.is_admin());

create policy class_courses_select on public.class_courses
  for select to authenticated using (
    public.in_class(class_id) or public.teaches_class(class_id) or public.is_admin()
  );
create policy class_courses_insert on public.class_courses
  for insert to authenticated with check (public.teaches_class(class_id) or public.is_admin());
create policy class_courses_update on public.class_courses
  for update to authenticated
  using (public.teaches_class(class_id) or public.is_admin())
  with check (public.teaches_class(class_id) or public.is_admin());
create policy class_courses_delete_admin on public.class_courses
  for delete to authenticated using (public.is_admin());

create policy class_unlock_overrides_select_own on public.class_unlock_overrides
  for select to authenticated using (student_id = public.uid());
create policy class_unlock_overrides_manage on public.class_unlock_overrides
  for all to authenticated
  using (public.teaches_class(class_id) or public.is_admin())
  with check (public.teaches_class(class_id) or public.is_admin());

-- 7.3 Content ------------------------------------------------

create policy courses_select_student on public.courses
  for select to authenticated using (
    status = 'published' and public.student_can_see_course(id)
  );
create policy courses_select_teacher on public.courses
  for select to authenticated using (
    public.app_role() = 'teacher' and (author_id = public.uid() or status = 'published')
  );
create policy courses_select_admin on public.courses
  for select to authenticated using (public.is_admin());
create policy courses_insert_teacher on public.courses
  for insert to authenticated with check (
    public.app_role() = 'teacher' and author_id = public.uid() and not is_official
  );
create policy courses_update_teacher on public.courses
  for update to authenticated
  using (public.app_role() = 'teacher' and author_id = public.uid() and not is_official)
  with check (public.app_role() = 'teacher' and author_id = public.uid() and not is_official);
create policy courses_delete_teacher on public.courses
  for delete to authenticated using (
    public.app_role() = 'teacher' and author_id = public.uid()
    and not is_official and status = 'draft'
  );
create policy courses_write_admin on public.courses
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy units_teacher on public.units
  for all to authenticated
  using (public.owns_course(course_id)) with check (public.owns_course(course_id));
create policy units_admin on public.units
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy lessons_teacher on public.lessons
  for all to authenticated
  using (public.owns_unit(unit_id)) with check (public.owns_unit(unit_id));
create policy lessons_admin on public.lessons
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy lesson_blocks_teacher on public.lesson_blocks
  for all to authenticated
  using (public.owns_lesson(lesson_id)) with check (public.owns_lesson(lesson_id));
create policy lesson_blocks_admin on public.lesson_blocks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy content_snapshots_select_student on public.content_snapshots
  for select to authenticated using (public.student_can_see_course(course_id));
create policy content_snapshots_select_teacher on public.content_snapshots
  for select to authenticated using (
    public.app_role() = 'teacher'
    and (public.owns_course(course_id) or public.course_is_published(course_id))
  );
create policy content_snapshots_admin on public.content_snapshots
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 7.4 Questions and assessments ------------------------------

create policy questions_teacher on public.questions
  for all to authenticated
  using (public.app_role() = 'teacher' and author_id = public.uid())
  with check (public.app_role() = 'teacher' and author_id = public.uid());
create policy questions_admin on public.questions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy rubrics_select_teacher on public.rubrics
  for select to authenticated using (
    public.app_role() = 'teacher' and (is_public or author_id = public.uid())
  );
create policy rubrics_write_teacher on public.rubrics
  for all to authenticated
  using (public.app_role() = 'teacher' and author_id = public.uid())
  with check (public.app_role() = 'teacher' and author_id = public.uid());
create policy rubrics_admin on public.rubrics
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy assessments_select_teacher on public.assessments
  for select to authenticated using (
    public.app_role() = 'teacher' and public.can_edit_assessment(id)
  );
create policy assessments_insert_teacher on public.assessments
  for insert to authenticated with check (
    public.app_role() = 'teacher'
    and author_id = public.uid()
    and (class_id is null or public.teaches_class(class_id))
  );
create policy assessments_update_teacher on public.assessments
  for update to authenticated
  using (public.app_role() = 'teacher' and public.can_edit_assessment(id))
  with check (
    public.app_role() = 'teacher'
    and (class_id is null or public.teaches_class(class_id))
  );
create policy assessments_delete_teacher on public.assessments
  for delete to authenticated using (
    public.app_role() = 'teacher' and author_id = public.uid() and status = 'draft'
  );
create policy assessments_admin on public.assessments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy assessment_questions_teacher on public.assessment_questions
  for all to authenticated
  using (public.app_role() = 'teacher' and public.can_edit_assessment(assessment_id))
  with check (public.app_role() = 'teacher' and public.can_edit_assessment(assessment_id));
create policy assessment_questions_admin on public.assessment_questions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy assessment_attempts_select_own on public.assessment_attempts
  for select to authenticated using (student_id = public.uid());
create policy assessment_attempts_select_teacher on public.assessment_attempts
  for select to authenticated using (public.teaches_assessment(assessment_id));
create policy assessment_attempts_select_admin on public.assessment_attempts
  for select to authenticated using (public.is_admin());

create policy attempt_answers_select_own on public.attempt_answers
  for select to authenticated using (public.owns_attempt(attempt_id));
create policy attempt_answers_select_teacher on public.attempt_answers
  for select to authenticated using (public.teaches_attempt(attempt_id));
create policy attempt_answers_select_admin on public.attempt_answers
  for select to authenticated using (public.is_admin());

create policy grade_history_select_teacher on public.grade_history
  for select to authenticated using (public.teaches_attempt(attempt_id));
create policy grade_history_select_admin on public.grade_history
  for select to authenticated using (public.is_admin());

create policy assignment_submissions_select_own on public.assignment_submissions
  for select to authenticated using (student_id = public.uid());
create policy assignment_submissions_select_teacher on public.assignment_submissions
  for select to authenticated using (public.teaches_class(class_id));
create policy assignment_submissions_update_teacher on public.assignment_submissions
  for update to authenticated
  using (public.teaches_class(class_id)) with check (public.teaches_class(class_id));
create policy assignment_submissions_select_admin on public.assignment_submissions
  for select to authenticated using (public.is_admin());

create policy assignment_revisions_select_own on public.assignment_submission_revisions
  for select to authenticated using (public.owns_submission(submission_id));
create policy assignment_revisions_select_teacher on public.assignment_submission_revisions
  for select to authenticated using (public.teaches_submission(submission_id));
create policy assignment_revisions_select_admin on public.assignment_submission_revisions
  for select to authenticated using (public.is_admin());

-- 7.5 Progress -----------------------------------------------

create policy lesson_progress_select_own on public.lesson_progress
  for select to authenticated using (student_id = public.uid());
create policy lesson_progress_insert_own on public.lesson_progress
  for insert to authenticated with check (student_id = public.uid());
create policy lesson_progress_update_own on public.lesson_progress
  for update to authenticated
  using (student_id = public.uid()) with check (student_id = public.uid());
create policy lesson_progress_select_teacher on public.lesson_progress
  for select to authenticated using (public.teaches_student(student_id));
create policy lesson_progress_select_admin on public.lesson_progress
  for select to authenticated using (public.is_admin());

create policy activity_progress_select_own on public.activity_progress
  for select to authenticated using (student_id = public.uid());
create policy activity_progress_insert_own on public.activity_progress
  for insert to authenticated with check (student_id = public.uid());
create policy activity_progress_update_own on public.activity_progress
  for update to authenticated
  using (student_id = public.uid()) with check (student_id = public.uid());
create policy activity_progress_select_teacher on public.activity_progress
  for select to authenticated using (public.teaches_student(student_id));
create policy activity_progress_select_admin on public.activity_progress
  for select to authenticated using (public.is_admin());

-- Completion and scoring columns change through RPCs only (spec 7.5).
revoke insert, update on public.lesson_progress from authenticated;
grant insert (student_id, lesson_id, course_id, notes) on public.lesson_progress to authenticated;
grant update (notes, last_accessed_at, last_opened_at) on public.lesson_progress to authenticated;

revoke insert, update on public.activity_progress from authenticated;
grant insert (student_id, activity_id, course_id, state) on public.activity_progress to authenticated;
grant update (state) on public.activity_progress to authenticated;

create policy writing_drafts_own on public.writing_drafts
  for all to authenticated
  using (student_id = public.uid()) with check (student_id = public.uid());

-- 7.6 Gamification, games, shop -------------------------------

create policy student_stats_select_own on public.student_stats
  for select to authenticated using (student_id = public.uid());
create policy student_stats_select_teacher on public.student_stats
  for select to authenticated using (public.teaches_student(student_id));
create policy student_stats_select_admin on public.student_stats
  for select to authenticated using (public.is_admin());

create policy xp_ledger_select_own on public.xp_ledger
  for select to authenticated using (student_id = public.uid());
create policy xp_ledger_select_teacher on public.xp_ledger
  for select to authenticated using (public.teaches_student(student_id));
create policy xp_ledger_select_admin on public.xp_ledger
  for select to authenticated using (public.is_admin());

create policy coin_ledger_select_own on public.coin_ledger
  for select to authenticated using (student_id = public.uid());
create policy coin_ledger_select_teacher on public.coin_ledger
  for select to authenticated using (public.teaches_student(student_id));
create policy coin_ledger_select_admin on public.coin_ledger
  for select to authenticated using (public.is_admin());

create policy streak_days_select_own on public.streak_days
  for select to authenticated using (student_id = public.uid());
create policy streak_days_select_admin on public.streak_days
  for select to authenticated using (public.is_admin());

create policy quest_templates_select on public.quest_templates
  for select to authenticated using (is_active or public.is_admin());
create policy quest_templates_write_super on public.quest_templates
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy badge_definitions_select on public.badge_definitions
  for select to authenticated using (true);
create policy badge_definitions_write_super on public.badge_definitions
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy quest_instances_select_own on public.quest_instances
  for select to authenticated using (student_id = public.uid());
create policy quest_instances_select_teacher on public.quest_instances
  for select to authenticated using (public.teaches_student(student_id));
create policy quest_instances_select_admin on public.quest_instances
  for select to authenticated using (public.is_admin());

create policy user_badges_select_own on public.user_badges
  for select to authenticated using (student_id = public.uid());
create policy user_badges_select_teacher on public.user_badges
  for select to authenticated using (public.teaches_student(student_id));
create policy user_badges_select_admin on public.user_badges
  for select to authenticated using (public.is_admin());

create policy leaderboard_snapshots_select_admin on public.leaderboard_snapshots
  for select to authenticated using (public.is_admin());

create policy games_select on public.games
  for select to authenticated using (is_active or public.is_admin());
create policy games_write_super on public.games
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy game_daily_featured_select on public.game_daily_featured
  for select to authenticated using (true);
create policy game_daily_featured_write_super on public.game_daily_featured
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy game_sessions_select_own on public.game_sessions
  for select to authenticated using (student_id = public.uid());
create policy game_sessions_select_admin on public.game_sessions
  for select to authenticated using (public.is_admin());

create policy shop_items_select on public.shop_items
  for select to authenticated using (
    is_available
    or public.is_admin()
    or exists (
      select 1 from public.user_inventory ui
      where ui.item_id = shop_items.id and ui.user_id = public.uid()
    )
  );
create policy shop_items_write_super on public.shop_items
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy avatar_assets_select on public.avatar_assets
  for select to authenticated using (true);
create policy avatar_assets_write_super on public.avatar_assets
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy user_inventory_select_own on public.user_inventory
  for select to authenticated using (user_id = public.uid());
create policy user_inventory_select_admin on public.user_inventory
  for select to authenticated using (public.is_admin());

-- 7.7 Communication and notifications --------------------------

create policy announcements_select_recipient on public.announcements
  for select to authenticated using (public.is_announcement_recipient(id));
create policy announcements_select_author on public.announcements
  for select to authenticated using (author_id = public.uid());
create policy announcements_insert_teacher on public.announcements
  for insert to authenticated with check (
    public.app_role() = 'teacher'
    and author_id = public.uid()
    and target_type = 'class'
    and target_class_id is not null
    and public.teaches_class(target_class_id)
  );
create policy announcements_update_teacher on public.announcements
  for update to authenticated
  using (public.app_role() = 'teacher' and author_id = public.uid())
  with check (
    public.app_role() = 'teacher'
    and author_id = public.uid()
    and target_type = 'class'
    and target_class_id is not null
    and public.teaches_class(target_class_id)
  );
create policy announcements_delete_teacher on public.announcements
  for delete to authenticated using (public.app_role() = 'teacher' and author_id = public.uid());
create policy announcements_admin on public.announcements
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy announcement_recipients_select_own on public.announcement_recipients
  for select to authenticated using (user_id = public.uid());
create policy announcement_recipients_update_own on public.announcement_recipients
  for update to authenticated using (user_id = public.uid()) with check (user_id = public.uid());
create policy announcement_recipients_select_author on public.announcement_recipients
  for select to authenticated using (public.owns_announcement(announcement_id));
create policy announcement_recipients_select_admin on public.announcement_recipients
  for select to authenticated using (public.is_admin());

revoke update on public.announcement_recipients from authenticated;
grant update (read_at) on public.announcement_recipients to authenticated;

create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = public.uid());
create policy notifications_update_own on public.notifications
  for update to authenticated using (user_id = public.uid()) with check (user_id = public.uid());

revoke update on public.notifications from authenticated;
grant update (is_read, read_at) on public.notifications to authenticated;

-- 7.9 Jobs, moderation, audit ---------------------------------

create policy jobs_select_own on public.jobs
  for select to authenticated using (initiator_id = public.uid());
create policy jobs_select_admin on public.jobs
  for select to authenticated using (public.is_admin());

create policy job_steps_select_own on public.job_steps
  for select to authenticated using (public.owns_job(job_id));
create policy job_steps_select_admin on public.job_steps
  for select to authenticated using (public.is_admin());

create policy moderation_queue_admin on public.moderation_queue
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy audit_log_select_super on public.audit_log
  for select to authenticated using (public.is_super_admin());
create policy audit_log_select_school on public.audit_log
  for select to authenticated using (
    public.is_school_admin() and actor_role in ('student', 'teacher')
  );

-- 7.8 AI -----------------------------------------------------
-- Students read and write their own conversations. Staff reach other conversations only
-- through Edge Functions with the service role.

create policy ai_conversations_select_own on public.ai_conversations
  for select to authenticated using (user_id = public.uid());
create policy ai_conversations_insert_own on public.ai_conversations
  for insert to authenticated with check (user_id = public.uid());
create policy ai_conversations_update_own on public.ai_conversations
  for update to authenticated using (user_id = public.uid()) with check (user_id = public.uid());

create policy ai_messages_select_own on public.ai_messages
  for select to authenticated using (public.owns_conversation(conversation_id));
create policy ai_messages_insert_own on public.ai_messages
  for insert to authenticated with check (
    public.owns_conversation(conversation_id) and role = 'user'
  );

create policy ai_action_cards_select_staff on public.ai_action_cards
  for select to authenticated using (
    public.app_role() in ('teacher', 'admin', 'super_admin')
    and (user_id = public.uid() or public.owns_conversation(conversation_id))
  );
create policy ai_action_cards_update_staff on public.ai_action_cards
  for update to authenticated
  using (
    public.app_role() in ('teacher', 'admin', 'super_admin')
    and (user_id = public.uid() or public.owns_conversation(conversation_id))
  )
  with check (
    public.app_role() in ('teacher', 'admin', 'super_admin')
    and (user_id = public.uid() or public.owns_conversation(conversation_id))
  );

create policy ai_usage_logs_select_admin on public.ai_usage_logs
  for select to authenticated using (public.is_admin());

-- ============================================================
-- Step 5: Foreign key indexes missing from earlier migrations
-- ============================================================

create index if not exists idx_activity_progress_course_id on public.activity_progress(course_id);
create index if not exists idx_admin_notes_author_id on public.admin_notes(author_id);
create index if not exists idx_admin_notes_user_id on public.admin_notes(user_id);
create index if not exists idx_assessment_attempts_grading_locked_by
  on public.assessment_attempts(grading_locked_by);
create index if not exists idx_content_snapshots_published_by on public.content_snapshots(published_by);
create index if not exists idx_grade_history_question_id on public.grade_history(question_id);
create index if not exists idx_jobs_locked_by on public.jobs(locked_by);
create index if not exists idx_lesson_progress_course_id on public.lesson_progress(course_id);
create index if not exists idx_lesson_progress_lesson_id on public.lesson_progress(lesson_id);
create index if not exists idx_moderation_queue_assignee_id on public.moderation_queue(assignee_id);
create index if not exists idx_moderation_queue_reporter_id on public.moderation_queue(reporter_id);
create index if not exists idx_moderation_queue_resolved_by on public.moderation_queue(resolved_by);
create index if not exists idx_moderation_queue_reviewed_by on public.moderation_queue(reviewed_by);
create index if not exists idx_platform_settings_updated_by on public.platform_settings(updated_by);
create index if not exists idx_user_badges_badge_id on public.user_badges(badge_id);
create index if not exists idx_user_inventory_item_id on public.user_inventory(item_id);



-- Migration: 040_auth_password_flows.sql
-- 040: password flows for SH-03 (forgot password) and SH-04 (set a new password)
--
-- 1. password_reset_requests (backend/docs/02-DATA-MODEL-CORE.md section 2): the rows a person
--    creates from /forgot-password. Nobody writes to the table directly. Reads follow
--    04-AUTH-AND-ACCESS section 5: admins see them, teachers see requests of their own students.
-- 2. request_password_reset(...): the public entry point for that table. Always returns the same
--    body, so nobody can learn which usernames exist. It limits one device to 3 requests per hour.
-- 3. complete_password_change(): clears must_change_password for the caller, only after the
--    password was changed. The client cannot write the profile row (no update policy by design).

-- ------------------------------------------------------------
-- 1. Table
-- ------------------------------------------------------------
create table if not exists public.password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  full_name text not null,
  grade_class text,
  note text check (note is null or char_length(note) <= 200),
  status text not null default 'new' check (status in ('new', 'handled', 'dismissed')),
  profile_id uuid references public.profiles (id) on delete set null,
  handled_by uuid references public.profiles (id) on delete set null,
  handled_at timestamptz,
  device_hash text,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_password_reset_requests_status_created
  on public.password_reset_requests (status, created_at);
create index if not exists idx_password_reset_requests_device_created
  on public.password_reset_requests (device_hash, created_at)
  where device_hash is not null;
create index if not exists idx_password_reset_requests_ip_created
  on public.password_reset_requests (ip_hash, created_at)
  where ip_hash is not null;

alter table public.password_reset_requests enable row level security;

-- No insert, update or delete policy: rows are created by request_password_reset() and handled
-- by the reset-password function with the service role.
create policy password_gate on public.password_reset_requests as restrictive
  for all to authenticated using (not public.must_change());

create policy password_reset_requests_select_admin on public.password_reset_requests
  for select to authenticated using (
    public.is_super_admin()
    or (
      public.is_school_admin()
      and (
        profile_id is null
        or exists (
          select 1 from public.profiles p
          where p.id = password_reset_requests.profile_id and p.role in ('student', 'teacher')
        )
      )
    )
  );

create policy password_reset_requests_select_teacher on public.password_reset_requests
  for select to authenticated using (
    profile_id is not null and public.teaches_student(profile_id)
  );

-- ------------------------------------------------------------
-- 2. request_password_reset
-- ------------------------------------------------------------
-- p_device_key is a random id the browser keeps. It is hashed here and never stored as sent.
-- The caller address comes from the request headers that PostgREST exposes, hashed the same way.
create or replace function public.request_password_reset(
  p_username text,
  p_full_name text,
  p_grade_class text default null,
  p_note text default null,
  p_device_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := lower(btrim(coalesce(p_username, '')));
  v_full_name text := btrim(coalesce(p_full_name, ''));
  v_grade_class text := nullif(btrim(coalesce(p_grade_class, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_headers jsonb;
  v_ip text;
  v_device_hash text;
  v_ip_hash text;
  v_profile_id uuid;
  v_recent integer;
begin
  if v_username !~ '^[a-z0-9._-]{3,32}$'
     or char_length(v_full_name) not between 2 and 80
     or (v_grade_class is not null and char_length(v_grade_class) > 32)
     or (v_note is not null and char_length(v_note) > 200) then
    raise exception using errcode = 'P0001', message = 'validation_failed';
  end if;

  begin
    v_headers := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  exception when others then
    v_headers := '{}'::jsonb;
  end;
  v_ip := nullif(btrim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), '');

  if nullif(btrim(coalesce(p_device_key, '')), '') is not null then
    v_device_hash := encode(extensions.digest('device:' || btrim(p_device_key), 'sha256'), 'hex');
  end if;
  if v_ip is not null then
    v_ip_hash := encode(extensions.digest('ip:' || v_ip, 'sha256'), 'hex');
  end if;

  -- Limits (04-AUTH-AND-ACCESS section 3): 3 per hour per device, 20 per hour per address.
  if v_device_hash is not null then
    select count(*) into v_recent
    from public.password_reset_requests r
    where r.device_hash = v_device_hash and r.created_at > now() - interval '1 hour';
    if v_recent >= 3 then
      raise exception using errcode = 'P0001', message = 'rate_limited';
    end if;
  end if;
  if v_ip_hash is not null then
    select count(*) into v_recent
    from public.password_reset_requests r
    where r.ip_hash = v_ip_hash and r.created_at > now() - interval '1 hour';
    if v_recent >= 20 then
      raise exception using errcode = 'P0001', message = 'rate_limited';
    end if;
  end if;

  -- Linked only when the username exists. The caller never learns whether it did.
  select p.id into v_profile_id
  from public.profiles p
  where p.username = v_username::extensions.citext;

  insert into public.password_reset_requests
    (username, full_name, grade_class, note, profile_id, device_hash, ip_hash)
  values
    (v_username, v_full_name, v_grade_class, v_note, v_profile_id, v_device_hash, v_ip_hash);

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.request_password_reset(text, text, text, text, text) from public;
grant execute on function public.request_password_reset(text, text, text, text, text)
  to anon, authenticated;

-- ------------------------------------------------------------
-- 3. complete_password_change
-- ------------------------------------------------------------
-- The page changes the password with Supabase Auth first, then calls this. A password change
-- updates the account row after the last sign-in, so a flag that is cleared without any change
-- since sign-in is refused. The caller can only ever clear their own flag.
create or replace function public.complete_password_change()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_changed boolean;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;

  select u.updated_at > coalesce(u.last_sign_in_at, '-infinity'::timestamptz)
    into v_changed
  from auth.users u
  where u.id = v_user_id;

  if not coalesce(v_changed, false) then
    raise exception using errcode = 'P0001', message = 'password_not_changed';
  end if;

  update public.profiles
     set must_change_password = false
   where id = v_user_id
     and status = 'active';

  if not found then
    raise exception using errcode = 'P0001', message = 'account_inactive';
  end if;
end;
$$;

revoke all on function public.complete_password_change() from public;
grant execute on function public.complete_password_change() to authenticated;



-- Migration: 040_question_bank_facets.sql
-- TC-19 Question Bank facets: persist CEFR/grade and school-library visibility.
alter table public.questions
  add column if not exists grade text,
  add column if not exists is_public boolean not null default false;

create index if not exists idx_questions_grade on public.questions(grade);
create index if not exists idx_questions_public on public.questions(is_public) where is_public = true;

-- Teachers may discover shared school-library questions; edits remain restricted to the owner.
create policy questions_select_shared on public.questions
  for select to authenticated
  using (is_public = true);



-- Migration: 041_auth_reset_password.sql
-- 041: reset_password(): an admin or a teacher issues a temporary password (SH-03 follow-up).
-- Follows backend/docs/04-AUTH-AND-ACCESS.md section 3 ("reset-password"), written as a database
-- function because it only needs the auth.users row and the tables of this schema.
--
--   Who may reset: a School admin resets students and teachers, only a Super admin resets admins,
--   and a teacher resets students with an active enrollment in one of their classes.
--   What it does: makes a temporary password (10 characters from an alphabet without look-alike
--   characters, with letters, numbers and symbols), stores it as the account password, sets
--   must_change_password, clears a lock, signs the account out everywhere, marks the request
--   handled (the first handler wins, a second gets `conflict`), writes an audit row, and returns
--   the temporary password once. Only its hash is kept, in password_change_gates, so
--   complete_password_change() can tell that the person chose a new password.

create or replace function public.make_temporary_password()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  c_letters constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  c_digits constant text := '23456789';
  c_symbols constant text := '!@#$%?';
  v_chars text[] := '{}';
  v_pick integer;
  v_byte integer;
  v_set text;
  v_count integer;
  v_limit integer;
begin
  -- 6 letters, 2 numbers, 2 symbols, then shuffled. Each pick rejects bytes that would bias it.
  for v_count in 1..10 loop
    v_set := case when v_count <= 6 then c_letters when v_count <= 8 then c_digits else c_symbols end;
    v_limit := (256 / length(v_set)) * length(v_set);
    loop
      v_byte := get_byte(extensions.gen_random_bytes(1), 0);
      exit when v_byte < v_limit;
    end loop;
    v_pick := (v_byte % length(v_set)) + 1;
    v_chars := v_chars || substr(v_set, v_pick, 1);
  end loop;

  -- Fisher-Yates with unbiased random indexes.
  for v_count in reverse 10..2 loop
    v_limit := (256 / v_count) * v_count;
    loop
      v_byte := get_byte(extensions.gen_random_bytes(1), 0);
      exit when v_byte < v_limit;
    end loop;
    v_pick := (v_byte % v_count) + 1;
    v_set := v_chars[v_count];
    v_chars[v_count] := v_chars[v_pick];
    v_chars[v_pick] := v_set;
  end loop;

  return array_to_string(v_chars, '');
end;
$$;

revoke all on function public.make_temporary_password() from public, anon, authenticated;

create or replace function public.reset_password(
  p_profile_id uuid,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_caller public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_request public.password_reset_requests%rowtype;
  v_allowed boolean;
  v_temp text;
  v_hash text;
begin
  if v_caller_id is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;

  select * into v_caller from public.profiles where id = v_caller_id and status = 'active';
  if not found then
    raise exception using errcode = 'P0001', message = 'account_inactive';
  end if;

  select * into v_target from public.profiles where id = p_profile_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;

  v_allowed := case
    when v_caller.role = 'super_admin' then true
    when v_caller.role = 'admin' then v_target.role in ('student', 'teacher')
    when v_caller.role = 'teacher' then v_target.role = 'student' and public.teaches_student(v_target.id)
    else false
  end;
  if not v_allowed or v_target.id = v_caller_id then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  if v_target.status = 'archived' then
    raise exception using errcode = 'P0001', message = 'account_inactive';
  end if;

  if p_request_id is not null then
    select * into v_request
    from public.password_reset_requests
    where id = p_request_id
    for update;
    if not found or v_request.profile_id is distinct from v_target.id then
      raise exception using errcode = 'P0001', message = 'not_found';
    end if;
    if v_request.status <> 'new' then
      raise exception using errcode = 'P0001', message = 'conflict';
    end if;
  end if;

  v_temp := public.make_temporary_password();
  v_hash := extensions.crypt(v_temp, extensions.gen_salt('bf'));

  update auth.users
     set encrypted_password = v_hash, updated_at = now()
   where id = v_target.id;

  insert into public.password_change_gates (profile_id, temp_hash)
  values (v_target.id, v_hash)
  on conflict (profile_id) do update set temp_hash = excluded.temp_hash, created_at = now();

  update public.profiles
     set must_change_password = true,
         status = case when status = 'locked' then 'active'::public.user_status else status end
   where id = v_target.id;

  -- Signed out everywhere (removes the refresh tokens with them).
  delete from auth.sessions where user_id = v_target.id;

  update public.password_reset_requests
     set status = 'handled', handled_by = v_caller_id, handled_at = now()
   where status = 'new'
     and (id = p_request_id or (p_request_id is null and profile_id = v_target.id));

  insert into public.audit_log
    (user_id, actor_id, actor_role, action, action_type, target_table, target_type, target_id, summary)
  values
    (v_target.id, v_caller_id, v_caller.role, 'password_reset', 'password_resets',
     'profiles', 'profile', v_target.id, 'Temporary password issued');

  return jsonb_build_object('profile_id', v_target.id, 'temporary_password', v_temp);
end;
$$;

revoke all on function public.reset_password(uuid, uuid) from public, anon;
grant execute on function public.reset_password(uuid, uuid) to authenticated;



-- Migration: 042_ops_21_my_deadlines.sql
-- 042: my_deadlines(): the student's open assignments and quizzes, soonest first (ST-01, STU-CORE-02).
--
-- Follows backend/docs/05-API-CONTRACT.md: `my_deadlines {limit}` returns
--   [{kind: 'assignment'|'quiz', id, title, course, due_at, status, action, overdue}]
--
--   What counts: published assessments with a due date, in a class the student is actively
--   enrolled in (and that is not archived), that the student has not finished.
--     assignment  finished once a submission exists that is no longer `in_progress`.
--     quiz        finished once the student has used every allowed attempt.
--   Overdue items stay on the list for 30 days after the due date so a missing homework keeps
--   showing as an alert. They sort first because they have the earliest due date.
--   course      the class name (assessments belong to a class, not to a course).
--   status      `in_progress` when the student has an unfinished attempt or draft, else `not_started`.
--   action      `continue` for `in_progress`, else `start`.
--   Security definer, because students have no direct read access to `assessments`. The caller's
--   own id comes from auth.uid(), so a student only ever sees their own deadlines.

create or replace function public.my_deadlines("limit" integer default 5)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select a.id,
           a.kind,
           a.title,
           a.due_date,
           a.max_attempts,
           c.name as course_name
    from public.assessments a
    join public.classes c
      on c.id = a.class_id
     and not coalesce(c.is_archived, false)
    join public.class_enrollments ce
      on ce.class_id = a.class_id
     and ce.student_id = (select auth.uid())
     and ce.status = 'active'
    where a.status = 'published'
      and a.due_date is not null
      and a.due_date > public.app_now() - interval '30 days'
  ),
  progress as (
    select m.*,
           case m.kind
             when 'assignment' then exists (
               select 1
               from public.assignment_submissions s
               where s.assessment_id = m.id
                 and s.student_id = (select auth.uid())
                 and s.status = 'in_progress'
             )
             else exists (
               select 1
               from public.assessment_attempts t
               where t.assessment_id = m.id
                 and t.student_id = (select auth.uid())
                 and t.status = 'in_progress'
             )
           end as started,
           case m.kind
             when 'assignment' then exists (
               select 1
               from public.assignment_submissions s
               where s.assessment_id = m.id
                 and s.student_id = (select auth.uid())
                 and s.status <> 'in_progress'
             )
             else (
               select count(*)
               from public.assessment_attempts t
               where t.assessment_id = m.id
                 and t.student_id = (select auth.uid())
                 and t.status <> 'in_progress'
             ) >= m.max_attempts
           end as finished
    from mine m
  ),
  open_items as (
    select p.*
    from progress p
    where not p.finished
    order by p.due_date, p.title
    limit least(greatest(coalesce(my_deadlines."limit", 5), 1), 20)
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'kind', o.kind::text,
        'id', o.id,
        'title', o.title,
        'course', o.course_name,
        'due_at', o.due_date,
        'status', case when o.started then 'in_progress' else 'not_started' end,
        'action', case when o.started then 'continue' else 'start' end,
        'overdue', o.due_date <= public.app_now()
      )
      order by o.due_date, o.title
    ),
    '[]'::jsonb
  )
  from open_items o
$$;

revoke all on function public.my_deadlines(integer) from public, anon;
grant execute on function public.my_deadlines(integer) to authenticated;



-- Migration: 043_ops_22_save_student_avatar.sql
-- ST-28: let a student save only their own generated avatar SVG.
-- A security-definer RPC is used because profiles intentionally has no broad
-- student UPDATE policy (display_name, role and status must remain protected).
create or replace function public.save_student_avatar(p_avatar_url text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Sign in to save your avatar.' using errcode = '28000';
  end if;

  if p_avatar_url is null
     or length(p_avatar_url) > 12000
     or p_avatar_url !~ '^data:image/svg\+xml,' then
    raise exception 'Choose a valid avatar design.' using errcode = '22023';
  end if;

  update public.profiles
     set avatar_url = p_avatar_url
   where id = v_user_id
     and role = 'student'
     and status = 'active';

  if not found then
    raise exception 'Your active student profile could not be found.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.save_student_avatar(text) from public;
grant execute on function public.save_student_avatar(text) to authenticated;



-- Migration: 044_ops_23_lesson_media_storage.sql
-- TC-11: storage bucket and ownership policies for lesson editor media.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lesson-media',
  'lesson-media',
  true,
  52428800,
  array['image/jpeg','image/png','image/webp','image/gif','audio/mpeg','audio/mp4','audio/wav','audio/ogg','audio/webm','audio/aac']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public reads are intentional so published lesson media can be played by students.
create policy "lesson media public read"
on storage.objects for select
to public
using (bucket_id = 'lesson-media');

create policy "lesson media lesson owner upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'lesson-media'
  and (storage.foldername(name))[1] = 'lessons'
  and public.owns_lesson(((storage.foldername(name))[2])::uuid)
);

create policy "lesson media lesson owner update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'lesson-media'
  and (storage.foldername(name))[1] = 'lessons'
  and public.owns_lesson(((storage.foldername(name))[2])::uuid)
)
with check (
  bucket_id = 'lesson-media'
  and (storage.foldername(name))[1] = 'lessons'
  and public.owns_lesson(((storage.foldername(name))[2])::uuid)
);

create policy "lesson media lesson owner delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'lesson-media'
  and (storage.foldername(name))[1] = 'lessons'
  and public.owns_lesson(((storage.foldername(name))[2])::uuid)
);



-- Migration: 045_ops_24_action_card_compatibility.sql
-- Align the action-card storage table with the fields consumed by ai-copilot and BE-OPS-20.
-- Existing rows are retained; pending cards become apply-ready after their payload is backfilled.
alter table public.ai_action_cards
  add column if not exists feature text not null default 'copilot',
  add column if not exists kind text,
  add column if not exists summary text,
  add column if not exists preview jsonb not null default '{}'::jsonb,
  add column if not exists sources jsonb not null default '[]'::jsonb,
  add column if not exists notes jsonb not null default '[]'::jsonb,
  add column if not exists stamps jsonb not null default '{}'::jsonb;

alter table public.ai_action_cards alter column card_type set default 'copilot';
alter table public.ai_action_cards alter column payload set default '{}'::jsonb;

-- Older installs used a narrower text check that excluded the lifecycle states required by RPCs.
do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select conname
    from pg_catalog.pg_constraint
    where conrelid = 'public.ai_action_cards'::regclass
      and contype = 'c'
      and pg_catalog.pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute pg_catalog.format('alter table public.ai_action_cards drop constraint %I', v_constraint.conname);
  end loop;
end;
$$;


update public.ai_action_cards
set kind = coalesce(kind, card_type, 'curriculum_change'),
    summary = coalesce(summary, payload->>'summary', 'Review the proposed changes below.'),
    preview = case when preview = '{}'::jsonb then coalesce(payload->'preview', payload, '{}'::jsonb) else preview end,
    sources = case when sources = '[]'::jsonb then coalesce(payload->'sources', '[]'::jsonb) else sources end,
    notes = case when notes = '[]'::jsonb then coalesce(payload->'notes', '[]'::jsonb) else notes end,
    status = case when status::text = 'pending' then 'ready' else status end;


alter table public.ai_action_cards
  add constraint ai_action_cards_status_lifecycle_check
  check (status::text in ('generating', 'pending', 'ready', 'accepted', 'applied', 'edited', 'discarded', 'stale', 'failed', 'undone'));

create index if not exists idx_ai_action_cards_feature_status_created
  on public.ai_action_cards(feature, status, created_at desc);



-- Migration: 046_teacher_ai_course_job_insert.sql
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



-- Migration: 047_teacher_restore_course_snapshot.sql
-- TCH-AI-19: restore a published immutable snapshot into the editable course draft.
-- Historical content_snapshots rows are never updated or deleted by this function.
create or replace function public.restore_course_snapshot(
  p_course_id uuid,
  p_snapshot_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_course public.courses%rowtype;
  v_snapshot public.content_snapshots%rowtype;
  v_course_json jsonb;
  v_unit jsonb;
  v_lesson jsonb;
  v_block jsonb;
  v_unit_id uuid;
  v_lesson_id uuid;
  v_units_count integer := 0;
  v_lessons_count integer := 0;
  v_blocks_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select p.role::text into v_role
  from public.profiles p
  where p.id = v_user_id and p.status::text = 'active';

  if v_role is null then
    raise exception 'Active profile required' using errcode = '42501';
  end if;

  select c.* into v_course
  from public.courses c
  where c.id = p_course_id
  for update;
  if not found then
    raise exception 'Course not found' using errcode = 'P0002';
  end if;

  if v_role not in ('admin', 'super_admin')
     and (v_role <> 'teacher' or v_course.author_id is distinct from v_user_id) then
    raise exception 'Only the course author or an admin can restore this course'
      using errcode = '42501';
  end if;

  select cs.* into v_snapshot
  from public.content_snapshots cs
  where cs.id = p_snapshot_id and cs.course_id = p_course_id;
  if not found then
    raise exception 'Snapshot does not belong to this course' using errcode = '22023';
  end if;

  v_course_json := coalesce(v_snapshot.snapshot_data->'course', '{}'::jsonb);
  if jsonb_typeof(v_snapshot.snapshot_data->'units') is distinct from 'array' then
    raise exception 'Snapshot has no valid units array' using errcode = '22023';
  end if;

  -- Keep ownership and slug stable, and restore content as an unpublished draft.
  update public.courses
  set title = coalesce(nullif(v_course_json->>'title', ''), v_course.title),
      description = v_course_json->>'description',
      grade_level = v_course_json->>'grade_level',
      cover_image = v_course_json->>'cover_image',
      position = coalesce((v_course_json->>'position')::integer, v_course.position),
      status = 'draft',
      updated_at = pg_catalog.now()
  where id = p_course_id;

  delete from public.units where course_id = p_course_id;

  for v_unit in select value from jsonb_array_elements(coalesce(v_snapshot.snapshot_data->'units', '[]'::jsonb))
  loop
    insert into public.units (course_id, title, description, order_index)
    values (
      p_course_id,
      coalesce(nullif(v_unit->>'title', ''), 'Untitled unit'),
      v_unit->>'description',
      coalesce((v_unit->>'order_index')::integer, v_units_count)
    ) returning id into v_unit_id;
    v_units_count := v_units_count + 1;

    for v_lesson in select value from jsonb_array_elements(coalesce(v_unit->'lessons', '[]'::jsonb))
    loop
      insert into public.lessons (unit_id, title, description, xp_reward, coin_reward, order_index)
      values (
        v_unit_id,
        coalesce(nullif(v_lesson->>'title', ''), 'Untitled lesson'),
        v_lesson->>'description',
        coalesce((v_lesson->>'xp_reward')::integer, 20),
        coalesce((v_lesson->>'coin_reward')::integer, 5),
        coalesce((v_lesson->>'order_index')::integer, v_lessons_count)
      ) returning id into v_lesson_id;
      v_lessons_count := v_lessons_count + 1;

      for v_block in select value from jsonb_array_elements(coalesce(v_lesson->'blocks', '[]'::jsonb))
      loop
        insert into public.lesson_blocks (lesson_id, block_type, content, order_index)
        values (
          v_lesson_id,
          coalesce(nullif(v_block->>'block_type', ''), 'text'),
          case when jsonb_typeof(v_block->'content') = 'object' then v_block->'content' else '{}'::jsonb end,
          coalesce((v_block->>'order_index')::integer, v_blocks_count)
        );
        v_blocks_count := v_blocks_count + 1;
      end loop;
    end loop;
  end loop;

  return jsonb_build_object(
    'course_id', p_course_id,
    'restored_snapshot_id', p_snapshot_id,
    'restored_version', v_snapshot.version_number,
    'status', 'draft',
    'units_restored', v_units_count,
    'lessons_restored', v_lessons_count,
    'blocks_restored', v_blocks_count
  );
end;
$$;

revoke all on function public.restore_course_snapshot(uuid, uuid) from public;
grant execute on function public.restore_course_snapshot(uuid, uuid) to authenticated;



