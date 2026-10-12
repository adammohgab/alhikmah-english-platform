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
