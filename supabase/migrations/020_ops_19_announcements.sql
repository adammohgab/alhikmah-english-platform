-- Task: BE-OPS-19

-- Allow active users to receive school-wide or their own class broadcasts.
do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
      and policyname = 'Active users can receive announcement broadcasts'
  ) then
    execute $policy$
      create policy "Active users can receive announcement broadcasts"
      on realtime.messages
      for select
      to authenticated
      using (
        extension = 'broadcast'
        and exists (
          select 1
          from public.profiles p
          where p.id = (select auth.uid())
            and p.status::text = 'active'
            and (
              (select realtime.topic()) = 'platform'
              or exists (
                select 1
                from public.class_enrollments ce
                where (select realtime.topic()) = 'class:' || ce.class_id::text
                  and ce.student_id = p.id
                  and ce.status = 'active'
              )
              or exists (
                select 1
                from public.class_teachers ct
                where (select realtime.topic()) = 'class:' || ct.class_id::text
                  and ct.teacher_id = p.id
              )
            )
        )
      )
    $policy$;
  end if;
end;
$$;

-- Fan out recipients in batches and broadcast urgent announcements.
create or replace function public._fanout_announcement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_ids uuid[];
  v_offset integer := 0;
begin
  loop
    if new.target_type = 'school' then
      select coalesce(
        pg_catalog.array_agg(targets.id order by targets.id),
        array[]::uuid[]
      )
      into v_user_ids
      from (
        select p.id
        from public.profiles p
        where p.status::text = 'active'
        order by p.id
        limit 500 offset v_offset
      ) targets;
    else
      select coalesce(
        pg_catalog.array_agg(targets.id order by targets.id),
        array[]::uuid[]
      )
      into v_user_ids
      from (
        select distinct p.id
        from public.profiles p
        where p.status::text = 'active'
          and (
            exists (
              select 1
              from public.class_enrollments ce
              where ce.class_id = new.target_class_id
                and ce.student_id = p.id
                and ce.status = 'active'
            )
            or exists (
              select 1
              from public.class_teachers ct
              where ct.class_id = new.target_class_id
                and ct.teacher_id = p.id
            )
          )
        order by p.id
        limit 500 offset v_offset
      ) targets;
    end if;

    exit when pg_catalog.cardinality(v_user_ids) = 0;

    insert into public.announcement_recipients (announcement_id, user_id)
    select new.id, recipient_id
    from pg_catalog.unnest(v_user_ids) as recipients(recipient_id)
    on conflict (announcement_id, user_id) do nothing;

    insert into public.notifications (
      user_id, kind, title, body, payload, link, priority
    )
    select
      recipient_id,
      'announcement',
      new.title,
      new.body,
      pg_catalog.jsonb_build_object('announcement_id', new.id),
      '/announcements/' || new.id::text,
      new.priority
    from pg_catalog.unnest(v_user_ids) as recipients(recipient_id);

    v_offset := v_offset + 500;
  end loop;

  if new.priority = 'urgent' and new.status = 'published' then
    perform realtime.send(
      pg_catalog.jsonb_build_object(
        'announcement_id', new.id,
        'title', new.title,
        'body', new.body,
        'priority', new.priority,
        'target_type', new.target_type,
        'target_class_id', new.target_class_id
      ),
      'urgent_announcement',
      case
        when new.target_type = 'class'
          then 'class:' || new.target_class_id::text
        else 'platform'
      end,
      true
    );
  end if;

  return new;
end;
$$;

create trigger announcements_fanout_after_insert
after insert on public.announcements
for each row
when (new.status = 'published')
execute function public._fanout_announcement();

create or replace function public.publish_announcement(
  p_title text,
  p_body text,
  p_priority text,
  p_target_type text,
  p_target_class_id uuid default null,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_announcement_id uuid;
  v_recipient_count bigint;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_title is null
     or pg_catalog.length(pg_catalog.btrim(p_title)) = 0
     or pg_catalog.length(p_title) > 200 then
    raise exception 'Title must contain 1 to 200 characters' using errcode = '22023';
  end if;

  if p_body is null
     or pg_catalog.length(pg_catalog.btrim(p_body)) = 0
     or pg_catalog.length(p_body) > 20000 then
    raise exception 'Body must contain 1 to 20000 characters' using errcode = '22023';
  end if;

  if p_priority is null
     or p_priority not in ('normal', 'important', 'urgent') then
    raise exception 'Invalid announcement priority' using errcode = '22023';
  end if;

  if p_target_type is null
     or p_target_type not in ('school', 'class') then
    raise exception 'Target type must be school or class' using errcode = '22023';
  end if;

  if (p_target_type = 'class' and p_target_class_id is null)
     or (p_target_type = 'school' and p_target_class_id is not null) then
    raise exception 'A class target requires a class id; a school target must not include one'
      using errcode = '22023';
  end if;

  if p_expires_at is not null and p_expires_at <= pg_catalog.now() then
    raise exception 'Expiry time must be in the future' using errcode = '22023';
  end if;

  select p.role::text
  into v_role
  from public.profiles p
  where p.id = v_user_id
    and p.status::text = 'active';

  if v_role is null then
    raise exception 'Active profile required' using errcode = '42501';
  end if;

  if v_role not in ('admin', 'super_admin') then
    if v_role <> 'teacher'
       or p_target_type <> 'class'
       or not exists (
         select 1
         from public.class_teachers ct
         where ct.class_id = p_target_class_id
           and ct.teacher_id = v_user_id
       ) then
      raise exception 'Not authorized to publish for this audience' using errcode = '42501';
    end if;
  end if;

  if p_target_type = 'class' and not exists (
    select 1
    from public.classes c
    where c.id = p_target_class_id
  ) then
    raise exception 'Target class does not exist' using errcode = '23503';
  end if;

  insert into public.announcements (
    author_id,
    title,
    body,
    priority,
    audience,
    target_type,
    target_class_id,
    status,
    publish_at,
    expires_at
  )
  values (
    v_user_id,
    pg_catalog.btrim(p_title),
    p_body,
    p_priority,
    case
      when p_target_type = 'school' then '{"type":"all"}'::jsonb
      else pg_catalog.jsonb_build_object(
        'type', 'classes',
        'ids', pg_catalog.jsonb_build_array(p_target_class_id)
      )
    end,
    p_target_type,
    p_target_class_id,
    'published',
    pg_catalog.now(),
    p_expires_at
  )
  returning id into v_announcement_id;

  select count(*)
  into v_recipient_count
  from public.announcement_recipients ar
  where ar.announcement_id = v_announcement_id;

  return pg_catalog.jsonb_build_object(
    'announcement_id', v_announcement_id,
    'recipients', v_recipient_count,
    'status', 'published'
  );
end;
$$;

revoke all on function public._fanout_announcement() from public;
revoke all on function public.publish_announcement(
  text, text, text, text, uuid, timestamptz
) from public;

grant execute on function public.publish_announcement(
  text, text, text, text, uuid, timestamptz
) to authenticated;
