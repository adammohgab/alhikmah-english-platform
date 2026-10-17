create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create type user_role as enum ('admin', 'super_admin', 'student', 'teacher');

create type user_status as enum ('active', 'locked', 'archived');

create type content_status as enum ('archived', 'draft', 'published');

create type question_type as enum ('audio_spelling', 'drag_drop', 'fill_blank', 'multiple_choice', 'reorder', 'short_answer', 'matching');

create type assessment_kind as enum ('assignment', 'quiz');

create type submission_status as enum ('graded', 'in_progress', 'returned', 'submitted');

create or replace function app_now()
returns timestamptz
language sql
as $$select now();$$;
