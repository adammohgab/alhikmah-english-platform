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

revoke all on function
  public.uid(), public.app_role(), public.is_admin(), public.is_super_admin(),
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
  public.uid(), public.app_role(), public.is_admin(), public.is_super_admin(),
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
