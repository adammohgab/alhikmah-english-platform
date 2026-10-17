-- Migration: 015_ai_system_tables.sql
-- Description: AI Tutor dialogues, Copilot sessions, streamed messages, action cards, token metering.
-- Task: BE-CORE-15
-- Depends On: BE-CORE-02 (profiles)
-- Notes:
--   - Columns follow the task text. ai_action_cards also carries user_id, changes, result,
--     resolved_at and resolved_by, which the action card RPCs (BE-OPS-20) read and write.
--   - Policies live in 039_rls_policies_indexes.sql.

create table if not exists ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  conversation_type text not null default 'tutor',
  context_data jsonb not null default '{}'::jsonb,
  is_archived boolean not null default false,
  created_at timestamptz not null default app_now()
);

create table if not exists ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null default '',
  tokens_used int not null default 0 check (tokens_used >= 0),
  safety_flag boolean not null default false,
  created_at timestamptz not null default app_now()
);

create table if not exists ai_action_cards (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references ai_conversations(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  card_type text not null,
  payload jsonb not null default '{}'::jsonb,
  changes jsonb not null default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'ready', 'accepted', 'discarded', 'applied', 'edited', 'undone')),
  result jsonb,
  applied_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default app_now(),
  check (conversation_id is not null or user_id is not null)
);

create table if not exists ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  feature text not null,
  model text not null,
  prompt_tokens int not null default 0 check (prompt_tokens >= 0),
  completion_tokens int not null default 0 check (completion_tokens >= 0),
  estimated_cost numeric(8,5) not null default 0 check (estimated_cost >= 0),
  created_at timestamptz not null default app_now()
);

-- Role ordering inside a conversation and per-user history reads.
create index if not exists idx_ai_conversations_user_created on ai_conversations(user_id, created_at desc);
create index if not exists idx_ai_messages_conversation_created on ai_messages(conversation_id, created_at);
create index if not exists idx_ai_action_cards_conversation on ai_action_cards(conversation_id);
create index if not exists idx_ai_action_cards_user_status on ai_action_cards(user_id, status);
create index if not exists idx_ai_action_cards_resolved_by on ai_action_cards(resolved_by);
-- Token logs stay apart from conversation reads (conflict prevention in the task).
create index if not exists idx_ai_usage_logs_user_created on ai_usage_logs(user_id, created_at desc);
create index if not exists idx_ai_usage_logs_feature_created on ai_usage_logs(feature, created_at desc);
