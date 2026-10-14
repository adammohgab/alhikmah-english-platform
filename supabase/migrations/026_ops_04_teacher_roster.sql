create or replace function public.add_students_to_class(class_id uuid, student_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.user_role;
  v_added integer := 0;
  v_requested integer;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_user_id and p.status = 'active';

  if v_role not in ('admin', 'super_admin')
     and not exists (
       select 1 from public.class_teachers ct
       where ct.class_id = add_students_to_class.class_id
         and ct.teacher_id = v_user_id
         and ct.is_primary is true
     ) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  if student_ids is null then
    raise exception using errcode = '22023', message = 'student_ids_required';
  end if;

  v_requested := cardinality(student_ids);

  if exists (
    select 1
    from unnest(student_ids) requested(id)
    left join public.profiles p
      on p.id = requested.id
     and p.role = 'student'
     and p.status = 'active'
    where p.id is null
  ) then
    raise exception using errcode = 'P0001', message = 'invalid_student';
  end if;

  insert into public.class_enrollments(class_id, student_id, status)
  select add_students_to_class.class_id, requested.id, 'active'
  from (select distinct unnest(student_ids) as id) requested
  on conflict (class_id, student_id) do nothing;

  get diagnostics v_added = row_count;

  insert into public.audit_log(user_id, actor_id, action, target_table, target_id, new_values)
  values (
    v_user_id,
    v_user_id,
    'class_students_added',
    'classes',
    add_students_to_class.class_id,
    jsonb_build_object('student_ids', student_ids, 'added', v_added)
  );

  return jsonb_build_object(
    'added', v_added,
    'skipped', greatest(v_requested - v_added, 0)
  );
end;
$$;

create or replace function public.remove_student_from_class(
  class_id uuid,
  student_id uuid,
  reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.user_role;
  v_old_status text;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_user_id and p.status = 'active';

  if v_role not in ('admin', 'super_admin')
     and not exists (
       select 1 from public.class_teachers ct
       where ct.class_id = remove_student_from_class.class_id
         and ct.teacher_id = v_user_id
         and ct.is_primary is true
     ) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  select ce.status into v_old_status
  from public.class_enrollments ce
  where ce.class_id = remove_student_from_class.class_id
    and ce.student_id = remove_student_from_class.student_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'enrollment_not_found';
  end if;

  update public.class_enrollments
     set status = 'archived'
   where class_enrollments.class_id = remove_student_from_class.class_id
     and class_enrollments.student_id = remove_student_from_class.student_id;

  insert into public.audit_log(user_id, actor_id, action, target_table, target_id, old_values, new_values, reason)
  values (
    v_user_id,
    v_user_id,
    'student_removed_from_class',
    'class_enrollments',
    remove_student_from_class.student_id,
    jsonb_build_object('class_id', remove_student_from_class.class_id, 'status', v_old_status),
    jsonb_build_object('class_id', remove_student_from_class.class_id, 'status', 'archived'),
    reason
  );

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.transfer_class_ownership(class_id uuid, new_teacher_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.user_role;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_user_id and p.status = 'active';

  if v_role not in ('admin', 'super_admin')
     and not exists (
       select 1 from public.class_teachers ct
       where ct.class_id = transfer_class_ownership.class_id
         and ct.teacher_id = v_user_id
         and ct.is_primary is true
     ) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = new_teacher_id
      and p.role = 'teacher'
      and p.status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'invalid_teacher';
  end if;

  perform 1
  from public.classes c
  where c.id = transfer_class_ownership.class_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'class_not_found';
  end if;

  insert into public.class_teachers(class_id, teacher_id, is_primary)
  values (transfer_class_ownership.class_id, new_teacher_id, true)
  on conflict (class_id, teacher_id) do update set is_primary = true;

  update public.class_teachers
     set is_primary = false
   where class_teachers.class_id = transfer_class_ownership.class_id
     and class_teachers.teacher_id <> new_teacher_id;

  insert into public.audit_log(user_id, actor_id, action, target_table, target_id, new_values)
  values (
    v_user_id,
    v_user_id,
    'class_ownership_transferred',
    'classes',
    transfer_class_ownership.class_id,
    jsonb_build_object('new_teacher_id', new_teacher_id)
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.add_students_to_class(uuid, uuid[]) from public;
revoke all on function public.remove_student_from_class(uuid, uuid, text) from public;
revoke all on function public.transfer_class_ownership(uuid, uuid) from public;

grant execute on function public.add_students_to_class(uuid, uuid[]) to authenticated;
grant execute on function public.remove_student_from_class(uuid, uuid, text) to authenticated;
grant execute on function public.transfer_class_ownership(uuid, uuid) to authenticated;
