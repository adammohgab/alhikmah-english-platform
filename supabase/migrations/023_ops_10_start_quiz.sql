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
