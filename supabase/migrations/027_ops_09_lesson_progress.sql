create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  is_completed boolean not null default false,
  completed_at timestamptz,
  last_accessed_at timestamptz not null default public.app_now(),
  unique (student_id, lesson_id)
);

create table if not exists public.activity_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  activity_id uuid not null,
  answers jsonb not null default '{}'::jsonb,
  score numeric(5,2),
  completed_at timestamptz,
  unique (student_id, activity_id)
);

create index if not exists idx_lesson_progress_student
  on public.lesson_progress(student_id, last_accessed_at desc);
create index if not exists idx_activity_progress_student
  on public.activity_progress(student_id, completed_at desc);

create or replace function public.complete_lesson(lesson_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := auth.uid();
  v_unit_id uuid;
  v_course_id uuid;
  v_xp integer;
  v_coins integer;
  v_first boolean;
  v_xp_result jsonb;
  v_coin_result jsonb;
  v_unlocked uuid[] := '{}';
begin
  if v_student_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select l.unit_id, u.course_id, l.xp_reward, l.coin_reward
    into v_unit_id, v_course_id, v_xp, v_coins
  from public.lessons l
  join public.units u on u.id = l.unit_id
  where l.id = complete_lesson.lesson_id;

  if not found then
    raise exception 'Lesson not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.profiles p
    join public.class_enrollments ce on ce.student_id = p.id
    join public.class_courses cc on cc.class_id = ce.class_id
    where p.id = v_student_id
      and p.role::text = 'student'
      and p.status::text = 'active'
      and ce.status = 'active'
      and cc.course_id = v_course_id
      and cc.is_active
  ) then
    raise exception 'Active enrollment in this course is required'
      using errcode = '42501';
  end if;

  insert into public.lesson_progress(student_id, lesson_id)
  values (v_student_id, complete_lesson.lesson_id)
  on conflict (student_id, lesson_id) do nothing;

  select not lp.is_completed
    into v_first
  from public.lesson_progress lp
  where lp.student_id = v_student_id
    and lp.lesson_id = complete_lesson.lesson_id
  for update;

  update public.lesson_progress
     set is_completed = true,
         completed_at = coalesce(completed_at, public.app_now()),
         last_accessed_at = public.app_now()
   where student_id = v_student_id
     and lesson_id = complete_lesson.lesson_id;

  if v_first then
    v_xp_result := public.award_xp(
      v_student_id, coalesce(v_xp, 20), 'lesson', complete_lesson.lesson_id
    );
    v_coin_result := public.award_coins(
      v_student_id, coalesce(v_coins, 5), 'lesson', complete_lesson.lesson_id
    );
  else
    v_xp_result := jsonb_build_object('awarded_xp', 0, 'repeat', true);
    v_coin_result := jsonb_build_object('amount_awarded', 0);
  end if;

  perform public.record_daily_activity(v_student_id);

  with completed_unit as (
    select u.id, u.course_id, u.order_index
    from public.units u
    where u.id = v_unit_id
      and not exists (
        select 1
        from public.lessons l
        left join public.lesson_progress lp
          on lp.lesson_id = l.id
         and lp.student_id = v_student_id
        where l.unit_id = u.id
          and coalesce(lp.is_completed, false) = false
      )
  ),
  next_unit as (
    select u.id, u.course_id
    from completed_unit cu
    join lateral (
      select un.id, un.course_id
      from public.units un
      where un.course_id = cu.course_id
        and un.order_index > cu.order_index
      order by un.order_index
      limit 1
    ) u on true
  )
  insert into public.class_unlock_overrides
    (class_id, student_id, target_type, target_id, is_unlocked, reason)
  select ce.class_id, v_student_id, 'unit', nu.id, true, 'Previous unit completed'
  from next_unit nu
  join public.class_courses cc on cc.course_id = nu.course_id and cc.is_active
  join public.class_enrollments ce
    on ce.class_id = cc.class_id
   and ce.student_id = v_student_id
   and ce.status = 'active'
  where not exists (
    select 1
    from public.class_unlock_overrides o
    where o.class_id = ce.class_id
      and o.student_id = v_student_id
      and o.target_type = 'unit'
      and o.target_id = nu.id
      and o.is_unlocked
  )
  returning target_id into v_unlocked;

  return jsonb_build_object(
    'lesson_id', complete_lesson.lesson_id,
    'completed', true,
    'first_completion', v_first,
    'xp', v_xp_result,
    'coins', v_coin_result,
    'unlocked_unit_ids', to_jsonb(v_unlocked)
  );
end;
$$;

create or replace function public.submit_activity(
  activity_id uuid,
  answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := auth.uid();
  v_lesson_id uuid;
  v_score numeric(5,2);
begin
  if v_student_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if answers is null or jsonb_typeof(answers) not in ('object', 'array') then
    raise exception 'Answers must be a JSON object or array'
      using errcode = '22023';
  end if;

  select lb.lesson_id
    into v_lesson_id
  from public.lesson_blocks lb
  where lb.id = submit_activity.activity_id
    and lb.block_type = 'check';

  if not found then
    raise exception 'Activity not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.lesson_progress lp
    where lp.student_id = v_student_id
      and lp.lesson_id = v_lesson_id
  ) then
    insert into public.lesson_progress(student_id, lesson_id)
    values (v_student_id, v_lesson_id)
    on conflict (student_id, lesson_id) do nothing;
  end if;

  v_score := null;

  insert into public.activity_progress
    (student_id, activity_id, answers, score, completed_at)
  values
    (v_student_id, submit_activity.activity_id, answers, v_score, public.app_now())
  on conflict (student_id, activity_id)
  do update set
    answers = excluded.answers,
    score = excluded.score,
    completed_at = excluded.completed_at;

  perform public.record_daily_activity(v_student_id);

  return jsonb_build_object(
    'activity_id', submit_activity.activity_id,
    'completed', true,
    'score', v_score
  );
end;
$$;

revoke all on function public.complete_lesson(uuid) from public;
revoke all on function public.submit_activity(uuid, jsonb) from public;
grant execute on function public.complete_lesson(uuid) to authenticated;
grant execute on function public.submit_activity(uuid, jsonb) to authenticated;
