-- Migration: 011_quests_badges.sql
-- Description: Create schema for quest templates, quest instances, badge definitions, user badges, and leaderboard snapshots.
-- Task: BE-CORE-11

-- Table: quest_templates
create table if not exists quest_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  quest_type text not null check (quest_type in ('daily', 'weekly')),
  target_count int not null default 1,
  xp_reward int not null default 0,
  coin_reward int not null default 0,
  is_active boolean default true,
  created_at timestamptz default app_now()
);

-- Table: quest_instances
create table if not exists quest_instances (
  id uuid primary key default gen_random_uuid(),
  quest_template_id uuid not null references quest_templates(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  current_count int not null default 0,
  is_completed boolean not null default false,
  is_claimed boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz default app_now(),
  unique (student_id, quest_template_id)
);

-- Table: badge_definitions
create table if not exists badge_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  icon_url text,
  category text not null,
  requirement_json jsonb not null,
  created_at timestamptz default app_now()
);

-- Table: user_badges
create table if not exists user_badges (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  badge_id uuid not null references badge_definitions(id) on delete cascade,
  awarded_at timestamptz default app_now(),
  is_pinned boolean not null default false,
  unique (student_id, badge_id)
);

-- Table: leaderboard_snapshots
create table if not exists leaderboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes(id) on delete set null,
  period text not null check (period in ('daily', 'weekly', 'monthly')),
  ranking_data jsonb not null,
  generated_at timestamptz default app_now()
);

-- Indexes
create index if not exists idx_quest_templates_active on quest_templates(is_active);
create index if not exists idx_quest_instances_student on quest_instances(student_id);
create index if not exists idx_quest_instances_template on quest_instances(quest_template_id);
create index if not exists idx_badge_definitions_category on badge_definitions(category);
create index if not exists idx_user_badges_student on user_badges(student_id);
create index if not exists idx_leaderboard_snapshots_class_period on leaderboard_snapshots(class_id, period);

-- RLS Policies
alter table quest_templates enable row level security;
create policy "Quest templates are readable by all authenticated users"
  on quest_templates for select using (true);

alter table quest_instances enable row level security;
create policy "Students manage own quest instances"
  on quest_instances for all using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

alter table badge_definitions enable row level security;
create policy "Badge definitions are readable by all authenticated users"
  on badge_definitions for select using (true);

alter table user_badges enable row level security;
create policy "Students manage own badges"
  on user_badges for all using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

alter table leaderboard_snapshots enable row level security;
create policy "Leaderboard snapshots are readable by all authenticated users"
  on leaderboard_snapshots for select using (true);

-- Check constraint for max 3 pinned badges per student
-- Implemented at application level; DB constraint would require more complex logic
-- A trigger could enforce this, but per spec we support the flag up to limit of 3