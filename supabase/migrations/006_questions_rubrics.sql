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
