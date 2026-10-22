-- ST-28: let a student save only their own generated avatar SVG.
-- A security-definer RPC is used because profiles intentionally has no broad
-- student UPDATE policy (display_name, role and status must remain protected).
create or replace function public.save_student_avatar(p_avatar_url text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Sign in to save your avatar.' using errcode = '28000';
  end if;

  if p_avatar_url is null
     or length(p_avatar_url) > 12000
     or p_avatar_url !~ '^data:image/svg\+xml,' then
    raise exception 'Choose a valid avatar design.' using errcode = '22023';
  end if;

  update public.profiles
     set avatar_url = p_avatar_url
   where id = v_user_id
     and role = 'student'
     and status = 'active';

  if not found then
    raise exception 'Your active student profile could not be found.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.save_student_avatar(text) from public;
grant execute on function public.save_student_avatar(text) to authenticated;
