create or replace function public.record_game_session(
  game_slug text,
  score integer,
  accuracy numeric,
  duration integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := auth.uid();
  v_game_id uuid;
  v_featured_multiplier numeric := 1;
  v_xp integer;
  v_coins integer;
  v_session_id uuid;
begin
  if v_student_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if score < 0 or duration < 1 or duration > 3600
     or accuracy < 0 or accuracy > 100
     or score > duration * 1000 then
    raise exception 'Game result is outside valid limits' using errcode = '22023';
  end if;

  select g.id into v_game_id
  from public.games g
  where g.slug = record_game_session.game_slug
    and g.is_active is true;

  if not found then
    raise exception 'Game is unavailable' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.game_sessions gs
    where gs.student_id = v_student_id
      and gs.game_id = v_game_id
      and gs.played_at > public.app_now() - interval '10 seconds'
  ) then
    raise exception 'Please wait before submitting another game result'
      using errcode = 'P0001';
  end if;

  select coalesce(gdf.bonus_multiplier, 1.5)
    into v_featured_multiplier
  from public.game_daily_featured gdf
  where gdf.game_id = v_game_id
    and gdf.featured_date = public.app_now()::date;

  v_featured_multiplier := coalesce(v_featured_multiplier, 1);

  v_xp := floor((5 + 20 * greatest(0, least(accuracy, 100)) / 100)
                * v_featured_multiplier)::integer;
  v_coins := floor((2 + 8 * greatest(0, least(accuracy, 100)) / 100)
                   * v_featured_multiplier)::integer;

  insert into public.game_sessions(
    game_id, student_id, score, accuracy, xp_awarded,
    coins_awarded, time_spent_seconds
  )
  values (
    v_game_id, v_student_id, score, accuracy, v_xp,
    v_coins, duration
  )
  returning id into v_session_id;

  insert into public.xp_ledger(student_id, amount, source, reference_id)
  values (v_student_id, v_xp, 'game', v_session_id);

  insert into public.coin_ledger(student_id, amount, source, reference_id)
  values (v_student_id, v_coins, 'game', v_session_id);

  perform public.record_daily_activity(v_student_id);

  return jsonb_build_object(
    'session_id', v_session_id,
    'score', score,
    'accuracy', accuracy,
    'xp_awarded', v_xp,
    'coins_awarded', v_coins,
    'featured_multiplier', v_featured_multiplier
  );
end;
$$;

revoke all on function public.record_game_session(text, integer, numeric, integer) from public;
grant execute on function public.record_game_session(text, integer, numeric, integer)
  to authenticated;
