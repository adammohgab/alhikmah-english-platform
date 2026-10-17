-- Migration: 012_games_schema.sql
-- Description: Create schema for minigames: game catalog, player sessions, high scores, and daily featured game tracking.
-- Task: BE-CORE-12

-- Table: games
create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  icon_url text,
  instructions text,
  is_active boolean default true,
  created_at timestamptz default app_now()
);

-- Table: game_sessions
create table if not exists game_sessions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  score int not null,
  accuracy numeric(5,2),
  xp_awarded int default 0,
  coins_awarded int default 0,
  time_spent_seconds int,
  played_at timestamptz default app_now()
);

-- Table: game_daily_featured
create table if not exists game_daily_featured (
  featured_date date primary key,
  game_id uuid not null references games(id) on delete cascade,
  bonus_multiplier numeric(3,2) default 1.5
);

-- Indexes
create index if not exists idx_game_sessions_student_game on game_sessions(student_id, game_id);
create index if not exists idx_game_sessions_game_id on game_sessions(game_id);
create index if not exists idx_game_sessions_student on game_sessions(student_id);
create index if not exists idx_game_daily_featured_game_id on game_daily_featured(game_id);

-- RLS Policies
alter table games enable row level security;
create policy "Games are readable by all authenticated users"
  on games for select using (true);

alter table game_sessions enable row level security;
create policy "Students manage own game sessions"
  on game_sessions for all using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

alter table game_daily_featured enable row level security;
create policy "Daily featured games are readable by all authenticated users"
  on game_daily_featured for select using (true);
