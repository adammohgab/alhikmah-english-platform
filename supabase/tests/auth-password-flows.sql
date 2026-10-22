-- Checks for 040_auth_password_flows.sql (SH-03 reset requests, SH-04 password change).
-- Run after apply-migrations.sh:  psql -v ON_ERROR_STOP=1 -d alhikmah_migration_check -f supabase/tests/auth-password-flows.sql
-- Each check raises an exception on failure. The script rolls back, so it leaves no data.
begin;

insert into auth.users (id, updated_at, last_sign_in_at) values
  ('00000000-0000-0000-0000-0000000000a1', now() - interval '10 minutes', now() - interval '10 minutes'),
  ('00000000-0000-0000-0000-0000000000a2', now(), now()),
  ('00000000-0000-0000-0000-0000000000b1', now(), now()),
  ('00000000-0000-0000-0000-0000000000c1', now(), now());
insert into profiles (id, username, display_name, role, status, must_change_password) values
  ('00000000-0000-0000-0000-0000000000a1', 'stu.one', 'Student One', 'student', 'active', true),
  ('00000000-0000-0000-0000-0000000000a2', 'stu.two', 'Student Two', 'student', 'active', false),
  ('00000000-0000-0000-0000-0000000000b1', 'teach.one', 'Teacher One', 'teacher', 'active', false),
  ('00000000-0000-0000-0000-0000000000c1', 'admin.one', 'Admin One', 'admin', 'active', false);
insert into school_years (id, name, start_date, end_date)
  values ('00000000-0000-0000-0000-00000000d001', 'Y', '2026-09-01', '2027-06-30');
insert into terms (id, year_id, name, start_date, end_date)
  values ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-00000000d001', 'T', '2026-09-01', '2027-01-30');
insert into classes (id, term_id, name, join_code, grade_level)
  values ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000d002', 'C', 'JOIN01', '7');
insert into class_teachers (class_id, teacher_id)
  values ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000b1');
insert into class_enrollments (class_id, student_id)
  values ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000a1');

create or replace function pg_temp.act_as(p_uid uuid, p_extra jsonb default '{}'::jsonb) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    (jsonb_build_object('sub', p_uid, 'role', 'authenticated') || p_extra)::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.act_as_anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.headers', '{"x-forwarded-for":"203.0.113.9, 10.0.0.1"}', true);
  execute 'set local role anon';
end $$;

create or replace function pg_temp.expect(p_label text, p_actual bigint, p_expected bigint) returns void
language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAIL % (got %, expected %)', p_label, p_actual, p_expected;
  end if;
  raise notice 'ok   %', p_label;
end $$;

