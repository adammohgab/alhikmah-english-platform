create or replace function public.award_coins(
  student_id uuid,
  amount integer,
  source text,
  ref_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_student_role text;
  v_balance bigint;
  v_ledger_id uuid;
begin
  if amount is null or amount <= 0 then
    raise exception 'Coin award must be greater than zero'
      using errcode = '22023';
  end if;

  if source is null or length(btrim(source)) = 0 or length(source) > 100 then
    raise exception 'Source must contain 1 to 100 characters'
      using errcode = '22023';
  end if;

  select p.role::text
    into v_student_role
  from public.profiles p
  where p.id = award_coins.student_id
    and p.status::text = 'active';

  if v_student_role is distinct from 'student' then
    raise exception 'An active student profile is required'
      using errcode = '22023';
  end if;

  if coalesce(auth.role(), '') <> 'service_role' then
    if v_actor_id is null then
      raise exception 'Authentication required' using errcode = '42501';
    end if;

    if v_actor_id <> award_coins.student_id then
      select p.role::text
        into v_actor_role
      from public.profiles p
      where p.id = v_actor_id
        and p.status::text = 'active';

      if v_actor_role not in ('admin', 'super_admin')
         and not (
           v_actor_role = 'teacher'
           and exists (
             select 1
             from public.class_teachers ct
             join public.class_enrollments ce
               on ce.class_id = ct.class_id
             where ct.teacher_id = v_actor_id
               and ce.student_id = award_coins.student_id
               and ce.status = 'active'
           )
         ) then
        raise exception 'Not authorized to award coins to this student'
          using errcode = '42501';
      end if;
    end if;
  end if;

  insert into public.student_stats (student_id)
  values (award_coins.student_id)
  on conflict (student_id) do nothing;

  perform 1
  from public.student_stats ss
  where ss.student_id = award_coins.student_id
  for update;

  insert into public.coin_ledger (student_id, amount, source, reference_id)
  values (
    award_coins.student_id,
    amount,
    btrim(source),
    ref_id
  )
  returning id into v_ledger_id;

  select ss.current_coins
    into v_balance
  from public.student_stats ss
  where ss.student_id = award_coins.student_id;

  return jsonb_build_object(
    'student_id', award_coins.student_id,
    'amount_awarded', amount,
    'balance', v_balance,
    'ledger_id', v_ledger_id
  );
end;
$$;


create or replace function public.spend_coins(
  student_id uuid,
  amount integer,
  reason text,
  item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_balance bigint;
  v_ledger_id uuid;
begin
  if amount is null or amount <= 0 then
    raise exception 'Spend amount must be greater than zero'
      using errcode = '22023';
  end if;

  if reason is null or length(btrim(reason)) = 0 or length(reason) > 200 then
    raise exception 'A reason of 1 to 200 characters is required'
      using errcode = '22023';
  end if;

  if v_actor_id is null or v_actor_id <> spend_coins.student_id then
    raise exception 'You can only spend your own coins'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = spend_coins.student_id
      and p.role::text = 'student'
      and p.status::text = 'active'
  ) then
    raise exception 'An active student profile is required'
      using errcode = '22023';
  end if;

  insert into public.student_stats (student_id)
  values (spend_coins.student_id)
  on conflict (student_id) do nothing;

  select ss.current_coins
    into v_balance
  from public.student_stats ss
  where ss.student_id = spend_coins.student_id
  for update;

  if v_balance < amount then
    raise exception 'Insufficient coins'
      using errcode = 'P0001';
  end if;

  if item_id is not null and not exists (
    select 1
    from public.shop_items si
    where si.id = spend_coins.item_id
      and si.is_available is true
      and si.coin_price = spend_coins.amount
  ) then
    raise exception 'Shop item is unavailable or price does not match'
      using errcode = 'P0001';
  end if;

  insert into public.coin_ledger (student_id, amount, source, reference_id)
  values (
    spend_coins.student_id,
    -amount,
    btrim(reason),
    item_id
  )
  returning id into v_ledger_id;

  select ss.current_coins
    into v_balance
  from public.student_stats ss
  where ss.student_id = spend_coins.student_id;

  return jsonb_build_object(
    'student_id', spend_coins.student_id,
    'amount_spent', amount,
    'balance', v_balance,
    'ledger_id', v_ledger_id
  );
end;
$$;


revoke all on function public.award_coins(uuid, integer, text, uuid) from public;
revoke all on function public.spend_coins(uuid, integer, text, uuid) from public;

grant execute on function public.award_coins(uuid, integer, text, uuid)
  to authenticated, service_role;
grant execute on function public.spend_coins(uuid, integer, text, uuid)
  to authenticated;
