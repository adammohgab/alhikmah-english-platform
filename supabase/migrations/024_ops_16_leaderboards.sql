create index if not exists idx_xp_ledger_student_created
  on public.xp_ledger (student_id, created_at);

create or replace function public.get_leaderboard(
  class_id uuid,
  timeframe text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_start timestamptz;
  v_is_private boolean := false;
  v_rows jsonb;
  v_my_rank bigint;
begin
  if v_actor_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if timeframe not in ('week', 'month', 'all_time') then
    raise exception 'Timeframe must be week, month, or all_time'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.class_enrollments ce
    where ce.class_id = get_leaderboard.class_id
      and ce.student_id = v_actor_id
      and ce.status = 'active'
  ) and not exists (
    select 1
    from public.class_teachers ct
    where ct.class_id = get_leaderboard.class_id
      and ct.teacher_id = v_actor_id
  ) and not exists (
    select 1
    from public.profiles p
    where p.id = v_actor_id
      and p.role::text in ('admin', 'super_admin')
      and p.status::text = 'active'
  ) then
    raise exception 'Not authorized to view this class leaderboard'
      using errcode = '42501';
  end if;

  if timeframe = 'week' then
    v_start := date_trunc('week', public.app_now());
  elsif timeframe = 'month' then
    v_start := date_trunc('month', public.app_now());
  end if;

  -- The current schema has no class-specific privacy column.
  -- Use the documented platform default for leaderboard privacy.
  select coalesce((ps.value #>> '{preferences,leaderboard_privacy_default}')::boolean, false)
    into v_is_private
  from public.platform_settings ps
  where ps.key = 'preferences';

  v_is_private := coalesce(v_is_private, false);

  with class_students as (
    select ce.student_id
    from public.class_enrollments ce
    where ce.class_id = get_leaderboard.class_id
      and ce.status = 'active'
  ),
  scores as (
    select
      cs.student_id,
      coalesce(sum(xl.amount), 0)::bigint as xp,
      min(xl.created_at) as first_xp_at
    from class_students cs
    left join public.xp_ledger xl
      on xl.student_id = cs.student_id
     and (v_start is null or xl.created_at >= v_start)
    group by cs.student_id
  ),
  ranked as (
    select
      row_number() over (
        order by s.xp desc, s.first_xp_at asc nulls last, s.student_id
      ) as rank,
      s.student_id,
      s.xp
    from scores s
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'rank', r.rank,
          'student_id', r.student_id,
          'display_name',
            case
              when v_is_private and r.student_id <> v_actor_id
                then 'Student ' || r.rank::text
              else p.display_name
            end,
          'avatar_url',
            case
              when v_is_private and r.student_id <> v_actor_id then null
              else p.avatar_url
            end,
          'equipped_badge', badge.badge,
          'xp', r.xp
        )
        order by r.rank
      ),
      '[]'::jsonb
    ),
    max(r.rank) filter (where r.student_id = v_actor_id)
  into v_rows, v_my_rank
  from ranked r
  join public.profiles p on p.id = r.student_id
  left join lateral (
    select jsonb_build_object(
      'id', bd.id,
      'name', bd.name,
      'icon_url', bd.icon_url
    ) as badge
    from public.user_badges ub
    join public.badge_definitions bd on bd.id = ub.badge_id
    where ub.student_id = r.student_id
      and ub.is_pinned is true
    order by ub.awarded_at desc
    limit 1
  ) badge on true;

  return jsonb_build_object(
    'class_id', get_leaderboard.class_id,
    'timeframe', timeframe,
    'my_rank', v_my_rank,
    'entries', v_rows
  );
end;
$$;

revoke all on function public.get_leaderboard(uuid, text) from public;
grant execute on function public.get_leaderboard(uuid, text) to authenticated;
