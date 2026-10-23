-- TCH-AI-19: restore a published immutable snapshot into the editable course draft.
-- Historical content_snapshots rows are never updated or deleted by this function.
create or replace function public.restore_course_snapshot(
  p_course_id uuid,
  p_snapshot_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_course public.courses%rowtype;
  v_snapshot public.content_snapshots%rowtype;
  v_course_json jsonb;
  v_unit jsonb;
  v_lesson jsonb;
  v_block jsonb;
  v_unit_id uuid;
  v_lesson_id uuid;
  v_units_count integer := 0;
  v_lessons_count integer := 0;
  v_blocks_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select p.role::text into v_role
  from public.profiles p
  where p.id = v_user_id and p.status::text = 'active';

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
    raise exception 'Only the course author or an admin can restore this course'
      using errcode = '42501';
  end if;

  select cs.* into v_snapshot
  from public.content_snapshots cs
  where cs.id = p_snapshot_id and cs.course_id = p_course_id;
  if not found then
    raise exception 'Snapshot does not belong to this course' using errcode = '22023';
  end if;

  v_course_json := coalesce(v_snapshot.snapshot_data->'course', '{}'::jsonb);
  if jsonb_typeof(v_snapshot.snapshot_data->'units') is distinct from 'array' then
    raise exception 'Snapshot has no valid units array' using errcode = '22023';
  end if;

  -- Keep ownership and slug stable, and restore content as an unpublished draft.
  update public.courses
  set title = coalesce(nullif(v_course_json->>'title', ''), v_course.title),
      description = v_course_json->>'description',
      grade_level = v_course_json->>'grade_level',
      cover_image = v_course_json->>'cover_image',
      position = coalesce((v_course_json->>'position')::integer, v_course.position),
      status = 'draft',
      updated_at = pg_catalog.now()
  where id = p_course_id;

  delete from public.units where course_id = p_course_id;

  for v_unit in select value from jsonb_array_elements(coalesce(v_snapshot.snapshot_data->'units', '[]'::jsonb))
  loop
    insert into public.units (course_id, title, description, order_index)
    values (
      p_course_id,
      coalesce(nullif(v_unit->>'title', ''), 'Untitled unit'),
      v_unit->>'description',
      coalesce((v_unit->>'order_index')::integer, v_units_count)
    ) returning id into v_unit_id;
    v_units_count := v_units_count + 1;

    for v_lesson in select value from jsonb_array_elements(coalesce(v_unit->'lessons', '[]'::jsonb))
    loop
      insert into public.lessons (unit_id, title, description, xp_reward, coin_reward, order_index)
      values (
        v_unit_id,
        coalesce(nullif(v_lesson->>'title', ''), 'Untitled lesson'),
        v_lesson->>'description',
        coalesce((v_lesson->>'xp_reward')::integer, 20),
        coalesce((v_lesson->>'coin_reward')::integer, 5),
        coalesce((v_lesson->>'order_index')::integer, v_lessons_count)
      ) returning id into v_lesson_id;
      v_lessons_count := v_lessons_count + 1;

      for v_block in select value from jsonb_array_elements(coalesce(v_lesson->'blocks', '[]'::jsonb))
      loop
        insert into public.lesson_blocks (lesson_id, block_type, content, order_index)
        values (
          v_lesson_id,
          coalesce(nullif(v_block->>'block_type', ''), 'text'),
          case when jsonb_typeof(v_block->'content') = 'object' then v_block->'content' else '{}'::jsonb end,
          coalesce((v_block->>'order_index')::integer, v_blocks_count)
        );
        v_blocks_count := v_blocks_count + 1;
      end loop;
    end loop;
  end loop;

  return jsonb_build_object(
    'course_id', p_course_id,
    'restored_snapshot_id', p_snapshot_id,
    'restored_version', v_snapshot.version_number,
    'status', 'draft',
    'units_restored', v_units_count,
    'lessons_restored', v_lessons_count,
    'blocks_restored', v_blocks_count
  );
end;
$$;

revoke all on function public.restore_course_snapshot(uuid, uuid) from public;
grant execute on function public.restore_course_snapshot(uuid, uuid) to authenticated;
