create or replace function public.purchase_shop_item(item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := auth.uid();
  v_item public.shop_items%rowtype;
  v_level integer;
  v_spend jsonb;
  v_inventory_id uuid;
begin
  if v_student_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_item
  from public.shop_items si
  where si.id = purchase_shop_item.item_id
  for update;

  if not found or v_item.is_available is not true then
    raise exception 'Shop item is unavailable' using errcode = 'P0002';
  end if;

  insert into public.student_stats(student_id)
  values (v_student_id)
  on conflict (student_id) do nothing;

  select ss.current_level into v_level
  from public.student_stats ss
  where ss.student_id = v_student_id
  for update;

  if v_level < coalesce(v_item.required_level, 1) then
    raise exception 'Required level not reached' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.user_inventory ui
    where ui.user_id = v_student_id and ui.item_id = v_item.id
  ) then
    raise exception 'Item already owned' using errcode = '23505';
  end if;

  v_spend := public.spend_coins(
    v_student_id, v_item.coin_price, 'shop_purchase', v_item.id
  );

  insert into public.user_inventory(user_id, item_id)
  values (v_student_id, v_item.id)
  returning id into v_inventory_id;

  return jsonb_build_object(
    'inventory_id', v_inventory_id,
    'item_id', v_item.id,
    'coins', v_spend
  );
end;
$$;

create or replace function public.equip_inventory_item(item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := auth.uid();
  v_item public.shop_items%rowtype;
  v_inventory_id uuid;
begin
  if v_student_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select si.*, ui.id
    into v_item, v_inventory_id
  from public.user_inventory ui
  join public.shop_items si on si.id = ui.item_id
  where ui.user_id = v_student_id
    and ui.item_id = equip_inventory_item.item_id
  for update of ui;

  if not found then
    raise exception 'Item is not in your inventory' using errcode = 'P0002';
  end if;

  if v_item.category = 'theme' then
    update public.profiles
       set equipped_theme = coalesce(v_item.metadata ->> 'theme', v_item.sku)
     where id = v_student_id;
  elsif v_item.category = 'avatar' then
    update public.profiles
       set avatar_url = v_item.asset_url
     where id = v_student_id;
  else
    raise exception 'This item cannot be equipped' using errcode = '22023';
  end if;

  update public.user_inventory
     set is_equipped = false
   where user_id = v_student_id
     and item_id in (
       select si.id from public.shop_items si
       where si.category = v_item.category
     );

  update public.user_inventory
     set is_equipped = true
   where id = v_inventory_id;

  return jsonb_build_object('ok', true, 'item_id', item_id);
end;
$$;

revoke all on function public.purchase_shop_item(uuid) from public;
revoke all on function public.equip_inventory_item(uuid) from public;
grant execute on function public.purchase_shop_item(uuid) to authenticated;
grant execute on function public.equip_inventory_item(uuid) to authenticated;
