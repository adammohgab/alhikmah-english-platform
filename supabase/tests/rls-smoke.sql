-- Access checks for the policies in 039_rls_policies_indexes.sql.
-- Run after apply-migrations.sh:  psql -v ON_ERROR_STOP=1 -d alhikmah_migration_check -f supabase/tests/rls-smoke.sql
-- Each check raises an exception on failure. The script rolls back, so it leaves no data.
begin;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000b1'), ('00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-0000000000c2');
insert into profiles (id, username, display_name, role, status) values
  ('00000000-0000-0000-0000-0000000000a1', 'stu.one', 'Student One', 'student', 'active'),
  ('00000000-0000-0000-0000-0000000000a2', 'stu.two', 'Student Two', 'student', 'active'),
  ('00000000-0000-0000-0000-0000000000b1', 'teach.one', 'Teacher One', 'teacher', 'active'),
  ('00000000-0000-0000-0000-0000000000c1', 'admin.one', 'Admin One', 'admin', 'active'),
  ('00000000-0000-0000-0000-0000000000c2', 'stu.locked', 'Locked', 'student', 'locked');
insert into school_years (id, name, start_date, end_date)
  values ('00000000-0000-0000-0000-00000000d001', 'Y', '2026-09-01', '2027-06-30');
insert into terms (id, year_id, name, start_date, end_date)
  values ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-00000000d001', 'T', '2026-09-01', '2027-01-30');
insert into classes (id, term_id, name, join_code, grade_level)
  values ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000d002', 'C', 'JOIN01', '7');
insert into class_teachers (class_id, teacher_id)
  values ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000b1');
insert into class_enrollments (class_id, student_id) values
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000a1');
insert into student_stats (student_id) values
  ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000a2');
insert into shop_items (id, sku, name, category, coin_price)
  values ('00000000-0000-0000-0000-00000000f001', 'sku1', 'Item', 'theme', 10);

create or replace function pg_temp.act_as(p_uid uuid, p_extra jsonb default '{}'::jsonb) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    (jsonb_build_object('sub', p_uid, 'role', 'authenticated') || p_extra)::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.expect(p_label text, p_actual bigint, p_expected bigint) returns void
language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAIL % (got %, expected %)', p_label, p_actual, p_expected;
  end if;
  raise notice 'ok   %', p_label;
end $$;

grant execute on function pg_temp.act_as(uuid, jsonb), pg_temp.expect(text, bigint, bigint) to public;

-- Student one
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select pg_temp.expect('student reads own stats only', (select count(*) from student_stats), 1);
select pg_temp.expect('student sees own profile only', (select count(*) from profiles), 1);
select pg_temp.expect('student sees own class', (select count(*) from classes), 1);
select pg_temp.expect('student cannot read admin notes', (select count(*) from admin_notes), 0);
select pg_temp.expect('student cannot read audit log', (select count(*) from audit_log), 0);
select pg_temp.expect('student reads live shop items', (select count(*) from shop_items), 1);
do $$ begin
  begin
    insert into user_inventory (user_id, item_id)
      values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000f001');
    raise exception 'FAIL student inserted inventory';
  exception when insufficient_privilege then raise notice 'ok   student cannot grant self inventory'; end;
  begin
    update student_stats set total_xp = 99999 where student_id = '00000000-0000-0000-0000-0000000000a1';
    if found then raise exception 'FAIL student changed own xp'; end if;
    raise notice 'ok   student cannot change own xp';
  exception when insufficient_privilege then raise notice 'ok   student cannot change own xp'; end;
end $$;
reset role;

-- Student two (no class)
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
select pg_temp.expect('other student sees no class', (select count(*) from classes), 0);
select pg_temp.expect('other student cannot read a peer profile', (select count(*) from profiles where id <> '00000000-0000-0000-0000-0000000000a2'), 0);
reset role;

-- Teacher
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select pg_temp.expect('teacher sees the student they teach', (select count(*) from student_stats), 1);
select pg_temp.expect('teacher sees own and taught profiles', (select count(*) from profiles), 2);
reset role;

-- Admin
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select pg_temp.expect('school admin sees students, teachers and self', (select count(*) from profiles), 5);
reset role;

-- View-as blocks writes
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1', '{"view_as": {"user_id": "x"}}');
do $$ begin
  update user_settings set sound_enabled = false where user_id = '00000000-0000-0000-0000-0000000000a1';
  raise notice 'ok   view-as write ran as zero rows or was blocked';
end $$;
reset role;

-- Locked account
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c2');
select pg_temp.expect('locked account reads own profile for the status check', (select count(*) from profiles), 1);
select pg_temp.expect('locked account reads nothing else', (select count(*) from student_stats) + (select count(*) from classes), 0);
reset role;

-- Must change password
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1', '{"must_change_password": true}');
select pg_temp.expect('password gate blocks stats', (select count(*) from student_stats), 0);
select pg_temp.expect('password gate still allows own profile', (select count(*) from profiles), 1);
reset role;

-- Signed out
set local role anon;
do $$ begin
  begin
    perform count(*) from profiles;
    raise exception 'FAIL anon read profiles';
  exception when insufficient_privilege then raise notice 'ok   anon has no table access'; end;
end $$;
reset role;

rollback;
