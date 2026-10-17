-- Migration: 017_admin_audit_moderation.sql
-- Description: Platform settings, immutable audit history, and moderation queue.
-- Task: BE-CORE-17

-- Table: platform_settings
create table if not exists platform_settings (
  key text primary key,
  value jsonb not null,
  description text,
  version integer not null default 1,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default app_now()
);

create trigger platform_settings_updated_at
  before update on platform_settings
  for each row
  execute function set_updated_at();

-- Table: audit_log
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  actor_id uuid references profiles(id),
  actor_role user_role,
  actor_admin_level text
    check (actor_admin_level is null or actor_admin_level in ('super', 'school')),
  action text not null,
  action_type text,
  target_table text,
  target_type text,
  target_id uuid,
  ip_address text,
  ip_hash text,
  old_values jsonb,
  new_values jsonb,
  before jsonb,
  after jsonb,
  summary text,
  reason text,
  device text,
  view_as_session_id uuid,
  created_at timestamptz not null default app_now()
);

create or replace function forbid_audit_log_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only; updates and deletes are not allowed.';
end;
$$;

create trigger audit_log_no_mutation
  before update or delete on audit_log
  for each row
  execute function forbid_audit_log_mutation();

revoke update, delete, truncate on audit_log from public, anon, authenticated;

-- Table: moderation_queue
create table if not exists moderation_queue (
  id uuid primary key default gen_random_uuid(),
  reported_by uuid references profiles(id),
  reporter_id uuid references profiles(id),
  entity_type text not null,
  entity_id uuid not null,
  reason text,
  type text check (type is null or type in ('flagged', 'reported', 'failed_job')),
  severity text check (severity is null or severity in ('low', 'medium', 'high')),
  status text not null default 'pending'
    check (status in ('pending', 'new', 'in_review', 'resolved', 'dismissed')),
  source_type text,
  source_id uuid,
  assignee_id uuid references profiles(id),
  reviewed_by uuid references profiles(id),
  summary text,
  snapshot jsonb,
  ai_triage jsonb,
  safety_category text,
  resolution text,
  resolution_note text,
  resolution_notes text,
  resolved_at timestamptz,
  resolved_by uuid references profiles(id),
  created_at timestamptz not null default app_now()
);

create index if not exists idx_audit_log_created_at
  on audit_log (created_at desc);
create index if not exists idx_audit_log_user_created_at
  on audit_log (user_id, created_at desc);
create index if not exists idx_audit_log_actor_created_at
  on audit_log (actor_id, created_at desc);
create index if not exists idx_audit_log_action_type_created_at
  on audit_log (action_type, created_at desc);
create index if not exists idx_audit_log_action_created_at
  on audit_log (action, created_at desc);
create index if not exists idx_audit_log_target
  on audit_log (target_type, target_id);
create index if not exists idx_audit_log_table_target
  on audit_log (target_table, target_id);

create index if not exists idx_moderation_queue_open_severity_created_at
  on moderation_queue (severity, created_at desc)
  where status in ('pending', 'new', 'in_review');
create index if not exists idx_moderation_queue_entity
  on moderation_queue (entity_type, entity_id);
create index if not exists idx_moderation_queue_status_created_at
  on moderation_queue (status, created_at desc);
create index if not exists idx_moderation_queue_reporter_created_at
  on moderation_queue (reported_by, created_at desc);
