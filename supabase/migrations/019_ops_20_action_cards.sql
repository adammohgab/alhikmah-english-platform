-- Migration: 018_ops_20_action_cards.sql
-- Task: BE-OPS-20
-- Supported entities: questions, assessments, lessons, lesson_blocks, class_enrollments.

do $$
begin
  if to_regtype('public.card_status') is not null then
    execute 'alter type public.card_status add value if not exists ''applied''';
    execute 'alter type public.card_status add value if not exists ''undone''';
  end if;
end;
$$;

create or replace function public._apply_action_card_change(p_change jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_entity text := p_change->>'entity';
  v_action text := p_change->>'action';
  v_data jsonb;
  v_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_column text;
  v_assignments text := '';
  v_allowed boolean;
begin
  if pg_catalog.current_setting('app.action_card_internal', true) is distinct from 'true' then
    raise exception 'Internal action-card operation only' using errcode = '42501';
  end if;

  if v_entity is null or v_entity not in ('questions', 'assessments', 'lessons', 'lesson_blocks', 'class_enrollments') then
    raise exception 'Unsupported action-card entity: %', v_entity using errcode = '22023';
  end if;

  if v_action in ('create_draft', 'insert') then
    v_data := p_change->'data';
    if jsonb_typeof(v_data) <> 'object' then
      raise exception 'Insert action requires an object in data' using errcode = '22023';
    end if;

    for v_column in select jsonb_object_keys(v_data) loop
      select exists (
        select 1 from pg_catalog.pg_attribute a
        where a.attrelid = pg_catalog.to_regclass('public.' || v_entity)
          and a.attname = v_column and a.attnum > 0 and not a.attisdropped
          and a.attgenerated = ''
      ) into v_allowed;
      if not v_allowed then
        raise exception 'Invalid or generated column % for %', v_column, v_entity using errcode = '22023';
      end if;
    end loop;

    execute pg_catalog.format(
      'insert into public.%1$I as inserted select (pg_catalog.jsonb_populate_record(null::public.%1$I, $1)).* returning pg_catalog.to_jsonb(inserted)',
      v_entity
    ) into v_after using v_data;

    v_id := (v_after->>'id')::uuid;
    return pg_catalog.jsonb_build_object(
      'action', 'insert', 'entity', v_entity, 'id', v_id, 'after', v_after
    );

  elsif v_action = 'update' then
    v_id := (p_change->>'id')::uuid;
    v_data := p_change->'patch';

    if v_id is null or jsonb_typeof(v_data) <> 'object' or v_data = '{}'::jsonb or v_data ? 'id' then
      raise exception 'Update action requires id and a non-empty patch without id' using errcode = '22023';
    end if;

    for v_column in select jsonb_object_keys(v_data) loop
      select exists (
        select 1 from pg_catalog.pg_attribute a
        where a.attrelid = pg_catalog.to_regclass('public.' || v_entity)
          and a.attname = v_column and a.attnum > 0 and not a.attisdropped
          and a.attgenerated = '' and a.attidentity = ''
      ) into v_allowed;

      if not v_allowed then
        raise exception 'Invalid or immutable column % for %', v_column, v_entity using errcode = '22023';
      end if;

      v_assignments := v_assignments
        || case when v_assignments = '' then '' else ', ' end
        || pg_catalog.format(
          '%1$I = (pg_catalog.jsonb_populate_record(null::public.%2$I, $1)).%1$I',
          v_column, v_entity
        );
    end loop;

    execute pg_catalog.format(
      'select pg_catalog.to_jsonb(t) from public.%I t where t.id = $1 for update',
      v_entity
    ) into v_before using v_id;

    if v_before is null then
      raise exception 'Target row does not exist in %', v_entity using errcode = 'P0002';
    end if;

    execute pg_catalog.format(
      'update public.%1$I t set %2$s where t.id = $2 returning pg_catalog.to_jsonb(t)',
      v_entity, v_assignments
    ) into v_after using v_data, v_id;

    return pg_catalog.jsonb_build_object(
      'action', 'update', 'entity', v_entity, 'id', v_id,
      'before', v_before, 'after', v_after
    );
  else
    raise exception 'Unsupported action-card operation: %', v_action using errcode = '22023';
  end if;
end;
$$;

create or replace function public.apply_action_card(card_id uuid, edits jsonb default null)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_card record;
  v_owner uuid;
  v_changes jsonb;
  v_change jsonb;
  v_undo jsonb := '[]'::jsonb;
  v_status text;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_card
  from public.ai_action_cards
  where id = card_id
  for update;

  if not found then
    raise exception 'Action card not found' using errcode = 'P0002';
  end if;

  if v_card.conversation_id is not null then
    select user_id into v_owner
    from public.ai_conversations
    where id = v_card.conversation_id;

    if v_owner is distinct from auth.uid() then
      raise exception 'Not authorized to apply this action card' using errcode = '42501';
    end if;
  elsif v_card.user_id is distinct from auth.uid() then
    raise exception 'Not authorized to apply this action card' using errcode = '42501';
  end if;

  if v_card.status::text <> 'ready' then
    raise exception 'Action card is not ready' using errcode = '55000';
  end if;

  v_changes := coalesce(edits->'changes', edits, v_card.changes);
  if jsonb_typeof(v_changes) <> 'array' then
    raise exception 'Action-card changes must be a JSON array' using errcode = '22023';
  end if;

  perform pg_catalog.set_config('app.action_card_internal', 'true', true);

  for v_change in
    select value from pg_catalog.jsonb_array_elements(v_changes)
  loop
    v_undo := v_undo || pg_catalog.jsonb_build_array(
      public._apply_action_card_change(v_change)
    );
  end loop;

  v_status := case when edits is null then 'applied' else 'edited' end;
  v_result := pg_catalog.jsonb_build_object('undo', v_undo);

  update public.ai_action_cards
  set status = v_status,
      result = v_result,
      resolved_at = pg_catalog.now(),
      resolved_by = auth.uid()
  where id = card_id;

  return pg_catalog.jsonb_build_object('status', v_status, 'result', v_result);
end;
$$;

create or replace function public.undo_action_card(card_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_card record;
  v_owner uuid;
  v_item jsonb;
  v_current jsonb;
  v_entity text;
  v_id uuid;
  v_assignments text;
  v_column text;
  v_index integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_card
  from public.ai_action_cards
  where id = card_id
  for update;

  if not found then
    raise exception 'Action card not found' using errcode = 'P0002';
  end if;

  if v_card.conversation_id is not null then
    select user_id into v_owner
    from public.ai_conversations
    where id = v_card.conversation_id;

    if v_owner is distinct from auth.uid() then
      raise exception 'Not authorized to undo this action card' using errcode = '42501';
    end if;
  elsif v_card.user_id is distinct from auth.uid() then
    raise exception 'Not authorized to undo this action card' using errcode = '42501';
  end if;

  if v_card.status::text not in ('applied', 'edited') then
    raise exception 'Action card cannot be undone in its current state' using errcode = '55000';
  end if;

  for v_index in reverse pg_catalog.jsonb_array_length(v_card.result->'undo')..1 loop
    v_item := v_card.result->'undo'->(v_index - 1);
    v_entity := v_item->>'entity';
    v_id := (v_item->>'id')::uuid;

    if v_entity is null or v_entity not in ('questions', 'assessments', 'lessons', 'lesson_blocks', 'class_enrollments') then
      raise exception 'Unsupported undo entity: %', v_entity using errcode = '22023';
    end if;

    execute pg_catalog.format(
      'select pg_catalog.to_jsonb(t) from public.%I t where t.id = $1 for update',
      v_entity
    ) into v_current using v_id;

    if v_current is distinct from v_item->'after' then
      raise exception 'Target row changed after action-card application; undo refused' using errcode = '55000';
    end if;

    if v_item->>'action' = 'insert' then
      execute pg_catalog.format(
        'delete from public.%I where id = $1', v_entity
      ) using v_id;
    else
      v_assignments := '';

      for v_column in
        select a.attname
        from pg_catalog.pg_attribute a
        where a.attrelid = pg_catalog.to_regclass('public.' || v_entity)
          and a.attnum > 0 and not a.attisdropped
          and a.attname <> 'id'
          and a.attgenerated = '' and a.attidentity = ''
        order by a.attnum
      loop
        v_assignments := v_assignments
          || case when v_assignments = '' then '' else ', ' end
          || pg_catalog.format(
            '%1$I = (pg_catalog.jsonb_populate_record(null::public.%2$I, $1)).%1$I',
            v_column, v_entity
          );
      end loop;

      execute pg_catalog.format(
        'update public.%1$I t set %2$s where t.id = $2',
        v_entity, v_assignments
      ) using v_item->'before', v_id;
    end if;
  end loop;

  update public.ai_action_cards
  set status = 'undone',
      resolved_at = pg_catalog.now(),
      resolved_by = auth.uid()
  where id = card_id;

  return pg_catalog.jsonb_build_object('status', 'undone');
end;
$$;

create or replace function public.discard_action_card(card_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_card record;
  v_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_card
  from public.ai_action_cards
  where id = card_id
  for update;

  if not found then
    raise exception 'Action card not found' using errcode = 'P0002';
  end if;

  if v_card.conversation_id is not null then
    select user_id into v_owner
    from public.ai_conversations
    where id = v_card.conversation_id;

    if v_owner is distinct from auth.uid() then
      raise exception 'Not authorized to discard this action card' using errcode = '42501';
    end if;
  elsif v_card.user_id is distinct from auth.uid() then
    raise exception 'Not authorized to discard this action card' using errcode = '42501';
  end if;

  if v_card.status::text <> 'ready' then
    raise exception 'Only ready action cards can be discarded' using errcode = '55000';
  end if;

  update public.ai_action_cards
  set status = 'discarded',
      resolved_at = pg_catalog.now(),
      resolved_by = auth.uid()
  where id = card_id;

  return pg_catalog.jsonb_build_object('status', 'discarded');
end;
$$;

revoke all on function public._apply_action_card_change(jsonb) from public;
revoke all on function public.apply_action_card(uuid, jsonb) from public;
revoke all on function public.undo_action_card(uuid) from public;
revoke all on function public.discard_action_card(uuid) from public;

grant execute on function public._apply_action_card_change(jsonb) to authenticated;
grant execute on function public.apply_action_card(uuid, jsonb) to authenticated;
grant execute on function public.undo_action_card(uuid) to authenticated;
grant execute on function public.discard_action_card(uuid) to authenticated;
