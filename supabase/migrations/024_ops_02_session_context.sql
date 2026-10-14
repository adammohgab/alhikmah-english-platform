create or replace function public.get_session_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_context jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;

  select p.*
    into v_profile
  from public.profiles p
  where p.id = v_user_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'account_inactive';
  end if;

  if v_profile.status <> 'active' then
    raise exception using errcode = 'P0001', message = 'account_inactive';
  end if;

  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'display_name', v_profile.display_name,
      'avatar_url', v_profile.avatar_url,
      'equipped_theme', v_profile.equipped_theme,
      'must_change_password', v_profile.must_change_password,
      'role', v_profile.role
    ),
    'active_role', v_profile.role,
    'permissions', jsonb_build_object(
      'can_administer', v_profile.role in ('admin', 'super_admin'),
      'can_teach', v_profile.role = 'teacher',
      'can_learn', v_profile.role = 'student'
    ),
    'enrolled_classes',
      case when v_profile.role = 'student' then
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'class_id', c.id,
            'name', c.name,
            'grade_level', c.grade_level
          ) order by c.name)
          from public.class_enrollments ce
          join public.classes c on c.id = ce.class_id
          where ce.student_id = v_user_id
            and ce.status = 'active'
            and c.is_archived is not true
        ), '[]'::jsonb)
      else '[]'::jsonb end,
    'teaching_classes',
      case when v_profile.role = 'teacher' then
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'class_id', c.id,
            'name', c.name,
            'grade_level', c.grade_level,
            'is_primary', ct.is_primary
          ) order by c.name)
          from public.class_teachers ct
          join public.classes c on c.id = ct.class_id
          where ct.teacher_id = v_user_id
            and c.is_archived is not true
        ), '[]'::jsonb)
      else '[]'::jsonb end,
    'unread_notifications', (
      select count(*) from public.notifications n
      where n.user_id = v_user_id and n.is_read = false
    ),
    'active_streak', coalesce((
      select ss.current_streak
      from public.student_stats ss
      where ss.student_id = v_user_id
    ), 0)
  )
  into v_context;

  return v_context;
end;
$$;

revoke all on function public.get_session_context() from public;
grant execute on function public.get_session_context() to authenticated;
