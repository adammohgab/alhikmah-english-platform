-- 041: reset_password(): an admin or a teacher issues a temporary password (SH-03 follow-up).
-- Follows backend/docs/04-AUTH-AND-ACCESS.md section 3 ("reset-password"), written as a database
-- function because it only needs the auth.users row and the tables of this schema.
--
--   Who may reset: a School admin resets students and teachers, only a Super admin resets admins,
--   and a teacher resets students with an active enrollment in one of their classes.
--   What it does: makes a temporary password (10 characters from an alphabet without look-alike
--   characters, with letters, numbers and symbols), stores it as the account password, sets
--   must_change_password, clears a lock, signs the account out everywhere, marks the request
--   handled (the first handler wins, a second gets `conflict`), writes an audit row, and returns
--   the temporary password once. Only its hash is kept, in password_change_gates, so
--   complete_password_change() can tell that the person chose a new password.

create or replace function public.make_temporary_password()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  c_letters constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  c_digits constant text := '23456789';
  c_symbols constant text := '!@#$%?';
  v_chars text[] := '{}';
  v_pick integer;
  v_byte integer;
  v_set text;
  v_count integer;
  v_limit integer;
begin
  -- 6 letters, 2 numbers, 2 symbols, then shuffled. Each pick rejects bytes that would bias it.
  for v_count in 1..10 loop
    v_set := case when v_count <= 6 then c_letters when v_count <= 8 then c_digits else c_symbols end;
    v_limit := (256 / length(v_set)) * length(v_set);
    loop
      v_byte := get_byte(extensions.gen_random_bytes(1), 0);
      exit when v_byte < v_limit;
    end loop;
    v_pick := (v_byte % length(v_set)) + 1;
    v_chars := v_chars || substr(v_set, v_pick, 1);
  end loop;

  -- Fisher-Yates with unbiased random indexes.
  for v_count in reverse 10..2 loop
    v_limit := (256 / v_count) * v_count;
    loop
      v_byte := get_byte(extensions.gen_random_bytes(1), 0);
      exit when v_byte < v_limit;
    end loop;
    v_pick := (v_byte % v_count) + 1;
    v_set := v_chars[v_count];
    v_chars[v_count] := v_chars[v_pick];
    v_chars[v_pick] := v_set;
  end loop;

  return array_to_string(v_chars, '');
end;
$$;

revoke all on function public.make_temporary_password() from public, anon, authenticated;

create or replace function public.reset_password(
  p_profile_id uuid,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_caller public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_request public.password_reset_requests%rowtype;
  v_allowed boolean;
  v_temp text;
  v_hash text;
begin
  if v_caller_id is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;

  select * into v_caller from public.profiles where id = v_caller_id and status = 'active';
  if not found then
    raise exception using errcode = 'P0001', message = 'account_inactive';
  end if;

  select * into v_target from public.profiles where id = p_profile_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;

  v_allowed := case
    when v_caller.role = 'super_admin' then true
    when v_caller.role = 'admin' then v_target.role in ('student', 'teacher')
    when v_caller.role = 'teacher' then v_target.role = 'student' and public.teaches_student(v_target.id)
    else false
  end;
  if not v_allowed or v_target.id = v_caller_id then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;

  if v_target.status = 'archived' then
    raise exception using errcode = 'P0001', message = 'account_inactive';
  end if;

  if p_request_id is not null then
    select * into v_request
    from public.password_reset_requests
    where id = p_request_id
    for update;
    if not found or v_request.profile_id is distinct from v_target.id then
      raise exception using errcode = 'P0001', message = 'not_found';
    end if;
    if v_request.status <> 'new' then
      raise exception using errcode = 'P0001', message = 'conflict';
    end if;
  end if;

  v_temp := public.make_temporary_password();
  v_hash := extensions.crypt(v_temp, extensions.gen_salt('bf'));

  update auth.users
     set encrypted_password = v_hash, updated_at = now()
   where id = v_target.id;

  insert into public.password_change_gates (profile_id, temp_hash)
  values (v_target.id, v_hash)
  on conflict (profile_id) do update set temp_hash = excluded.temp_hash, created_at = now();

  update public.profiles
     set must_change_password = true,
         status = case when status = 'locked' then 'active'::public.user_status else status end
   where id = v_target.id;

  -- Signed out everywhere (removes the refresh tokens with them).
  delete from auth.sessions where user_id = v_target.id;

  update public.password_reset_requests
     set status = 'handled', handled_by = v_caller_id, handled_at = now()
   where status = 'new'
     and (id = p_request_id or (p_request_id is null and profile_id = v_target.id));

  insert into public.audit_log
    (user_id, actor_id, actor_role, action, action_type, target_table, target_type, target_id, summary)
  values
    (v_target.id, v_caller_id, v_caller.role, 'password_reset', 'password_resets',
     'profiles', 'profile', v_target.id, 'Temporary password issued');

  return jsonb_build_object('profile_id', v_target.id, 'temporary_password', v_temp);
end;
$$;

revoke all on function public.reset_password(uuid, uuid) from public, anon;
grant execute on function public.reset_password(uuid, uuid) to authenticated;
