-- ==========================================================
-- Al Hikmah English Platform — Seed Data
-- Run this in the Supabase SQL Editor after pushing migrations
-- Creates demo accounts for each role so you can log in
-- ==========================================================

-- Login format: username (e.g. "admin1") and password below.
-- Supabase stores accounts as: {username}@accounts.invalid

-- ========================
-- 1. Create auth.users rows
-- ========================
-- NOTE: In Supabase, auth.users must be inserted via the
-- Supabase Admin API or Auth dashboard for production.
-- For seeding, we use the internal function available in SQL Editor.

-- Super Admin
SELECT auth.create_user(
  uid := 'a0000000-0000-0000-0000-000000000001'::uuid,
  email := 'superadmin@accounts.invalid',
  email_confirm := true,
  password := 'Admin@1234'
);

-- School Admin
SELECT auth.create_user(
  uid := 'a0000000-0000-0000-0000-000000000002'::uuid,
  email := 'schooladmin@accounts.invalid',
  email_confirm := true,
  password := 'Admin@1234'
);

-- Teacher 1
SELECT auth.create_user(
  uid := 'a0000000-0000-0000-0000-000000000003'::uuid,
  email := 'teacher.sarah@accounts.invalid',
  email_confirm := true,
  password := 'Teacher@1234'
);

-- Teacher 2
SELECT auth.create_user(
  uid := 'a0000000-0000-0000-0000-000000000004'::uuid,
  email := 'teacher.omar@accounts.invalid',
  email_confirm := true,
  password := 'Teacher@1234'
);

-- Student 1
SELECT auth.create_user(
  uid := 'a0000000-0000-0000-0000-000000000005'::uuid,
  email := 'student.ali@accounts.invalid',
  email_confirm := true,
  password := 'Student@1234'
);

-- Student 2
SELECT auth.create_user(
  uid := 'a0000000-0000-0000-0000-000000000006'::uuid,
  email := 'student.mariam@accounts.invalid',
  email_confirm := true,
  password := 'Student@1234'
);

-- Student 3
SELECT auth.create_user(
  uid := 'a0000000-0000-0000-0000-000000000007'::uuid,
  email := 'student.khaled@accounts.invalid',
  email_confirm := true,
  password := 'Student@1234'
);

-- ========================
-- 2. Insert profiles rows
-- ========================
INSERT INTO profiles (id, username, display_name, role, status, must_change_password)
VALUES
  -- Super Admin (routes to /admin)
  ('a0000000-0000-0000-0000-000000000001', 'superadmin', 'Super Admin', 'super_admin', 'active', false),
  -- School Admin (routes to /admin)
  ('a0000000-0000-0000-0000-000000000002', 'schooladmin', 'School Admin', 'admin', 'active', false),
  -- Teachers (route to /teacher)
  ('a0000000-0000-0000-0000-000000000003', 'teacher.sarah', 'Sarah Al-Mansouri', 'teacher', 'active', false),
  ('a0000000-0000-0000-0000-000000000004', 'teacher.omar', 'Omar Benali', 'teacher', 'active', false),
  -- Students (route to /student)
  ('a0000000-0000-0000-0000-000000000005', 'student.ali', 'Ali Hassan', 'student', 'active', false),
  ('a0000000-0000-0000-0000-000000000006', 'student.mariam', 'Mariam Khalifa', 'student', 'active', false),
  ('a0000000-0000-0000-0000-000000000007', 'student.khaled', 'Khaled Yousef', 'student', 'active', false)
ON CONFLICT (id) DO NOTHING;

-- ========================
-- 3. Insert default user_settings for each user
-- ========================
INSERT INTO user_settings (user_id)
SELECT id FROM profiles
WHERE id IN (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000005',
  'a0000000-0000-0000-0000-000000000006',
  'a0000000-0000-0000-0000-000000000007'
)
ON CONFLICT (user_id) DO NOTHING;
