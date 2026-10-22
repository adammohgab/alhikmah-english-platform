-- Checks for my_deadlines() (migration 042, STU-CORE-02).
-- Run after apply-migrations.sh:  psql -v ON_ERROR_STOP=1 -d alhikmah_migration_check -f supabase/tests/my-deadlines.sql
-- Each check raises an exception on failure. The script rolls back, so it leaves no data.
begin;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000b1');
insert into profiles (id, username, display_name, role, status) values
  ('00000000-0000-0000-0000-0000000000a1', 'stu.one', 'Student One', 'student', 'active'),
  ('00000000-0000-0000-0000-0000000000a2', 'stu.two', 'Student Two', 'student', 'active'),
  ('00000000-0000-0000-0000-0000000000b1', 'teach.one', 'Teacher One', 'teacher', 'active');
insert into school_years (id, name, start_date, end_date)
  values ('00000000-0000-0000-0000-00000000d001', 'Y', '2026-09-01', '2027-06-30');
insert into terms (id, year_id, name, start_date, end_date)
  values ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-00000000d001', 'T', '2026-09-01', '2027-01-30');
insert into classes (id, term_id, name, join_code, grade_level) values
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000d002', 'Grade 7A', 'JOIN01', '7'),
  ('00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-00000000d002', 'Grade 8B', 'JOIN02', '8');
-- Student one is in class one only. Student two is in class two only.
insert into class_enrollments (class_id, student_id) values
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-0000000000a2');

-- Assessments in class one. The letter is in the title.
insert into assessments (id, class_id, author_id, title, kind, due_date, max_attempts, status) values
  ('00000000-0000-0000-0000-00000000a0a1', '00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000b1', 'A overdue assignment', 'assignment', now() - interval '2 hours', 1, 'published'),
  ('00000000-0000-0000-0000-00000000a0b1', '00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000b1', 'B quiz in progress', 'quiz', now() + interval '5 hours', 2, 'published'),
  ('00000000-0000-0000-0000-00000000a0c1', '00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000b1', 'C draft assignment', 'assignment', now() + interval '3 days', 1, 'draft'),
  ('00000000-0000-0000-0000-00000000a0d1', '00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000b1', 'D submitted assignment', 'assignment', now() + interval '1 day', 1, 'published'),
  ('00000000-0000-0000-0000-00000000a0e1', '00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000b1', 'E quiz attempts used up', 'quiz', now() + interval '2 days', 1, 'published'),
  ('00000000-0000-0000-0000-00000000a0f1', '00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000b1', 'F quiz not started', 'quiz', now() + interval '4 days', 1, 'published'),
  ('00000000-0000-0000-0000-00000000a0a2', '00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000b1', 'G long overdue', 'assignment', now() - interval '40 days', 1, 'published'),
  ('00000000-0000-0000-0000-00000000a0a3', '00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000b1', 'H no due date', 'assignment', null, 1, 'published'),
  ('00000000-0000-0000-0000-00000000a0a4', '00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-0000000000b1', 'I other class', 'assignment', now() + interval '1 day', 1, 'published'),
  ('00000000-0000-0000-0000-00000000a0a5', '00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000b1', 'K assignment later', 'assignment', now() + interval '5 days', 1, 'published');

insert into assessment_attempts (assessment_id, student_id, attempt_number, status, submitted_at) values
  ('00000000-0000-0000-0000-00000000a0b1', '00000000-0000-0000-0000-0000000000a1', 1, 'in_progress', null),
  ('00000000-0000-0000-0000-00000000a0e1', '00000000-0000-0000-0000-0000000000a1', 1, 'submitted', now());
insert into assignment_submissions (assessment_id, student_id, class_id, status, submitted_at) values
  ('00000000-0000-0000-0000-00000000a0d1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000e001', 'submitted', now());

create or replace function pg_temp.act_as(p_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.titles(p_limit integer) returns text
language sql as $$
  select coalesce(string_agg(left(d ->> 'title', 1), '' order by ord), '')
  from jsonb_array_elements(public.my_deadlines(p_limit)) with ordinality as t(d, ord)
$$;

-- Student one: open items only, soonest first (A overdue, B in progress, F, K).
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
do $$
declare
  v jsonb;
begin
  if pg_temp.titles(5) <> 'ABFK' then
    raise exception 'my_deadlines order/filter wrong: got %', pg_temp.titles(5);
  end if;
  if pg_temp.titles(2) <> 'AB' then
    raise exception 'my_deadlines limit not applied: got %', pg_temp.titles(2);
  end if;
  if pg_temp.titles(null) <> 'ABFK' then
    raise exception 'my_deadlines default limit wrong: got %', pg_temp.titles(null);
  end if;

  v := public.my_deadlines(5);
  if (v -> 0 ->> 'overdue')::boolean is not true or v -> 0 ->> 'kind' <> 'assignment'
     or v -> 0 ->> 'status' <> 'not_started' or v -> 0 ->> 'action' <> 'start'
     or v -> 0 ->> 'course' <> 'Grade 7A' then
    raise exception 'overdue assignment row wrong: %', v -> 0;
  end if;
  if (v -> 1 ->> 'overdue')::boolean is not false or v -> 1 ->> 'kind' <> 'quiz'
     or v -> 1 ->> 'status' <> 'in_progress' or v -> 1 ->> 'action' <> 'continue' then
    raise exception 'in-progress quiz row wrong: %', v -> 1;
  end if;
  raise notice 'ok: student one sees A, B, F, K in due order';
end $$;

-- Student two: only their own class (I), never class one's work.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
do $$
begin
  if pg_temp.titles(5) <> 'I' then
    raise exception 'student two should only see I: got %', pg_temp.titles(5);
  end if;
  raise notice 'ok: student two sees only their own class';
end $$;

-- A signed-out caller sees nothing and cannot run the function.
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
do $$
begin
  begin
    perform public.my_deadlines(5);
    raise exception 'anon was able to call my_deadlines';
  exception when insufficient_privilege then
    raise notice 'ok: anon cannot call my_deadlines';
  end;
end $$;

rollback;