create or replace function pg_temp.expect_error(p_label text, p_sql text, p_message text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm like '%' || p_message || '%' then
      raise notice 'ok   %', p_label;
      return;
    end if;
    raise exception 'FAIL % (wrong error: %)', p_label, sqlerrm;
  end;
  raise exception 'FAIL % (no error)', p_label;
end $$;

grant execute on function
  pg_temp.act_as(uuid, jsonb), pg_temp.act_as_anon(),
  pg_temp.expect(text, bigint, bigint), pg_temp.expect_error(text, text, text)
  to public;

-- ---- request_password_reset (anonymous) ----
select pg_temp.act_as_anon();
select pg_temp.expect('known username answers ok',
  (select count(*) from (select public.request_password_reset('Stu.One ', 'Student One', '7A', 'locked out', 'dev-1')) r
    where r.request_password_reset = '{"ok": true}'::jsonb), 1);
select pg_temp.expect('unknown username answers the same',
  (select count(*) from (select public.request_password_reset('nobody.here', 'Nobody Here', null, null, 'dev-2')) r
    where r.request_password_reset = '{"ok": true}'::jsonb), 1);
select pg_temp.expect_error('bad username is rejected',
  $$select public.request_password_reset('x', 'Some Name', null, null, 'dev-3')$$, 'validation_failed');
select pg_temp.expect_error('short name is rejected',
  $$select public.request_password_reset('stu.one', 'A', null, null, 'dev-3')$$, 'validation_failed');
select pg_temp.expect_error('long note is rejected',
  $$select public.request_password_reset('stu.one', 'Student One', null, repeat('x', 201), 'dev-3')$$, 'validation_failed');
select pg_temp.expect('anonymous reads no rows', (select count(*) from public.password_reset_requests), 0);
select pg_temp.expect_error('anonymous cannot insert directly',
  $$insert into public.password_reset_requests (username, full_name) values ('a.b', 'A B')$$, 'row-level security');

-- 3 per hour per device: dev-1 has one request, add two, the fourth is refused.
select public.request_password_reset('stu.one', 'Student One', null, null, 'dev-1');
select public.request_password_reset('stu.one', 'Student One', null, null, 'dev-1');
select pg_temp.expect_error('fourth request from one device is limited',
  $$select public.request_password_reset('stu.one', 'Student One', null, null, 'dev-1')$$, 'rate_limited');

reset role;
select pg_temp.expect('rows stored', (select count(*) from public.password_reset_requests), 4);
select pg_temp.expect('known username is linked',
  (select count(*) from public.password_reset_requests
    where username = 'stu.one' and profile_id = '00000000-0000-0000-0000-0000000000a1'), 3);
select pg_temp.expect('unknown username is not linked',
  (select count(*) from public.password_reset_requests where username = 'nobody.here' and profile_id is null), 1);
select pg_temp.expect('device key is stored hashed only',
  (select count(*) from public.password_reset_requests where device_hash like 'dev-%'), 0);
select pg_temp.expect('address is stored hashed only',
  (select count(*) from public.password_reset_requests where ip_hash is not null and ip_hash not like '203.%'), 4);

select pg_temp.expect('admin is notified of every request',
  (select count(*) from notifications
    where kind = 'password_reset_request' and user_id = '00000000-0000-0000-0000-0000000000c1'), 4);
select pg_temp.expect('teacher is notified of requests for own students only',
  (select count(*) from notifications
    where kind = 'password_reset_request' and user_id = '00000000-0000-0000-0000-0000000000b1'), 3);
select pg_temp.expect('other student is not notified',
  (select count(*) from notifications
    where kind = 'password_reset_request' and user_id = '00000000-0000-0000-0000-0000000000a2'), 0);

-- 20 per hour per address
insert into public.password_reset_requests (username, full_name, ip_hash)
  select 'bulk.user', 'Bulk User',
         encode(extensions.digest('ip:203.0.113.9', 'sha256'), 'hex')
  from generate_series(1, 20);
select pg_temp.act_as_anon();
select pg_temp.expect_error('address limit applies',
  $$select public.request_password_reset('stu.one', 'Student One', null, null, 'dev-9')$$, 'rate_limited');
reset role;
delete from public.password_reset_requests where username = 'bulk.user';

-- ---- who can read the requests ----
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
select pg_temp.expect('other student sees none', (select count(*) from public.password_reset_requests), 0);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select pg_temp.expect('teacher sees requests of own students only',
  (select count(*) from public.password_reset_requests), 3);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select pg_temp.expect('admin sees all', (select count(*) from public.password_reset_requests), 4);
select pg_temp.expect_error('signed-in user cannot insert directly',
  $$insert into public.password_reset_requests (username, full_name) values ('a.b', 'A B')$$, 'row-level security');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1', '{"must_change_password": true}');
select pg_temp.expect('password gate hides requests while a change is due',
  (select count(*) from public.password_reset_requests), 0);
reset role;

-- ---- complete_password_change ----
select pg_temp.act_as_anon();
select pg_temp.expect_error('anonymous cannot call it',
  $$select public.complete_password_change()$$, 'permission denied');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select pg_temp.expect_error('refused when nothing changed since sign-in',
  $$select public.complete_password_change()$$, 'password_not_changed');
reset role;
select pg_temp.expect('flag still set after the refusal',
  (select count(*) from profiles where id = '00000000-0000-0000-0000-0000000000a1' and must_change_password), 1);

update auth.users set updated_at = now() where id = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select public.complete_password_change();
reset role;
select pg_temp.expect('flag cleared after a change',
  (select count(*) from profiles where id = '00000000-0000-0000-0000-0000000000a1' and not must_change_password), 1);

-- It only ever touches the caller's own row.
update profiles set must_change_password = true where id = '00000000-0000-0000-0000-0000000000a2';
update auth.users set updated_at = now() + interval '1 minute' where id = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select public.complete_password_change();
reset role;
select pg_temp.expect('another account keeps its flag',
  (select count(*) from profiles where id = '00000000-0000-0000-0000-0000000000a2' and must_change_password), 1);

-- ---- complete_password_change with a temporary password on record ----
-- (reset_password, below, sets the gate row. Here the gate is set by hand to test the check.)
reset role;
insert into auth.users (id, encrypted_password, updated_at, last_sign_in_at)
  values ('00000000-0000-0000-0000-0000000000f1', 'temp-hash', now(), now() - interval '5 minutes');
insert into profiles (id, username, display_name, role, status, must_change_password)
  values ('00000000-0000-0000-0000-0000000000f1', 'gated.one', 'Gated One', 'student', 'active', true);
insert into public.password_change_gates (profile_id, temp_hash)
  values ('00000000-0000-0000-0000-0000000000f1', 'temp-hash');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
select pg_temp.expect_error('gate: same hash is refused even though the row was updated later',
  $$select public.complete_password_change()$$, 'password_not_changed');
reset role;
update auth.users set encrypted_password = 'new-hash' where id = '00000000-0000-0000-0000-0000000000f1';
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
select public.complete_password_change();
reset role;
select pg_temp.expect('gate: a different hash clears the flag',
  (select count(*) from profiles where id = '00000000-0000-0000-0000-0000000000f1' and not must_change_password), 1);
select pg_temp.expect('gate: the row is removed',
  (select count(*) from public.password_change_gates where profile_id = '00000000-0000-0000-0000-0000000000f1'), 0);

-- ---- reset_password ----
insert into auth.users (id, updated_at, last_sign_in_at) values
  ('00000000-0000-0000-0000-0000000000c2', now(), now()),
  ('00000000-0000-0000-0000-0000000000d1', now(), now()),
  ('00000000-0000-0000-0000-0000000000e1', now(), now());
insert into profiles (id, username, display_name, role, status) values
  ('00000000-0000-0000-0000-0000000000c2', 'admin.two', 'Admin Two', 'admin', 'active'),
  ('00000000-0000-0000-0000-0000000000d1', 'super.one', 'Super One', 'super_admin', 'active'),
  ('00000000-0000-0000-0000-0000000000e1', 'stu.locked', 'Locked Student', 'student', 'locked');
insert into auth.sessions (user_id) values
  ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000a1');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
select pg_temp.expect_error('a student cannot reset a password',
  $$select public.reset_password('00000000-0000-0000-0000-0000000000a1')$$, 'forbidden');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select pg_temp.expect_error('a teacher cannot reset a student they do not teach',
  $$select public.reset_password('00000000-0000-0000-0000-0000000000a2')$$, 'forbidden');
select pg_temp.expect_error('a teacher cannot reset an admin',
  $$select public.reset_password('00000000-0000-0000-0000-0000000000c1')$$, 'forbidden');
select pg_temp.expect_error('nobody resets their own password this way',
  $$select public.reset_password('00000000-0000-0000-0000-0000000000b1')$$, 'forbidden');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_error('a school admin cannot reset another admin',
  $$select public.reset_password('00000000-0000-0000-0000-0000000000c2')$$, 'forbidden');
select pg_temp.expect_error('a school admin cannot reset a super admin',
  $$select public.reset_password('00000000-0000-0000-0000-0000000000d1')$$, 'forbidden');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select pg_temp.expect_error('an unknown profile is not found',
  $$select public.reset_password('00000000-0000-0000-0000-00000000ffff')$$, 'not_found');
reset role;

-- A teacher resets a student they teach, from a request.
create temp table t_reset (result jsonb, request_id uuid);
grant all on t_reset to public;
insert into t_reset (request_id)
  select id from public.password_reset_requests
  where profile_id = '00000000-0000-0000-0000-0000000000a1' order by created_at limit 1;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
update t_reset set result = public.reset_password(
  '00000000-0000-0000-0000-0000000000a1', (select request_id from t_reset));
reset role;
select pg_temp.expect('temporary password has 10 characters',
  (select length(result ->> 'temporary_password') from t_reset), 10);
select pg_temp.expect('temporary password has a number and a symbol and no look-alikes',
  (select count(*) from t_reset
    where result ->> 'temporary_password' ~ '[0-9]'
      and result ->> 'temporary_password' ~ '[!@#$%?]'
      and result ->> 'temporary_password' !~ '[0OIl1]'), 1);
select pg_temp.expect('stored password matches the temporary password',
  (select count(*) from auth.users u, t_reset t
    where u.id = '00000000-0000-0000-0000-0000000000a1'
      and u.encrypted_password = extensions.crypt(t.result ->> 'temporary_password', u.encrypted_password)), 1);
select pg_temp.expect('flag is set', (select count(*) from profiles
  where id = '00000000-0000-0000-0000-0000000000a1' and must_change_password), 1);
select pg_temp.expect('all sessions are gone',
  (select count(*) from auth.sessions where user_id = '00000000-0000-0000-0000-0000000000a1'), 0);
select pg_temp.expect('request is marked handled by the teacher',
  (select count(*) from public.password_reset_requests r, t_reset t
    where r.id = t.request_id and r.status = 'handled'
      and r.handled_by = '00000000-0000-0000-0000-0000000000b1' and r.handled_at is not null), 1);
select pg_temp.expect('audit row is written with the actor',
  (select count(*) from audit_log
    where action = 'password_reset' and action_type = 'password_resets'
      and actor_id = '00000000-0000-0000-0000-0000000000b1'
      and user_id = '00000000-0000-0000-0000-0000000000a1'), 1);
select pg_temp.expect('only a hash is kept',
  (select count(*) from public.password_change_gates g, t_reset t
    where g.profile_id = '00000000-0000-0000-0000-0000000000a1'
      and g.temp_hash <> t.result ->> 'temporary_password'), 1);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_error('a second handler gets conflict',
  format($$select public.reset_password('00000000-0000-0000-0000-0000000000a1', %L)$$,
    (select request_id from t_reset)), 'conflict');

-- The person cannot keep the temporary password: the flag stays until the hash changes.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select pg_temp.expect_error('flag stays while the temporary password is unchanged',
  $$select public.complete_password_change()$$, 'password_not_changed');
reset role;
update auth.users set encrypted_password = 'chosen-by-the-student' where id = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select public.complete_password_change();
reset role;
select pg_temp.expect('flag clears once the student chose a password',
  (select count(*) from profiles
    where id = '00000000-0000-0000-0000-0000000000a1' and not must_change_password), 1);

-- A school admin resets a locked student and the lock is cleared.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select public.reset_password('00000000-0000-0000-0000-0000000000e1');
reset role;
select pg_temp.expect('lock is cleared by a reset',
  (select count(*) from profiles
    where id = '00000000-0000-0000-0000-0000000000e1' and status = 'active' and must_change_password), 1);

-- A super admin resets an admin.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select public.reset_password('00000000-0000-0000-0000-0000000000c2');
reset role;
select pg_temp.expect('a super admin can reset an admin',
  (select count(*) from profiles
    where id = '00000000-0000-0000-0000-0000000000c2' and must_change_password), 1);

-- An archived account is not reset.
update profiles set status = 'archived' where id = '00000000-0000-0000-0000-0000000000e1';
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_error('an archived account is refused',
  $$select public.reset_password('00000000-0000-0000-0000-0000000000e1')$$, 'account_inactive');
reset role;

-- Anonymous callers cannot reach it, and the helper is closed to every client role.
select pg_temp.act_as_anon();
select pg_temp.expect_error('anonymous cannot call reset_password',
  $$select public.reset_password('00000000-0000-0000-0000-0000000000a1')$$, 'permission denied');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_error('the generator is not callable by clients',
  $$select public.make_temporary_password()$$, 'permission denied');
reset role;

rollback;
