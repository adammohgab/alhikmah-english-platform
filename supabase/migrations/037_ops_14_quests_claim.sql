alter table public.quest_instances
  add column if not exists quest_date date;

update public.quest_instances
   set quest_date = created_at::date
 where quest_date is null;

alter table public.quest_instances
  alter column quest_date set default current_date,
  alter column quest_date set not null;

alter table public.quest_instances
  drop constraint if exists quest_instances_student_id_quest_template_id_key;

create unique index if not exists uq_quest_instances_student_template_date
  on public.quest_instances(student_id, quest_template_id, quest_date);

create or replace function public.generate_daily_quests(student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_timezone text := 'UTC';
  v_today date;
  v_expires timestamptz;
  v_ids uuid[];
begin
  if v_actor is null or v_actor <> generate_daily_quests.student_id then
    raise exception 'You can only generate your own quests' using errcode = '42501';
  end if;

  select coalesce(ps.value ->> 'timezone', 'UTC')
    into v_timezone
  from public.platform_settings ps
  where ps.key = 'region';

  v_timezone := coalesce(v_timezone, 'UTC');
  v_today := (public.app_now() at time zone v_timezone)::date;
  v_expires := ((v_today + 1)::timestamp at time zone v_timezone);

  insert into public.quest_instances(
    quest_template_id, student_id, current_count, expires_at, quest_date
  )
  select chosen.id, student_id, 0, v_expires, v_today
  from (
    select qt.id
    from public.quest_templates qt
    where qt.is_active
      and qt.quest_type = 'daily'
      and not exists (
        select 1
        from public.quest_instances qi
        where qi.student_id = generate_daily_quests.student_id
          and qi.quest_template_id = qt.id
          and qi.quest_date = v_today
      )
    order by random()
    limit 3
  ) chosen
  on conflict (student_id, quest_template_id, quest_date) do nothing;

  select coalesce(array_agg(qi.id order by qi.created_at), '{}')
    into v_ids
  from public.quest_instances qi
  where qi.student_id = generate_daily_quests.student_id
    and qi.quest_date = v_today;

  return jsonb_build_object(
    'quest_date', v_today,
    'expires_at', v_expires,
    'instance_ids', to_jsonb(v_ids)
  );
end;
$$;

create or replace function public.claim_quest_reward(instance_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student uuid := auth.uid();
  v_quest public.quest_instances%rowtype;
  v_template public.quest_templates%rowtype;
  v_freeze_awarded boolean := false;
begin
  if v_student is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_quest
  from public.quest_instances qi
  where qi.id = claim_quest_reward.instance_id
    and qi.student_id = v_student
  for update;

  if not found then
    raise exception 'Quest not found' using errcode = 'P0002';
  end if;

  if not v_quest.is_completed or v_quest.is_claimed then
    raise exception 'Quest is incomplete or already claimed' using errcode = '55000';
  end if;

  if v_quest.expires_at is not null and v_quest.expires_at <= public.app_now() then
    raise exception 'Quest has expired' using errcode = '55000';
  end if;

  select * into v_template
  from public.quest_templates qt
  where qt.id = v_quest.quest_template_id;

  update public.quest_instances
     set is_claimed = true
   where id = v_quest.id;

  if v_template.xp_reward > 0 then
    insert into public.xp_ledger(student_id, amount, source, reference_id)
    values (v_student, v_template.xp_reward, 'quest', v_quest.id);
  end if;

  if v_template.coin_reward > 0 then
    insert into public.coin_ledger(student_id, amount, source, reference_id)
    values (v_student, v_template.coin_reward, 'quest', v_quest.id);
  end if;

  if random() < 0.05 then
    update public.student_stats
       set streak_freeze_count = least(streak_freeze_count + 1, 3)
     where student_id = v_student
       and streak_freeze_count < 3;
    v_freeze_awarded := found;
  end if;

  return jsonb_build_object(
    'quest_instance_id', v_quest.id,
    'xp', v_template.xp_reward,
    'coins', v_template.coin_reward,
    'streak_freeze_awarded', v_freeze_awarded
  );
end;
$$;

revoke all on function public.generate_daily_quests(uuid) from public;
revoke all on function public.claim_quest_reward(uuid) from public;
grant execute on function public.generate_daily_quests(uuid) to authenticated;
grant execute on function public.claim_quest_reward(uuid) to authenticated;
