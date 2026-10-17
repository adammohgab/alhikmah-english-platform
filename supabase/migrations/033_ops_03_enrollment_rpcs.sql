create or replace function public.join_class_by_code(code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_class_id uuid;
  v_role public.user_role;
  v_inserted integer;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_user_id and p.status = 'active';

  if v_role is distinct from 'student' then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  select c.id into v_class_id
  from public.classes c
  where upper(c.join_code) = upper(trim(code))
    and c.is_archived is not true
  for update;

  if v_class_id is null then
    raise exception using errcode = 'P0001', message = 'invalid_or_expired_code';
  end if;

  insert into public.class_enrollments(class_id, student_id, status)
  values (v_class_id, v_user_id, 'active')
  on conflict (class_id, student_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    insert into public.notifications(user_id, kind, title, body, payload)
    values (
      v_user_id,
      'class_enrollment',
      'Joined class',
      'You joined a class.',
      jsonb_build_object('class_id', v_class_id)
    );
  end if;

  return jsonb_build_object('ok', true, 'class_id', v_class_id);
end;
$$;

create or replace function public.respond_class_invite(class_id uuid, accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated integer;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;

  if accept then
    update public.class_enrollments
       set status = 'active'
     where class_enrollments.class_id = respond_class_invite.class_id
       and student_id = v_user_id
       and status = 'invited';
    get diagnostics v_updated = row_count;
  else
    delete from public.class_enrollments
     where class_enrollments.class_id = respond_class_invite.class_id
       and student_id = v_user_id
       and status = 'invited';
    get diagnostics v_updated = row_count;
  end if;

  if v_updated = 0 then
    raise exception using errcode = 'P0001', message = 'invite_not_found';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.rotate_join_code(class_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.user_role;
  v_code text;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_user_id and p.status = 'active';

  perform 1
  from public.classes c
  where c.id = rotate_join_code.class_id
    and c.is_archived is not true
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'class_not_found';
  end if;

  if v_role not in ('admin', 'super_admin')
     and not exists (
       select 1 from public.class_teachers ct
       where ct.class_id = rotate_join_code.class_id
         and ct.teacher_id = v_user_id
     ) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  loop
    v_code := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 6));
    begin
      update public.classes
         set join_code = v_code
       where id = rotate_join_code.class_id;
      exit;
    exception when unique_violation then
      -- Generate another code if the unique class join code is already taken.
      null;
    end;
  end loop;

  return v_code;
end;
$$;

revoke all on function public.join_class_by_code(text) from public;
revoke all on function public.respond_class_invite(uuid, boolean) from public;
revoke all on function public.rotate_join_code(uuid) from public;

grant execute on function public.join_class_by_code(text) to authenticated;
grant execute on function public.respond_class_invite(uuid, boolean) to authenticated;
grant execute on function public.rotate_join_code(uuid) to authenticated;
