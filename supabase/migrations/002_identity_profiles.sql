-- Table: profiles
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  username citext unique,
  display_name text not null,
  -- Read-only alias for screens that call the display name "full_name".
  full_name text generated always as (display_name) stored,
  role user_role not null default 'student',
  status user_status not null default 'active',
  avatar_url text,
  equipped_theme text,
  must_change_password boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table: user_settings
create table user_settings (
  user_id uuid primary key references profiles on delete cascade,
  sound_enabled boolean default true,
  effects_tier text default 'balanced',
  prefers_reduced_motion boolean default false,
  notifications_json jsonb,
  updated_at timestamptz not null default now()
);

-- Table: admin_notes
create table admin_notes (
  id uuid primary key,
  user_id uuid references profiles not null,
  author_id uuid references profiles not null,
  note text not null,
  created_at timestamptz not null default now()
);

-- Trigger: set updated_at on profiles
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on profiles
  for each row
  execute function set_updated_at();

-- Trigger: set updated_at on user_settings
create trigger user_settings_updated_at
  before update on user_settings
  for each row
  execute function set_updated_at();