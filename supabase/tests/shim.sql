-- Minimal Supabase compatibility layer for plain PostgreSQL 15 or newer.
-- It gives migrations what the hosted platform provides: the API roles, the `auth`, `realtime`
-- and `extensions` schemas, and the JWT helper functions. It exists only for the migration
-- check (supabase/tests/apply-migrations.sh) and never runs in a real project.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists realtime;
create schema if not exists storage;

grant usage on schema extensions to anon, authenticated, service_role;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

alter database :"dbname" set search_path = "$user", public, extensions;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  encrypted_password text,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

create table if not exists auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade
);

-- Minimal Storage API tables/functions for applying migrations in plain PostgreSQL CI.
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$ select string_to_array(name, '/') $$;

grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.buckets, storage.objects to anon, authenticated, service_role;
grant execute on all functions in schema storage to anon, authenticated, service_role;

create table if not exists realtime.messages (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  extension text not null default 'broadcast',
  event text,
  payload jsonb,
  private boolean not null default false,
  inserted_at timestamptz not null default now()
);
alter table realtime.messages enable row level security;

create or replace function realtime.topic()
returns text
language sql
stable
as $$ select nullif(current_setting('realtime.topic', true), '') $$;

create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true)
returns void
language sql
as $$
  insert into realtime.messages (topic, event, payload, private) values (topic, event, payload, private)
$$;

grant usage on schema auth, realtime to anon, authenticated, service_role;
grant execute on all functions in schema auth, realtime to anon, authenticated, service_role;
grant select on realtime.messages to authenticated;
