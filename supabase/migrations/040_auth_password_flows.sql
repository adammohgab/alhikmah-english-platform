-- 040: password flows for SH-03 (forgot password) and SH-04 (set a new password)
--
-- 1. password_reset_requests (backend/docs/02-DATA-MODEL-CORE.md section 2): the rows a person
--    creates from /forgot-password. Nobody writes to the table directly. Reads follow
--    04-AUTH-AND-ACCESS section 5: admins see them, teachers see requests of their own students.
-- 2. request_password_reset(...): the public entry point for that table. Always returns the same
--    body, so nobody can learn which usernames exist. It limits one device to 3 requests per hour.
-- 3. complete_password_change(): clears must_change_password for the caller, only after the
--    password was changed. The client cannot write the profile row (no update policy by design).

-- ------------------------------------------------------------
-- 1. Table
-- ------------------------------------------------------------
create table if not exists public.password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  full_name text not null,
  grade_class text,
  note text check (note is null or char_length(note) <= 200),
  status text not null default 'new' check (status in ('new', 'handled', 'dismissed')),
  profile_id uuid references public.profiles (id) on delete set null,
  handled_by uuid references public.profiles (id) on delete set null,
  handled_at timestamptz,
  device_hash text,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_password_reset_requests_status_created
  on public.password_reset_requests (status, created_at);
create index if not exists idx_password_reset_requests_device_created
  on public.password_reset_requests (device_hash, created_at)
  where device_hash is not null;
create index if not exists idx_password_reset_requests_ip_created
  on public.password_reset_requests (ip_hash, created_at)
  where ip_hash is not null;

alter table public.password_reset_requests enable row level security;

-- No insert, update or delete policy: rows are created by request_password_reset() and handled
-- by the reset-password function with the service role.
create policy password_gate on public.password_reset_requests as restrictive
  for all to authenticated using (not public.must_change());

create policy password_reset_requests_select_admin on public.password_reset_requests
  for select to authenticated using (
    public.is_super_admin()
    or (
      public.is_school_admin()
      and (
        profile_id is null
        or exists (
          select 1 from public.profiles p
          where p.id = password_reset_requests.profile_id and p.role in ('student', 'teacher')
        )
      )
    )
  );

create policy password_reset_requests_select_teacher on public.password_reset_requests
  for select to authenticated using (
    profile_id is not null and public.teaches_student(profile_id)
  );

-- ------------------------------------------------------------
-- 2. request_password_reset
-- ------------------------------------------------------------
-- p_device_key is a random id the browser keeps. It is hashed here and never stored as sent.
-- The caller address comes from the request headers that PostgREST exposes, hashed the same way.
create or replace function public.request_password_reset(
  p_username text,
  p_full_name text,
  p_grade_class text default null,
  p_note text default null,
  p_device_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := lower(btrim(coalesce(p_username, '')));
  v_full_name text := btrim(coalesce(p_full_name, ''));
  v_grade_class text := nullif(btrim(coalesce(p_grade_class, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_headers jsonb;
  v_ip text;
  v_device_hash text;
  v_ip_hash text;
  v_profile_id uuid;
  v_recent integer;
begin
  if v_username !~ '^[a-z0-9._-]{3,32}$'
     or char_length(v_full_name) not between 2 and 80
     or (v_grade_class is not null and char_length(v_grade_class) > 32)
     or (v_note is not null and char_length(v_note) > 200) then
    raise exception using errcode = 'P0001', message = 'validation_failed';
  end if;

  begin
    v_headers := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  exception when others then
    v_headers := '{}'::jsonb;
  end;
  v_ip := nullif(btrim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), '');

  if nullif(btrim(coalesce(p_device_key, '')), '') is not null then
    v_device_hash := encode(extensions.digest('device:' || btrim(p_device_key), 'sha256'), 'hex');
  end if;
  if v_ip is not null then
    v_ip_hash := encode(extensions.digest('ip:' || v_ip, 'sha256'), 'hex');
  end if;

  -- Limits (04-AUTH-AND-ACCESS section 3): 3 per hour per device, 20 per hour per address.
  if v_device_hash is not null then
    select count(*) into v_recent
    from public.password_reset_requests r
    where r.device_hash = v_device_hash and r.created_at > now() - interval '1 hour';
    if v_recent >= 3 then
      raise exception using errcode = 'P0001', message = 'rate_limited';
    end if;
  end if;
  if v_ip_hash is not null then
    select count(*) into v_recent
    from public.password_reset_requests r
    where r.ip_hash = v_ip_hash and r.created_at > now() - interval '1 hour';
    if v_recent >= 20 then
      raise exception using errcode = 'P0001', message = 'rate_limited';
    end if;
  end if;

  -- Linked only when the username exists. The caller never learns whether it did.
  select p.id into v_profile_id
  from public.profiles p
  where p.username = v_username::extensions.citext;

  insert into public.password_reset_requests
    (username, full_name, grade_class, note, profile_id, device_hash, ip_hash)
  values
    (v_username, v_full_name, v_grade_class, v_note, v_profile_id, v_device_hash, v_ip_hash);

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.request_password_reset(text, text, text, text, text) from public;
grant execute on function public.request_password_reset(text, text, text, text, text)
  to anon, authenticated;

-- ------------------------------------------------------------
-- 3. complete_password_change
-- ------------------------------------------------------------
-- The page changes the password with Supabase Auth first, then calls this. A password change
-- updates the account row after the last sign-in, so a flag that is cleared without any change
-- since sign-in is refused. The caller can only ever clear their own flag.
create or replace function public.complete_password_change()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_changed boolean;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;

  select u.updated_at > coalesce(u.last_sign_in_at, '-infinity'::timestamptz)
    into v_changed
  from auth.users u
  where u.id = v_user_id;

  if not coalesce(v_changed, false) then
    raise exception using errcode = 'P0001', message = 'password_not_changed';
  end if;

  update public.profiles
     set must_change_password = false
   where id = v_user_id
     and status = 'active';

  if not found then
    raise exception using errcode = 'P0001', message = 'account_inactive';
  end if;
end;
$$;

revoke all on function public.complete_password_change() from public;
grant execute on function public.complete_password_change() to authenticated;
