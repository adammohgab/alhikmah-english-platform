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
