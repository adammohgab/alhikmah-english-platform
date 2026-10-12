-- Migration: 010_gamification_ledgers.sql
-- Description: Core gamification ledger tables: student statistics, immutable XP and Coin transactional ledgers, and streak history.
-- Task: BE-CORE-10

-- Table: student_stats
create table if not exists student_stats (
  student_id uuid primary key references profiles(id) on delete cascade,
  total_xp bigint not null default 0,
  current_level int not null default 1 check (current_level >= 1 and current_level <= 60),
  current_coins bigint not null default 0 check (current_coins >= 0),
  current_streak int not null default 0 check (current_streak >= 0),
  longest_streak int not null default 0 check (longest_streak >= 0),
  streak_freeze_count int not null default 0 check (streak_freeze_count >= 0 and streak_freeze_count <= 3),
  last_active_date date,
  updated_at timestamptz not null default now()
);

-- Table: xp_ledger (strictly append-only)
create table if not exists xp_ledger (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  amount int not null,
  source text not null,
  reference_id uuid,
  created_at timestamptz not null default app_now()
);

-- Table: coin_ledger (strictly append-only)
create table if not exists coin_ledger (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  amount int not null,
  source text not null,
  reference_id uuid,
  created_at timestamptz not null default app_now()
);

-- Table: streak_days
create table if not exists streak_days (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  activity_date date not null,
  xp_earned int not null default 0,
  is_frozen boolean not null default false,
  created_at timestamptz not null default now(),
  unique (student_id, activity_date)
);

-- Prevent update and delete on xp_ledger (append-only enforcement)
create or replace function forbid_ledger_mutation()
returns trigger as $$
begin
  raise exception 'Ledger tables are append-only. Mutation or deletion is not allowed.';
end;
$$ language plpgsql;

create trigger xp_ledger_no_mutation
  before update or delete on xp_ledger
  for each row
  execute function forbid_ledger_mutation();

create trigger coin_ledger_no_mutation
  before update or delete on coin_ledger
  for each row
  execute function forbid_ledger_mutation();

-- Trigger: synchronize student_stats on xp_ledger insert
create or replace function sync_xp_ledger_to_stats()
returns trigger as $$
begin
  insert into student_stats (student_id, total_xp, last_active_date)
  values (new.student_id, new.amount, current_date)
  on conflict (student_id) do update
  set total_xp = student_stats.total_xp + new.amount,
      last_active_date = current_date,
      updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_sync_xp_ledger
  after insert on xp_ledger
  for each row
  execute function sync_xp_ledger_to_stats();

-- Trigger: synchronize student_stats on coin_ledger insert
create or replace function sync_coin_ledger_to_stats()
returns trigger as $$
begin
  insert into student_stats (student_id, current_coins, last_active_date)
  values (new.student_id, greatest(0, new.amount), current_date)
  on conflict (student_id) do update
  set current_coins = greatest(0, student_stats.current_coins + new.amount),
      last_active_date = current_date,
      updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_sync_coin_ledger
  after insert on coin_ledger
  for each row
  execute function sync_coin_ledger_to_stats();

-- Indexes for performance
create index if not exists idx_student_stats_total_xp on student_stats(total_xp desc);
create index if not exists idx_student_stats_current_streak on student_stats(current_streak desc);

create index if not exists idx_xp_ledger_student_id on xp_ledger(student_id, created_at desc);
create index if not exists idx_xp_ledger_source on xp_ledger(source);

create index if not exists idx_coin_ledger_student_id on coin_ledger(student_id, created_at desc);
create index if not exists idx_coin_ledger_source on coin_ledger(source);

create index if not exists idx_streak_days_student_id on streak_days(student_id, activity_date desc);

-- Trigger for student_stats updated_at
create trigger student_stats_updated_at
  before update on student_stats
  for each row
  execute function set_updated_at();
