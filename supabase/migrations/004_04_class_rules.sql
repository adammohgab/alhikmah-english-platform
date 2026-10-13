-- Migration: 004_04_class_rules.sql
-- Description: Class-specific rules, curriculum assignments, and unlock overrides.
-- Task: BE-CORE-04

create table if not exists class_rules (
  class_id uuid primary key references classes(id) on delete cascade,
  games_enabled boolean not null default true,
  ai_tutor_enabled boolean not null default true,
  late_submission_allowed boolean not null default true,
  late_penalty_percent integer not null default 10,
  bonus_multiplier numeric(3,2) not null default 1.0,
  updated_at timestamptz not null default now()
);

-- Give existing classes the same defaults as new classes.
insert into class_rules (class_id)
select id from classes
on conflict (class_id) do nothing;

-- Give each new class a default rule row.
create or replace function create_default_class_rules()
returns trigger
language plpgsql
as $$
begin
  insert into class_rules (class_id) values (new.id);
  return new;
end;
$$;

create trigger classes_create_default_rules
  after insert on classes
  for each row
  execute function create_default_class_rules();

create trigger class_rules_updated_at
  before update on class_rules
  for each row
  execute function set_updated_at();

create table if not exists class_courses (
  class_id uuid not null references classes(id) on delete cascade,
  course_id uuid not null,
  is_active boolean not null default true,
  assigned_at timestamptz not null default now(),
  primary key (class_id, course_id)
);

create table if not exists class_unlock_overrides (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id),
  student_id uuid not null references profiles(id),
  target_type text not null,
  target_id uuid not null,
  is_unlocked boolean not null,
  reason text
);

create index if not exists idx_class_unlock_overrides_class_target
  on class_unlock_overrides (class_id, target_type, target_id);

create index if not exists idx_class_unlock_overrides_student_target
  on class_unlock_overrides (student_id, target_type, target_id);
