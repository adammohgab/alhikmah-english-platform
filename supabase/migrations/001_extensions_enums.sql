create extension if not exists uuid_ossp;
create extension if not exists pgcrypto;
create extension if not exists citext;

create enum user_role as ('admin', 'super_admin', 'student', 'teacher');

create enum user_status as ('active', 'locked', 'archived');

create enum content_status as ('archived', 'draft', 'published');

create enum question_type as ('audio_spelling', 'drag_drop', 'fill_blank', 'multiple_choice', 'reorder', 'short_answer', 'matching');

create enum assessment_kind as ('assignment', 'quiz');

create enum submission_status as ('graded', 'in_progress', 'returned', 'submitted');

create or replace function app_now()
returns timestamptz
language sql
as $$select now();$$