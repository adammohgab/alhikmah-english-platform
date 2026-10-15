create or replace function public.evaluate_badges_for_student(
  student_id uuid,
  event_type text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_badge record;
  v_stats public.student_stats%rowtype;
  v_new_badges jsonb := '[]'::jsonb;
  v_threshold integer;
  v_met boolean;
begin
  if auth.uid() is null
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if auth.uid() is not null
     and auth.uid() <> evaluate_badges_for_student.student_id
     and coalesce(auth.role(), '') <> 'service_role'
     and not exists (
       select 1 from public.profiles p
       where p.id = auth.uid()
         and p.role::text in ('admin', 'super_admin')
         and p.status::text = 'active'
     ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  insert into public.student_stats(student_id)
  values (evaluate_badges_for_student.student_id)
  on conflict (student_id) do nothing;

  select * into v_stats
  from public.student_stats ss
  where ss.student_id = evaluate_badges_for_student.student_id;

  for v_badge in
    select bd.*
    from public.badge_definitions bd
    where not exists (
      select 1 from public.user_badges ub
      where ub.student_id = evaluate_badges_for_student.student_id
        and ub.badge_id = bd.id
    )
  loop
    v_threshold := coalesce(
      (v_badge.requirement_json ->> 'threshold')::integer,
      (v_badge.requirement_json ->> 'days')::integer,
      (v_badge.requirement_json ->> 'count')::integer,
      0
    );

    v_met := case
      when event_type = 'streak'
        and v_badge.category = 'streak'
        then v_stats.current_streak >= v_threshold
      when event_type = 'xp'
        and v_badge.category in ('xp', 'milestone')
        then v_stats.total_xp >= v_threshold
      when event_type = 'quiz'
        and v_badge.category = 'quiz'
        then exists (
          select 1
          from public.assessment_attempts aa
          where aa.student_id = evaluate_badges_for_student.student_id
            and aa.status = 'graded'
            and aa.max_score > 0
            and aa.score = aa.max_score
        )
      when event_type = 'lesson'
        and v_badge.category in ('reading', 'lessons')
        then (
          select count(*) >= v_threshold
          from public.lesson_progress lp
          where lp.student_id = evaluate_badges_for_student.student_id
            and lp.is_completed
        )
      else false
    end;

    if v_threshold > 0 and v_met then
      insert into public.user_badges(student_id, badge_id)
      values (evaluate_badges_for_student.student_id, v_badge.id)
      on conflict (student_id, badge_id) do nothing;

      if found then
        insert into public.notifications(user_id, kind, title, body, payload)
        values (
          evaluate_badges_for_student.student_id,
          'badge_earned',
          'New badge earned',
          v_badge.name,
          jsonb_build_object('badge_id', v_badge.id, 'code', v_badge.code)
        );

        v_new_badges := v_new_badges || jsonb_build_array(
          jsonb_build_object('id', v_badge.id, 'code', v_badge.code, 'name', v_badge.name)
        );
      end if;
    end if;
  end loop;

  return jsonb_build_object('student_id', student_id, 'earned', v_new_badges);
end;
$$;

create or replace function public.pin_badges(student_id uuid, badge_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_count integer;
begin
  if v_actor is null or v_actor <> pin_badges.student_id then
    raise exception 'You can only pin your own badges' using errcode = '42501';
  end if;

  if coalesce(cardinality(badge_ids), 0) > 3
     or cardinality(badge_ids) <> (
       select count(distinct x) from unnest(coalesce(badge_ids, '{}')) x
     ) then
    raise exception 'Choose up to three distinct badges' using errcode = '22023';
  end if;

  perform 1 from public.user_badges ub
  where ub.student_id = pin_badges.student_id
  for update;

  if exists (
    select 1 from unnest(coalesce(badge_ids, '{}')) requested(id)
    where not exists (
      select 1 from public.user_badges ub
      where ub.student_id = pin_badges.student_id
        and ub.badge_id = requested.id
    )
  ) then
    raise exception 'You can only pin badges you have earned' using errcode = '22023';
  end if;

  update public.user_badges
     set is_pinned = (badge_id = any(coalesce(badge_ids, '{}')))
   where user_badges.student_id = pin_badges.student_id;

  get diagnostics v_count = row_count;

  return jsonb_build_object('pinned', coalesce(to_jsonb(badge_ids), '[]'::jsonb));
end;
$$;

revoke all on function public.evaluate_badges_for_student(uuid, text) from public;
revoke all on function public.pin_badges(uuid, uuid[]) from public;
grant execute on function public.evaluate_badges_for_student(uuid, text)
  to authenticated, service_role;
grant execute on function public.pin_badges(uuid, uuid[]) to authenticated;
