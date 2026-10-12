-- Migration: 003_school_structure.sql
-- Description: Define school hierarchy database tables: academic years, terms, classes, teacher assignments, and student enrollments.
-- Task: BE-CORE-03

-- Table: school_years
create table if not exists school_years (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean default false,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table: terms
create table if not exists terms (
  id uuid primary key default gen_random_uuid(),
  year_id uuid not null references school_years(id) on delete cascade,
  name text not null,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table: classes
create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  term_id uuid references terms(id) on delete set null,
  name text not null,
  join_code text unique,
  grade_level text,
  is_archived boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table: class_teachers (co-teaching / teacher assignments)
create table if not exists class_teachers (
  class_id uuid not null references classes(id) on delete cascade,
  teacher_id uuid not null references profiles(id) on delete cascade,
  is_primary boolean default false,
  primary key (class_id, teacher_id)
);

-- Table: class_enrollments (student enrollments)
create table if not exists class_enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  enrolled_at timestamptz not null default app_now(),
  status text not null default 'active',
  unique (class_id, student_id)
);

-- Foreign Key & Join Indexes
create index if not exists idx_terms_year_id on terms(year_id);
create index if not exists idx_classes_term_id on classes(term_id);
create index if not exists idx_classes_join_code on classes(join_code);
create index if not exists idx_classes_grade_level on classes(grade_level);
create index if not exists idx_classes_is_archived on classes(is_archived);

create index if not exists idx_class_teachers_teacher_id on class_teachers(teacher_id);
create index if not exists idx_class_enrollments_student_id on class_enrollments(student_id);
create index if not exists idx_class_enrollments_class_id on class_enrollments(class_id);
create index if not exists idx_class_enrollments_status on class_enrollments(status);

-- Triggers for updated_at
create trigger school_years_updated_at
  before update on school_years
  for each row
  execute function set_updated_at();

create trigger terms_updated_at
  before update on terms
  for each row
  execute function set_updated_at();

create trigger classes_updated_at
  before update on classes
  for each row
  execute function set_updated_at();
