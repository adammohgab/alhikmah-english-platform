create or replace function public.get_public_state()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'maintenance_mode',
    coalesce(
      (select (ps.value ->> 'enabled')::boolean
       from public.platform_settings ps
       where ps.key = 'maintenance'),
      false
    ),
    'registration_enabled',
    coalesce(
      (select (ps.value ->> 'enabled')::boolean
       from public.platform_settings ps
       where ps.key = 'registration'),
      true
    ),
    'school_name',
    coalesce(
      (select ps.value ->> 'school_name'
       from public.platform_settings ps
       where ps.key = 'general'),
      ''
    ),
    'current_academic_year',
    coalesce(
      (select sy.name
       from public.school_years sy
       where sy.is_active is true
       order by sy.start_date desc nulls last
       limit 1),
      ''
    )
  );
$$;

create or replace function public.server_time()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select public.app_now();
$$;

revoke all on function public.get_public_state() from public;
revoke all on function public.server_time() from public;

grant execute on function public.get_public_state() to anon, authenticated;
grant execute on function public.server_time() to anon, authenticated;
