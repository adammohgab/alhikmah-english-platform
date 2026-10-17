-- Task: BE-OPS-05

create or replace function public.award_xp(
  student_id uuid,
  amount integer,
  source text,
  ref_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_student_role text;
  v_daily_cap integer;
  v_xp_earned_today bigint;
  v_awarded integer;
  v_total_xp bigint;
  v_level_before integer;
  v_level_after integer;
  v_bonus_coins integer := 0;
  v_xp_ledger_id uuid;
  v_current_coins bigint;
begin
  if amount is null or amount < 0 then
    raise exception 'XP amount must be zero or greater' using errcode = '22023';
  end if;

  if source is null
     or pg_catalog.length(pg_catalog.btrim(source)) = 0
     or pg_catalog.length(source) > 100 then
    raise exception 'Source must contain 1 to 100 characters' using errcode = '22023';
  end if;

  select p.role::text into v_student_role
  from public.profiles p
  where p.id = student_id and p.status::text = 'active';

  if v_student_role is distinct from 'student' then
    raise exception 'An active student profile is required' using errcode = '22023';
  end if;

  if coalesce(auth.role(), '') <> 'service_role' then
    if v_actor is null then
      raise exception 'Authentication required' using errcode = '42501';
    end if;

    select p.role::text into v_actor_role
    from public.profiles p
    where p.id = v_actor and p.status::text = 'active';

    if v_actor_role in ('admin', 'super_admin') then
      null;
    elsif v_actor_role = 'teacher' and exists (
      select 1
      from public.class_teachers ct
      join public.class_enrollments ce on ce.class_id = ct.class_id
      where ct.teacher_id = v_actor
        and ce.student_id = student_id
        and ce.status = 'active'
    ) then
      null;
    else
      raise exception 'Not authorized to award XP to this student' using errcode = '42501';
    end if;
  end if;

  select coalesce((ps.value #>> '{}')::integer, 1000)
  into v_daily_cap
  from public.platform_settings ps
  where ps.key = 'xp_daily_cap';

  v_daily_cap := coalesce(v_daily_cap, 1000);

  if v_daily_cap < 0 then
    raise exception 'Configured daily XP cap cannot be negative' using errcode = '22023';
  end if;

  insert into public.student_stats (student_id)
  values (student_id)
  on conflict (student_id) do nothing;

  select ss.total_xp, ss.current_level
  into v_total_xp, v_level_before
  from public.student_stats ss
  where ss.student_id = student_id
  for update;

  select coalesce(sum(xl.amount), 0)::bigint
  into v_xp_earned_today
  from public.xp_ledger xl
  where xl.student_id = student_id
    and xl.created_at >= pg_catalog.date_trunc('day', pg_catalog.now())
    and xl.created_at < pg_catalog.date_trunc('day', pg_catalog.now()) + interval '1 day';

  v_awarded := greatest(
    0,
    least(amount::bigint, v_daily_cap::bigint - v_xp_earned_today)
  );

  insert into public.xp_ledger (student_id, amount, source, reference_id)
  values (student_id, v_awarded, pg_catalog.btrim(source), ref_id)
  returning id into v_xp_ledger_id;

  select ss.total_xp
  into v_total_xp
  from public.student_stats ss
  where ss.student_id = student_id;

  v_level_after := least(
    60,
    floor(pg_catalog.sqrt(v_total_xp::numeric / 100))::integer + 1
  );
  v_level_before := least(60, greatest(1, v_level_before));

  update public.student_stats
  set current_level = v_level_after
  where student_stats.student_id = award_xp.student_id;

  if v_level_after > v_level_before then
    select coalesce(sum(25 + level_number), 0)::integer
    into v_bonus_coins
    from pg_catalog.generate_series(v_level_before + 1, v_level_after)
      as levels(level_number);

    if v_bonus_coins > 0 then
      insert into public.coin_ledger (student_id, amount, source, reference_id)
      values (student_id, v_bonus_coins, 'level_up_bonus', v_xp_ledger_id);
    end if;

    insert into public.notifications (
      user_id, kind, title, body, payload, priority
    )
    values (
      student_id,
      'level_up',
      'Level up!',
      'You reached level ' || v_level_after::text || '.',
      pg_catalog.jsonb_build_object(
        'event', 'level_up',
        'level_before', v_level_before,
        'level_after', v_level_after,
        'bonus_coins', v_bonus_coins
      ),
      'important'
    );
  end if;

  select ss.current_coins into v_current_coins
  from public.student_stats ss
  where ss.student_id = student_id;

  return pg_catalog.jsonb_build_object(
    'student_id', student_id,
    'requested_xp', amount,
    'awarded_xp', v_awarded,
    'daily_xp_cap', v_daily_cap,
    'xp_earned_today', v_xp_earned_today + v_awarded,
    'capped', v_awarded < amount,
    'total_xp', v_total_xp,
    'level_before', v_level_before,
    'level_after', v_level_after,
    'level_up_bonus_coins', v_bonus_coins,
    'current_coins', v_current_coins,
    'xp_ledger_id', v_xp_ledger_id
  );
end;
$$;

revoke all on function public.award_xp(uuid, integer, text, uuid) from public;
grant execute on function public.award_xp(uuid, integer, text, uuid)
  to authenticated, service_role;
