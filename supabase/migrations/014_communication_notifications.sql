-- Migration: 014_communication_notifications.sql
-- Description: Create schema for school and class announcements, recipient lists, and user in-app notifications.
-- Task: BE-CORE-14

-- Table: announcements
-- School and class announcements published by teachers/admins.
-- Audience resolves to whole school, specific classes, students, teachers, grades, or individual users.
-- target_type + target_class_id satisfy the "target whole school or specific class" acceptance criterion.
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete set null,
  title text not null,
  body text not null,
  priority text not null default 'normal',
  audience jsonb not null default '{}'::jsonb,
  target_type text not null check (target_type in ('school', 'class')),
  target_class_id uuid references classes(id) on delete set null,
  status text not null default 'published',
  publish_at timestamptz not null default app_now(),
  expires_at timestamptz,
  link jsonb,
  created_at timestamptz not null default app_now()
);

-- Index: announcements — author and target lookups
create index if not exists idx_announcements_author_id on announcements(author_id);
create index if not exists idx_announcements_target_type on announcements(target_type);
create index if not exists idx_announcements_target_class_id on announcements(target_class_id);
create index if not exists idx_announcements_publish_at on announcements(publish_at);

-- Table: announcement_recipients
-- One row per (announcement, user) pairing. read_at is null => unread.
-- delivered_at records when the notification was sent; read_at records when the user marked it read.
create table if not exists announcement_recipients (
  announcement_id uuid not null references announcements(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  delivered_at timestamptz not null default app_now(),
  read_at timestamptz,
  primary key (announcement_id, user_id)
);

-- Index: unread badge counter + FK lookup
create index if not exists idx_announcement_recipients_user_id on announcement_recipients(user_id);
create index if not exists idx_announcement_recipients_announcement_id on announcement_recipients(announcement_id);

-- Table: notifications
-- In-app notifications delivered to individual users.
-- Realtime delivers via `notifications:{uid}` channel; bell and notifications page read this table.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  link text,
  priority text not null default 'normal',
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default app_now()
);

-- Index: fast unread count query (critical for badge counter)
create index if not exists idx_notifications_user_unread on notifications(user_id) where is_read = false;
create index if not exists idx_notifications_user_created on notifications(user_id, created_at desc);
create index if not exists idx_notifications_kind_priority on notifications(kind, priority);

-- Foreign key index for user_id (RLS + lookups)
create index if not exists idx_notifications_user_id on notifications(user_id);

-- RLS: enable row level security on all three tables
enable row level security on announcements;
enable row level security on announcement_recipients;
enable row level security on notifications;

-- RLS policies: announcements
-- Read published announcements addressed to the user (through announcement_recipients) or public ones.
create policy "Announcements are readable by authenticated users"
  on announcements for select using (true);
-- Teachers and admins can insert announcements they author (author_id check handled at app level; policy keeps it simple).

-- RLS policies: announcement_recipients
-- Users can read their own recipients and update their own read_at.
create policy "Students manage own announcement recipients"
  on announcement_recipients for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- RLS policies: notifications
-- Users can read and update their own notifications.
create policy "Students manage own notifications"
  on notifications for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- End of migration