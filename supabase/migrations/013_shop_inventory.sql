-- Migration: 013_shop_inventory.sql
-- Description: Create schema for virtual arcade shop catalog, student item inventories, themes, and avatar cosmetics.
-- Task: BE-CORE-13

-- Table: shop_items
create table if not exists shop_items (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  name text not null,
  description text,
  category text not null,
  coin_price int not null,
  required_level int default 1,
  asset_url text,
  metadata jsonb,
  is_available boolean default true
);

-- Table: user_inventory
create table if not exists user_inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  item_id uuid not null references shop_items(id),
  purchased_at timestamptz default app_now(),
  is_equipped boolean default false,
  unique (user_id, item_id)
);

-- Table: avatar_assets
create table if not exists avatar_assets (
  id uuid primary key default gen_random_uuid(),
  asset_type text not null,
  name text not null,
  svg_data text,
  coin_price int default 0,
  is_default boolean default false
);

-- Indexes
create index if not exists idx_shop_items_sku on shop_items(sku);
create index if not exists idx_shop_items_category on shop_items(category);
create index if not exists idx_shop_items_available on shop_items(is_available);
create index if not exists idx_user_inventory_user on user_inventory(user_id);
create index if not exists idx_avatar_assets_type on avatar_assets(asset_type);

-- RLS Policies
enable row level security on shop_items;
create policy "Shop items are readable by all authenticated users"
  on shop_items for select using (true);

enable row level security on user_inventory;
create policy "Students manage own inventory"
  on user_inventory for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

enable row level security on avatar_assets;
create policy "Avatar assets are readable by all authenticated users"
  on avatar_assets for select using (true);