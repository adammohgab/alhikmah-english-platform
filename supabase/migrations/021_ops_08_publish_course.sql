-- Task: BE-OPS-08

alter table public.courses
  add column if not exists published_at timestamptz;

create or replace function public._prevent_content_snapshot_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Content snapshots are immutable' using errcode = '55000';
end;
$$;

drop trigger if exists content_snapshots_immutable
  on public.content_snapshots;

create trigger content_snapshots_immutable
before update or delete on public.content_snapshots
for each row
execute function public._prevent_content_snapshot_mutation();

create or replace function public._publish_course_snapshot(p_course_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_course public.courses%rowtype;
  v_lesson_count integer;
  v_unit_count integer;
  v_version integer;
  v_snapshot jsonb;
  v_class_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select p.role::text into v_role
  from public.profiles p
  where p.id = v_user_id
    and p.status::text = 'active';

  if v_role is null then
    raise exception 'Active profile required' using errcode = '42501';
  end if;

  select c.* into v_course
  from public.courses c
  where c.id = p_course_id
  for update;

  if not found then
    raise exception 'Course not found' using errcode = 'P0002';
  end if;

  if v_role not in ('admin', 'super_admin')
     and (v_role <> 'teacher' or v_course.author_id is distinct from v_user_id) then
    raise exception 'Only the course author or an admin can publish this course'
      using errcode = '42501';
  end if;

  select count(*) into v_unit_count
  from public.units u
  where u.course_id = p_course_id;

  if v_unit_count < 1 then
    raise exception 'A course must contain at least one unit' using errcode = '22023';
  end if;

  select count(*) into v_lesson_count
  from public.units u
  join public.lessons l on l.unit_id = u.id
  where u.course_id = p_course_id;

  if v_lesson_count < 1 then
    raise exception 'A course must contain at least one lesson' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.units u
    join public.lessons l on l.unit_id = u.id
    where u.course_id = p_course_id
      and (
        pg_catalog.length(pg_catalog.btrim(l.title)) = 0
        or not exists (
          select 1
          from public.lesson_blocks b
          where b.lesson_id = l.id
            and pg_catalog.jsonb_typeof(b.content) = 'object'
            and b.content <> '{}'::jsonb
        )
      )
  ) then
    raise exception 'Every lesson must have a title and at least one non-empty content block'
      using errcode = '22023';
  end if;

  select coalesce(max(cs.version_number), 0) + 1
  into v_version
  from public.content_snapshots cs
  where cs.course_id = p_course_id;

  update public.courses
  set status = 'published',
      published_at = pg_catalog.now()
  where id = p_course_id;

  select pg_catalog.jsonb_build_object(
    'course', pg_catalog.to_jsonb(c),
    'units', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.to_jsonb(u) || pg_catalog.jsonb_build_object(
          'lessons', coalesce((
            select pg_catalog.jsonb_agg(
              pg_catalog.to_jsonb(l) || pg_catalog.jsonb_build_object(
                'blocks', coalesce((
                  select pg_catalog.jsonb_agg(
                    pg_catalog.to_jsonb(b)
                    order by b.order_index, b.id
                  )
                  from public.lesson_blocks b
                  where b.lesson_id = l.id
                ), '[]'::jsonb)
              )
              order by l.order_index, l.id
            )
            from public.lessons l
            where l.unit_id = u.id
          ), '[]'::jsonb)
        )
        order by u.order_index, u.id
      )
      from public.units u
      where u.course_id = p_course_id
    ), '[]'::jsonb),
    'question_references', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(q) order by q.id)
      from (
        select distinct questions.*
        from public.class_courses cc
        join public.assessments a on a.class_id = cc.class_id
        join public.assessment_questions aq on aq.assessment_id = a.id
        join public.questions on questions.id = aq.question_id
        where cc.course_id = p_course_id
      ) q
    ), '[]'::jsonb)
  )
  into v_snapshot
  from public.courses c
  where c.id = p_course_id;

  insert into public.content_snapshots (
    course_id,
    version_number,
    snapshot_data,
    published_by,
    published_at
  )
  values (
    p_course_id,
    v_version,
    v_snapshot,
    v_user_id,
    pg_catalog.now()
  );

  for v_class_id in
    select cc.class_id
    from public.class_courses cc
    where cc.course_id = p_course_id
      and cc.is_active = true
    order by cc.class_id
  loop
    perform realtime.send(
      pg_catalog.jsonb_build_object(
        'course_id', p_course_id,
        'version', v_version,
        'title', v_course.title
      ),
      'course_published',
      'class:' || v_class_id::text,
      true
    );
  end loop;

  return pg_catalog.jsonb_build_object(
    'course_id', p_course_id,
    'published_version', v_version,
    'published_at', pg_catalog.now(),
    'snapshot_id', (
      select cs.id
      from public.content_snapshots cs
      where cs.course_id = p_course_id
        and cs.version_number = v_version
    )
  );
end;
$$;

create or replace function public.publish_course(course_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public._publish_course_snapshot($1);
$$;

create or replace function public.publish_course_changes(course_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public._publish_course_snapshot($1);
$$;

revoke all on function public._prevent_content_snapshot_mutation() from public;
revoke all on function public._publish_course_snapshot(uuid) from public;
revoke all on function public.publish_course(uuid) from public;
revoke all on function public.publish_course_changes(uuid) from public;

grant execute on function public._publish_course_snapshot(uuid) to authenticated;
grant execute on function public.publish_course(uuid) to authenticated;
grant execute on function public.publish_course_changes(uuid) to authenticated;
