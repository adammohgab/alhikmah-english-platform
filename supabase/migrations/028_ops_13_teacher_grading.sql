create table if not exists public.grade_history (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null
    references public.assessment_attempts(id) on delete cascade,
  changed_by uuid references public.profiles(id),
  old_score numeric(5,2),
  new_score numeric(5,2) not null,
  rubric_scores jsonb not null default '{}'::jsonb,
  feedback text,
  created_at timestamptz not null default public.app_now()
);

alter table public.assessment_attempts
  add column if not exists grading_locked_by uuid references public.profiles(id),
  add column if not exists grading_locked_at timestamptz,
  add column if not exists grades_released_at timestamptz;

create index if not exists idx_assessment_attempts_grading_queue
  on public.assessment_attempts(class_id, status, submitted_at);

create or replace function public.lock_submission_for_grading(attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teacher uuid := auth.uid();
  v_attempt public.assessment_attempts%rowtype;
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

  if not exists (
    select 1 from public.class_teachers ct
    where ct.class_id = v_attempt.class_id
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

  if not exists (
    select 1 from public.class_teachers ct
    where ct.class_id = v_attempt.class_id
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
        attempt_id, question_id, answer, points_awarded, is_correct
      )
      values (
        v_attempt.id,
        v_question.id,
        coalesce((
          select aa.answer from public.attempt_answers aa
          where aa.attempt_id = v_attempt.id and aa.question_id = v_question.id
        ), 'null'::jsonb),
        v_score,
        (v_score = v_question.max_points)
      )
      on conflict (attempt_id, question_id)
      do update set
        points_awarded = excluded.points_awarded,
        is_correct = excluded.is_correct;
    end if;
  end loop;

  update public.assessment_attempts
     set score = final_score,
         status = 'graded',
         grading_locked_by = null,
         grading_locked_at = null
   where id = v_attempt.id;

  insert into public.grade_history(
    attempt_id, changed_by, old_score, new_score, rubric_scores, feedback
  )
  values (
    v_attempt.id, v_teacher, v_old_score, final_score, rubric_scores, feedback
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
