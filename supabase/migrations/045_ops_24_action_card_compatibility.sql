-- Align the action-card storage table with the fields consumed by ai-copilot and BE-OPS-20.
-- Existing rows are retained; pending cards become apply-ready after their payload is backfilled.
alter table public.ai_action_cards
  add column if not exists feature text not null default 'copilot',
  add column if not exists kind text,
  add column if not exists summary text,
  add column if not exists preview jsonb not null default '{}'::jsonb,
  add column if not exists sources jsonb not null default '[]'::jsonb,
  add column if not exists notes jsonb not null default '[]'::jsonb,
  add column if not exists stamps jsonb not null default '{}'::jsonb;

alter table public.ai_action_cards alter column card_type set default 'copilot';
alter table public.ai_action_cards alter column payload set default '{}'::jsonb;

-- Older installs used a narrower text check that excluded the lifecycle states required by RPCs.
do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select conname
    from pg_catalog.pg_constraint
    where conrelid = 'public.ai_action_cards'::regclass
      and contype = 'c'
      and pg_catalog.pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute pg_catalog.format('alter table public.ai_action_cards drop constraint %I', v_constraint.conname);
  end loop;
end;
$$;


update public.ai_action_cards
set kind = coalesce(kind, card_type, 'curriculum_change'),
    summary = coalesce(summary, payload->>'summary', 'Review the proposed changes below.'),
    preview = case when preview = '{}'::jsonb then coalesce(payload->'preview', payload, '{}'::jsonb) else preview end,
    sources = case when sources = '[]'::jsonb then coalesce(payload->'sources', '[]'::jsonb) else sources end,
    notes = case when notes = '[]'::jsonb then coalesce(payload->'notes', '[]'::jsonb) else notes end,
    status = case when status::text = 'pending' then 'ready' else status end;


alter table public.ai_action_cards
  add constraint ai_action_cards_status_lifecycle_check
  check (status::text in ('generating', 'pending', 'ready', 'accepted', 'applied', 'edited', 'discarded', 'stale', 'failed', 'undone'));

create index if not exists idx_ai_action_cards_feature_status_created
  on public.ai_action_cards(feature, status, created_at desc);
