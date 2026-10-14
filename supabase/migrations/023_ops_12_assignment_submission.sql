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
