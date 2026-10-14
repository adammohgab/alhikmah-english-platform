create or replace function public.record_daily_activity(student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_timezone text;
  v_today date;
  v_latest_activity date;
  v_current_streak integer;
  v_longest_streak integer;
  v_freezes integer;
  v_used_freeze boolean := false;
  v_already_active_today boolean;
begin
  if v_actor_id is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if v_actor_id is not null
     and v_actor_id <> student_id
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'You can only record your own activity' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = student_id
      and p.role::text = 'student'
      and p.status::text = 'active'
  ) then
    raise exception 'An active student profile is required' using errcode = '22023';
  end if;

  select coalesce(nullif(ps.value ->> 'timezone', ''), 'UTC')
    into v_timezone
  from public.platform_settings ps
  where ps.key = 'region';

  v_timezone := coalesce(v_timezone, 'UTC');

  begin
    v_today := (public.app_now() at time zone v_timezone)::date;
  exception
    when invalid_parameter_value then
      v_today := (public.app_now() at time zone 'UTC')::date;
      v_timezone := 'UTC';
  end;

  insert into public.student_stats (student_id)
  values (student_id)
  on conflict (student_id) do nothing;

  -- Serialize activity and freeze updates for this student.
  select ss.current_streak, ss.longest_streak, ss.streak_freeze_count
    into v_current_streak, v_longest_streak, v_freezes
  from public.student_stats ss
  where ss.student_id = record_daily_activity.student_id
  for update;

  select exists (
    select 1
    from public.streak_days sd
    where sd.student_id = record_daily_activity.student_id
      and sd.activity_date = v_today
      and sd.xp_earned > 0
  ) into v_already_active_today;

  if v_already_active_today then
    update public.streak_days
       set xp_earned = xp_earned + 1
     where streak_days.student_id = record_daily_activity.student_id
       and streak_days.activity_date = v_today;
  else
    select max(sd.activity_date)
      into v_latest_activity
    from public.streak_days sd
    where sd.student_id = record_daily_activity.student_id
      and sd.xp_earned > 0;

    if v_latest_activity = v_today - 1 then
      v_current_streak := v_current_streak + 1;
    elsif v_latest_activity = v_today - 2 and v_freezes > 0 then
      insert into public.streak_days (student_id, activity_date, xp_earned, is_frozen)
      values (record_daily_activity.student_id, v_today - 1, 0, true)
      on conflict (student_id, activity_date)
      do update set is_frozen = true;

      v_freezes := v_freezes - 1;
      v_current_streak := v_current_streak + 1;
      v_used_freeze := true;
    else
      v_current_streak := 1;
    end if;

    insert into public.streak_days (student_id, activity_date, xp_earned)
    values (record_daily_activity.student_id, v_today, 1)
    on conflict (student_id, activity_date)
    do update set xp_earned = streak_days.xp_earned + 1;

    v_longest_streak := greatest(v_longest_streak, v_current_streak);

    update public.student_stats
       set current_streak = v_current_streak,
           longest_streak = v_longest_streak,
           streak_freeze_count = v_freezes,
           last_active_date = v_today
     where student_stats.student_id = record_daily_activity.student_id;
  end if;

  return jsonb_build_object(
    'student_id', record_daily_activity.student_id,
    'activity_date', v_today,
    'timezone', v_timezone,
    'current_streak', v_current_streak,
    'longest_streak', v_longest_streak,
    'streak_freeze_count', v_freezes,
    'freeze_used', v_used_freeze
  );
end;
$$;


create or replace function public.buy_streak_freeze(student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_freeze_price integer;
  v_current_coins bigint;
  v_freeze_count integer;
begin
  if v_actor_id is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if v_actor_id is not null
     and v_actor_id <> student_id
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'You can only buy a freeze for your own account' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = student_id
      and p.role::text = 'student'
      and p.status::text = 'active'
  ) then
    raise exception 'An active student profile is required' using errcode = '22023';
  end if;

  -- Configure this setting as a JSON number; defaults to 100 coins.
  select coalesce((ps.value #>> '{}')::integer, 100)
    into v_freeze_price
  from public.platform_settings ps
  where ps.key = 'streak_freeze_price';

  v_freeze_price := coalesce(v_freeze_price, 100);

  if v_freeze_price < 0 then
    raise exception 'Streak freeze price cannot be negative' using errcode = '22023';
  end if;

  insert into public.student_stats (student_id)
  values (student_id)
  on conflict (student_id) do nothing;

  select ss.current_coins, ss.streak_freeze_count
    into v_current_coins, v_freeze_count
  from public.student_stats ss
  where ss.student_id = buy_streak_freeze.student_id
  for update;

  if v_freeze_count >= 3 then
    raise exception 'Streak freeze limit reached' using errcode = 'P0001';
  end if;

  if v_current_coins < v_freeze_price then
    raise exception 'Insufficient coins' using errcode = 'P0001';
  end if;

  -- The coin-ledger trigger atomically updates student_stats.current_coins.
  insert into public.coin_ledger (student_id, amount, source, reference_id)
  values (
    buy_streak_freeze.student_id,
    -v_freeze_price,
    'streak_freeze_purchase',
    null
  );

  update public.student_stats
     set streak_freeze_count = streak_freeze_count + 1
   where student_stats.student_id = buy_streak_freeze.student_id
  returning current_coins, streak_freeze_count
       into v_current_coins, v_freeze_count;

  return jsonb_build_object(
    'student_id', buy_streak_freeze.student_id,
    'coins_spent', v_freeze_price,
    'current_coins', v_current_coins,
    'streak_freeze_count', v_freeze_count
  );
end;
$$;

revoke all on function public.record_daily_activity(uuid) from public;
revoke all on function public.buy_streak_freeze(uuid) from public;

grant execute on function public.record_daily_activity(uuid)
  to authenticated, service_role;
grant execute on function public.buy_streak_freeze(uuid)
  to authenticated, service_role;
