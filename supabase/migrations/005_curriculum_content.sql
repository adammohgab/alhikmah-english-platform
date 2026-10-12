-- Migration: 005_curriculum_content.sql
-- Description: Curriculum and content hierarchy tables: courses, units, lessons, blocks, and version snapshots.
-- Task: BE-CORE-05

-- Table: courses
create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references profiles(id) on delete set null,
  title text not null,
  slug text unique not null,
  description text,
  grade_level text,
  is_official boolean not null default false,
  status content_status not null default 'draft',
  cover_image text,
  position int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table: units
create table if not exists units (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  title text not null,
  description text,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table: lessons
create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  title text not null,
  description text,
  xp_reward int not null default 20,
  coin_reward int not null default 5,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table: lesson_blocks
create table if not exists lesson_blocks (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  block_type text not null,
  content jsonb not null default '{}'::jsonb,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table: content_snapshots
create table if not exists content_snapshots (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  version_number int not null default 1,
  snapshot_data jsonb not null default '{}'::jsonb,
  published_by uuid references profiles(id) on delete set null,
  published_at timestamptz not null default app_now(),
  unique (course_id, version_number)
);

-- Indexes
create index if not exists idx_courses_slug on courses(slug);
create index if not exists idx_courses_author_id on courses(author_id);
create index if not exists idx_courses_status on courses(status);
create index if not exists idx_courses_grade_level on courses(grade_level);

create index if not exists idx_units_course_id on units(course_id);
create index if not exists idx_units_order_index on units(order_index);

create index if not exists idx_lessons_unit_id on lessons(unit_id);
create index if not exists idx_lessons_order_index on lessons(order_index);

create index if not exists idx_lesson_blocks_lesson_id on lesson_blocks(lesson_id);
create index if not exists idx_lesson_blocks_order_index on lesson_blocks(order_index);

create index if not exists idx_content_snapshots_course_id on content_snapshots(course_id);
create index if not exists idx_content_snapshots_version on content_snapshots(course_id, version_number);

-- Triggers for updated_at
create trigger courses_updated_at
  before update on courses
  for each row
  execute function set_updated_at();

create trigger units_updated_at
  before update on units
  for each row
  execute function set_updated_at();

create trigger lessons_updated_at
  before update on lessons
  for each row
  execute function set_updated_at();

create trigger lesson_blocks_updated_at
  before update on lesson_blocks
  for each row
  execute function set_updated_at();
