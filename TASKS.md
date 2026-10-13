# Complete Tasks Registry

This document catalogs all 224 tasks from the Task Claiming system for autonomous AI agents and developers.

## Block: ADM (22 tasks)

### ADM-01: Admin Executive Dashboard: operational metrics, active learners and alerts (AD-01)
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: UIK-25, BE-CORE-17
- **Tags**: admin, dashboard, metrics

### Goal
Build primary Admin Dashboard (`AD-01`) displaying total active students today, platform operational health, pending moderation items, and quick management links.

### Implementation Details
- Create `frontend/src/pages/admin/DashboardPage/index.tsx`.
- Real-time stat tiles: Enrolled Students, Active Teachers, Completed Lessons Today, System Health (All Systems Nominal).
- Action alerts: Unreviewed Moderation Reports, Failed Background Jobs, Pending Password Resets.
- Quick navigation shortcuts: 'Import Users', 'Year Rollover', 'Edit Settings'.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/admin/DashboardPage/**`
- **Conflict Prevention**: Follow AD-01 specification in ADMIN-SPEC.

**Acceptance Criteria**:
- Renders high-level platform health metrics cleanly.
- Alerts highlight pending moderation reports or failed jobs.
- Quick links navigate directly to admin submodules.

---

### ADM-02: Users directory master table: role filters, status toggles and search (AD-02)
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: ADM-01, UIK-18
- **Tags**: admin, users, directory

### Goal
Implement `/admin/users` master directory displaying all students, teachers, and administrators with multi-attribute filtering and bulk actions.

### Implementation Details
- Create `frontend/src/pages/admin/UsersListPage/index.tsx`.
- TanStack DataTable: Avatar, Display Name, Username, Role badge, Status ('active', 'locked', 'archived'), Created Date.
- Filter by Role (All, Students, Teachers, Admins) and Status.
- Bulk actions: Lock Accounts, Archive Accounts, Reset Passwords.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/admin/UsersListPage/**`
- **Conflict Prevention**: Follow AD-02 in ADMIN-SPEC.

**Acceptance Criteria**:
- Fast searching and sorting across thousands of user records.
- Bulk selection allows locking or archiving accounts.
- Clicking user opens full User Detail page.

---

### ADM-03: User detail dossier, account status control and administrative notes (AD-03)
- **Priority**: high | **Estimate**: 2h
- **Depends On**: ADM-02, BE-CORE-02
- **Tags**: admin, user-detail, account-management

### Goal
Implement `/admin/users/:userId` user management profile allowing admins to view academic history, toggle lockout, change role, and view audit trail.

### Implementation Details
- Create `frontend/src/pages/admin/UserDetailPage/index.tsx`.
- User profile header with status indicator chip and role badge.
- Administrative controls: Lock / Unlock account button, Reset Password trigger, Change Role dropdown.
- Private `admin_notes` feed visible only to administrators.
- 'Simulate View-As User' button launching View-As mode.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/admin/UserDetailPage/**`
- **Conflict Prevention**: Follow AD-03 in ADMIN-SPEC.

**Acceptance Criteria**:
- Admins can lock or unlock user accounts with immediate effect.
- Role changes update user permissions in database.
- Private admin notes save securely.

---

### ADM-04: Create User manual account generator modal (AD-04)
- **Priority**: high | **Estimate**: 1h
- **Depends On**: ADM-02
- **Tags**: admin, create-user, accounts

### Goal
Implement `/admin/users/create` modal or page for manually creating student, teacher, or administrator accounts with auto-generated passwords.

### Implementation Details
- Create `frontend/src/pages/admin/CreateUserModal.tsx`.
- Form: Full name, Username (validated unique), Email (optional for younger students), Role, Grade Level, Initial Temporary Password.
- Force password change on first login toggle (defaults to true).
- Copy credentials card (Username and Password) to clipboard or print.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/admin/CreateUserModal.tsx`
- **Conflict Prevention**: Follow AD-04 in ADMIN-SPEC.

**Acceptance Criteria**:
- Validates unique username availability in real-time.
- Creates account in Supabase Auth and inserts profile row.
- Offers one-click copy of login credentials for student card.

---

### ADM-05: CSV Bulk Import Wizard: mapping, validation and staged commit (AD-05)
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: ADM-02, BE-EDGE-13
- **Tags**: admin, csv, import, bulk-accounts

### Goal
Implement `/admin/users/import` multi-step wizard allowing admins to upload class rosters in CSV format, map columns, fix validation errors, and bulk create accounts.

### Implementation Details
- Create `frontend/src/pages/admin/CsvImportWizardPage/index.tsx`.
- Step 1: Upload CSV file (with downloadable sample template).
- Step 2: Column mapping interface (First Name, Last Name, Username, Grade, Class Code).
- Step 3: Interactive error grid showing invalid rows with inline cell correction.
- Step 4: Dispatch import job via `job-runner` and download credentials distribution CSV.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/admin/CsvImportWizardPage/**`
- **Conflict Prevention**: Follow AD-05 in ADMIN-SPEC.

**Acceptance Criteria**:
- Parses CSV file and maps columns flexibly.
- Highlights invalid rows (e.g. duplicate username, invalid grade) before commit.
- Asynchronously processes import job and generates credentials PDF/CSV.

---

### ADM-06: Academic Year Rollover Wizard with pre-flight check and rollback (AD-06)
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: ADM-01, BE-EDGE-14
- **Tags**: admin, rollover, operations, safeguards

### Goal
Implement `/admin/operations/rollover` academic rollover wizard archiving concluding school year, advancing grades, creating classes, and storing rollback snapshots.

### Implementation Details
- Create `frontend/src/pages/admin/YearRolloverPage/index.tsx`.
- Pre-flight checklist: verifies all current term grades are submitted, warns of active sessions.
- Rollover configuration: Select source year, destination year, grade advancement mapping (e.g. Grade 5 -> Grade 6).
- Two-factor confirmation: requires typing "CONFIRM ROLLOVER" to proceed.
- 48-hour rollback button allowing instant reversal if school schedules change.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/admin/YearRolloverPage/**`
- **Conflict Prevention**: Follow AD-06 in ADMIN-SPEC.

**Acceptance Criteria**:
- Multi-step safeguards prevent accidental execution.
- Dispatches background rollover job and shows progress percentage.
- Rollback button successfully restores previous year state if triggered.

---

### ADM-07: School classes admin master directory and term management (AD-07, AD-08)
- **Priority**: high | **Estimate**: 2h
- **Depends On**: ADM-01, BE-CORE-03
- **Tags**: admin, classes, school-structure

### Goal
Implement `/admin/classes` and `/admin/classes/:classId` administrative views showing all school classes across all grades, assigned teachers, and enrollment totals.

### Implementation Details
- Create `frontend/src/pages/admin/ClassesAdminPage/index.tsx` and `ClassAdminDetailPage.tsx`.
- Comprehensive list of school classes filtered by Academic Year and Grade.
- Admin controls: Reassign Primary Teacher, Add Co-Teachers, Archive Class, Force Reset Join Code.
- View class roster and grade averages across sections.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/admin/ClassesAdminPage/**`
  - `frontend/src/pages/admin/ClassAdminDetailPage/**`
- **Conflict Prevention**: Follow AD-07, AD-08 in ADMIN-SPEC.

**Acceptance Criteria**:
- Lists all school classes with assigned teachers and student counts.
- Allows reassigning primary teachers and adding co-teachers.
- Archive class preserves historical data safely.

---

### ADM-08: Official curriculum management and scope-and-sequence tree (AD-09)
- **Priority**: high | **Estimate**: 2h
- **Depends On**: ADM-01, BE-CORE-05
- **Tags**: admin, curriculum, standards

### Goal
Implement `/admin/curriculum` official curriculum repository managing school-wide courses, grade-level learning outcomes, and master versions.

### Implementation Details
- Create `frontend/src/pages/admin/CurriculumAdminPage/index.tsx`.
- Master curriculum hierarchy: Grades 1–12, Core English tracks, Supplementary reading tracks.
- 'Promote to Official Curriculum' action on verified teacher courses.
- Lock/unlock editing permissions on official courses.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/admin/CurriculumAdminPage/**`
- **Conflict Prevention**: Follow AD-09 in ADMIN-SPEC.

**Acceptance Criteria**:
- Renders official curriculum tree by grade level.
- Promotes verified courses to official status via database flag.
- Enforces strict administrative authoring controls on official tracks.

---

### ADM-09: AI Official Curriculum Wizard: grade syllabus and standard generator (AD-10)
- **Priority**: high | **Estimate**: 2h
- **Depends On**: ADM-08, BE-EDGE-12
- **Tags**: admin, ai, curriculum-wizard

### Goal
Implement `/admin/curriculum/generate` enterprise AI wizard generating year-long English curriculum scopes aligned with international CEFR standards.

### Implementation Details
- Create `frontend/src/pages/admin/CurriculumGeneratorPage/index.tsx`.
- Input parameters: Grade level, Academic weeks (30 to 40), CEFR targets (A1, A2, B1, B2), Core themes (Grammar, Fiction, Essay Writing).
- Generates 6 comprehensive units with weekly lesson breakdown and milestone assessment checkpoints.
- Dispatches async generation job and creates draft official course.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/admin/CurriculumGeneratorPage/**`
- **Conflict Prevention**: Follow AD-10 in ADMIN-SPEC.

**Acceptance Criteria**:
- Generates comprehensive year-long curriculum syllabus with CEFR alignment.
- Tracks background generation progress in real-time.
- Creates official curriculum draft awaiting admin review.

---

### ADM-10: Content moderation queue: reported essays, chat flags and review triage (AD-13)
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: ADM-01, BE-CORE-17
- **Tags**: admin, moderation, safety, triage

### Goal
Implement `/admin/moderation` queue displaying student writing flags, safety filter trigger logs, and user problem reports with resolution actions.

### Implementation Details
- Create `frontend/src/pages/admin/ModerationQueuePage/index.tsx`.
- Moderation cards: Entity type (Student Essay, AI Chat message, Forum comment), Trigger reason (Safety filter flag, PII detected, Offensive language), Timestamp.
- Triage actions: 'Approve Content (False Positive)', 'Redact Content', 'Warn Student', 'Notify Parents / Teacher'.
- Resolves item and logs resolution in `moderation_queue` table.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/admin/ModerationQueuePage/**`
- **Conflict Prevention**: Follow AD-13 in ADMIN-SPEC.

**Acceptance Criteria**:
- Groups flagged content items chronologically with urgency tags.
- Triage actions resolve items and update database state.
- Admins can add notes explaining resolution decisions.

---

### ADM-11: XP, Levels, Coins and Streak rules economy studio (AD-14)
- **Priority**: high | **Estimate**: 2h
- **Depends On**: ADM-01, BE-OPS-05
- **Tags**: admin, economy, xp, rules

### Goal
Implement `/admin/studios/economy` configuration studio allowing admins to adjust economy parameters: lesson XP, quiz XP multipliers, daily caps, and level curve.

### Implementation Details
- Create `frontend/src/pages/admin/EconomyStudioPage/index.tsx`.
- Parameter inputs: Daily XP Cap (default 1000), Base Lesson XP (20), Base Activity XP (10), Quiz Perfect Score Bonus (50).
- Level progression curve calculator graph showing XP required for levels 1 to 50.
- Economy health simulation calculating average student coin earnings per week.
- Save configuration into `platform_settings`.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/admin/EconomyStudioPage/**`
- **Conflict Prevention**: Follow AD-14 in ADMIN-SPEC.

**Acceptance Criteria**:
- Admins can tune reward formulas and daily caps.
- Visual graph depicts level progression curve.
- Changes update economy config in `platform_settings` atomically.

---

### ADM-12: Quest templates and badge definitions designer (AD-15)
- **Priority**: high | **Estimate**: 2h
- **Depends On**: ADM-11, BE-CORE-11
- **Tags**: admin, quests, badges, studio

### Goal
Implement `/admin/studios/quests-badges` studio allowing administrators to create daily quest templates and define achievement badges with custom criteria.

### Implementation Details
- Create `frontend/src/pages/admin/QuestsBadgesStudioPage/index.tsx`.
- Quest Template Builder: Quest type, Title, Target count, Reward XP/coins, Active toggle.
- Badge Definition Builder: Badge code, Name, Category, Icon image upload, Criteria JSON builder (e.g. `streak_days >= 30`).
- Preview badge card with retro arcade borders.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/admin/QuestsBadgesStudioPage/**`
- **Conflict Prevention**: Follow AD-15 in ADMIN-SPEC.

**Acceptance Criteria**:
- Create, edit, and deactivate quest templates.
- Define achievement badges with criteria conditions.
- Badge image upload integrates with storage bucket.

---

### ADM-13: Virtual shop catalog manager and item pricing studio (AD-16)
- **Priority**: high | **Estimate**: 1h
- **Depends On**: ADM-11, BE-CORE-13
- **Tags**: admin, shop, catalog, economy

### Goal
Implement `/admin/studios/shop` catalog editor managing purchasable items: themes, streak freezes, sticker packs, coin costs, and unlock level requirements.

### Implementation Details
- Create `frontend/src/pages/admin/ShopCatalogPage/index.tsx`.
- Item editor modal: SKU, Item Title, Category (Theme, Accessory, Power-up), Coin Price, Required Student Level, Asset URL, Availability toggle.
- Reorder items within shop shelves via drag-and-drop.
- Sales metrics: shows most popular purchased items.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/admin/ShopCatalogPage/**`
- **Conflict Prevention**: Follow AD-16 in ADMIN-SPEC.

**Acceptance Criteria**:
- Add and edit virtual goods in shop catalog.
- Configure level locks and coin pricing.
- Toggling availability immediately updates student shop view.

---

### ADM-14: Avatar studio asset manager and theme studio palette editor (AD-17, AD-18)
- **Priority**: medium | **Estimate**: 2h
- **Depends On**: ADM-13
- **Tags**: admin, themes, avatar, design-system

### Goal
Implement `/admin/studios/avatar` SVG asset manager and `/admin/studios/themes` theme palette studio for creating brand-new unlockable arcade themes.

### Implementation Details
- Create `frontend/src/pages/admin/AvatarStudioAdminPage/index.tsx`.
- Create `frontend/src/pages/admin/ThemesStudioAdminPage/index.tsx`.
- Avatar asset manager: Upload modular SVG parts (hairstyles, hats, glasses, shirts) with layer ordering.
- Theme studio: Color picker configuring the 6 World variables, neutral surface tones, and contrast ratio validation check (WCAG AA).

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/admin/AvatarStudioAdminPage/**`
  - `frontend/src/pages/admin/ThemesStudioAdminPage/**`
- **Conflict Prevention**: Follow AD-17, AD-18 in ADMIN-SPEC.

**Acceptance Criteria**:
- Uploads and organizes modular SVG avatar assets.
- Creates new purchasable color themes with WCAG AA contrast check.
- Theme previews update live across mockup interface.

---

### ADM-15: Leaderboard moderation and score anomaly detector (AD-19)
- **Priority**: high | **Estimate**: 1h
- **Depends On**: ADM-11, BE-OPS-16
- **Tags**: admin, leaderboard, anti-cheat, moderation

### Goal
Implement `/admin/studios/leaderboards` monitoring tool detecting suspicious XP spikes or script exploits, with manual score adjustment and student reset tools.

### Implementation Details
- Create `frontend/src/pages/admin/LeaderboardModerationPage/index.tsx`.
- Anomaly detector: Flags students earning >500 XP within 10 minutes or perfect scores across 10 consecutive exercises.
- Actions: 'Investigate Activity Log', 'Adjust Student XP', 'Temporarily Hide from Leaderboard'.
- Toggle school-wide or class-level leaderboard visibility.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/admin/LeaderboardModerationPage/**`
- **Conflict Prevention**: Follow AD-19 in ADMIN-SPEC.

**Acceptance Criteria**:
- Highlights suspicious XP spikes with automated anomaly flags.
- Admin can audit ledger entries and adjust points with justification note.
- Can hide bad actors from public rankings with one click.

---

### ADM-16: AI features toggles and student daily limits governance (AD-20)
- **Priority**: critical | **Estimate**: 1h
- **Depends On**: ADM-01, BE-EDGE-05
- **Tags**: admin, ai-governance, limits, metering

### Goal
Implement `/admin/ai/features-limits` governance panel controlling which AI capabilities are active per grade level and setting daily student token budgets.

### Implementation Details
- Create `frontend/src/pages/admin/AiGovernancePage/index.tsx`.
- Feature toggles per grade level (Grades 1-3, 4-6, 7-9, 10-12): AI Tutor chat, AI Writing Feedback, AI Translation.
- Daily message limit slider: default 20 messages/day for students.
- Token budget caps per class and monthly cost alert threshold ($100 / month).

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/admin/AiGovernancePage/**`
- **Conflict Prevention**: Follow AD-20 in ADMIN-SPEC.

**Acceptance Criteria**:
- Toggles AI features on or off by grade level.
- Adjusts daily student message caps and token budgets.
- Updates platform configuration in database immediately.

---

### ADM-17: AI safety rules, custom pedagogical instructions and test sandbox (AD-21)
- **Priority**: high | **Estimate**: 2h
- **Depends On**: ADM-16, BE-EDGE-03
- **Tags**: admin, ai, safety, sandbox

### Goal
Implement `/admin/ai/safety-instructions` editor allowing school administrators to customize AI system prompts, pedagogical tone, and test replies in a sandbox.

### Implementation Details
- Create `frontend/src/pages/admin/AiSafetyEditorPage/index.tsx`.
- System instruction editor: Add school-specific guidelines (e.g. British English spelling preference, school motto encouragement).
- Prohibited topics keyword list.
- Interactive test sandbox: run test queries directly in the browser and inspect system prompts, model reasoning, and safety filter verdicts.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/admin/AiSafetyEditorPage/**`
- **Conflict Prevention**: Follow AD-21 in ADMIN-SPEC.

**Acceptance Criteria**:
- Custom system instructions append cleanly to AI prompt assembly.
- Prohibited keywords trigger safety redirections in sandbox tests.
- Sandbox displays live token counts and safety evaluations.

---

### ADM-18: AI usage, token consumption, cost breakdown and activity audit log (AD-22, AD-23)
- **Priority**: high | **Estimate**: 2h
- **Depends On**: ADM-16, BE-CORE-15
- **Tags**: admin, ai, usage, cost, logs

### Goal
Implement `/admin/ai/usage` cost dashboard and `/admin/ai/logs` activity inspector detailing token metrics across models, features, and classes.

### Implementation Details
- Create `frontend/src/pages/admin/AiUsagePage/index.tsx` and `AiLogsPage.tsx`.
- Recharts visualizations: Daily Token Consumption over time, Cost breakdown by feature (Tutor vs Writing vs Copilot), Token spend per class.
- AI Logs inspector: Filterable table of past interactions with model name, tokens used, latency, and safety status.
- Export usage report to CSV.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/admin/AiUsagePage/**`
  - `frontend/src/pages/admin/AiLogsPage/**`
- **Conflict Prevention**: Follow AD-22, AD-23 in ADMIN-SPEC.

**Acceptance Criteria**:
- Charts historical token and dollar spend accurately.
- Filterable activity log pinpoints expensive or flagged queries.
- Exports CSV summary for school financial reporting.

---

### ADM-19: School-wide announcements publisher and urgent broadcast (AD-24)
- **Priority**: high | **Estimate**: 1h
- **Depends On**: ADM-01, BE-OPS-19
- **Tags**: admin, announcements, broadcast

### Goal
Implement `/admin/announcements` school broadcaster creating campus announcements, parent bulletins, and full-screen urgent emergency alerts.

### Implementation Details
- Create `frontend/src/pages/admin/SchoolAnnouncementsPage/index.tsx`.
- Composer: Title, Target Audience (All School, All Students, All Teachers), Priority (Normal vs Urgent Broadcast).
- Scheduled release date and expiration date picker.
- Urgent broadcast triggers instant Realtime modal overlay across all connected clients.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/admin/SchoolAnnouncementsPage/**`
- **Conflict Prevention**: Follow AD-24 in ADMIN-SPEC.

**Acceptance Criteria**:
- Publishes announcements targeting whole school or specific roles.
- Urgent priority displays prominent banner to all online users.
- Tracks view statistics and read percentages.

---

### ADM-20: Immutable system audit log inspector with JSON diff viewer (AD-26)
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: ADM-01, BE-CORE-17
- **Tags**: admin, audit, security, diff

### Goal
Implement `/admin/audit` security log viewer displaying every administrative modification, user deletion, grade override, and setting change with before/after JSON diffs.

### Implementation Details
- Create `frontend/src/pages/admin/AuditLogPage/index.tsx`.
- Comprehensive DataTable reading `audit_log` table: Timestamp, Admin Name, Action type, Target Table, IP address.
- Interactive JSON diff modal highlighting old values in red and new values in green.
- Filter by date range, action type, or target user.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/admin/AuditLogPage/**`
- **Conflict Prevention**: Follow AD-26 in ADMIN-SPEC.

**Acceptance Criteria**:
- Renders complete, tamper-evident audit history.
- JSON diff viewer clearly illuminates modifications.
- Filterable by date range and administrative actor.

---

### ADM-21: Platform settings control room: maintenance mode, registration and Super Admin roles (AD-27, AD-28)
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: ADM-01, BE-CORE-17
- **Tags**: admin, settings, super-admin, maintenance

### Goal
Implement `/admin/settings` and `/admin/admins` (restricted to Super Admins) controlling maintenance mode, student registration toggles, and admin role assignments.

### Implementation Details
- Create `frontend/src/pages/admin/PlatformSettingsPage/index.tsx` and `AdminsManagementPage.tsx`.
- Platform toggles: Emergency Maintenance Mode (blocks non-admins with friendly banner), Public Registration Allowed, Default World Theme.
- Admins Manager: Assign and revoke Admin / Super Admin roles with confirmation modal.
- Require password verification before saving sensitive platform settings.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/admin/PlatformSettingsPage/**`
  - `frontend/src/pages/admin/AdminsManagementPage/**`
- **Conflict Prevention**: Follow AD-27, AD-28 in ADMIN-SPEC.

**Acceptance Criteria**:
- Super Admin role strictly enforced for accessing these settings.
- Toggling maintenance mode updates `get_public_state` immediately.
- Role modifications write immutable entries to `audit_log`.

---

### ADM-22: View-As student/teacher simulation mode and security sandbox integration
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: UIK-25, ADM-03
- **Tags**: admin, view-as, simulation, security

### Goal
Implement administrative View-As simulation mechanism: allows admins to temporarily experience the app from any student or teacher's perspective with read-only safety locks.

### Implementation Details
- Create `frontend/src/shared/hooks/useViewAs.ts`.
- Admin activates View-As on `UserDetailPage.tsx`.
- Sets session simulation state in AuthProvider; loads target user's classes, courses, and stats.
- `ViewAsBanner` docks permanently at screen top with warning: "SIMULATION MODE (READ-ONLY) - Simulating [Student Name]".
- Mutation operations are intercepted and blocked in read-only mode to prevent altering real student grades.
- 'Exit View-As' button immediately restores admin interface.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/hooks/useViewAs.ts`
  - `frontend/src/shared/components/layout/ViewAsBanner.tsx`
- **Conflict Prevention**: Never bypass backend RLS; simulation operates with safe audit trail.

**Acceptance Criteria**:
- Admin seamlessly simulates any student or teacher portal.
- View-As banner stays docked with high-visibility warning.
- Read-only interceptor prevents accidental data mutations.
- Exit simulation cleanly restores administrator session.

---

## Block: BE-CORE (18 tasks)

### BE-CORE-01: Core database setup, extensions, custom enums and helper domains
- **Priority**: critical | **Estimate**: 1h
- **Depends On**: FND-11
- **Tags**: database, enums, sql

### Goal
Initialize PostgreSQL database extensions (`uuid-ossp`, `pgcrypto`, `citext`), utility functions, and custom enum types specified in backend docs.

### Implementation Details
- Create migration for PostgreSQL extensions.
- Define custom enums:
  - User roles: `user_role` ('student', 'teacher', 'admin', 'super_admin')
  - Account status: `user_status` ('active', 'locked', 'archived')
  - Course status: `content_status` ('draft', 'published', 'archived')
  - Question types: `question_type` ('multiple_choice', 'fill_blank', 'matching', 'short_answer', 'reorder', 'audio_spelling', 'drag_drop')
  - Assessment kinds: `assessment_kind` ('quiz', 'assignment')
  - Submission status: `submission_status` ('in_progress', 'submitted', 'graded', 'returned')
- Create helper function `app_now()` for consistent time manipulation and testing.

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_01_extensions_enums.sql`
- **Conflict Prevention**: Keep enums modular and alphabetically organized.

**Acceptance Criteria**:
- Migration applies cleanly without errors on fresh Supabase instance.
- All required enum types created and queryable.
- `app_now()` returns current `timestamptz`.

---

### BE-CORE-02: Identity and profile schema, user settings and admin notes tables
- **Priority**: critical | **Estimate**: 1h
- **Depends On**: BE-CORE-01
- **Tags**: database, profiles, identity

### Goal
Create core user identity tables linking with `auth.users`, user preferences, and private administrative notes.

### Implementation Details
- Create table `profiles` (id uuid PK references auth.users on delete cascade, username citext unique, display_name text, role user_role, status user_status, avatar_url text, equipped_theme text, must_change_password boolean default false, created_at, updated_at).
- Create table `user_settings` (user_id uuid PK references profiles on delete cascade, sound_enabled boolean default true, effects_tier text default 'balanced', prefers_reduced_motion boolean default false, notifications_json jsonb, updated_at).
- Create table `admin_notes` (id uuid PK, user_id uuid references profiles, author_id uuid references profiles, note text, created_at).
- Add updated_at automatic timestamp triggers.

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_02_identity_profiles.sql`
- **Conflict Prevention**: Ensure cascading constraints don't cause orphaned records.

**Acceptance Criteria**:
- `profiles` table integrates with Supabase Auth users.
- Unique username constraints case-insensitive with `citext`.
- `admin_notes` accessible only to authorized staff.

---

### BE-CORE-03: School structure tables: academic years, terms, classes and enrollments
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: BE-CORE-02
- **Tags**: database, classes, enrollment

### Goal
Define the school hierarchy database tables: academic years, terms, classes, teacher assignments, and student enrollments.

### Implementation Details
- Create table `school_years` (id uuid PK, name text, is_active boolean, start_date date, end_date date).
- Create table `terms` (id uuid PK, year_id uuid references school_years, name text, start_date date, end_date date).
- Create table `classes` (id uuid PK, term_id uuid references terms, name text, join_code text unique, grade_level text, is_archived boolean default false).
- Create table `class_teachers` (class_id uuid references classes, teacher_id uuid references profiles, is_primary boolean default false, PK (class_id, teacher_id)).
- Create table `class_enrollments` (id uuid PK, class_id uuid references classes, student_id uuid references profiles, enrolled_at timestamptz, status text default 'active', unique (class_id, student_id)).

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_03_school_structure.sql`
- **Conflict Prevention**: Index foreign keys for performant join queries.

**Acceptance Criteria**:
- Unique indexes enforce one enrollment per student per class.
- `join_code` generated with unique index on `classes`.
- Teacher co-teaching relationships cleanly modeled.

---

### BE-CORE-04: Class rules, reward settings and course assignments schema
- **Priority**: high | **Estimate**: 1h
- **Depends On**: BE-CORE-03
- **Tags**: database, rules, classes

### Goal
Create schema for class-specific rule overrides, custom rewards, and curriculum assignments.

### Implementation Details
- Create table `class_rules` (class_id uuid PK references classes on delete cascade, games_enabled boolean default true, ai_tutor_enabled boolean default true, late_submission_allowed boolean default true, late_penalty_percent integer default 10, bonus_multiplier numeric(3,2) default 1.0, updated_at).
- Create table `class_courses` (class_id uuid references classes on delete cascade, course_id uuid, is_active boolean default true, assigned_at timestamptz, PK (class_id, course_id)).
- Create table `class_unlock_overrides` (id uuid PK, class_id uuid references classes, student_id uuid references profiles, target_type text, target_id uuid, is_unlocked boolean, reason text).

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_04_class_rules.sql`
- **Conflict Prevention**: Foreign keys to courses will connect after BE-CORE-05.

**Acceptance Criteria**:
- `class_rules` enforces default values on class creation.
- Unlock overrides support student-specific accommodations.
- Class courses map assigned curriculum to class rosters.

---

### BE-CORE-05: Curriculum and content hierarchy tables: courses, units, lessons and blocks
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: BE-CORE-02
- **Tags**: database, curriculum, courses

### Goal
Create database hierarchy for official and teacher-created curriculum: courses, units, lessons, content blocks, and version snapshots.

### Implementation Details
- Create table `courses` (id uuid PK, author_id uuid references profiles, title text, slug text unique, description text, grade_level text, is_official boolean default false, status content_status default 'draft', cover_image text, position int, created_at, updated_at).
- Create table `units` (id uuid PK, course_id uuid references courses on delete cascade, title text, description text, order_index int, created_at).
- Create table `lessons` (id uuid PK, unit_id uuid references units on delete cascade, title text, description text, xp_reward int default 20, coin_reward int default 5, order_index int, created_at).
- Create table `lesson_blocks` (id uuid PK, lesson_id uuid references lessons on delete cascade, block_type text, content jsonb, order_index int).
- Create table `content_snapshots` (id uuid PK, course_id uuid references courses, version_number int, snapshot_data jsonb, published_by uuid references profiles, published_at timestamptz).

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_05_curriculum_content.sql`
- **Conflict Prevention**: Follow JSONB schema formats for lesson_blocks.

**Acceptance Criteria**:
- Cascade deletes clean up unit, lesson, and block child records on course removal.
- Content snapshots capture immutable versions of published courses.
- Unique slug on courses for clean routing.

---

### BE-CORE-06: Questions and rubrics schema supporting all interactive exercise types
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: BE-CORE-02
- **Tags**: database, questions, rubrics

### Goal
Create database tables for questions, question bank tags, and assessment rubrics for automated and manual scoring.

### Implementation Details
- Create table `rubrics` (id uuid PK, title text, criteria jsonb, max_score numeric(5,2), author_id uuid references profiles, is_public boolean default false, created_at).
- Create table `questions` (id uuid PK, author_id uuid references profiles, question_type question_type, prompt text, options jsonb, correct_answer jsonb, explanation text, points numeric(5,2) default 1.0, difficulty text, tags text[], rubric_id uuid references rubrics, created_at).
- Add GIN index on `tags` and `correct_answer` JSONB fields for rapid bank filtering.

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_06_questions_rubrics.sql`
- **Conflict Prevention**: JSONB structures must match QuestionRenderer schemas.

**Acceptance Criteria**:
- `questions` table supports multiple choice, fill in the blank, matching, reorder, short answer.
- GIN index on tags allows instant search across thousands of questions.
- Rubrics link to subjective questions for teacher grading.

---

### BE-CORE-07: Assessments schema: quizzes, assignments, questions linkage and settings
- **Priority**: critical | **Estimate**: 1h
- **Depends On**: BE-CORE-03, BE-CORE-06
- **Tags**: database, assessments, quizzes

### Goal
Define database tables for quizzes, homework assignments, assessment settings, and question linkages.

### Implementation Details
- Create table `assessments` (id uuid PK, class_id uuid references classes, author_id uuid references profiles, title text, description text, kind assessment_kind, due_date timestamptz, time_limit_minutes int, max_attempts int default 1, pass_percentage numeric(5,2) default 60.0, shuffle_questions boolean default false, show_feedback_mode text default 'immediate', status content_status default 'draft', created_at).
- Create table `assessment_questions` (assessment_id uuid references assessments on delete cascade, question_id uuid references questions, order_index int, points_override numeric(5,2), PK (assessment_id, question_id)).

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_07_assessments_schema.sql`
- **Conflict Prevention**: Coordinate with attempts tables in BE-CORE-08.

**Acceptance Criteria**:
- Foreign keys properly connect classes, authors, and questions.
- Time limit and attempt constraints modeled with positive integer checks.
- `status` flag controls draft vs published visibility.

---

### BE-CORE-08: Student attempts, submissions, answers and grading history schema
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: BE-CORE-07
- **Tags**: database, attempts, grading

### Goal
Create schema for student assessment attempts, autosaved answers, teacher grades, and feedback history.

### Implementation Details
- Create table `assessment_attempts` (id uuid PK, assessment_id uuid references assessments on delete cascade, student_id uuid references profiles, attempt_number int, status submission_status default 'in_progress', started_at timestamptz default app_now(), submitted_at timestamptz, score numeric(5,2), max_score numeric(5,2), feedback text, graded_by uuid references profiles, graded_at timestamptz).
- Create table `attempt_answers` (id uuid PK, attempt_id uuid references assessment_attempts on delete cascade, question_id uuid references questions, student_answer jsonb, is_correct boolean, points_awarded numeric(5,2), teacher_comment text, updated_at timestamptz).
- Create table `grade_history` (id uuid PK, attempt_id uuid references assessment_attempts on delete cascade, grader_id uuid references profiles, old_score numeric(5,2), new_score numeric(5,2), reason text, changed_at timestamptz default app_now()).

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_08_attempts_grading.sql`
- **Conflict Prevention**: Index (assessment_id, student_id) for rapid progress lookups.

**Acceptance Criteria**:
- Enforces unique attempt per student/attempt_number pair.
- `attempt_answers` supports JSONB answers for all question formats.
- Complete grade audit trail in `grade_history`.

---

### BE-CORE-09: Learning progress tables: lesson progress, activity logs and drafts
- **Priority**: high | **Estimate**: 1h
- **Depends On**: BE-CORE-05
- **Tags**: database, progress, student

### Goal
Create database tables tracking student lesson progress, activity completion, and draft writing pieces.

### Implementation Details
- Create table `lesson_progress` (id uuid PK, student_id uuid references profiles, lesson_id uuid references lessons on delete cascade, is_completed boolean default false, completed_at timestamptz, last_accessed_at timestamptz default app_now(), unique (student_id, lesson_id)).
- Create table `activity_progress` (id uuid PK, student_id uuid references profiles, activity_id uuid, answers jsonb, score numeric(5,2), completed_at timestamptz).
- Create table `writing_drafts` (id uuid PK, student_id uuid references profiles, prompt_id uuid, title text, content text, word_count int default 0, last_saved_at timestamptz default app_now()).

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_09_learning_progress.sql`
- **Conflict Prevention**: Use composite primary or unique keys for fast progress lookup.

**Acceptance Criteria**:
- Tracks completion state per student per lesson accurately.
- `writing_drafts` handles autosaved revisions without locking rows.
- Indices on student_id enable sub-10ms query times on dashboard.

---

### BE-CORE-10: Gamification engine tables: stats, XP ledger, coin ledger and streak days
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: BE-CORE-02
- **Tags**: database, gamification, xp, economy

### Goal
Establish the core gamification ledger tables: student statistics, immutable XP and Coin transactional ledgers, and streak history.

### Implementation Details
- Create table `student_stats` (student_id uuid PK references profiles on delete cascade, total_xp bigint default 0, current_level int default 1, current_coins bigint default 0, current_streak int default 0, longest_streak int default 0, streak_freeze_count int default 0, last_active_date date).
- Create table `xp_ledger` (id uuid PK, student_id uuid references profiles, amount int not null, source text not null, reference_id uuid, created_at timestamptz default app_now()).
- Create table `coin_ledger` (id uuid PK, student_id uuid references profiles, amount int not null, source text not null, reference_id uuid, created_at timestamptz default app_now()).
- Create table `streak_days` (id uuid PK, student_id uuid references profiles, activity_date date not null, xp_earned int default 0, is_frozen boolean default false, unique (student_id, activity_date)).

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_10_gamification_ledgers.sql`
- **Conflict Prevention**: Ledgers are strictly append-only; never delete ledger transactions.

**Acceptance Criteria**:
- Append-only transactions in XP and Coin ledgers.
- Unique constraint prevents multiple streak records for the same day.
- `student_stats` maintains denormalized counters synchronized by triggers.

---

### BE-CORE-11: Quests, badges, achievements and leaderboards schema
- **Priority**: high | **Estimate**: 2h
- **Depends On**: BE-CORE-10
- **Tags**: database, quests, badges, leaderboard

### Goal
Create schema for daily and weekly quest templates, active quest instances, badge definitions, user achievements, and leaderboard rankings.

### Implementation Details
- Create table `quest_templates` (id uuid PK, title text, description text, quest_type text, target_count int, xp_reward int, coin_reward int, is_active boolean default true).
- Create table `quest_instances` (id uuid PK, quest_template_id uuid references quest_templates, student_id uuid references profiles, current_count int default 0, is_completed boolean default false, is_claimed boolean default false, expires_at timestamptz, created_at timestamptz default app_now()).
- Create table `badge_definitions` (id uuid PK, code text unique, name text, description text, icon_url text, category text, requirement_json jsonb).
- Create table `user_badges` (id uuid PK, student_id uuid references profiles, badge_id uuid references badge_definitions, awarded_at timestamptz default app_now(), is_pinned boolean default false, unique (student_id, badge_id)).
- Create table `leaderboard_snapshots` (id uuid PK, class_id uuid references classes, period text, ranking_data jsonb, generated_at timestamptz default app_now()).

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_11_quests_badges.sql`
- **Conflict Prevention**: Follow standard JSONB payload for badge criteria.

**Acceptance Criteria**:
- Quests track progress count, completion state, and claim flag.
- Unique badge awards per student.
- Pinned badge flags supported up to limit of 3.

---

### BE-CORE-12: Minigames schema: game catalog, player sessions, high scores and daily games
- **Priority**: medium | **Estimate**: 1h
- **Depends On**: BE-CORE-10
- **Tags**: database, games, minigames

### Goal
Create database tables for 7 educational minigames, user game sessions, scores, and daily featured game tracking.

### Implementation Details
- Create table `games` (id uuid PK, slug text unique, title text, description text, icon_url text, instructions text, is_active boolean default true).
- Create table `game_sessions` (id uuid PK, game_id uuid references games, student_id uuid references profiles, score int not null, accuracy numeric(5,2), xp_awarded int default 0, coins_awarded int default 0, time_spent_seconds int, played_at timestamptz default app_now()).
- Create table `game_daily_featured` (featured_date date PK, game_id uuid references games, bonus_multiplier numeric(3,2) default 1.5).

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_12_games_schema.sql`
- **Conflict Prevention**: Index (student_id, game_id) for personal best score calculations.

**Acceptance Criteria**:
- All 7 arcade games (Word Scramble, Speed Match, Grammar Dash, etc.) supported.
- Session logs capture score, accuracy, and playtime.
- Featured game assigns bonus multiplier.

---

### BE-CORE-13: Economy shop catalog, items inventory and cosmetic purchases schema
- **Priority**: high | **Estimate**: 1h
- **Depends On**: BE-CORE-10
- **Tags**: database, shop, inventory, economy

### Goal
Create schema for virtual arcade shop catalog, student item inventories, themes, and avatar cosmetics.

### Implementation Details
- Create table `shop_items` (id uuid PK, sku text unique, name text, description text, category text, coin_price int not null, required_level int default 1, asset_url text, metadata jsonb, is_available boolean default true).
- Create table `user_inventory` (id uuid PK, user_id uuid references profiles on delete cascade, item_id uuid references shop_items, purchased_at timestamptz default app_now(), is_equipped boolean default false, unique (user_id, item_id)).
- Create table `avatar_assets` (id uuid PK, asset_type text, name text, svg_data text, coin_price int default 0, is_default boolean default false).

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_13_shop_inventory.sql`
- **Conflict Prevention**: Item SKU must be lowercase snake_case.

**Acceptance Criteria**:
- Unique item ownership per student.
- Equipped status toggled per category.
- Minimum level requirements enforced on items.

---

### BE-CORE-14: Communication tables: announcements, recipients and notifications schema
- **Priority**: high | **Estimate**: 1h
- **Depends On**: BE-CORE-02
- **Tags**: database, notifications, announcements

### Goal
Create database tables for school and class announcements, recipient lists, and user in-app notifications.

### Implementation Details
- Create table `announcements` (id uuid PK, author_id uuid references profiles, title text, body text, priority text default 'normal', target_type text, target_class_id uuid references classes, published_at timestamptz default app_now(), expires_at timestamptz).
- Create table `announcement_recipients` (announcement_id uuid references announcements on delete cascade, user_id uuid references profiles on delete cascade, read_at timestamptz, PK (announcement_id, user_id)).
- Create table `notifications` (id uuid PK, user_id uuid references profiles on delete cascade, notification_type text not null, title text, body text, data jsonb, is_read boolean default false, created_at timestamptz default app_now()).

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_14_communication_notifications.sql`
- **Conflict Prevention**: Index (user_id, is_read) for instant unread badge badge counter.

**Acceptance Criteria**:
- Announcements target whole school or specific class.
- Read tracking stored per recipient.
- Notification table indexed for fast unread count queries.

---

### BE-CORE-15: AI system schema: conversations, messages, action cards and token usage logs
- **Priority**: high | **Estimate**: 2h
- **Depends On**: BE-CORE-02
- **Tags**: database, ai, action-cards, metering

### Goal
Create database tables for AI Tutor dialogues, Copilot sessions, streaming messages, action cards, and token metering.

### Implementation Details
- Create table `ai_conversations` (id uuid PK, user_id uuid references profiles on delete cascade, conversation_type text, context_data jsonb, is_archived boolean default false, created_at timestamptz default app_now()).
- Create table `ai_messages` (id uuid PK, conversation_id uuid references ai_conversations on delete cascade, role text, content text, tokens_used int default 0, safety_flag boolean default false, created_at timestamptz default app_now()).
- Create table `ai_action_cards` (id uuid PK, conversation_id uuid references ai_conversations on delete cascade, card_type text, payload jsonb, status text default 'pending', applied_at timestamptz).
- Create table `ai_usage_logs` (id uuid PK, user_id uuid references profiles, feature text, model text, prompt_tokens int, completion_tokens int, estimated_cost numeric(8,5), created_at timestamptz default app_now()).

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_15_ai_system_tables.sql`
- **Conflict Prevention**: Isolate token logs from active conversation reads.

**Acceptance Criteria**:
- Action cards track pending, accepted, discarded states.
- AI messages link to parent conversation with role ordering.
- Usage logs track token costs and model identifiers.

---

### BE-CORE-16: Async job runner schema: background jobs, job steps and worker status
- **Priority**: high | **Estimate**: 1h
- **Depends On**: BE-CORE-02
- **Tags**: database, jobs, background-tasks

### Goal
Create database tables for asynchronous background jobs (AI course generation, bulk grading, CSV import, year rollover).

### Implementation Details
- Create table `jobs` (id uuid PK, kind text not null, status text default 'queued', initiator_id uuid references profiles, input_params jsonb, result_payload jsonb, error_message text, started_at timestamptz, completed_at timestamptz, created_at timestamptz default app_now()).
- Create table `job_steps` (id uuid PK, job_id uuid references jobs on delete cascade, step_index int, name text, status text default 'pending', progress_percent int default 0, log text, started_at timestamptz, completed_at timestamptz).
- Index on `(status, created_at)` for efficient queue polling.

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_16_jobs_schema.sql`
- **Conflict Prevention**: Status values must adhere strictly to: queued, running, completed, failed, cancelled.

**Acceptance Criteria**:
- Background jobs track multi-step progress percentages.
- Worker locking pattern supported via status transitions.
- Errors capture stack traces and failure reasons.

---

### BE-CORE-17: Administrative governance tables: platform settings, audit logs and moderation queue
- **Priority**: critical | **Estimate**: 1h
- **Depends On**: BE-CORE-02
- **Tags**: database, audit, moderation, admin

### Goal
Establish system administrative tables: configuration key-value storage, immutable audit logs, and content moderation records.

### Implementation Details
- Create table `platform_settings` (key text PK, value jsonb not null, description text, updated_by uuid references profiles, updated_at timestamptz default app_now()).
- Create table `audit_log` (id uuid PK, user_id uuid references profiles, action text not null, target_table text, target_id uuid, ip_address text, old_values jsonb, new_values jsonb, created_at timestamptz default app_now()).
- Create table `moderation_queue` (id uuid PK, reported_by uuid references profiles, entity_type text not null, entity_id uuid not null, reason text, status text default 'pending', reviewed_by uuid references profiles, resolution_notes text, created_at timestamptz default app_now()).

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_17_admin_audit_moderation.sql`
- **Conflict Prevention**: Audit logs must never allow updates or deletes (append only).

**Acceptance Criteria**:
- Audit logs record all administrative mutations with diffs.
- Moderation queue connects flagged content to admin review.
- Platform settings manage global feature toggles via JSONB.

---

### BE-CORE-18: Row Level Security (RLS) policies, access matrices and database indexes
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: BE-CORE-02, BE-CORE-03, BE-CORE-04, BE-CORE-05, BE-CORE-06, BE-CORE-07, BE-CORE-08, BE-CORE-09, BE-CORE-10, BE-CORE-11, BE-CORE-12, BE-CORE-13, BE-CORE-14, BE-CORE-15, BE-CORE-16, BE-CORE-17
- **Tags**: security, rls, database, indexes

### Goal
Enable Row Level Security (RLS) across all tables and implement granular, secure policies according to the Access Matrix in backend documentation.

### Implementation Details
- Enable RLS on every created table (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
- Implement helper security functions: `auth_role()`, `is_admin()`, `is_teacher_of_class(class_id)`, `is_student_enrolled(class_id)`.
- Apply RLS policies:
  - Students can read published courses and only their own submissions/stats.
  - Teachers can read and grade their classes' students, but not other classes.
  - Admins have elevated read/write permissions.
  - Audit log is read-only for Super Admins and write-only via system triggers.
- Create composite indexes for all foreign keys and high-frequency queries.

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_18_rls_policies_indexes.sql`
- **Conflict Prevention**: Run pgTAP or access matrix tests to ensure no unintentional policy leaks.

**Acceptance Criteria**:
- All tables have RLS enabled with restrictive policies.
- Anonymous and unauthorized cross-student data access is completely blocked.
- Query performance on indexed foreign keys stays sub-10ms.

---

## Block: BE-EDGE (18 tasks)

### BE-EDGE-01: Shared Edge Function library: auth, error handling, rate limiting and CORS
- **Priority**: critical | **Estimate**: 1h
- **Depends On**: FND-11
- **Tags**: edge-functions, deno, security, cors

### Goal
Create shared Deno runtime utilities in `supabase/functions/_shared/` for authorization, error envelopes, rate limiting, and CORS headers.

### Implementation Details
- Create `_shared/cors.ts` supporting configured origins and preflight requests.
- Create `_shared/auth.ts` validating JWT tokens and extracting user roles from Supabase Auth.
- Create `_shared/errors.ts` serializing exceptions into consistent API error JSON envelopes.
- Create `_shared/ratelimit.ts` utilizing database or in-memory token bucket counters.

### Execution & File Ownership
- **Owns**:
  - `supabase/functions/_shared/**`
- **Conflict Prevention**: Reusable core module; avoid hardcoding specific function logic here.

**Acceptance Criteria**:
- CORS headers allow frontend development and production origins.
- Validates Supabase JWTs and rejects expired/tampered tokens.
- Standardized error envelopes returned on all failures.

---

### BE-EDGE-02: Multi-provider AI adapter layer with fallback and fake mocks
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: BE-EDGE-01
- **Tags**: ai, edge-functions, gemini, adapter

### Goal
Implement provider-agnostic AI adapter in `_shared/ai/adapter.ts` supporting Gemini, Anthropic/OpenAI, and local deterministic mock testing.

### Implementation Details
- Define standard interface: `generateCompletion()`, `streamCompletion()`, `generateStructured<T>()`.
- Implement Google Gemini adapter (default primary).
- Implement secondary fallback provider.
- Implement `FakeAIAdapter` returning deterministic test fixtures when running local CI/CD tests.
- Support temperature, maxTokens, and systemInstruction parameters.

### Execution & File Ownership
- **Owns**:
  - `supabase/functions/_shared/ai/adapter.ts`
- **Conflict Prevention**: Never expose API keys to client; keys reside strictly in Edge secrets.

**Acceptance Criteria**:
- Seamless switching between Gemini and fallback providers.
- Fake adapter enables offline CI unit tests with zero cost.
- Streaming responses emit standard chunk structures.

---

### BE-EDGE-03: AI safety filter pipeline: PII redaction, prompt injection guard and moderation
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: BE-EDGE-02
- **Tags**: ai, safety, moderation, security

### Goal
Implement pre-check and post-check safety pipelines in `_shared/ai/safety.ts` protecting student conversations from inappropriate content and data leakage.

### Implementation Details
- Pre-check: Redact student PII (phone numbers, emails, physical addresses).
- Prompt injection defense: Detect and block jailbreak patterns ("ignore previous instructions").
- Inappropriate content filter: Check against prohibited educational topics and hate speech.
- Post-check: Validate model output before streaming to client.
- Log flagged safety violations to `moderation_queue` table.

### Execution & File Ownership
- **Owns**:
  - `supabase/functions/_shared/ai/safety.ts`
- **Conflict Prevention**: Keep safety rules configurable via platform settings.

**Acceptance Criteria**:
- PII redacted from student messages before reaching LLM.
- Flagged unsafe queries trigger standard safety redirect message.
- Violations logged to administrative moderation records.

---

### BE-EDGE-04: AI prompt assembly modules for educational personas and characters
- **Priority**: high | **Estimate**: 1h
- **Depends On**: BE-EDGE-02
- **Tags**: ai, prompts, personas

### Goal
Create centralized prompt templates in `_shared/ai/prompts.ts` for Pip (curious owl) and Nova (encouraging robot) personas and curriculum contexts.

### Implementation Details
- Define system prompts for student AI Tutor: Socratic guidance (hints rather than direct answers), CEFR English levels A1–B2 adaptation.
- Define system prompts for Teacher Copilot: pedagogical tone, lesson planning, rubric generation.
- Support dynamic context injection: current lesson topic, student grade level, previous mistakes history.

### Execution & File Ownership
- **Owns**:
  - `supabase/functions/_shared/ai/prompts.ts`
- **Conflict Prevention**: Keep prompts strictly aligned with AI-BEHAVIOR.md spec.

**Acceptance Criteria**:
- AI Tutor encourages students with Socratic questions.
- Adapts vocabulary and complexity according to student grade level.
- Pip and Nova distinct conversational styles reflected.

---

### BE-EDGE-05: AI Tutor streaming Edge Function with SSE protocol
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: BE-EDGE-03, BE-EDGE-04, BE-CORE-15
- **Tags**: edge-functions, ai, streaming, sse

### Goal
Implement `ai-tutor` Edge Function streaming real-time token responses to student clients via Server-Sent Events (SSE).

### Implementation Details
- Endpoint `/functions/v1/ai-tutor` receiving `{ conversation_id, message, lesson_context }`.
- Check student daily AI message limit; return 429 if quota exceeded.
- Pass student query through safety pre-check.
- Assemble prompt and stream tokens via `ReadableStream` using SSE event format (`data: { chunk: "..." }`).
- On stream completion, write full assistant reply to `ai_messages` and log tokens to `ai_usage_logs`.

### Execution & File Ownership
- **Owns**:
  - `supabase/functions/ai-tutor/**`
- **Conflict Prevention**: Follow SSE streaming specification in API contract §1.6.

**Acceptance Criteria**:
- Streams text tokens to browser with sub-500ms initial token latency.
- Rate-limiting prevents quota overruns.
- Persists final conversation message and token counts upon stream close.

---

### BE-EDGE-06: AI writing feedback and grammar check Edge Function
- **Priority**: high | **Estimate**: 2h
- **Depends On**: BE-EDGE-03
- **Tags**: edge-functions, ai, writing, feedback

### Goal
Create `ai-writing-feedback` Edge Function providing structured grammar, spelling, clarity suggestions, and CEFR level estimations for student essays.

### Implementation Details
- Endpoint `/functions/v1/ai-writing-feedback` receiving `{ text, grade_level, prompt }`.
- Run through safety pipeline.
- Request structured JSON output from LLM:
  - Overall score and CEFR level assessment
  - Strengths and areas for improvement
  - Array of inline corrections: `{ original, suggestion, explanation, category }`.
- Store feedback summary in student's `writing_drafts` or return directly.

### Execution & File Ownership
- **Owns**:
  - `supabase/functions/ai-writing-feedback/**`
- **Conflict Prevention**: Validate JSON schema using Zod parser before returning.

**Acceptance Criteria**:
- Returns valid structured JSON containing categorized writing feedback.
- Identifies spelling, grammatical, and stylistic improvements.
- Provides constructive, age-appropriate praise.

---

### BE-EDGE-07: AI dictionary lookup and English-Arabic translation Edge Function
- **Priority**: high | **Estimate**: 1h
- **Depends On**: BE-EDGE-02
- **Tags**: edge-functions, ai, translation, arabic

### Goal
Create `ai-translate` Edge Function delivering bidirectional English/Arabic translations, phonetic spelling, and contextual example sentences.

### Implementation Details
- Endpoint `/functions/v1/ai-translate` receiving `{ query, source_lang, target_lang, context }`.
- Return structured definition:
  - Translated word or sentence with Arabic diacritics (harakat)
  - Part of speech (noun, verb, adjective)
  - Phonetic pronunciation / IPA
  - 3 contextual example sentences in both languages.
- Cache common vocabulary definitions to avoid redundant model invocations.

### Execution & File Ownership
- **Owns**:
  - `supabase/functions/ai-translate/**`
- **Conflict Prevention**: Support single words and full paragraph translation.

**Acceptance Criteria**:
- Accurately translates between English and Arabic with accurate diacritics.
- Generates contextual bilingual examples for learning.
- Caches repeated lookups in Redis/PostgreSQL.

---

### BE-EDGE-08: Text-to-Speech (TTS) audio synthesis and caching Edge Function
- **Priority**: high | **Estimate**: 2h
- **Depends On**: BE-EDGE-01
- **Tags**: edge-functions, tts, audio, multimedia

### Goal
Implement `tts-synthesize` Edge Function generating clear British/American English audio pronunciation for vocabulary and listening exercises.

### Implementation Details
- Endpoint `/functions/v1/tts-synthesize` receiving `{ text, accent, speed }`.
- Check if audio file already exists in `media-audio` storage bucket via content hash.
- If cached, return signed public URL immediately.
- If not cached, call Google Cloud TTS API or ElevenLabs, stream audio bytes to Supabase Storage, and return generated URL.

### Execution & File Ownership
- **Owns**:
  - `supabase/functions/tts-synthesize/**`
- **Conflict Prevention**: Content-hash audio keys to prevent redundant generation costs.

**Acceptance Criteria**:
- Audio synthesis returns clean MP3 audio streams.
- Content hash caching prevents re-generating identical words.
- Returns pre-signed URL for direct browser playback.

---

### BE-EDGE-09: Teacher AI Copilot streaming and action card generator function
- **Priority**: high | **Estimate**: 2h
- **Depends On**: BE-EDGE-03, BE-EDGE-04, BE-OPS-20
- **Tags**: edge-functions, ai, teacher, copilot

### Goal
Implement `ai-copilot` Edge Function assisting teachers with lesson structuring, quiz generation, and producing structured `ActionCards`.

### Implementation Details
- Endpoint `/functions/v1/ai-copilot` receiving teacher chat message and workspace state.
- System prompt equips Copilot with teacher tools: course generation, quiz builder, grading assistant.
- Stream conversational reasoning to the teacher.
- If Copilot proposes a database modification (e.g. adding 5 questions to a quiz), emit structured `action_card` event in stream.
- Insert card into `ai_action_cards` table with status 'pending'.

### Execution & File Ownership
- **Owns**:
  - `supabase/functions/ai-copilot/**`
- **Conflict Prevention**: Only authenticated teachers and admins can invoke this endpoint.

**Acceptance Criteria**:
- Stream advice to teacher with high pedagogical relevance.
- Generates valid Action Cards for one-click insertion into curriculum.
- Enforces strict teacher role authorization check.

---

### BE-EDGE-10: AI assessment auto-grading Edge Function for subjective student answers
- **Priority**: high | **Estimate**: 2h
- **Depends On**: BE-EDGE-03, BE-CORE-08
- **Tags**: edge-functions, ai, grading, rubrics

### Goal
Implement `ai-grade-submission` Edge Function evaluating open-ended student responses against teacher-defined rubrics.

### Implementation Details
- Endpoint `/functions/v1/ai-grade-submission` receiving `{ attempt_id, question_id, student_answer, rubric_id }`.
- Evaluate student answer against each rubric criterion.
- Generate suggested criterion score, explanation, and feedback suggestions.
- Write draft AI suggestions to `attempt_answers.teacher_comment` flagged as `is_ai_draft = true`.
- Teacher must review and approve; AI grades never auto-finalize without teacher signoff.

### Execution & File Ownership
- **Owns**:
  - `supabase/functions/ai-grade-submission/**`
- **Conflict Prevention**: Ensure human-in-the-loop guarantee; AI cannot publish final scores alone.

**Acceptance Criteria**:
- Evaluates essay against rubric criteria with clear rationales.
- Flags uncertain or borderline responses for teacher attention.
- Requires teacher confirmation before releasing scores to student.

---

### BE-EDGE-11: Async job runner core Edge Function for multi-step background tasks
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: BE-CORE-16
- **Tags**: edge-functions, jobs, background-tasks

### Goal
Implement `job-runner` Edge Function managing execution of queued background tasks (curriculum generation, bulk grading, exports).

### Implementation Details
- Endpoint `/functions/v1/job-runner` (triggered via webhook, cron, or admin invocation).
- Acquire next available queued job from `jobs` table with row lock (`status = 'running'`).
- Dispatch job to specific handler based on `kind` (e.g. `ai_course`, `csv_import`, `year_rollover`).
- Update progress percentage in `job_steps` at each milestone.
- Mark job 'completed' with payload, or 'failed' with error stack trace.

### Execution & File Ownership
- **Owns**:
  - `supabase/functions/job-runner/**`
- **Conflict Prevention**: Handle worker timeouts and dead-letter queue retries.

**Acceptance Criteria**:
- Asynchronously processes queued background jobs.
- Updates live progress percentages in database during execution.
- Captures runtime errors and marks job status failed cleanly.

---

### BE-EDGE-12: AI Course Generation background job handler
- **Priority**: high | **Estimate**: 2h
- **Depends On**: BE-EDGE-11
- **Tags**: edge-functions, ai, course-wizard

### Goal
Implement `ai_course` handler inside job runner generating complete curriculum: outline, units, lessons, vocabulary, and quizzes from a teacher prompt.

### Implementation Details
- Step 1: Generate course overview and unit outline (progress: 25%).
- Step 2: Expand each unit with lesson descriptions and learning objectives (progress: 50%).
- Step 3: Generate interactive lesson blocks and practice questions (progress: 75%).
- Step 4: Assemble draft course hierarchy in database, assign to teacher author, mark job finished (progress: 100%).

### Execution & File Ownership
- **Owns**:
  - `supabase/functions/job-runner/handlers/ai-course.ts`
- **Conflict Prevention**: Maintain transactional consistency so failure rolls back partial entities.

**Acceptance Criteria**:
- Creates comprehensive course draft with multiple units and lessons.
- Emits real-time progress updates through job steps.
- Produced course is saved in 'draft' state awaiting teacher review.

---

### BE-EDGE-13: CSV student and teacher bulk import validation and execution job
- **Priority**: high | **Estimate**: 2h
- **Depends On**: BE-EDGE-11
- **Tags**: edge-functions, csv, import, admin

### Goal
Implement `csv-import` background job validating uploaded roster CSVs, resolving schema conflicts, and creating user accounts in bulk.

### Implementation Details
- Parse CSV data using PapaParse/Deno std CSV parser.
- Validate rows against schema: username format, duplicate emails, valid grade level.
- Stage valid records and flag invalid rows with explicit error line numbers.
- For valid rows: generate initial temporary passwords, insert into `profiles` and `auth.users`, create class enrollments.
- Produce summary report of created accounts and download file.

### Execution & File Ownership
- **Owns**:
  - `supabase/functions/job-runner/handlers/csv-import.ts`
- **Conflict Prevention**: Chunk inserts in batches of 100 to prevent database query timeouts.

**Acceptance Criteria**:
- Validates 500+ student rows within 5 seconds.
- Pinpoints errors to exact row and column numbers.
- Safely generates bulk student accounts with temporary passwords.

---

### BE-EDGE-14: Academic year rollover background job with rollback support
- **Priority**: high | **Estimate**: 2h
- **Depends On**: BE-EDGE-11
- **Tags**: edge-functions, rollover, admin

### Goal
Implement `year-rollover` job archiving past academic terms, advancing student grade levels, creating next-year classes, and storing reversal snapshot.

### Implementation Details
- Verify Super Admin authorization.
- Capture pre-rollover snapshot in database to allow 48-hour rollback.
- Archive classes from concluding term.
- Advance student grades (e.g. Grade 5 -> Grade 6).
- Create new academic classes for next school year.
- Log action in `audit_log`.

### Execution & File Ownership
- **Owns**:
  - `supabase/functions/job-runner/handlers/year-rollover.ts`
- **Conflict Prevention**: Ensure rollback capability is thoroughly tested before rollout.

**Acceptance Criteria**:
- Successfully shifts student grades and archives past classes.
- Rollback operation cleanly restores students to previous grades if triggered.
- Logs full administrative audit trail.

---

### BE-EDGE-15: Storage upload pre-signed URL generator and SVG/rich text sanitizer
- **Priority**: high | **Estimate**: 1h
- **Depends On**: BE-EDGE-01
- **Tags**: edge-functions, storage, upload, security

### Goal
Create `storage-upload` Edge Function issuing presigned URLs for media uploads with MIME validation and SVG sanitizer.

### Implementation Details
- Endpoint `/functions/v1/storage-upload` receiving `{ bucket, filename, content_type, size_bytes }`.
- Validate file size limits (avatars: 2MB, images: 10MB, audio: 25MB).
- If SVG, parse and strip dangerous script tags, onload handlers, and foreignObject elements.
- Return pre-signed upload URL for direct client-to-storage upload.

### Execution & File Ownership
- **Owns**:
  - `supabase/functions/storage-upload/**`
- **Conflict Prevention**: Never allow arbitrary file uploads without extension and MIME validation.

**Acceptance Criteria**:
- Issues secure pre-signed upload URLs for authorized users.
- Blocks prohibited file types (.exe, .html, unsafe .svg).
- Enforces strict bucket-specific file size limits.

---

### BE-EDGE-16: Global search Edge Function across courses, questions, students and help docs
- **Priority**: medium | **Estimate**: 1h
- **Depends On**: BE-EDGE-01
- **Tags**: edge-functions, search, full-text-search

### Goal
Implement `global-search` Edge Function executing high-speed, role-filtered searches across curriculum, assessments, users, and platform articles.

### Implementation Details
- Endpoint `/functions/v1/global-search` receiving query string and active role.
- Perform full-text search using PostgreSQL `websearch_to_tsquery` and trigram matching.
- Filter results based on caller's role (students only see published courses; teachers see their students and class assessments; admins see all).
- Return grouped results: `{ courses: [...], lessons: [...], assessments: [...], users: [...] }`.

### Execution & File Ownership
- **Owns**:
  - `supabase/functions/global-search/**`
- **Conflict Prevention**: Enforce strict role-based output filtering.

**Acceptance Criteria**:
- Sub-100ms search results across multi-table corpus.
- Renders results grouped by category with highlighted search snippets.
- Strict data privacy: students cannot search other students' grades.

---

### BE-EDGE-17: Realtime WebSocket channel authorization and broadcast dispatcher
- **Priority**: high | **Estimate**: 1h
- **Depends On**: BE-EDGE-01
- **Tags**: edge-functions, realtime, websockets

### Goal
Create Edge Function middleware and webhook handlers coordinating Supabase Realtime channel broadcasts for notifications, grading presence, and platform announcements.

### Implementation Details
- Authorize Realtime channel subscriptions:
  - `notifications:{user_id}` (user private)
  - `class:{class_id}` (enrolled students and teachers)
  - `grading:{assessment_id}` (teacher presence lock)
  - `platform:announcements` (broadcast to all)
- Dispatch events on database mutation triggers.

### Execution & File Ownership
- **Owns**:
  - `supabase/functions/realtime-dispatcher/**`
- **Conflict Prevention**: Follow Realtime channel topology in backend docs §8.

**Acceptance Criteria**:
- Prevents unauthorized users from subscribing to other users' channels.
- Broadcasts new notifications and announcements with sub-200ms delivery.
- Presence tracking prevents multiple teachers from editing same grade.

---

### BE-EDGE-18: Scheduled cron tasks: daily midnight rollover, auto-submit quizzes and cleanup
- **Priority**: high | **Estimate**: 1h
- **Depends On**: BE-OPS-07, BE-OPS-11
- **Tags**: edge-functions, cron, maintenance, streaks

### Goal
Implement scheduled maintenance cron functions in Edge Functions or pg_cron: midnight streak updates, expiring timed quiz attempts, and temporary files cleanup.

### Implementation Details
- Daily midnight job: evaluate unactive students, consume streak freezes or reset streaks, generate fresh daily quests.
- Every 5-minutes job: scan `assessment_attempts` where `expires_at < app_now()` and status is still 'in_progress'; invoke `submit_quiz_attempt` automatically.
- Weekly job: refresh materialized views and prune expired upload tokens.

### Execution & File Ownership
- **Owns**:
  - `supabase/functions/cron-maintenance/**`
- **Conflict Prevention**: Operations must be idempotent and fault-tolerant.

**Acceptance Criteria**:
- Timed out quiz attempts are automatically graded and submitted.
- Streaks accurately transition at midnight in school timezone.
- Cron logs execution status and duration in scheduler_state.

---

## Block: BE-OPS (20 tasks)

### BE-OPS-01: Public platform state and server time RPC functions
- **Priority**: high | **Estimate**: 1h
- **Depends On**: BE-CORE-18
- **Tags**: rpc, database, public-api

### Goal
Implement `get_public_state()` and `server_time()` RPCs providing unauthenticated visitors with platform operational status and synchronized timestamps.

### Implementation Details
- Create function `get_public_state()` returning JSON: `{ maintenance_mode: boolean, registration_enabled: boolean, school_name: text, current_academic_year: text }`.
- Create function `server_time()` returning current `timestamptz` using `app_now()`.
- Grant execute permissions to `anon` and `authenticated` roles.

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_ops_01_public_state.sql`
- **Conflict Prevention**: Keep public RPCs lightweight; no expensive joins.

**Acceptance Criteria**:
- `get_public_state()` executes without auth token and returns accurate config.
- `server_time()` matches database system clock for anti-cheat synchronization.

---

### BE-OPS-02: Session context resolution and role verification RPC
- **Priority**: critical | **Estimate**: 1h
- **Depends On**: BE-CORE-18
- **Tags**: rpc, auth, session

### Goal
Implement `get_session_context()` RPC resolving user profile, role permissions, active enrollments, and unread notification counts on startup.

### Implementation Details
- Create function `get_session_context()` reading `auth.uid()`.
- Return structured JSON containing:
  - User profile (display name, avatar, equipped theme, must_change_password)
  - Active role & effective permissions
  - Enrolled classes (for student) or teaching classes (for teacher)
  - Unread notifications count and active streak count
- Verify account status is 'active'; raise exception if 'locked' or 'archived'.

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_ops_02_session_context.sql`
- **Conflict Prevention**: Single query aggregation via JSONB to optimize login roundtrips.

**Acceptance Criteria**:
- Returns full user context in a single roundtrip (<25ms).
- Rejects locked or banned accounts with explicit error code.
- Unread counts accurately reflect unread notification table records.

---

### BE-OPS-03: Class enrollment by join code and student invite RPCs
- **Priority**: high | **Estimate**: 1h
- **Depends On**: BE-CORE-18
- **Tags**: rpc, classes, enrollment

### Goal
Implement transactional functions for students joining classes via 6-character codes and accepting teacher invites.

### Implementation Details
- Implement `join_class_by_code(code text)` verifying active class, enrolling student in `class_enrollments`, and creating enrollment notification.
- Implement `respond_class_invite(class_id uuid, accept boolean)`.
- Implement `rotate_join_code(class_id uuid)` allowing teachers to regenerate unique join code.

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_ops_03_enrollment_rpcs.sql`
- **Conflict Prevention**: Use `SELECT FOR UPDATE` on `classes` to prevent race conditions.

**Acceptance Criteria**:
- Student successfully joins class using valid code.
- Duplicate enrollment attempts handled idempotently without error.
- Invalid or expired codes return clean user error.

---

### BE-OPS-04: Teacher roster management and student removal RPCs
- **Priority**: high | **Estimate**: 1h
- **Depends On**: BE-CORE-18
- **Tags**: rpc, teacher, roster

### Goal
Create teacher RPCs to add students directly, remove students from classes, and transfer class ownership.

### Implementation Details
- Implement `add_students_to_class(class_id uuid, student_ids uuid[])`.
- Implement `remove_student_from_class(class_id uuid, student_id uuid, reason text)`.
- Enforce caller is authenticated primary teacher or admin of the specified class.
- Record changes in `audit_log`.

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_ops_04_teacher_roster.sql`
- **Conflict Prevention**: Validate teacher permissions using `is_teacher_of_class`.

**Acceptance Criteria**:
- Teachers can bulk enroll existing students.
- Removing student preserves past assignment grades but sets enrollment to 'archived'.
- Non-teachers cannot modify rosters.

---

### BE-OPS-05: XP reward engine with daily caps and level progression calculation
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: BE-CORE-18
- **Tags**: rpc, gamification, xp, economy

### Goal
Implement `award_xp(student_id uuid, amount int, source text, ref_id uuid)` RPC with daily cap enforcement, level threshold calculation, and ledger recording.

### Implementation Details
- Read daily XP cap from `platform_settings` (default 1000 XP/day).
- Check sum of XP earned today in `xp_ledger`; clamp reward if approaching cap.
- Insert immutable record into `xp_ledger`.
- Compute new level according to non-linear XP curve (`level = floor(sqrt(total_xp / 100)) + 1`).
- If level increases, trigger level-up celebration event and award bonus coins.
- Update `student_stats`.

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_ops_05_award_xp.sql`
- **Conflict Prevention**: Must be atomic and thread-safe.

**Acceptance Criteria**:
- XP awards strictly logged to `xp_ledger`.
- Daily caps prevent exploitative grinding.
- Level changes accurately calculated and returned in AwardResult JSON.

---

### BE-OPS-06: Coin transaction engine with balance checks and fraud prevention
- **Priority**: critical | **Estimate**: 1h
- **Depends On**: BE-OPS-05
- **Tags**: rpc, coins, economy

### Goal
Implement `award_coins` and `spend_coins` RPCs with strict balance validation and atomic deduction.

### Implementation Details
- Implement `award_coins(student_id uuid, amount int, source text, ref_id uuid)` writing to `coin_ledger` and incrementing `student_stats.current_coins`.
- Implement `spend_coins(student_id uuid, amount int, reason text, item_id uuid)`:
  - Check `current_coins >= amount`; raise insufficient funds error if balance is low.
  - Insert negative transaction to `coin_ledger`.
  - Decrement `student_stats.current_coins`.
- All operations run within transaction isolation.

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_ops_06_coins.sql`
- **Conflict Prevention**: No client should ever update `current_coins` directly; RPC only.

**Acceptance Criteria**:
- Coins cannot drop below zero.
- Double-spend attempts are caught by transaction locks.
- Every coin delta has an audit entry in `coin_ledger`.

---

### BE-OPS-07: Daily streak tracking and streak freeze consumption logic
- **Priority**: high | **Estimate**: 2h
- **Depends On**: BE-OPS-05
- **Tags**: rpc, gamification, streaks

### Goal
Implement daily streak maintenance RPCs: recording activity, maintaining streak counts, and consuming streak freezes on missed days.

### Implementation Details
- Implement `record_daily_activity(student_id uuid)`:
  - Check `streak_days` for today; if exists, increment xp counter.
  - If yesterday had activity, increment `current_streak`.
  - If yesterday was missed but student has `streak_freeze_count > 0`, use freeze, mark yesterday frozen, preserve streak.
  - Otherwise, reset `current_streak = 1`.
  - Update `longest_streak` if current exceeds it.
- Implement `buy_streak_freeze(student_id uuid)` spending coins to add freeze item.

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_ops_07_streaks.sql`
- **Conflict Prevention**: Use school timezone or UTC standard from platform config.

**Acceptance Criteria**:
- Streak increments accurately on consecutive active days.
- Streak freeze automatically protects broken streak if available.
- Longest streak record updates when personal record broken.

---

### BE-OPS-08: Course snapshot publication and versioning RPC
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: BE-CORE-18
- **Tags**: rpc, curriculum, publishing

### Goal
Implement `publish_course(course_id uuid)` and `publish_course_changes(course_id uuid)` RPCs creating immutable content snapshots.

### Implementation Details
- Verify course has at least 1 unit and 1 lesson with valid content.
- Package full course tree (units, lessons, blocks, question references) into JSON snapshot.
- Store snapshot in `content_snapshots` with incremented version number.
- Update `courses.status = 'published'` and record `published_at` timestamp.
- Trigger Realtime broadcast notifying enrolled classes of curriculum update.

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_ops_08_publish_course.sql`
- **Conflict Prevention**: Validate that non-authors/non-admins cannot publish courses.

**Acceptance Criteria**:
- Snapshots are completely self-contained and immutable.
- Existing student progress remains intact across course updates.
- Validation prevents publishing empty or broken courses.

---

### BE-OPS-09: Lesson progress tracking and activity submission RPCs
- **Priority**: high | **Estimate**: 1h
- **Depends On**: BE-OPS-05, BE-OPS-07
- **Tags**: rpc, progress, lessons

### Goal
Implement `complete_lesson(lesson_id uuid)` and `submit_activity(activity_id uuid, answers jsonb)` updating student progress and awarding rewards.

### Implementation Details
- Check if lesson was already completed by student; if already completed, award repeat bonus (reduced XP) or 0 XP to prevent farming.
- If first completion, invoke `award_xp` and `award_coins` according to lesson rewards.
- Mark `lesson_progress.is_completed = true`.
- Check if all lessons in current unit completed; if yes, unlock next unit.
- Record activity in streak engine.

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_ops_09_lesson_progress.sql`
- **Conflict Prevention**: Return complete AwardResult with level-up flags in JSON.

**Acceptance Criteria**:
- Lesson completion marks progress and unlocks downstream units.
- First-time completion awards full configured XP and coins.
- Re-completing past lessons adheres to repeat reward policy.

---

### BE-OPS-10: Quiz attempt lifecycle: start attempt and timing validation RPC
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: BE-CORE-18
- **Tags**: rpc, quizzes, assessments

### Goal
Implement `start_quiz_attempt(assessment_id uuid)` creating attempt record, calculating deadline, and enforcing attempt limit rules.

### Implementation Details
- Check student enrollment in the assessment's class.
- Verify assessment is currently published and not past strict closing deadline.
- Count existing attempts; raise error if `attempt_count >= max_attempts`.
- If `time_limit_minutes` is set, calculate `expires_at = app_now() + interval`.
- Insert `assessment_attempts` record with status 'in_progress'.
- If assessment specifies shuffle, randomize question sequence for this attempt.

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_ops_10_start_quiz.sql`
- **Conflict Prevention**: Return questions WITHOUT `correct_answer` or explanations.

**Acceptance Criteria**:
- Successfully initializes quiz attempt with server-side time tracking.
- Answer keys are strictly omitted from student payload.
- Attempt limit prevents unauthorized extra takes.

---

### BE-OPS-11: Quiz autosave answers and atomic submission RPC
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: BE-OPS-10, BE-OPS-05
- **Tags**: rpc, quizzes, grading

### Goal
Implement `save_quiz_answers(attempt_id uuid, answers jsonb)` and `submit_quiz_attempt(attempt_id uuid)` with automated objective scoring.

### Implementation Details
- Implement autosave writing partial answers to `attempt_answers` without grading.
- Implement `submit_quiz_attempt`:
  - Verify attempt is in 'in_progress' state.
  - Verify elapsed time does not exceed limit (with 30-second grace period for network latency).
  - Iterate through objective questions (multiple choice, matching, fill blank), comparing student answers against `correct_answer`.
  - Calculate total score and percentage.
  - Set `status = 'submitted'` or `'graded'` (if 100% auto-graded).
  - Award XP and coins proportional to score.

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_ops_11_submit_quiz.sql`
- **Conflict Prevention**: Grade calculation performed entirely on server.

**Acceptance Criteria**:
- Auto-grades objective questions with 100% accuracy.
- Enforces strict timer expiration policy.
- Awards XP and coins based on percentage scored.

---

### BE-OPS-12: Assignment submission, late policy enforcement and draft saving RPCs
- **Priority**: high | **Estimate**: 1h
- **Depends On**: BE-CORE-18
- **Tags**: rpc, assignments, submission

### Goal
Implement student assignment draft saving, final submission, and automatic late penalty calculations.

### Implementation Details
- Implement `save_assignment_draft(assessment_id uuid, draft_data jsonb)`.
- Implement `submit_assignment(assessment_id uuid, submission_data jsonb)`:
  - Check submission time against `due_date`.
  - If late, verify class rules allow late work. Apply late penalty deduction percentage.
  - Set status to 'submitted', add submission to teacher grading queue.
  - Notify class teachers of new submission.

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_ops_12_assignment_submission.sql`
- **Conflict Prevention**: Preserve draft history if resubmissions are allowed.

**Acceptance Criteria**:
- Saves drafts with zero data loss.
- Flags late submissions and correctly calculates penalty percentage.
- Adds submission to teacher grading queue.

---

### BE-OPS-13: Teacher grading submission, rubric scoring and score release RPCs
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: BE-OPS-11, BE-OPS-12
- **Tags**: rpc, teacher, grading, rubrics

### Goal
Implement teacher grading functions: locking submissions for review, saving rubric scores, overriding totals, and releasing grades to students.

### Implementation Details
- Implement `lock_submission_for_grading(attempt_id uuid)` preventing multiple teachers from grading simultaneously.
- Implement `save_grade(attempt_id uuid, rubric_scores jsonb, feedback text, final_score numeric)`:
  - Write detailed breakdown to `attempt_answers`.
  - Update `assessment_attempts.score` and status.
  - Log modification in `grade_history`.
- Implement `release_grades(assessment_id uuid)` publishing scores to students and sending notifications.

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_ops_13_teacher_grading.sql`
- **Conflict Prevention**: Verify teacher owns the class before permitting grading.

**Acceptance Criteria**:
- Concurrency lock prevents grading collisions between co-teachers.
- Rubric criteria scores saved and summed accurately.
- Releasing grades broadcasts notification to enrolled students.

---

### BE-OPS-14: Daily and weekly quest generation and reward claim RPCs
- **Priority**: high | **Estimate**: 2h
- **Depends On**: BE-OPS-05, BE-OPS-06
- **Tags**: rpc, quests, rewards, gamification

### Goal
Implement automated quest generation for students and `claim_quest_reward(instance_id uuid)` with chest opening animations.

### Implementation Details
- Implement `generate_daily_quests(student_id uuid)`:
  - Select 3 daily quests from active templates (e.g. complete 1 lesson, practice 10 vocab words, play 1 minigame).
  - Set expiration to midnight in school timezone.
- Implement `claim_quest_reward(instance_id uuid)`:
  - Verify `is_completed = true` and `is_claimed = false`.
  - Award quest XP and coins via reward engine.
  - Mark `is_claimed = true`.
  - Return chest rewards payload (XP, coins, chance for streak freeze).

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_ops_14_quests_claim.sql`
- **Conflict Prevention**: Prevent duplicate claiming via row locking.

**Acceptance Criteria**:
- Students receive 3 personalized daily quests each day.
- Claiming rewards updates XP/coins and marks quest claimed.
- Cannot claim incomplete quests.

---

### BE-OPS-15: Badge evaluation and award engine triggers
- **Priority**: high | **Estimate**: 2h
- **Depends On**: BE-OPS-05, BE-OPS-07
- **Tags**: rpc, badges, achievements

### Goal
Implement automated badge evaluation engine that triggers on XP awards, streaks, quiz completions, and reading milestones.

### Implementation Details
- Create function `evaluate_badges_for_student(student_id uuid, event_type text)`.
- Check unearned badges against conditions:
  - Streak badges (7 days, 30 days, 100 days)
  - XP milestones (10,000 XP, 50,000 XP)
  - Perfect quiz score badges
  - Bookworm badges (reading lessons completed)
- Insert earned badges into `user_badges` and send achievement notification.
- Implement `pin_badges(student_id uuid, badge_ids uuid[])` supporting up to 3 pinned badges.

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_ops_15_badges.sql`
- **Conflict Prevention**: Execute evaluation asynchronously or efficiently to avoid delaying user actions.

**Acceptance Criteria**:
- Badges automatically award upon meeting criteria.
- Achievement notification generated for newly unlocked badges.
- Up to 3 badges can be pinned to student public profile.

---

### BE-OPS-16: Class and school leaderboard ranking calculation RPCs
- **Priority**: high | **Estimate**: 1h
- **Depends On**: BE-OPS-05
- **Tags**: rpc, leaderboard, gamification

### Goal
Implement `get_leaderboard(class_id uuid, timeframe text)` RPC returning real-time rankings with tie-breakers and privacy masking.

### Implementation Details
- Timeframes: `'week'`, `'month'`, `'all_time'`.
- Calculate sum of XP earned within timeframe from `xp_ledger` for all students in class.
- Sort by XP descending, secondary sort by earliest timestamp.
- Include student rank, display name, avatar, and equipped badge.
- Support optional anonymization if class rule mandates private leaderboards.

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_ops_16_leaderboards.sql`
- **Conflict Prevention**: Optimize with composite indexes on `xp_ledger(student_id, created_at)`.

**Acceptance Criteria**:
- Ranks calculate within <50ms even with thousands of ledger entries.
- Weekly and monthly timeframes filter strictly within calendar dates.
- Returns current user's relative ranking position.

---

### BE-OPS-17: Minigame score validation, session recording and rewards RPC
- **Priority**: medium | **Estimate**: 1h
- **Depends On**: BE-OPS-05, BE-OPS-06
- **Tags**: rpc, games, minigames

### Goal
Implement `record_game_session(game_slug text, score int, accuracy numeric, duration int)` validating game constraints and awarding XP.

### Implementation Details
- Validate score sanity (e.g. max theoretical score per minute) to deter script injection.
- Check if game is the Daily Featured Game; apply 1.5x bonus multiplier if active.
- Calculate XP and coin earnings based on score and duration.
- Record session in `game_sessions`.
- Update student game best score and streak activity.

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_ops_17_game_session.sql`
- **Conflict Prevention**: Rate-limit game session submissions to prevent spamming.

**Acceptance Criteria**:
- Unrealistic scores (> max threshold) rejected or flagged for audit.
- Daily featured game bonus correctly applied.
- Game session successfully awards XP and coins.

---

### BE-OPS-18: Virtual shop purchase transaction and inventory equip RPCs
- **Priority**: high | **Estimate**: 1h
- **Depends On**: BE-OPS-06
- **Tags**: rpc, shop, inventory, economy

### Goal
Implement `purchase_shop_item(item_id uuid)` and `equip_inventory_item(item_id uuid)` RPCs.

### Implementation Details
- In `purchase_shop_item`:
  - Check item exists and `is_available = true`.
  - Check student meets `required_level`.
  - Check student does not already own the item.
  - Deduct coins atomically via `spend_coins`.
  - Insert record into `user_inventory`.
- In `equip_inventory_item`:
  - Verify student owns item.
  - If theme item, update `profiles.equipped_theme`.
  - If avatar item, update `profiles.avatar_url` or custom avatar configuration.

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_ops_18_shop_purchase.sql`
- **Conflict Prevention**: Atomically enforce inventory uniqueness and coin deduction.

**Acceptance Criteria**:
- Students cannot purchase items they lack coins or levels for.
- Cannot purchase duplicate items.
- Equipping updates profile theme or avatar immediately.

---

### BE-OPS-19: School-wide announcement publishing and fan-out notification trigger
- **Priority**: high | **Estimate**: 1h
- **Depends On**: BE-CORE-18
- **Tags**: rpc, announcements, notifications

### Goal
Implement `publish_announcement` RPC and fan-out trigger distributing notifications to all targeted students and staff.

### Implementation Details
- Validate author is authorized teacher or admin.
- Insert record into `announcements`.
- For targeted audience (school or class), bulk insert recipient entries into `announcement_recipients`.
- Bulk create in-app notification rows for active members.
- If urgent priority, trigger Realtime push broadcast.

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_ops_19_announcements.sql`
- **Conflict Prevention**: Chunk recipient insertions for large student populations.

**Acceptance Criteria**:
- Announcements create recipient rows for all target users.
- Urgent broadcasts immediately emit Realtime channel event.
- Non-privileged users blocked from creating announcements.

---

### BE-OPS-20: Action card lifecycle: apply, undo and discard stored procedures
- **Priority**: high | **Estimate**: 2h
- **Depends On**: BE-CORE-18
- **Tags**: rpc, ai, action-cards

### Goal
Implement `apply_action_card(card_id uuid, edits jsonb)`, `undo_action_card(card_id uuid)`, and `discard_action_card(card_id uuid)` RPCs.

### Implementation Details
- In `apply_action_card`:
  - Validate caller is card recipient / conversation owner.
  - Execute card action (e.g. insert quiz question, update lesson plan, enroll student).
  - Save snapshot of changes in card payload to allow reversal.
  - Set `status = 'applied'` and timestamp.
- In `undo_action_card`:
  - Reverse the changes created by card.
  - Set `status = 'undone'`.
- In `discard_action_card`:
  - Set `status = 'discarded'`.

### Execution & File Ownership
- **Owns**:
  - `supabase/migrations/*_ops_20_action_cards.sql`
- **Conflict Prevention**: Validate schema integrity before applying card modifications.

**Acceptance Criteria**:
- Applying card mutates target entity exactly as previewed.
- Undo cleanly restores previous database state.
- Unauthorized users cannot apply action cards.

---

## Block: FND (16 tasks)

### FND-01: Scaffold cleanup, pnpm migration and directory layout
- **Priority**: critical | **Estimate**: 1h
- **Tags**: setup, tooling, pnpm

### Goal
Migrate repository tooling to pnpm, clean up outdated scaffold files, and establish the Page Alone directory layout in frontend according to ARCHITECTURE §1 and §3.

### Implementation Details
- Remove obsolete scaffold mock files and unused starter assets.
- Configure pnpm workspace/package manifests and enforce engine constraints (`node >= 20`, `pnpm >= 9`).
- Establish standard folder structure:
  - `frontend/src/app/` (core app entry, router, providers)
  - `frontend/src/pages/` (isolated page bundles)
  - `frontend/src/shared/` (components, api, hooks, utils, types, styles)
  - `frontend/src/assets/` (fonts, audio sprites, images)

### Execution & File Ownership
- **Owns**:
  - `frontend/package.json`
  - `frontend/pnpm-lock.yaml`
  - `frontend/src/main.tsx`
  - `frontend/src/app/**`
  - `frontend/src/shared/**`
- **Conflict Prevention**: Do not modify files in `frontend/docs` or `backend/docs`. Coordinate with FND-02 for compiler configurations.

**Acceptance Criteria**:
- Clean pnpm install passes without warnings or duplicate react instances.
- Directory structure strictly mirrors ARCHITECTURE §3.
- Page Alone convention documented in README or frontend/README.
- Zero leftover boilerplate landing pages or placeholder files in src.

---

### FND-02: Strict TypeScript, ESLint, Prettier and path aliases
- **Priority**: high | **Estimate**: 1h
- **Depends On**: FND-01
- **Tags**: tooling, typescript, linting

### Goal
Set up rigorous TypeScript compiler settings, ESLint flat config with React and accessibility plugins, Prettier, and path aliases (`@/*` pointing to `frontend/src/*`).

### Implementation Details
- Update `tsconfig.json` and `tsconfig.node.json` with strict null checks, no implicit any, verbatimModuleSyntax, and path aliases (`@/*`).
- Configure ESLint with `typescript-eslint`, `eslint-plugin-react-hooks`, and `eslint-plugin-jsx-a11y`.
- Configure `prettier.config.js` with consistent indentation, single quotes/double quotes rules, and tailwindcss sorting plugin.
- Add npm scripts: `typecheck`, `lint`, `format:check`.

### Execution & File Ownership
- **Owns**:
  - `frontend/tsconfig.json`
  - `frontend/tsconfig.node.json`
  - `frontend/.eslintrc.cjs` (or `eslint.config.js`)
  - `frontend/.prettierrc`
  - `frontend/vite.config.ts` (alias resolution)
- **Conflict Prevention**: Only modify configuration files. Keep configs modular.

**Acceptance Criteria**:
- `pnpm typecheck` runs without errors across the codebase.
- `pnpm lint` executes cleanly and flags missing dependencies or a11y violations.
- Path alias `@/...` imports resolve correctly in IDE and Vite builds.

---

### FND-03: Testing framework setup with Vitest and React Testing Library
- **Priority**: high | **Estimate**: 1h
- **Depends On**: FND-02
- **Tags**: testing, vitest

### Goal
Configure the unit and component testing environment using Vitest, jsdom, and React Testing Library.

### Implementation Details
- Install and configure `vitest`, `@testing-library/react`, `@testing-library/user-event`, and `@testing-library/jest-dom`.
- Configure `vitest.config.ts` or integrate with `vite.config.ts` test settings with jsdom environment and setup file.
- Create `frontend/src/test/setup.ts` with matchers, cleanup routines, and mock implementations for `window.matchMedia`, `ResizeObserver`, and `IntersectionObserver`.
- Add smoke test `frontend/src/test/smoke.test.tsx` validating React render and DOM assertion.

### Execution & File Ownership
- **Owns**:
  - `frontend/vitest.config.ts`
  - `frontend/src/test/**`
- **Conflict Prevention**: Keep setup scripts isolated in test folder.

**Acceptance Criteria**:
- `pnpm test` executes synchronously and runs smoke test.
- RTL DOM matchers (`toBeInTheDocument`, etc.) operate with typed assertions.
- Browser API mocks prevent headless environment crashes.

---

### FND-04: Playwright E2E framework initialization
- **Priority**: medium | **Estimate**: 1h
- **Depends On**: FND-02
- **Tags**: testing, playwright, e2e

### Goal
Initialize Playwright E2E testing framework with multi-browser configurations and local dev server orchestration.

### Implementation Details
- Configure `playwright.config.ts` targeting chromium, webkit, and mobile viewports (Mobile Safari 375x667).
- Set up local webServer command in Playwright config (`pnpm preview` or `pnpm dev`).
- Create basic initial smoke test in `e2e/smoke.spec.ts` validating index page loading.
- Add npm script `test:e2e`.

### Execution & File Ownership
- **Owns**:
  - `frontend/playwright.config.ts`
  - `frontend/e2e/**`
- **Conflict Prevention**: Keep e2e tests out of src directory.

**Acceptance Criteria**:
- Playwright initializes without error on local headless chromium.
- Mobile viewport profile tests run at 375px width.
- Trace, video, and screenshot artifact recording configured for CI failures.

---

### FND-05: CI/CD GitHub Actions workflows for frontend and verification
- **Priority**: high | **Estimate**: 1h
- **Depends On**: FND-03, FND-04
- **Tags**: devops, ci-cd, github-actions

### Goal
Create GitHub Actions workflows to automate CI checks: typecheck, linting, unit tests, bundle budget check, and PR previews.

### Implementation Details
- Create `.github/workflows/ci.yml` executing on PR and push to main.
- Setup pnpm cache, node 20, install dependencies, run `typecheck`, `lint`, and `test`.
- Add bundle size check comparing outputs against initial budget threshold.
- Create preview build step verifying static artifact generation.

### Execution & File Ownership
- **Owns**:
  - `.github/workflows/ci.yml`
- **Conflict Prevention**: Coordinate with existing deployment workflows.

**Acceptance Criteria**:
- CI workflow passes cleanly in GitHub Actions environment.
- Any lint or type error fails PR check immediately.
- Bundle budget validation triggers warnings or failures if thresholds exceed limits.

---

### FND-06: Environment variables, validation schema and runtime config
- **Priority**: critical | **Estimate**: 1h
- **Depends On**: FND-02
- **Tags**: config, zod, env

### Goal
Establish validated environment variable configuration using Zod and Vite env typing.

### Implementation Details
- Create `frontend/src/shared/config/env.ts` parsing `import.meta.env`.
- Enforce required variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_ENV` (local, staging, production).
- Add optional flags: `VITE_ENABLE_MOCKS`, `VITE_APP_VERSION`.
- Generate `.env.example` with documented dummy development keys.
- Update `frontend/src/vite-env.d.ts` with full `ImportMetaEnv` typing.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/config/env.ts`
  - `frontend/.env.example`
  - `frontend/src/vite-env.d.ts`
- **Conflict Prevention**: Never commit actual secrets into `.env.example` or code.

**Acceptance Criteria**:
- Invalid or missing Supabase env variables throw clear startup validation error.
- Full IntelliSense available on `env` object across frontend codebase.
- `.env.example` committed with placeholder keys.

---

### FND-07: Design tokens and CSS custom properties generation
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: FND-01
- **Tags**: design-system, tokens, css

### Goal
Generate the comprehensive CSS tokens file representing all colors, worlds, neutrals, strokes, shadows, and radii specified in GLOBAL-STYLES-SPEC.

### Implementation Details
- Create `frontend/src/shared/styles/tokens.css`.
- Implement CSS variables for:
  - 6 Worlds: Coral, Amber, Mint, Sky, Violet, Rose (with 50, 100, 200, 300, 400, 500, 600, 700 shades).
  - Neutrals: Surface, Surface Elevated, Background, Stroke (solid 2px outline), Muted.
  - Arcade Shadows: `--shadow-sm` (2px 2px #000), `--shadow-md` (4px 4px #000), `--shadow-lg` (8px 8px #000).
  - Radii: `--radius-sm` (6px), `--radius-md` (12px), `--radius-lg` (20px), `--radius-pill` (9999px).
  - Font families: `--font-heading` (Fredoka), `--font-body` (Figtree), `--font-accent` (Caveat), `--font-arabic` (Amiri).

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/styles/tokens.css`
- **Conflict Prevention**: Follow exact hex values and token names in GLOBAL-STYLES §3 and §6.

**Acceptance Criteria**:
- CSS variables match GLOBAL-STYLES-SPEC §3, §6 without omission.
- Solid offset box shadows render crisp black outlines without blur.
- CSS file imports cleanly into main stylesheet.

---

### FND-08: Tailwind CSS configuration with design system mappings
- **Priority**: critical | **Estimate**: 1h
- **Depends On**: FND-07
- **Tags**: tailwind, tokens, design-system

### Goal
Configure `tailwind.config.ts` mapping Tailwind utilities directly to the design tokens and custom properties created in FND-07.

### Implementation Details
- Map custom colors (`world-coral`, `world-amber`, etc., `surface`, `stroke`).
- Map border widths (`border-2` as default stroke).
- Map retro drop shadows (`shadow-retro-sm`, `shadow-retro-md`, `shadow-retro-lg`).
- Configure typography font families: `font-heading`, `font-body`, `font-accent`, `font-arabic`.
- Configure custom animation keyframes for sticker wiggles, celebrations, and pulse.

### Execution & File Ownership
- **Owns**:
  - `frontend/tailwind.config.ts`
- **Conflict Prevention**: Keep tailwind extensions structured and strictly aligned with tokens.css.

**Acceptance Criteria**:
- Tailwind utility classes (`bg-world-coral-400`, `shadow-retro-md`, `font-heading`) compile properly.
- No arbitrary values required for primary brand elements.
- Strict 2px border defaults enforced.

---

### FND-09: Typography, Google fonts loader, Arabic fonts and font fallback stack
- **Priority**: high | **Estimate**: 1h
- **Depends On**: FND-08
- **Tags**: typography, fonts, i18n

### Goal
Set up Google Fonts and Arabic font loaders with fallback font stack to prevent layout shift (CLS).

### Implementation Details
- Configure font preloading in `frontend/index.html` for:
  - Fredoka (headings, weights 500, 600, 700)
  - Figtree (body, weights 400, 500, 600, 700)
  - Caveat (handwriting/stickers)
  - Amiri / Scheherazade New (Arabic script)
- Configure font fallback stacks with size-adjust and ascent-override in CSS to eliminate FOUT/CLS.
- Create typography utility classes in `frontend/src/shared/styles/typography.css`.

### Execution & File Ownership
- **Owns**:
  - `frontend/index.html` (font preload links)
  - `frontend/src/shared/styles/typography.css`
- **Conflict Prevention**: Test with Arabic and English character sets.

**Acceptance Criteria**:
- Fonts load without layout shift; zero cumulative layout shift (CLS < 0.05).
- Arabic texts automatically render with Amiri/Scheherazade font family.
- Heading and body styles render accurately at all breakpoints.

---

### FND-10: Global base CSS, focus rings and accessibility styles
- **Priority**: high | **Estimate**: 1h
- **Depends On**: FND-08
- **Tags**: a11y, css, focus-ring

### Goal
Create global base stylesheet establishing high-contrast accessibility focus rings, selection styling, and box-sizing resets according to GLOBAL-STYLES-SPEC.

### Implementation Details
- Create `frontend/src/shared/styles/base.css`.
- Enforce universal 2px high-visibility focus ring on `:focus-visible` with 2px offset.
- Set custom text selection colors (`selection:bg-primary-300 selection:text-black`).
- Apply standard scrollbar styling matching arcade theme.
- Ensure `prefers-reduced-motion` global killswitch disables transition/animation durations.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/styles/base.css`
  - `frontend/src/app/globals.css` (imports)
- **Conflict Prevention**: Maintain unified stylesheet imports.

**Acceptance Criteria**:
- Keyboard navigation displays clear 2px outline focus rings on all interactive elements.
- Text selection uses brand highlight styles.
- `prefers-reduced-motion` instantly pauses all CSS keyframe animations.

---

### FND-11: Supabase client initialization and typed database interface
- **Priority**: critical | **Estimate**: 1h
- **Depends On**: FND-06
- **Tags**: supabase, api, database

### Goal
Initialize the singleton Supabase browser client with strict TypeScript typing generated from the database schema.

### Implementation Details
- Create `frontend/src/shared/api/supabase.ts` initializing `createClient<Database>`.
- Configure custom storage handler, auth session persistence in `localStorage`, and auto-refresh token handling.
- Create placeholder/initial `frontend/src/shared/types/database.types.ts`.
- Add script `pnpm db:types` in `frontend/package.json` to run Supabase typegen.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/api/supabase.ts`
  - `frontend/src/shared/types/database.types.ts`
- **Conflict Prevention**: Do not hardcode Supabase keys; import strictly from `src/shared/config/env.ts`.

**Acceptance Criteria**:
- Supabase client initializes cleanly with environment variables.
- TypeScript queries against Supabase tables possess full autocomplete and type safety.
- Auth session recovery handles expired tokens without infinite reload.

---

### FND-12: Authentication context provider and session state management
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: FND-11
- **Tags**: auth, security, provider

### Goal
Implement `AuthProvider` with session lifecycle management, user profile resolution, role parsing, and lockout detection.

### Implementation Details
- Create `frontend/src/app/providers/AuthProvider.tsx` and `useAuth()` hook.
- Listen to `supabase.auth.onAuthStateChange`.
- Fetch active profile (`profiles` table) on login, caching user role (`student`, `teacher`, `admin`, `super_admin`), status (`active`, `locked`, `archived`), and must_change_password flag.
- Provide sign-in, sign-out, and refresh methods.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/app/providers/AuthProvider.tsx`
  - `frontend/src/shared/hooks/useAuth.ts`
- **Conflict Prevention**: Keep auth state independent of UI components.

**Acceptance Criteria**:
- User session state (profile, role, permissions) available across React tree via `useAuth()`.
- Login, logout, and token expiration automatically update auth state.
- Locked or password-reset-required states correctly flagged.

---

### FND-13: TanStack Query provider, global cache defaults and error normalization
- **Priority**: high | **Estimate**: 1h
- **Depends On**: FND-02
- **Tags**: tanstack-query, cache, api

### Goal
Configure `QueryClientProvider` with resilient network retry logic, stale times, and global API error normalization.

### Implementation Details
- Create `frontend/src/app/providers/QueryProvider.tsx`.
- Configure `QueryClient` default options:
  - `staleTime: 1000 * 60 * 2` (2 minutes for standard data)
  - `gcTime: 1000 * 60 * 10` (10 minutes garbage collection)
  - Retries: 2 for network failures, 0 for 401/403/404 errors.
- Create `normalizeApiError()` utility parsing Supabase PostgREST errors into typed AppError objects (`code`, `message`, `details`).

### Execution & File Ownership
- **Owns**:
  - `frontend/src/app/providers/QueryProvider.tsx`
  - `frontend/src/shared/api/error-normalizer.ts`
- **Conflict Prevention**: Standardize error types used by all subsequent API tasks.

**Acceptance Criteria**:
- Query client properly wraps application root.
- PostgREST errors are transformed into clean user-friendly error objects.
- Unauthorized calls trigger auth refresh rather than silent crashes.

---

### FND-14: React Router setup, route definitions and authentication guards
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: FND-12
- **Tags**: routing, react-router, guards

### Goal
Set up React Router v6 data router with route protection, role-based guard middleware, and redirection logic.

### Implementation Details
- Create `frontend/src/app/router.tsx` using `createBrowserRouter`.
- Implement `<ProtectedRoute />` guard checking authentication, role permissions, and user status.
- Implement role redirects: students to `/student`, teachers to `/teacher`, admins to `/admin`.
- Handle special states: unauthenticated users redirected to `/login`, `must_change_password` redirected to `/set-new-password`, `locked` users redirected to `/account-not-active`.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/app/router.tsx`
  - `frontend/src/app/guards/ProtectedRoute.tsx`
- **Conflict Prevention**: Follow route table specifications in SHARED-SPEC §6.

**Acceptance Criteria**:
- Protected routes prevent unauthenticated or unauthorized role access.
- Role-based redirect sends users to correct portal upon login.
- Deep links preserved via `?redirect=` search parameter.

---

### FND-15: Toast and modal dialog providers with retro arcade styling
- **Priority**: high | **Estimate**: 1h
- **Depends On**: FND-10
- **Tags**: ui, toast, feedback

### Goal
Create global Toast notification and modal Dialog providers styled with retro arcade borders, drop shadows, and world themes.

### Implementation Details
- Create `frontend/src/app/providers/ToastProvider.tsx` and `useToast()` hook.
- Support notification variants: `success`, `error`, `warning`, `info`, `reward` (with coins/XP icon).
- Style toasts with solid 2px outline, retro black shadow (`4px 4px #000`), and entry spring animation.
- Implement accessible Radix UI dialog primitive container for modal management.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/app/providers/ToastProvider.tsx`
  - `frontend/src/shared/components/feedback/Toast.tsx`
- **Conflict Prevention**: Ensure toasts dismiss cleanly on timeout or swipe.

**Acceptance Criteria**:
- `useToast().show({ title, type })` renders accessible toast notification.
- Toasts stack neatly at top-right or bottom-center on mobile.
- Toasts dismiss on Escape key or close button click.

---

### FND-16: Platform settings and feature flags hook with backend sync
- **Priority**: medium | **Estimate**: 1h
- **Depends On**: FND-13
- **Tags**: settings, features, hooks

### Goal
Implement `useFeatures()` and `usePlatformSettings()` hook reading active platform configuration from Supabase `platform_settings`.

### Implementation Details
- Create `frontend/src/shared/hooks/usePlatformSettings.ts`.
- Fetch global settings: maintenance mode, registration enabled, AI features enabled, sound enabled by default.
- Provide helper methods: `isFeatureEnabled(featureKey: string): boolean`.
- Gracefully fallback to safe defaults if network request fails or user is offline.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/hooks/usePlatformSettings.ts`
- **Conflict Prevention**: Read-only hook; do not implement mutation here (mutations are in ADM).

**Acceptance Criteria**:
- Platform settings load on application mount with TanStack Query.
- Disabled features can be conditionally queried across views.
- Offline state serves cached or fallback default settings.

---

## Block: PUB (14 tasks)

### PUB-01: Public landing page: Hero section, interactive stickers and arcade CTA (SH-01)
- **Priority**: high | **Estimate**: 2h
- **Depends On**: UIK-22, UIK-06
- **Tags**: public, landing, hero

### Goal
Implement public landing page hero section with Fredoka typography, animated stickers, world preview switcher, and CTA buttons linking to Sign In and Explore.

### Implementation Details
- Create `frontend/src/pages/public/LandingPage/HeroSection.tsx`.
- Animated headline with Caveat accent handwriting badge ("Welcome to Al Hikmah").
- Interactive floating sticker elements with spring hover tilt.
- Primary CTA button "Sign In to Learn" with tactile arcade press physics.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/public/LandingPage/HeroSection.tsx`
- **Conflict Prevention**: Follow SH-01 specification in SHARED-SPEC.

**Acceptance Criteria**:
- Hero renders cleanly across mobile (375px) and desktop viewports.
- Stickers have subtle floating animation conforming to performance budget.
- Primary CTA navigates to /login.

---

### PUB-02: Public landing page: Features, gamification showcase and curriculum overview
- **Priority**: medium | **Estimate**: 2h
- **Depends On**: UIK-07, UIK-20
- **Tags**: public, landing, features

### Goal
Build feature showcase sections for the landing page: gamification breakdown (XP, Quests, Arcade Minigames), AI Tutor introduction, and English curriculum structure.

### Implementation Details
- Create `frontend/src/pages/public/LandingPage/FeaturesSection.tsx` and `CurriculumSection.tsx`.
- Feature cards with 2px borders, retro offset shadows, and world color themes.
- Interactive tab switcher previewing student, teacher, and parent perspectives.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/public/LandingPage/FeaturesSection.tsx`
  - `frontend/src/pages/public/LandingPage/CurriculumSection.tsx`
- **Conflict Prevention**: Coordinate with HeroSection in assemble task PUB-03.

**Acceptance Criteria**:
- Highlights all 6 gamified pillars and AI learning companion.
- Features display responsive card grid adapting from 1 col on mobile to 3 cols on desktop.
- World colors mapped consistently.

---

### PUB-03: Public landing page assembly and scroll storytelling integration
- **Priority**: high | **Estimate**: 1h
- **Depends On**: PUB-01, PUB-02
- **Tags**: public, landing, assembly

### Goal
Assemble all landing page sections into `LandingPage.tsx` with Lenis smooth scrolling, PublicHeader, and PublicFooter integration.

### Implementation Details
- Create `frontend/src/pages/public/LandingPage/index.tsx`.
- Assemble Hero, Features, Curriculum, Testimonials, and CTA banner sections.
- Integrate Lenis smooth scrolling container.
- Connect SEO meta tags (title, description, OpenGraph images).

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/public/LandingPage/index.tsx`
- **Conflict Prevention**: Isolated in LandingPage folder.

**Acceptance Criteria**:
- Page loads without layout shift (CLS < 0.05).
- Lenis smooth scroll operates at 60fps on desktop.
- Header and footer attach seamlessly.

---

### PUB-04: Sign-in page: form validation, authentication handling and role redirect (SH-02)
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: FND-12, UIK-09, UIK-04
- **Tags**: auth, public, login

### Goal
Implement `/login` sign-in page with username/password authentication, show/hide password toggle, remember me checkbox, and error handling.

### Implementation Details
- Create `frontend/src/pages/public/LoginPage/index.tsx`.
- Form validation with Zod and React Hook Form (valid username, minimum 6 characters password).
- Invoke `supabase.auth.signInWithPassword`.
- Check user profile upon success; route student to `/student`, teacher to `/teacher`, admin to `/admin`.
- Handle lockout: redirect to `/account-not-active` if account status is 'locked'.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/public/LoginPage/**`
- **Conflict Prevention**: Follow SH-02 specification in SHARED-SPEC.

**Acceptance Criteria**:
- Valid credentials authenticate and trigger role-specific dashboard redirect.
- Invalid credentials display friendly, non-revealing error message.
- Keyboard submission via Enter key works reliably.

---

### PUB-05: Forgot password request page and school administrator instructions (SH-03)
- **Priority**: high | **Estimate**: 1h
- **Depends On**: PUB-04
- **Tags**: auth, public, forgot-password

### Goal
Implement `/forgot-password` page allowing students and staff to submit password reset requests or view school IT administrator contact steps.

### Implementation Details
- Create `frontend/src/pages/public/ForgotPasswordPage/index.tsx`.
- Input field for username or email.
- Submitting request creates entry in `password_reset_requests` table or triggers reset email.
- Display school IT contact card with office hours and physical classroom support instructions.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/public/ForgotPasswordPage/**`
- **Conflict Prevention**: Follow SH-03 in SHARED-SPEC.

**Acceptance Criteria**:
- Submits reset request and displays clear confirmation banner.
- Provides direct school helpdesk email and office hours.
- Back to sign-in link returns to /login.

---

### PUB-06: Set new password page with password strength meter (SH-04)
- **Priority**: high | **Estimate**: 1h
- **Depends On**: PUB-04
- **Tags**: auth, public, password-reset

### Goal
Implement `/set-new-password` page for first-time login force-reset or recovery token confirmation with visual strength meter.

### Implementation Details
- Create `frontend/src/pages/public/SetNewPasswordPage/index.tsx`.
- Enforce password policy: min 8 characters, at least 1 number, at least 1 symbol.
- Dynamic password strength meter with animated color bar (Weak, Good, Strong).
- Confirm password matching check.
- Update password via Supabase Auth and clear `must_change_password` profile flag.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/public/SetNewPasswordPage/**`
- **Conflict Prevention**: Follow SH-04 in SHARED-SPEC.

**Acceptance Criteria**:
- Strength meter updates dynamically on keystrokes.
- Blocks submission if password requirements are not met.
- Successfully updates password and navigates to role dashboard.

---

### PUB-07: Account not active and suspension notice page (SH-05)
- **Priority**: medium | **Estimate**: 1h
- **Depends On**: PUB-04
- **Tags**: auth, public, account-status

### Goal
Implement `/account-not-active` page explaining account status (pending activation, locked, or archived) with next steps.

### Implementation Details
- Create `frontend/src/pages/public/AccountNotActivePage/index.tsx`.
- Read active user session status or query param reason.
- Display reassuring explanation card with school IT contact details.
- Provide Sign Out button to allow logging in with another account.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/public/AccountNotActivePage/**`
- **Conflict Prevention**: Follow SH-05 in SHARED-SPEC.

**Acceptance Criteria**:
- Displays clear reason for inactive account status without revealing private system data.
- Sign Out button clears local session completely.
- Displays school support contact options.

---

### PUB-08: Help and contact the school page with inquiry form (SH-06)
- **Priority**: medium | **Estimate**: 1h
- **Depends On**: UIK-22, UIK-09
- **Tags**: public, help, contact

### Goal
Implement `/help` page with school department directory, physical campus location, office hours, and inquiry message form.

### Implementation Details
- Create `frontend/src/pages/public/HelpContactPage/index.tsx`.
- Campus map card and English Department contact card.
- Accessible contact form (Name, Student ID / Grade, Category, Message).
- Form submission feedback toast and reset.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/public/HelpContactPage/**`
- **Conflict Prevention**: Follow SH-06 in SHARED-SPEC.

**Acceptance Criteria**:
- Contact form validates inputs with helpful error hints.
- Displays official school contact channels and operating hours.
- Confirms inquiry submission with success feedback.

---

### PUB-09: Frequently Asked Questions (FAQ) page with searchable accordion (SH-07)
- **Priority**: medium | **Estimate**: 1h
- **Depends On**: UIK-21, UIK-09
- **Tags**: public, faq, search

### Goal
Build `/faq` page featuring categorized questions (Students, Parents, Teachers, Technical) with instant search filter and expandable accordions.

### Implementation Details
- Create `frontend/src/pages/public/FaqPage/index.tsx`.
- Real-time search input filtering questions by keywords.
- Categorized accordion panels utilizing UIK-21 primitive.
- Helpful "Did this answer your question?" feedback buttons.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/public/FaqPage/**`
- **Conflict Prevention**: Follow SH-07 in SHARED-SPEC.

**Acceptance Criteria**:
- Instant search filters matching questions across all categories.
- Accordion panels expand smoothly and support full keyboard navigation.
- Category pills filter visible questions.

---

### PUB-10: Terms of Service and Privacy Policy pages (SH-08)
- **Priority**: low | **Estimate**: 1h
- **Depends On**: UIK-22
- **Tags**: public, legal, privacy

### Goal
Implement `/terms` and `/privacy` legal pages detailing student privacy standards, COPPA/GDPR-K educational compliance, and acceptable platform use.

### Implementation Details
- Create `frontend/src/pages/public/LegalPage/index.tsx`.
- Formatted markdown article layout with sticky table of contents navigation.
- Highlighting student data privacy guarantees (no advertising, data isolation).
- Print stylesheet optimization (`@media print`).

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/public/LegalPage/**`
- **Conflict Prevention**: Follow SH-08 in SHARED-SPEC.

**Acceptance Criteria**:
- Clean typography and readable line lengths (max 65ch).
- Sticky table of contents links navigate directly to article sections.
- Print stylesheet removes headers/footers for clean paper copies.

---

### PUB-11: About the platform page and pedagogical mission (SH-09)
- **Priority**: low | **Estimate**: 1h
- **Depends On**: UIK-22, UIK-07
- **Tags**: public, about

### Goal
Implement `/about` page outlining Al Hikmah School's pedagogical philosophy, CEFR framework integration, and gamification principles.

### Implementation Details
- Create `frontend/src/pages/public/AboutPage/index.tsx`.
- Mission statement hero banner.
- Grid detailing the 4 language skills (Reading, Writing, Listening, Speaking).
- Mascot backstory card explaining Pip and Nova.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/public/AboutPage/**`
- **Conflict Prevention**: Follow SH-09 in SHARED-SPEC.

**Acceptance Criteria**:
- Communicates school pedagogical goals clearly with engaging arcade visuals.
- Responsive design adapts to all screen sizes.
- Accessible typography conforming to design tokens.

---

### PUB-12: Not Found 404 page with arcade mini-game easter egg (SH-10)
- **Priority**: medium | **Estimate**: 1h
- **Depends On**: UIK-04, UIK-03
- **Tags**: public, 404, easter-egg

### Goal
Implement `/404` page with playful lost character illustration, helpful navigation links, and mini playable easter egg button.

### Implementation Details
- Create `frontend/src/pages/public/NotFoundPage/index.tsx`.
- Mascot illustration of Pip looking confused with a map.
- "Return to Home" and "Go to Dashboard" CTA buttons.
- Playful Easter egg: clicking the mascot 3 times plays a celebration sound and gives a mini coin bounce animation.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/public/NotFoundPage/**`
- **Conflict Prevention**: Follow SH-10 in SHARED-SPEC.

**Acceptance Criteria**:
- Renders whenever route does not match defined patterns.
- Clear button directing user back to safe destination.
- Mascot interaction plays sound effect cleanly.

---

### PUB-13: Something Went Wrong error boundary page (SH-11)
- **Priority**: high | **Estimate**: 1h
- **Depends On**: UIK-04, UIK-07
- **Tags**: public, error-boundary, reliability

### Goal
Implement React error boundary fallback page (`SH-11`) catching unhandled client exceptions with error reporting and reload button.

### Implementation Details
- Create `frontend/src/pages/public/ErrorPage/index.tsx`.
- Gracefully render error boundary UI without crashing the window.
- Display error summary (stack trace collapsible in dev mode only).
- "Try Again" reload button and "Report Issue" action.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/public/ErrorPage/**`
- **Conflict Prevention**: Follow SH-11 in SHARED-SPEC.

**Acceptance Criteria**:
- Catches unhandled React runtime errors cleanly.
- Try Again button resets error boundary and attempts re-render.
- Sensitive stack traces hidden in production builds.

---

### PUB-14: Offline, Maintenance and No Access system pages (SH-12, SH-13, SH-14)
- **Priority**: high | **Estimate**: 1h
- **Depends On**: UIK-04, UIK-07
- **Tags**: public, offline, maintenance, security

### Goal
Implement system notification pages: `/offline` (SH-12), `/maintenance` (SH-13), and `/no-access` (SH-14).

### Implementation Details
- Create `OfflinePage.tsx` with automatic internet reconnection listener.
- Create `MaintenancePage.tsx` displaying estimated return time from platform settings.
- Create `NoAccessPage.tsx` displaying 403 Forbidden message with role switch instructions.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/public/SystemPages/**`
- **Conflict Prevention**: Follow SH-12, SH-13, SH-14 in SHARED-SPEC.

**Acceptance Criteria**:
- Offline page automatically reloads once navigator.onLine becomes true.
- Maintenance page dynamically shows return time estimate.
- No access page prevents unauthorized loops.

---

## Block: STU-CORE (24 tasks)

### STU-CORE-01: Student Dashboard: overview banner, continue learning card and quick stats (ST-01)
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: UIK-23, BE-OPS-02
- **Tags**: student, dashboard, learning

### Goal
Build primary Student Dashboard page (`ST-01`) displaying personalized welcome greeting, current level badge, 'Continue Learning' resume button, and daily XP goal bar.

### Implementation Details
- Create `frontend/src/pages/student/DashboardPage/index.tsx`.
- Fetch student stats via `useStudentStats()` (XP, level, coins, streak).
- 'Continue Learning' hero card linking to last accessed lesson or next pending activity.
- Daily XP progress bar toward target goal.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/DashboardPage/**`
- **Conflict Prevention**: Follow ST-01 specification in STUDENT-SPEC.

**Acceptance Criteria**:
- Renders student greeting with active level and avatar.
- Continue Learning button launches correct lesson.
- Daily XP bar fills proportionally to today's earnings.

---

### STU-CORE-02: Student Dashboard: upcoming deadlines and active class quests widget
- **Priority**: high | **Estimate**: 1h
- **Depends On**: STU-CORE-01
- **Tags**: student, dashboard, deadlines, quests

### Goal
Implement dashboard side widgets: upcoming assessment deadlines, unsubmitted homework alerts, and active daily quest progress previews.

### Implementation Details
- Create `frontend/src/pages/student/DashboardPage/DeadlinesWidget.tsx` and `QuestsWidget.tsx`.
- Query active deadlines via `my_deadlines` API hook.
- Highlight overdue items in coral-600 and items due within 24 hours with pulsing clock tag.
- Quest widget displays 3 daily quests with quick-claim button.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/DashboardPage/DeadlinesWidget.tsx`
  - `frontend/src/pages/student/DashboardPage/QuestsWidget.tsx`
- **Conflict Prevention**: Coordinate with STU-CORE-01 layout container.

**Acceptance Criteria**:
- Lists upcoming assignments and quizzes chronologically.
- Clicking deadline navigates directly to assessment start page.
- Quest progress counters synchronize with live database values.

---

### STU-CORE-03: Courses catalog and enrolled classes hub (ST-02)
- **Priority**: critical | **Estimate**: 1h
- **Depends On**: UIK-23, BE-OPS-09
- **Tags**: student, courses

### Goal
Implement `/student/courses` list page displaying enrolled class curricula and optional supplementary learning tracks.

### Implementation Details
- Create `frontend/src/pages/student/CoursesPage/index.tsx`.
- Fetch student courses via `my_courses` hook.
- Course cards displaying cover image, progress percentage bar, completed lessons count, and teacher name.
- Filter tabs: 'Enrolled Classes', 'Completed', 'Self-Paced'.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/CoursesPage/**`
- **Conflict Prevention**: Follow ST-02 in STUDENT-SPEC.

**Acceptance Criteria**:
- Renders grid of enrolled courses with progress bars.
- Filter tabs filter courses without re-fetching.
- Clicking course navigates to /student/courses/:courseId.

---

### STU-CORE-04: Course details and curriculum roadmap tree (ST-03)
- **Priority**: high | **Estimate**: 2h
- **Depends On**: STU-CORE-03
- **Tags**: student, course, curriculum

### Goal
Implement `/student/courses/:courseId` course details page with syllabus overview, learning objectives, and unit roadmap.

### Implementation Details
- Create `frontend/src/pages/student/CourseDetailsPage/index.tsx`.
- Fetch course tree (units and lessons) with student completion indicators.
- Display course header band with overall progress percentage and estimated time remaining.
- List units with expandable accordion or vertical roadmap layout.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/CourseDetailsPage/**`
- **Conflict Prevention**: Follow ST-03 in STUDENT-SPEC.

**Acceptance Criteria**:
- Renders complete unit hierarchy of the course.
- Highlights current in-progress unit.
- Locked units clearly indicated with lock icon according to class rules.

---

### STU-CORE-05: Unit learning map and visual lesson progression path (ST-04)
- **Priority**: high | **Estimate**: 2h
- **Depends On**: STU-CORE-04
- **Tags**: student, unit, gamification, progression

### Goal
Implement `/student/courses/:courseId/units/:unitId` unit page featuring an arcade winding path map of lessons and milestone checkpoints.

### Implementation Details
- Create `frontend/src/pages/student/UnitPage/index.tsx`.
- Visual winding progression path (stepping stones representing lessons).
- Lesson status: `completed` (green with star), `current` (pulsing active ring), `locked` (padlock icon).
- Unit checkpoint boss or quiz node at the end of the path.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/UnitPage/**`
- **Conflict Prevention**: Follow ST-04 in STUDENT-SPEC.

**Acceptance Criteria**:
- Interactive stepping-stone path linking unit lessons.
- Tooltip displays lesson title, duration, and XP reward on hover.
- Stepping stones animate slightly on hover.

---

### STU-CORE-06: Interactive lesson player: block carousel and audio narration (ST-05)
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: STU-CORE-05, UIK-03
- **Tags**: student, lesson, multimedia

### Goal
Implement `/student/lessons/:lessonId` lesson player supporting text blocks, vocabulary callouts, audio pronunciation, and video embeds.

### Implementation Details
- Create `frontend/src/pages/student/LessonPlayerPage/index.tsx`.
- Render content blocks sequentially: Introduction, Vocabulary spotlight, Reading passage, Dialogue card, Audio player.
- Integrate TTS audio playback button on vocabulary words.
- 'Continue to Practice' button navigating to attached activities upon reaching the end.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/LessonPlayerPage/**`
- **Conflict Prevention**: Follow ST-05 in STUDENT-SPEC.

**Acceptance Criteria**:
- Renders all rich lesson content blocks cleanly without layout bugs.
- Pronunciation audio plays clearly on click.
- Marks lesson accessed via `touch_lesson` RPC.

---

### STU-CORE-07: Interactive activity runner with instant feedback and reward fanfare (ST-06)
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: STU-CORE-06, UIK-26, UIK-28
- **Tags**: student, activity, exercises, feedback

### Goal
Implement `/student/lessons/:lessonId/activities/:activityId` activity solving screen using QuestionRenderer with immediate validation and celebration.

### Implementation Details
- Create `frontend/src/pages/student/ActivityPage/index.tsx`.
- Render interactive exercise questions (multiple choice, matching, sentence ordering).
- 'Check Answer' button with immediate positive reinforcement sound and haptic pulse.
- Completing activity awards XP/coins and triggers celebration fanfare.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/ActivityPage/**`
- **Conflict Prevention**: Follow ST-06 in STUDENT-SPEC.

**Acceptance Criteria**:
- QuestionRenderer handles user input and validates answer.
- Correct answer triggers success audio and celebration particles.
- Submits results to backend via `submit_activity` RPC.

---

### STU-CORE-08: Quizzes hub: active, upcoming and completed quiz tabs (ST-07)
- **Priority**: high | **Estimate**: 1h
- **Depends On**: UIK-23, BE-OPS-10
- **Tags**: student, quizzes, hub

### Goal
Implement `/student/quizzes` hub listing assigned quizzes organized by status: Available Now, Upcoming, and Completed/Graded.

### Implementation Details
- Create `frontend/src/pages/student/QuizzesHubPage/index.tsx`.
- Fetch quizzes via `my_quizzes` hook.
- Quiz cards: title, class name, question count, time limit, attempt allowance, score badge.
- Filter by status and search by quiz title.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/QuizzesHubPage/**`
- **Conflict Prevention**: Follow ST-07 in STUDENT-SPEC.

**Acceptance Criteria**:
- Separates available vs completed quizzes accurately.
- Highlights urgent quizzes due soon.
- Past quizzes show earned grade percentage.

---

### STU-CORE-09: Quiz start page: instructions, honor code and attempt launcher (ST-08)
- **Priority**: high | **Estimate**: 1h
- **Depends On**: STU-CORE-08
- **Tags**: student, quizzes, pre-flight

### Goal
Implement `/student/quizzes/:quizId` pre-flight start screen detailing rules, timer limits, attempt number, and 'Start Quiz' confirmation.

### Implementation Details
- Create `frontend/src/pages/student/QuizStartPage/index.tsx`.
- Display assessment metadata: duration, allowed attempts, passing grade, shuffle notice.
- Academic integrity pledge checkbox.
- 'Begin Attempt' button invoking `start_quiz_attempt` RPC and navigating to attempt screen.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/QuizStartPage/**`
- **Conflict Prevention**: Follow ST-08 in STUDENT-SPEC.

**Acceptance Criteria**:
- Displays clear pre-quiz instructions and time constraints.
- Prevents starting attempt if max attempts reached.
- Begin Attempt creates active database attempt and transitions to runner.

---

### STU-CORE-10: Quiz attempt runner: live timer, question navigator and autosave (ST-09)
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: STU-CORE-09, UIK-26, BE-OPS-11
- **Tags**: student, quizzes, timer, runner

### Goal
Implement `/student/quizzes/:quizId/attempt/:attemptId` focused quiz taking screen with synchronized countdown timer, question navigator grid, and autosave.

### Implementation Details
- Create `frontend/src/pages/student/QuizAttemptPage/index.tsx`.
- Floating header: synchronized countdown timer, question progress indicator, and 'Submit Quiz' button.
- Question navigator sidebar / bottom drawer showing answered vs unanswered pills.
- Autosaves answers every 30 seconds or on question change via `save_quiz_answers`.
- Fullscreen focused flow mode hiding standard sidebar navigation.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/QuizAttemptPage/**`
- **Conflict Prevention**: Follow ST-09 in STUDENT-SPEC.

**Acceptance Criteria**:
- Timer counts down accurately against server-calculated expiration.
- Question navigator highlights answered vs flagged questions.
- Unload warning prevents accidental tab closing without submission.

---

### STU-CORE-11: Quiz result page: score breakdown, item review and explanations (ST-10)
- **Priority**: high | **Estimate**: 2h
- **Depends On**: STU-CORE-10, UIK-28
- **Tags**: student, quizzes, results

### Goal
Implement `/student/quizzes/:quizId/result/:attemptId` result screen displaying final score, pass/fail badge, XP rewards, and review of questions.

### Implementation Details
- Create `frontend/src/pages/student/QuizResultPage/index.tsx`.
- Score summary card: percentage, points earned / max points, time taken.
- If passed, trigger celebration dialog and XP/coins reward fanfare.
- Question-by-question review (if quiz settings permit review): shows student answer, correct answer, and explanation.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/QuizResultPage/**`
- **Conflict Prevention**: Follow ST-10 in STUDENT-SPEC.

**Acceptance Criteria**:
- Accurately displays final score and pass/fail status.
- Triggers celebratory fanfare on high passing grades.
- Question explanations display when review mode is unlocked.

---

### STU-CORE-12: Assignments list and homework hub (ST-11)
- **Priority**: high | **Estimate**: 1h
- **Depends On**: UIK-23, BE-OPS-12
- **Tags**: student, assignments, homework

### Goal
Implement `/student/assignments` hub listing assigned written essays, worksheets, and speaking exercises with due dates and submission statuses.

### Implementation Details
- Create `frontend/src/pages/student/AssignmentsListPage/index.tsx`.
- Tabs: 'To Do', 'Submitted (Pending Review)', 'Graded'.
- Cards display title, class name, due date pill, submission status, and rubric summary.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/AssignmentsListPage/**`
- **Conflict Prevention**: Follow ST-11 in STUDENT-SPEC.

**Acceptance Criteria**:
- Filters homework assignments by active status cleanly.
- Overdue assignments flagged with clear warnings.
- Graded assignments display final teacher mark.

---

### STU-CORE-13: Assignment details, guidelines and rubric preview (ST-12)
- **Priority**: medium | **Estimate**: 1h
- **Depends On**: STU-CORE-12
- **Tags**: student, assignments, rubric

### Goal
Implement `/student/assignments/:assignmentId` overview page presenting teacher prompt, attached reference materials, and grading rubric.

### Implementation Details
- Create `frontend/src/pages/student/AssignmentDetailsPage/index.tsx`.
- Render assignment guidelines, word count targets, and resource attachments (PDFs, audio).
- Rubric criteria table detailing expectations for full credit.
- 'Start Working' button opening solving workspace.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/AssignmentDetailsPage/**`
- **Conflict Prevention**: Follow ST-12 in STUDENT-SPEC.

**Acceptance Criteria**:
- Displays clear writing prompt and formatting guidelines.
- Rubric criteria preview is fully readable.
- 'Start Working' resumes existing draft if one exists.

---

### STU-CORE-14: Assignment solving workspace: rich text editor, autosave and submit (ST-13)
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: STU-CORE-13, BE-OPS-12
- **Tags**: student, assignments, editor, tiptap

### Goal
Implement `/student/assignments/:assignmentId/solve` workspace featuring Tiptap rich text editor, live word counter, automatic draft saving, and final submit.

### Implementation Details
- Create `frontend/src/pages/student/AssignmentSolvePage/index.tsx`.
- Tiptap rich text editor (bold, italic, lists, headings).
- Live word counter and character counter.
- Autosaves draft every 15 seconds to `writing_drafts` via debounced hook.
- 'Submit for Grading' confirmation modal.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/AssignmentSolvePage/**`
- **Conflict Prevention**: Follow ST-13 in STUDENT-SPEC.

**Acceptance Criteria**:
- Seamless typing experience in rich text editor.
- Autosaves draft without UI lockup; status shows 'Saved just now'.
- Submitting marks status 'submitted' and locks editor from further edits.

---

### STU-CORE-15: Assignment feedback and teacher rubric review page (ST-14)
- **Priority**: high | **Estimate**: 1h
- **Depends On**: STU-CORE-14
- **Tags**: student, assignments, feedback, grading

### Goal
Implement `/student/assignments/:assignmentId/result` page reviewing teacher grades, rubric score breakdown, and inline margin comments.

### Implementation Details
- Create `frontend/src/pages/student/AssignmentResultPage/index.tsx`.
- Rubric score evaluation breakdown showing marks awarded per criterion.
- Read-only student text view with highlighted inline teacher comments.
- Overall teacher feedback card with audio feedback note player if provided.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/AssignmentResultPage/**`
- **Conflict Prevention**: Follow ST-14 in STUDENT-SPEC.

**Acceptance Criteria**:
- Clearly displays final letter grade / percentage.
- Rubric criteria marks detail exactly where points were earned.
- Inline teacher comments expand on hover or tap.

---

### STU-CORE-16: Vocabulary practice library and flashcards tool (ST-15)
- **Priority**: high | **Estimate**: 2h
- **Depends On**: UIK-23, UIK-03
- **Tags**: student, vocabulary, flashcards, practice

### Goal
Implement `/student/practice/vocabulary` vocabulary library with spaced repetition flashcards, audio pronunciation, and mastery status filters.

### Implementation Details
- Create `frontend/src/pages/student/VocabularyPracticePage/index.tsx`.
- Interactive 3D flip flashcard component (term, part of speech, CEFR level on front; Arabic translation, definition, and example sentence on back).
- Spaced repetition action buttons: 'Need Practice', 'Almost Got It', 'Mastered'.
- Filter by topic tag and mastery level.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/VocabularyPracticePage/**`
- **Conflict Prevention**: Follow ST-15 in STUDENT-SPEC.

**Acceptance Criteria**:
- Flashcard flips smoothly on click or Spacebar.
- Audio icon pronounces English word clearly.
- Spaced repetition ratings update mastery stats in database.

---

### STU-CORE-17: Grammar trainer: rules reference and interactive exercises (ST-16)
- **Priority**: high | **Estimate**: 2h
- **Depends On**: STU-CORE-16, UIK-26
- **Tags**: student, grammar, practice

### Goal
Implement `/student/practice/grammar` grammar workout page featuring bite-sized rule explanations and interactive sentence correction drills.

### Implementation Details
- Create `frontend/src/pages/student/GrammarPracticePage/index.tsx`.
- Topic selector: Tenses, Prepositions, Conditionals, Modals, Passive Voice.
- Interactive sentence unscrambling and error-spotting exercises.
- Instant explanations detailing grammatical rules on mistakes.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/GrammarPracticePage/**`
- **Conflict Prevention**: Follow ST-16 in STUDENT-SPEC.

**Acceptance Criteria**:
- Modular grammar exercise cards with immediate feedback.
- Explains grammatical rule rationale on error.
- Tracks completed drills toward daily XP goals.

---

### STU-CORE-18: Reading room: leveled passages, comprehension questions and audio read-along (ST-17)
- **Priority**: high | **Estimate**: 2h
- **Depends On**: STU-CORE-16, UIK-15
- **Tags**: student, reading, practice, audio

### Goal
Implement `/student/practice/reading` reading lab featuring leveled stories, synchronized audio read-along, and comprehension checkpoints.

### Implementation Details
- Create `frontend/src/pages/student/ReadingPracticePage/index.tsx`.
- CEFR leveled stories (A1 to B2) with reading time estimates.
- Synchronized read-along highlighting active sentence in sync with audio narration.
- Comprehension quiz questions at conclusion of passage.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/ReadingPracticePage/**`
- **Conflict Prevention**: Follow ST-17 in STUDENT-SPEC.

**Acceptance Criteria**:
- Highlights text in sync with audio playback.
- Word definition popover appears on clicking difficult words.
- Comprehension quiz awards XP upon completion.

---

### STU-CORE-19: Writing workshop: prompts, guided scaffolding and drafting tool (ST-18)
- **Priority**: high | **Estimate**: 2h
- **Depends On**: STU-CORE-14, BE-EDGE-06
- **Tags**: student, writing, practice

### Goal
Implement `/student/practice/writing` guided writing lab with creative/academic prompts, sentence starters, and structured essay templates.

### Implementation Details
- Create `frontend/src/pages/student/WritingPracticePage/index.tsx`.
- Prompt gallery categorized by type: Story, Opinion, Email, Review.
- Sentence starter chips that can be inserted with one click.
- Integrated AI feedback trigger connecting to `ai-writing-feedback` Edge Function.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/WritingPracticePage/**`
- **Conflict Prevention**: Follow ST-18 in STUDENT-SPEC.

**Acceptance Criteria**:
- Clicking sentence starter inserts phrase into editor.
- AI feedback button triggers structured grammar and vocabulary review.
- Saves writing drafts safely in background.

---

### STU-CORE-20: Bilingual translation workbench and custom vocabulary notebook (ST-19)
- **Priority**: medium | **Estimate**: 1h
- **Depends On**: STU-CORE-16, BE-EDGE-07
- **Tags**: student, translation, arabic, vocabulary

### Goal
Implement `/student/practice/translation` translation workbench with English-Arabic lookup, phonetic audio, and 'Add to My Words' notebook saver.

### Implementation Details
- Create `frontend/src/pages/student/TranslationPracticePage/index.tsx`.
- Bidirectional search bar with instant translation powered by `ai-translate` function.
- Detailed card: Arabic with harakat, phonetic spelling, part of speech, and 3 example sentences.
- 'Save to My Words' button adding entry to student's personal vocabulary bank.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/TranslationPracticePage/**`
- **Conflict Prevention**: Follow ST-19 in STUDENT-SPEC.

**Acceptance Criteria**:
- Displays accurate Arabic translation with vowel marks.
- Pronunciation audio plays on click.
- 'Save to My Words' persists word into student's personal review deck.

---

### STU-CORE-21: Student profile, stats overview and pinned badges showcase (ST-28)
- **Priority**: high | **Estimate**: 1h
- **Depends On**: UIK-23, UIK-08
- **Tags**: student, profile, stats, badges

### Goal
Implement `/student/profile` page displaying lifetime stats, total XP, current level, streak records, and showcase of up to 3 pinned badges.

### Implementation Details
- Create `frontend/src/pages/student/ProfilePage/index.tsx`.
- Profile hero: avatar with LevelRing, username, enrolled grade level.
- Stats grid: Total XP, Lessons Completed, Quiz Average, Longest Streak.
- Pinned badges showcase slot with 'Change Pinned Badges' modal.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/ProfilePage/**`
- **Conflict Prevention**: Follow ST-28 in STUDENT-SPEC.

**Acceptance Criteria**:
- Renders lifetime stats with clear visual cards.
- Displays up to 3 pinned badges with achievement tooltips.
- Responsive layout adapting to mobile and desktop.

---

### STU-CORE-22: Avatar customizer studio: parts picker and color palette (ST-28)
- **Priority**: high | **Estimate**: 2h
- **Depends On**: STU-CORE-21
- **Tags**: student, avatar, customization

### Goal
Build interactive avatar customization modal/page allowing students to equip unlocked hairstyles, glasses, hats, and outfits with live preview.

### Implementation Details
- Create `frontend/src/pages/student/ProfilePage/AvatarStudioModal.tsx`.
- Category tabs: Head, Hair, Eyes/Glasses, Accessories, Outfits, Background.
- Live SVG avatar preview updating in real-time on selection.
- Save button updating `profiles.avatar_url` in database.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/ProfilePage/AvatarStudioModal.tsx`
- **Conflict Prevention**: Follow ST-28 in STUDENT-SPEC.

**Acceptance Criteria**:
- Real-time SVG avatar composition updating on click.
- Locked items display lock icon with unlock level requirement.
- Successfully saves chosen avatar configuration.

---

### STU-CORE-23: Certificates of completion gallery and PDF export (ST-29)
- **Priority**: medium | **Estimate**: 1h
- **Depends On**: STU-CORE-21
- **Tags**: student, certificates, pdf

### Goal
Implement `/student/certificates` page showing earned course graduation certificates with printable styling and PDF download.

### Implementation Details
- Create `frontend/src/pages/student/CertificatesPage/index.tsx`.
- Certificate card displaying course title, completion date, and verified certificate hash.
- Fullscreen certificate modal with ornate arcade border, gold seal, and student name.
- 'Print / Download PDF' button formatted for standard A4 landscape printing.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/CertificatesPage/**`
- **Conflict Prevention**: Follow ST-29 in STUDENT-SPEC.

**Acceptance Criteria**:
- Renders beautiful certificate template with student name and date.
- Verification hash displayed on certificate footer.
- Print stylesheet formats cleanly to landscape page without cutoffs.

---

### STU-CORE-24: Student settings: audio, motion, notification preferences and password change (ST-31)
- **Priority**: high | **Estimate**: 1h
- **Depends On**: UIK-23, UIK-02, UIK-03
- **Tags**: student, settings, preferences

### Goal
Implement `/student/settings` page allowing students to adjust audio volume, sound effects toggle, reduced motion, and change their password.

### Implementation Details
- Create `frontend/src/pages/student/SettingsPage/index.tsx`.
- Sound effects toggle and volume slider syncing with `SoundProvider`.
- Reduced motion toggle and visual effects tier picker (Low, Balanced, High).
- Change password card (current password, new password, confirmation).
- Save preferences to `user_settings` table.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/SettingsPage/**`
- **Conflict Prevention**: Follow ST-31 in STUDENT-SPEC.

**Acceptance Criteria**:
- Toggling sound or effects tier applies immediately across the app.
- Changing password validates policies and confirms with toast.
- Preferences persist reliably in database.

---

## Block: STU-GAM (22 tasks)

### STU-GAM-01: AI Tutor chat interface: conversation thread, Pip avatar and audio toggle (ST-20)
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: UIK-27, BE-EDGE-05
- **Tags**: student, ai-tutor, chat

### Goal
Build the primary AI Tutor chat screen (`ST-20`) with conversational message feed, Pip owl mascot avatar, and text-to-speech audio narration toggle.

### Implementation Details
- Create `frontend/src/pages/student/AiTutorPage/index.tsx`.
- Message feed rendering user speech bubbles and Pip assistant replies.
- Mascot animated presence: Pip looking attentive, blinking, or nodding during responses.
- Audio toggle button automatically narrating Pip's explanations aloud.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/AiTutorPage/index.tsx`
  - `frontend/src/pages/student/AiTutorPage/MessageFeed.tsx`
- **Conflict Prevention**: Follow ST-20 in STUDENT-SPEC.

**Acceptance Criteria**:
- Renders friendly arcade chat UI with Pip mascot.
- Smooth auto-scroll keeps newest messages in view during conversation.
- Audio toggle plays speech narration cleanly.

---

### STU-GAM-02: AI Tutor prompt suggestions, voice input and daily token limit meter (ST-20)
- **Priority**: high | **Estimate**: 2h
- **Depends On**: STU-GAM-01
- **Tags**: student, ai-tutor, voice, metering

### Goal
Implement contextual prompt suggestion chips, voice microphone input (Web Speech API), and daily student AI message quota indicator.

### Implementation Details
- Create `frontend/src/pages/student/AiTutorPage/TutorInputBar.tsx`.
- Contextual suggestion chips: "Explain this rule", "Give me an example", "Test my knowledge".
- Microphone button enabling voice-to-text input.
- Message counter badge displaying remaining daily AI interactions.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/AiTutorPage/TutorInputBar.tsx`
- **Conflict Prevention**: Coordinate with STU-GAM-01 message feed.

**Acceptance Criteria**:
- Clicking suggestion chip populates input and sends message.
- Voice input records speech and transcribes accurately.
- Reaching daily message quota gracefully disables input with friendly explanation.

---

### STU-GAM-03: Arcade minigames selection hub and Daily Featured Game banner (ST-21)
- **Priority**: high | **Estimate**: 1h
- **Depends On**: UIK-23, BE-CORE-12
- **Tags**: student, games, arcade, hub

### Goal
Implement `/student/games` arcade game selection hall featuring vibrant retro game posters, personal best scores, and Daily Featured Game bonus banner.

### Implementation Details
- Create `frontend/src/pages/student/GamesHubPage/index.tsx`.
- Hero banner highlighting today's featured game with 1.5x XP bonus multiplier.
- Grid of 7 educational minigames with illustrated arcade badges and player high scores.
- Filter by skill: Vocabulary, Spelling, Grammar, Speed.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/GamesHubPage/**`
- **Conflict Prevention**: Follow ST-21 in STUDENT-SPEC.

**Acceptance Criteria**:
- Highlights Daily Featured Game with animated bonus badge.
- Displays player's personal high score on each game card.
- Clicking game opens game screen.

---

### STU-GAM-04: Minigame execution shell: game lifecycle, timer and pause overlay (ST-22)
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: STU-GAM-03, UIK-03
- **Tags**: student, games, arcade-shell

### Goal
Build standard arcade wrapper shell managing countdown intro (3-2-1 GO!), active round timer, score counter, pause menu, and audio effects.

### Implementation Details
- Create `frontend/src/pages/student/GameScreenPage/GameShell.tsx`.
- Animated countdown overlay with arcade audio fanfare.
- Floating HUD: Current Score, Combo Streak multiplier, Round Timer, Mute button, Pause button.
- Accessible Pause modal with Resume and Exit options.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/GameScreenPage/GameShell.tsx`
  - `frontend/src/pages/student/GameScreenPage/PauseOverlay.tsx`
- **Conflict Prevention**: Follow ST-22 in STUDENT-SPEC.

**Acceptance Criteria**:
- 3-2-1 GO intro initializes game state cleanly.
- HUD reflects real-time score updates and combo multipliers.
- Pause overlay suspends all timers and game loops.

---

### STU-GAM-05: Minigame 1: Word Scramble letter tiles puzzle
- **Priority**: high | **Estimate**: 2h
- **Depends On**: STU-GAM-04
- **Tags**: games, word-scramble, vocabulary

### Goal
Implement Word Scramble arcade game: unscrambling English vocabulary words using draggable/tappable letter tiles against a 60-second clock.

### Implementation Details
- Create `frontend/src/pages/student/GameScreenPage/games/WordScrambleGame.tsx`.
- Interactive letter tiles that can be tapped or dragged into target slots.
- Audio pronunciation hint button.
- Rapid feedback: correct word triggers coin ding and generates next word immediately.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/GameScreenPage/games/WordScrambleGame.tsx`
- **Conflict Prevention**: Mounts inside GameShell.

**Acceptance Criteria**:
- Keyboard and touch friendly letter tile placement.
- Unscrambling word awards points and advances to next word.
- Tracks accuracy and elapsed time.

---

### STU-GAM-06: Minigame 2: Speed Match English-Arabic pairing frenzy
- **Priority**: high | **Estimate**: 2h
- **Depends On**: STU-GAM-04
- **Tags**: games, speed-match, vocabulary

### Goal
Implement Speed Match arcade game: tapping matching English and Arabic word cards on a dynamic 4x4 card grid before the clock runs out.

### Implementation Details
- Create `frontend/src/pages/student/GameScreenPage/games/SpeedMatchGame.tsx`.
- Dynamic card grid showing English terms and Arabic translations.
- Matching pairs pop with celebratory stars and vanish from board.
- Mismatched selections shake with gentle buzz and reset selection.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/GameScreenPage/games/SpeedMatchGame.tsx`
- **Conflict Prevention**: Coordinate with audio effects in UIK-03.

**Acceptance Criteria**:
- Tapping two cards evaluates match immediately.
- Matched cards vanish with satisfying visual pop animation.
- Grid replenishes when pairs are cleared.

---

### STU-GAM-07: Minigame 3: Grammar Dash rapid sentence repair runner
- **Priority**: high | **Estimate**: 2h
- **Depends On**: STU-GAM-04
- **Tags**: games, grammar-dash, grammar

### Goal
Implement Grammar Dash runner game: spotting grammatical errors in running sentences and selecting the correct fix before time expires.

### Implementation Details
- Create `frontend/src/pages/student/GameScreenPage/games/GrammarDashGame.tsx`.
- Sentences appear with highlighted questionable word/phrase.
- Two large arcade choice buttons for instant split-second decisions.
- Consecutive correct choices trigger 2x, 3x combo score streaks.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/GameScreenPage/games/GrammarDashGame.tsx`
- **Conflict Prevention**: Follow timing rules in ECONOMY-AND-GAMES §9.

**Acceptance Criteria**:
- Rapid decision mechanics with immediate visual feedback.
- Combos escalate arcade soundtrack pitch or visual flair.
- Game ends cleanly when timer expires.

---

### STU-GAM-08: Minigames 4-7: Spelling Bee, Sentence Builder, Word Safari and Memory Match
- **Priority**: high | **Estimate**: 2h
- **Depends On**: STU-GAM-04
- **Tags**: games, arcade, spelling, syntax

### Goal
Implement the remaining 4 arcade minigames: audio Spelling Bee, tile Sentence Builder, animal-themed Word Safari, and concentration Memory Match.

### Implementation Details
- Implement `SpellingBeeGame.tsx` (listen to audio pronunciation and type word).
- Implement `SentenceBuilderGame.tsx` (reorder scrambled word tiles into valid syntax).
- Implement `WordSafariGame.tsx` (tap target vocabulary words as they pass on screen).
- Implement `MemoryMatchGame.tsx` (classic memory flip card game).

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/GameScreenPage/games/SpellingBeeGame.tsx`
  - `frontend/src/pages/student/GameScreenPage/games/SentenceBuilderGame.tsx`
  - `frontend/src/pages/student/GameScreenPage/games/WordSafariGame.tsx`
  - `frontend/src/pages/student/GameScreenPage/games/MemoryMatchGame.tsx`
- **Conflict Prevention**: Each game exports standard GameComponent interface.

**Acceptance Criteria**:
- All 4 minigames playable with keyboard and touch inputs.
- Audio synthesis integrates with Spelling Bee.
- Completing rounds reports score and accuracy to GameShell.

---

### STU-GAM-09: Minigame game over and results screen with high score check (ST-23)
- **Priority**: high | **Estimate**: 1h
- **Depends On**: STU-GAM-04, BE-OPS-17, UIK-28
- **Tags**: student, games, results

### Goal
Implement `/student/games/:gameSlug/results` game results screen calculating final score, new personal best fanfare, XP/coins earned, and retry button.

### Implementation Details
- Create `frontend/src/pages/student/GameResultsPage/index.tsx`.
- Big arcade score summary board with count-up animation.
- 'New High Score!' stamp celebration with confetti burst if current score beats personal record.
- Submit session to `record_game_session` RPC and display earned XP/Coins.
- 'Play Again' and 'Back to Arcade' CTA buttons.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/GameResultsPage/**`
- **Conflict Prevention**: Follow ST-23 in STUDENT-SPEC.

**Acceptance Criteria**:
- Final score displays with energetic count-up animation.
- Celebrates new personal high score with confetti.
- Awards XP and coins via backend RPC.

---

### STU-GAM-10: Daily quests and weekly goals hub with chest opening sequence (ST-24)
- **Priority**: high | **Estimate**: 2h
- **Depends On**: UIK-23, BE-OPS-14, UIK-28
- **Tags**: student, quests, rewards, chests

### Goal
Implement `/student/quests` page showing active daily quests, weekly milestone challenges, and interactive animated treasure chest opening reward ceremony.

### Implementation Details
- Create `frontend/src/pages/student/QuestsPage/index.tsx`.
- Daily quests list with live progress meters and 'Claim Reward' button.
- Weekly challenges section with bonus coin reward.
- Interactive Chest Opening modal: chest shakes, springs open, and shoots out coins/XP rewards with fanfare.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/QuestsPage/**`
- **Conflict Prevention**: Follow ST-24 in STUDENT-SPEC.

**Acceptance Criteria**:
- Displays 3 daily quests and weekly goal cards.
- Completed quests unlock claim button.
- Chest opening sequence plays joyful reward animation.

---

### STU-GAM-11: Class and grade leaderboard with rank podium and privacy toggle (ST-25)
- **Priority**: high | **Estimate**: 2h
- **Depends On**: UIK-23, BE-OPS-16
- **Tags**: student, leaderboard, gamification

### Goal
Implement `/student/leaderboard` page featuring 1st, 2nd, 3rd rank podium, scrolling ranking rows, student's current position, and weekly timeframe tabs.

### Implementation Details
- Create `frontend/src/pages/student/LeaderboardPage/index.tsx`.
- Top 3 podium display with gold, silver, bronze arcade medals.
- Sticky user rank bar at bottom indicating current student's position and points needed to climb rank.
- Filter tabs: 'This Week', 'This Month', 'All Time'.
- Respects class privacy rules (anonymizing names if mandated by teacher).

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/LeaderboardPage/**`
- **Conflict Prevention**: Follow ST-25 in STUDENT-SPEC.

**Acceptance Criteria**:
- Renders top 3 podium cards with medals.
- Renders list of class students sorted by XP.
- Sticky user rank bar shows user's current standing.

---

### STU-GAM-12: Achievements and badges showcase with categories and unlock progress (ST-26)
- **Priority**: high | **Estimate**: 1h
- **Depends On**: UIK-23, BE-OPS-15
- **Tags**: student, achievements, badges

### Goal
Implement `/student/achievements` badge gallery showing unlocked vs locked badges categorized by Streaks, Learning, Quizzes, and Special Events.

### Implementation Details
- Create `frontend/src/pages/student/AchievementsPage/index.tsx`.
- Badge tiles with illustrated icons: unlocked badges display in full color with earn date; locked badges in monochrome silhouette with progress bar.
- Clicking badge opens detail popover with requirement description and XP reward.
- 'Pin to Profile' action button for unlocked badges.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/AchievementsPage/**`
- **Conflict Prevention**: Follow ST-26 in STUDENT-SPEC.

**Acceptance Criteria**:
- Displays full catalog of achievement badges categorized neatly.
- Shows percentage progress toward locked badges.
- Pin button lets student equip up to 3 badges.

---

### STU-GAM-13: Arcade virtual shop: catalog browsing, item inspection and coin checkout (ST-27)
- **Priority**: high | **Estimate**: 2h
- **Depends On**: UIK-23, BE-OPS-18
- **Tags**: student, shop, economy, customization

### Goal
Implement `/student/shop` arcade store where students spend earned coins on themes, avatar items, sticker packs, and streak freezes.

### Implementation Details
- Create `frontend/src/pages/student/ShopPage/index.tsx`.
- Category tabs: Themes, Avatar Items, Stickers, Power-Ups (Streak Freezes).
- Shop item cards with coin price, required level, and 'Buy' or 'Equipped' status.
- Purchase confirmation modal showing student coin balance before and after checkout.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/ShopPage/**`
- **Conflict Prevention**: Follow ST-27 in STUDENT-SPEC.

**Acceptance Criteria**:
- Displays all purchasable cosmetics with coin costs.
- Prevents buying if student lacks coins or level.
- Purchase completes via `purchase_shop_item` RPC with instant coin deduction.

---

### STU-GAM-14: In-app notifications feed, announcement popups and real-time alerts (ST-30)
- **Priority**: high | **Estimate**: 1h
- **Depends On**: UIK-23, BE-EDGE-17
- **Tags**: student, notifications, realtime

### Goal
Implement `/student/notifications` inbox and slide-over drawer with real-time notification alerts, announcement dialogs, and mark-all-read action.

### Implementation Details
- Create `frontend/src/pages/student/NotificationsPage/index.tsx`.
- Filter tabs: 'All', 'Unread', 'Announcements', 'Achievements'.
- Realtime WebSocket subscription updating unread counter when new grade or announcement posted.
- School-wide urgent announcement modal popup.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/student/NotificationsPage/**`
- **Conflict Prevention**: Follow ST-30 in STUDENT-SPEC.

**Acceptance Criteria**:
- Unread count badge increments immediately on Realtime broadcast.
- Mark All Read clears unread status via API.
- Clicking notification links directly to relevant assignment or quiz result.

---

### STU-GAM-15: Audio pronunciation and speech recognition practice component
- **Priority**: medium | **Estimate**: 2h
- **Depends On**: BE-EDGE-08, UIK-03
- **Tags**: student, audio, speaking, pronunciation

### Goal
Build specialized pronunciation trainer tool allowing students to listen to model British/American pronunciation and record their own voice for match feedback.

### Implementation Details
- Create `frontend/src/shared/components/practice/PronunciationTrainer.tsx`.
- Audio player with slow-speed toggle (0.75x) for careful listening.
- Microphone record button with visual audio waveform visualizer.
- Speech recognition comparison scoring student pronunciation against phonetic target.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/components/practice/PronunciationTrainer.tsx`
- **Conflict Prevention**: Reusable practice component.

**Acceptance Criteria**:
- Plays model pronunciation at normal and 0.75x speed.
- Records user audio and provides accuracy score.
- Audio waveform animates smoothly during recording.

---

### STU-GAM-16: Gamification soundscapes: audio fanfare hooks and ambient arcade sounds
- **Priority**: medium | **Estimate**: 1h
- **Depends On**: UIK-03, UIK-28
- **Tags**: sound, audio, gamification

### Goal
Integrate celebratory arcade audio feedback hooks across gamification milestones (streak continuation ding, quest complete pop, level-up trumpet fanfare).

### Implementation Details
- Create `frontend/src/shared/hooks/useGamificationAudio.ts`.
- Connect audio events to streak updates, chest openings, coin gains, and badge awards.
- Polyphonic sound layering preventing audio clipping or jarring cutoffs.
- Strictly honors sound mute settings.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/hooks/useGamificationAudio.ts`
- **Conflict Prevention**: Pure utility hook; does not alter UI components directly.

**Acceptance Criteria**:
- Plays distinct sound effects for coin ding, fanfare, and level up.
- Does not clip or distort when multiple sounds fire together.
- Instantly silences when mute toggle is activated.

---

### STU-GAM-17: Streak flame animation and freeze shield status indicator
- **Priority**: high | **Estimate**: 1h
- **Depends On**: UIK-01, UIK-15
- **Tags**: gamification, streaks, animation

### Goal
Build dynamic `StreakFlame` indicator with tiered flame sizes (sparks at 1-6 days, blazing fire at 7-29 days, radiant blue flame at 30+ days) and freeze shield badge.

### Implementation Details
- Create `frontend/src/shared/components/gamification/StreakFlame.tsx`.
- CSS / SVG flame animation with particle embers.
- Freeze shield icon displaying count of active streak freezes.
- Explanatory tooltip explaining tomorrow's streak target and freeze protection rules.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/components/gamification/StreakFlame.tsx`
- **Conflict Prevention**: Follow streak rules in ECONOMY-AND-GAMES §1.

**Acceptance Criteria**:
- Flame visual scales up at 7-day and 30-day milestones.
- Shield badge indicates available streak freezes accurately.
- Tooltip displays days count and active streak status.

---

### STU-GAM-18: Pip mascot companion widget with context-aware advice callouts
- **Priority**: medium | **Estimate**: 1h
- **Depends On**: UIK-06, UIK-08
- **Tags**: mascot, pip, gamification

### Goal
Build floating `PipCompanion` widget on student dashboard and lesson pages offering friendly hints, encouraging remarks, and streak reminders.

### Implementation Details
- Create `frontend/src/shared/components/mascot/PipCompanion.tsx`.
- Animated Pip owl character in bottom-right corner.
- Speech bubble callout with friendly reminder ("You are 20 XP away from leveling up!").
- Can be collapsed into mini icon badge or expanded on click.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/components/mascot/PipCompanion.tsx`
- **Conflict Prevention**: Follow mascot specifications in GLOBAL-STYLES §11.

**Acceptance Criteria**:
- Friendly character presence with context-aware encouragement.
- Non-intrusive; dismissable and collapsible.
- Does not block interactive buttons or page content.

---

### STU-GAM-19: Interactive LevelUp celebration modal with reward unlocks preview
- **Priority**: high | **Estimate**: 1h
- **Depends On**: UIK-28, BE-OPS-05
- **Tags**: gamification, levels, celebration

### Goal
Create dedicated `LevelUpModal` displaying rank badge upgrade, new cosmetics unlocked in shop, bonus coins awarded, and shareable congratulatory card.

### Implementation Details
- Create `frontend/src/shared/components/gamification/LevelUpModal.tsx`.
- Big level number animation scaling in with celebratory sunburst.
- List of rewards unlocked: +50 Coins, New Avatar Hat unlocked, New Title unlocked.
- Fanfare sound effect and confetti cannon burst.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/components/gamification/LevelUpModal.tsx`
- **Conflict Prevention**: Connects with `CelebrationProvider`.

**Acceptance Criteria**:
- Triggers automatically when student levels up.
- Highlights newly unlocked shop items and features.
- Closes cleanly and returns to active task.

---

### STU-GAM-20: Live Coin counter with animated delta numbers
- **Priority**: high | **Estimate**: 1h
- **Depends On**: UIK-01, UIK-03
- **Tags**: gamification, coins, animation

### Goal
Build tactile `CoinCounter` component in top navigation showing rolling number transition and floating floating `+10` gold coin chips on earnings.

### Implementation Details
- Create `frontend/src/shared/components/gamification/CoinCounter.tsx`.
- Animated number ticker smoothly rolling to new balance.
- Floating `+X` coin icon rising and fading out when coins are earned.
- Sound ding on balance increment.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/components/gamification/CoinCounter.tsx`
- **Conflict Prevention**: Place in top navigation header.

**Acceptance Criteria**:
- Rolling number animation updates balance smoothly.
- Floating +X indicator provides instant reward feedback.
- Accessible ARIA live region announces coin earnings to screen readers.

---

### STU-GAM-21: Class Quests collective goal tracker component
- **Priority**: medium | **Estimate**: 1h
- **Depends On**: UIK-16, BE-CORE-11
- **Tags**: student, quests, class, collaboration

### Goal
Implement `ClassQuestProgress` widget showing collective class progress toward group targets (e.g. "Read 500 pages together this week") with collective reward pool.

### Implementation Details
- Create `frontend/src/shared/components/gamification/ClassQuestProgress.tsx`.
- Class goal title, description, and group progress bar.
- Contributor avatars showing top helping classmates.
- Group reward banner (e.g. Free Arcade Day or Bonus 100 Coins for everyone).

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/components/gamification/ClassQuestProgress.tsx`
- **Conflict Prevention**: Follow class quest rules in ECONOMY-AND-GAMES §4.

**Acceptance Criteria**:
- Displays aggregated class progress accurately.
- Highlights individual student's personal contribution.
- Celebrates collective completion when target achieved.

---

### STU-GAM-22: Student gamification integration test suite and edge verification
- **Priority**: high | **Estimate**: 2h
- **Depends On**: STU-GAM-10, STU-GAM-11, STU-GAM-13
- **Tags**: testing, gamification, vitest

### Goal
Write comprehensive component and integration tests verifying reward claims, streak calculations, level up triggers, and minigame score reporting.

### Implementation Details
- Create `frontend/src/test/integration/student-gamification.test.tsx`.
- Test daily quest claiming and double-claim prevention.
- Test streak freeze protection when daily target is missed.
- Test level-up calculation and celebration trigger.
- Test shop purchase validation with insufficient coins.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/test/integration/student-gamification.test.tsx`
- **Conflict Prevention**: Automated test suite.

**Acceptance Criteria**:
- All integration tests execute and pass in Vitest.
- Covers edge cases for streak freeze and level boundaries.
- Validates that UI state reflects backend ledger transactions.

---

## Block: TCH-AI (20 tasks)

### TCH-AI-01: Teacher courses list and curriculum management hub (TC-09)
- **Priority**: high | **Estimate**: 1h
- **Depends On**: TCH-CORE-01, BE-CORE-05
- **Tags**: teacher, curriculum, courses, authoring

### Goal
Implement `/teacher/courses` hub displaying all teacher-authored courses, official school curriculum copies, publication statuses, and 'Create Course' launcher.

### Implementation Details
- Create `frontend/src/pages/teacher/CoursesAuthoringPage/index.tsx`.
- Course cards showing draft/published badges, unit counts, enrolled classes count, and last edited timestamp.
- 'Create New Course' and 'Adopt Official Curriculum' action buttons.
- Duplicate course and archive actions.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/CoursesAuthoringPage/**`
- **Conflict Prevention**: Follow TC-09 in TEACHER-SPEC.

**Acceptance Criteria**:
- Lists teacher courses with publication status badges.
- Duplicate action creates fresh copy with '(Copy)' suffix.
- Create Course navigates to course builder.

---

### TCH-AI-02: Interactive course builder: unit hierarchy and drag-and-drop reordering (TC-10)
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: TCH-AI-01
- **Tags**: teacher, course-builder, dnd-kit

### Goal
Implement `/teacher/courses/:courseId/edit` course outline builder allowing teachers to structure units, add lessons, and reorder elements via drag-and-drop.

### Implementation Details
- Create `frontend/src/pages/teacher/CourseBuilderPage/index.tsx`.
- Drag-and-drop outline tree powered by `@dnd-kit`.
- Add Unit and Add Lesson inline action buttons.
- Lesson metadata drawer: Title, XP reward, estimated duration, CEFR level.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/CourseBuilderPage/**`
- **Conflict Prevention**: Follow TC-10 in TEACHER-SPEC.

**Acceptance Criteria**:
- Units and lessons can be reordered via drag-and-drop.
- Inline creation adds units and lessons instantly.
- Saves outline order to database via debounced update.

---

### TCH-AI-03: Modular lesson editor: rich content blocks and media attachments (TC-11)
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: TCH-AI-02, BE-EDGE-15
- **Tags**: teacher, lesson-editor, blocks, authoring

### Goal
Implement `/teacher/lessons/:lessonId/edit` content editor allowing teachers to assemble lessons by adding and arranging modular learning blocks.

### Implementation Details
- Create `frontend/src/pages/teacher/LessonEditorPage/index.tsx`.
- Supported block types: Text/Exposition (Tiptap), Vocabulary Spotlight, Dialogue/Conversation, Audio Narration, Image Card, Interactive Quiz Question.
- Drag-handle to reorder blocks within lesson.
- Live preview toggle showing exactly how lesson appears to students.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/LessonEditorPage/**`
- **Conflict Prevention**: Follow TC-11 in TEACHER-SPEC.

**Acceptance Criteria**:
- Allows adding, editing, and deleting all 6 block types.
- Media upload button attaches audio and images via storage pipeline.
- Live preview mirrors student lesson player.

---

### TCH-AI-04: Course publish and class assignment wizard (TC-12)
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: TCH-AI-02, BE-OPS-08
- **Tags**: teacher, publishing, snapshot, curriculum

### Goal
Implement `/teacher/courses/:courseId/publish` validation checklist and assignment wizard creating immutable snapshot and enrolling classes.

### Implementation Details
- Create `frontend/src/pages/teacher/CoursePublishPage/index.tsx`.
- Pre-publish validation checklist: checks that course has >= 1 unit, >= 1 lesson, no empty text blocks, and valid XP values.
- Version bump selector (Major, Minor revision notes).
- Class assignment checkboxes assigning published version to active classes.
- Invokes `publish_course` RPC.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/CoursePublishPage/**`
- **Conflict Prevention**: Follow TC-12 in TEACHER-SPEC.

**Acceptance Criteria**:
- Validation checklist catches broken or empty lessons before publishing.
- Publishing creates immutable snapshot via `publish_course` RPC.
- Assigns course to selected classes immediately.

---

### TCH-AI-05: Assignment builder: prompt authoring, attachments and rubric selector (TC-14)
- **Priority**: high | **Estimate**: 2h
- **Depends On**: TCH-CORE-09, BE-CORE-07
- **Tags**: teacher, assignment-builder, rubrics

### Goal
Implement `/teacher/assignments/create` and `/teacher/assignments/:assignmentId/edit` authoring flow with rich text prompt editor, due dates, and rubric picker.

### Implementation Details
- Create `frontend/src/pages/teacher/AssignmentBuilderPage/index.tsx`.
- Details form: Assignment title, Target class selector, Due date & time picker, Late submissions policy.
- Rich text writing prompt editor (Tiptap).
- Attached Rubric selector (pick existing rubric or click 'Build New Rubric').

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/AssignmentBuilderPage/**`
- **Conflict Prevention**: Follow TC-14 in TEACHER-SPEC.

**Acceptance Criteria**:
- Creates homework assignments with scheduled due dates.
- Attaches rubric for structured scoring.
- Saves assignment draft or publishes to class immediately.

---

### TCH-AI-06: Quiz builder: test settings, question assembly and shuffle rules (TC-17)
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: TCH-CORE-11, BE-CORE-07
- **Tags**: teacher, quiz-builder, quizzes

### Goal
Implement `/teacher/quizzes/create` and `/teacher/quizzes/:quizId/edit` quiz authoring workspace supporting timer constraints, passing threshold, and question ordering.

### Implementation Details
- Create `frontend/src/pages/teacher/QuizBuilderPage/index.tsx`.
- Quiz settings: Duration in minutes (or untimed), Max attempts (1 to 5), Passing grade (default 60%), Shuffle questions toggle, Results visibility mode.
- Question list: Add from Question Bank, Create New Question, or Generate with AI.
- Per-question points override input.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/QuizBuilderPage/**`
- **Conflict Prevention**: Follow TC-17 in TEACHER-SPEC.

**Acceptance Criteria**:
- Configures complete quiz timing and attempt rules.
- Assembles questions from scratch or question bank.
- Calculates total quiz points automatically.

---

### TCH-AI-07: Question Bank: searchable repository, tag filtering and difficulty sorting (TC-19)
- **Priority**: high | **Estimate**: 2h
- **Depends On**: TCH-AI-06, BE-CORE-06
- **Tags**: teacher, question-bank, repository

### Goal
Implement `/teacher/question-bank` central repository holding thousands of curriculum questions with faceted search by topic, CEFR level, question type, and usage history.

### Implementation Details
- Create `frontend/src/pages/teacher/QuestionBankPage/index.tsx`.
- Faceted filter bar: Question Type (Multiple Choice, Fill Blank, Matching, etc.), CEFR Level (A1–B2), Tags (Grammar, Vocab, Reading, Literature).
- Question preview card displaying prompt, answer key, and explanation.
- Actions: 'Edit', 'Add to Quiz', 'Duplicate', 'Export'.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/QuestionBankPage/**`
- **Conflict Prevention**: Follow TC-19 in TEACHER-SPEC.

**Acceptance Criteria**:
- Instant search filters questions by keywords and tags.
- Question preview renders exact interactive preview.
- 'Add to Quiz' lets teacher insert questions directly into active quiz drafts.

---

### TCH-AI-08: Interactive Question Creator modal for all question types
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: TCH-AI-07
- **Tags**: teacher, question-creator, modal

### Goal
Build modal editor enabling teachers to create questions of any type (Multiple Choice, Fill in the Blank, Matching Pairs, Reorder, Short Answer, Audio Spelling).

### Implementation Details
- Create `frontend/src/pages/teacher/QuestionBankPage/QuestionCreatorModal.tsx`.
- Type selector switches form fields dynamically.
- Multiple Choice: prompt, 4 options, radio button designating correct option.
- Matching: pair rows (term and definition).
- Fill in the Blank: sentence editor with `[brackets]` marking target blank words.
- Tag input and explanation notes for student review.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/QuestionBankPage/QuestionCreatorModal.tsx`
- **Conflict Prevention**: Reusable modal used by Quiz Builder and Question Bank.

**Acceptance Criteria**:
- Supports creation and editing of all 6 core question types.
- Validates that correct answer is designated before saving.
- Saves question into `questions` table cleanly.

---

### TCH-AI-09: Interactive Rubric Designer: criteria grid, performance levels and score weights
- **Priority**: high | **Estimate**: 2h
- **Depends On**: TCH-AI-05
- **Tags**: teacher, rubrics, assessment-design

### Goal
Build `/teacher/rubrics` authoring workspace enabling teachers to create multi-criteria assessment rubrics with performance levels (e.g. Exemplary, Proficient, Developing, Beginning).

### Implementation Details
- Create `frontend/src/pages/teacher/RubricsPage/index.tsx`.
- Dynamic rubric grid: Criteria rows (Content, Organization, Grammar, Vocabulary) and Level columns.
- Point values per cell and total max score calculation.
- Save as shared template or private rubric.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/RubricsPage/**`
- **Conflict Prevention**: Follow rubrics data model in BE-CORE-06.

**Acceptance Criteria**:
- Dynamic grid adds/removes criteria rows and performance columns.
- Total score recalculates automatically based on criterion weightings.
- Saves rubric into `rubrics` table with JSONB criteria payload.

---

### TCH-AI-10: Teacher AI Copilot slide-over panel: pedagogical chat and context injection
- **Priority**: high | **Estimate**: 2h
- **Depends On**: UIK-27, BE-EDGE-09
- **Tags**: teacher, ai, copilot, drawer

### Goal
Implement slide-over `TeacherCopilotPanel` allowing teachers to chat with educational AI while building courses or grading work.

### Implementation Details
- Create `frontend/src/shared/components/teacher/TeacherCopilotPanel.tsx`.
- Context injection: passes currently open course, quiz, or rubric to the model automatically.
- Streaming conversational advice powered by `ai-copilot` Edge Function.
- One-click prompt shortcuts: "Suggest 3 discussion questions", "Simplify this passage for Grade 5", "Create a rubric for this prompt".

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/components/teacher/TeacherCopilotPanel.tsx`
- **Conflict Prevention**: Docked in TeacherAppShell; opens as slide-over drawer.

**Acceptance Criteria**:
- Streams pedagogical suggestions with low latency.
- Automatically injects active workspace context into prompt.
- Suggestion chips provide instant starter prompts.

---

### TCH-AI-11: AI Action Cards integration: visual preview, edit diff and one-click apply
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: TCH-AI-10, BE-OPS-20
- **Tags**: teacher, ai, action-cards, diff

### Goal
Connect Teacher Copilot to `ActionCardDisplay` allowing teachers to review AI-generated quiz questions, edit them inline, and insert them directly into curriculum with one click.

### Implementation Details
- Create `frontend/src/shared/components/teacher/TeacherActionCardContainer.tsx`.
- Visual diff preview showing proposed questions, lesson additions, or rubric criteria.
- Inline edit mode allowing teacher to tweak suggested text before applying.
- 'Apply Changes' invokes `apply_action_card` RPC, mutating course/quiz immediately without manual copy-pasting.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/components/teacher/TeacherActionCardContainer.tsx`
- **Conflict Prevention**: Follow Action Cards logic in BE-OPS-20.

**Acceptance Criteria**:
- Action card displays visual preview of proposed database modification.
- Teacher can edit text inline before applying.
- Apply button executes mutation via RPC with immediate success toast.

---

### TCH-AI-12: AI Course Generation Wizard: multi-step prompt builder and outline review (TC-30)
- **Priority**: high | **Estimate**: 2h
- **Depends On**: TCH-AI-02, BE-EDGE-12
- **Tags**: teacher, ai, course-wizard, jobs

### Goal
Implement `/teacher/courses/generate` multi-step wizard allowing teachers to input topic, grade level, learning objectives, and generate a complete course outline.

### Implementation Details
- Create `frontend/src/pages/teacher/CourseWizardPage/index.tsx`.
- Step 1: Course topic, CEFR target level, number of units (1 to 6), target grade level.
- Step 2: Learning standards and skill emphasis (Grammar, Writing, Literature, Speaking).
- Step 3: Trigger background generation job via `job-runner` and display live progress bar (0% to 100%).
- Step 4: Review generated outline with ability to regenerate specific units before saving.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/CourseWizardPage/**`
- **Conflict Prevention**: Follow TC-30 in TEACHER-SPEC.

**Acceptance Criteria**:
- Multi-step form gathers pedagogical parameters.
- Dispatches async background job and streams step progress.
- Review screen lets teacher approve or refine generated course outline.

---

### TCH-AI-13: AI Weekly Lesson Planner: curriculum schedule and lesson plan generator (TC-31)
- **Priority**: high | **Estimate**: 2h
- **Depends On**: TCH-CORE-01, BE-EDGE-09
- **Tags**: teacher, ai, planner, lesson-planning

### Goal
Implement `/teacher/planner` AI-assisted weekly lesson planning board generating daily 45-minute lesson agendas, bell-ringers, and homework ideas.

### Implementation Details
- Create `frontend/src/pages/teacher/LessonPlannerPage/index.tsx`.
- Weekly calendar view (Monday through Friday) mapping class periods.
- 'Generate Weekly Plan' modal: takes target unit and generates 5 daily lesson plans with timing breakdowns.
- Daily plan detail: Warm-up activity (5m), Direct instruction (15m), Guided practice (15m), Exit ticket (10m).
- Export to printable PDF lesson plan.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/LessonPlannerPage/**`
- **Conflict Prevention**: Follow TC-31 in TEACHER-SPEC.

**Acceptance Criteria**:
- Generates structured 5-day lesson schedule based on syllabus.
- Timed agenda breakdown for classroom management.
- Printable lesson plan format.

---

### TCH-AI-14: AI Support Plans: personalized intervention generator for struggling students (TC-32)
- **Priority**: high | **Estimate**: 2h
- **Depends On**: TCH-CORE-08, BE-EDGE-09
- **Tags**: teacher, ai, support-plans, intervention

### Goal
Implement `/teacher/students/:studentId/support-plan` intervention generator creating individualized education plans (IEP/remediation) from student mistake data.

### Implementation Details
- Create `frontend/src/pages/teacher/SupportPlanPage/index.tsx`.
- Automatically analyzes student's recent low-scoring quizzes and homework mistakes.
- Generates 3 targeted remediation goals and specific practice recommendations.
- Allows teacher to edit intervention strategies, assign targeted practice packs, and set follow-up check-in date.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/SupportPlanPage/**`
- **Conflict Prevention**: Follow TC-32 in TEACHER-SPEC.

**Acceptance Criteria**:
- Analyzes student struggle areas and suggests concrete remediation steps.
- Teacher can edit and finalize support plan.
- Assigns targeted practice exercises with one click.

---

### TCH-AI-15: AI Question Generator: bulk exercise generation from text or reading passage
- **Priority**: high | **Estimate**: 2h
- **Depends On**: TCH-AI-08, BE-EDGE-09
- **Tags**: teacher, ai, question-generator

### Goal
Build 'Generate Questions with AI' tool inside Question Bank allowing teachers to paste any reading passage and generate 5–10 aligned comprehension questions.

### Implementation Details
- Create `frontend/src/pages/teacher/QuestionBankPage/AiQuestionGeneratorModal.tsx`.
- Input: Paste text passage, select target grade level, choose desired question types.
- Generates questions with answer keys and rationale explanations.
- Teacher can accept individual questions with checkboxes and add them directly to Question Bank.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/QuestionBankPage/AiQuestionGeneratorModal.tsx`
- **Conflict Prevention**: Integrates into Question Bank.

**Acceptance Criteria**:
- Generates 5+ valid questions aligned with pasted text passage.
- Pre-populates correct answers and explanations.
- One-click bulk insertion into question bank.

---

### TCH-AI-16: AI Rubric Generator: rubric creation from assignment prompt
- **Priority**: medium | **Estimate**: 1h
- **Depends On**: TCH-AI-09, BE-EDGE-09
- **Tags**: teacher, ai, rubrics

### Goal
Build 'Generate Rubric with AI' modal inside Rubric Designer that crafts tailored scoring criteria and descriptions from an assignment prompt.

### Implementation Details
- Create `frontend/src/pages/teacher/RubricsPage/AiRubricGeneratorModal.tsx`.
- Input: Assignment title, writing genre (Argumentative, Narrative, Expository), grade level.
- Generates 4 criteria rows with 4 performance levels each and descriptive descriptions.
- Inserts generated rubric into designer for teacher fine-tuning.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/RubricsPage/AiRubricGeneratorModal.tsx`
- **Conflict Prevention**: Integrates into RubricsPage.

**Acceptance Criteria**:
- Generates comprehensive criteria matching genre expectations.
- Differentiates performance levels clearly.
- Seamlessly transfers generated rubric into grid editor.

---

### TCH-AI-17: AI Pre-Grading assistant integration in teacher grading screen
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: TCH-CORE-14, BE-EDGE-10
- **Tags**: teacher, ai, grading, human-in-the-loop

### Goal
Connect `ai-grade-submission` Edge Function to teacher grading screen, providing draft rubric criterion scores and constructive feedback suggestions for teacher approval.

### Implementation Details
- Add 'Run AI Pre-Grade' button in `GradingScreenPage.tsx`.
- Calls `ai-grade-submission` Edge Function.
- Displays suggested scores as highlighted outlines on rubric cells with reasoning tooltips.
- Inserts suggested feedback into draft comments box; teacher can edit, accept, or reject with one click.
- Strict human-in-the-loop guarantee: AI suggestions never finalize without teacher confirmation.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/GradingScreenPage/AiGradingAssistant.tsx`
- **Conflict Prevention**: Follow human-in-the-loop rule in backend docs §7.

**Acceptance Criteria**:
- Pre-evaluates essay against rubric criteria with rationale tooltips.
- Teacher retains complete control to edit or override scores.
- Clear badge distinguishes AI suggestions from finalized teacher grades.

---

### TCH-AI-18: AI Announcement Drafter and tone adjuster wizard
- **Priority**: medium | **Estimate**: 1h
- **Depends On**: TCH-CORE-17, BE-EDGE-09
- **Tags**: teacher, ai, announcements, translation

### Goal
Build AI announcement assistant in Announcement Composer helping teachers draft engaging announcements, praise student milestones, and translate to parents.

### Implementation Details
- Create `frontend/src/pages/teacher/AnnouncementsPage/AiAnnouncementDrafter.tsx`.
- Tone selector: Encouraging, Urgent / Reminder, Celebratory, Formal.
- Generates draft announcement body with emoji and arcade formatting.
- One-click Arabic translation preview for bilingual parent communications.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/AnnouncementsPage/AiAnnouncementDrafter.tsx`
- **Conflict Prevention**: Integrates into AnnouncementsPage.

**Acceptance Criteria**:
- Generates well-crafted announcement drafts based on topic keywords.
- Adapts tone according to selection.
- Provides bilingual English/Arabic draft preview for parents.

---

### TCH-AI-19: Curriculum snapshot diff viewer and version history inspector
- **Priority**: medium | **Estimate**: 1h
- **Depends On**: TCH-AI-04
- **Tags**: teacher, curriculum, versioning, diff

### Goal
Build curriculum snapshot comparator allowing teachers to inspect changes between course versions before publishing updates.

### Implementation Details
- Create `frontend/src/pages/teacher/CourseBuilderPage/VersionHistoryModal.tsx`.
- Visual diff viewer highlighting added lessons in green, modified blocks in amber, and deleted elements in red.
- 'Rollback to Version X' action allowing teachers to restore past snapshots.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/CourseBuilderPage/VersionHistoryModal.tsx`
- **Conflict Prevention**: Reads from `content_snapshots` table.

**Acceptance Criteria**:
- Displays clear visual diff between course versions.
- Highlights additions, edits, and deletions.
- Restore button reverts draft course state cleanly.

---

### TCH-AI-20: Teacher AI builders integration test suite and safety verification
- **Priority**: high | **Estimate**: 2h
- **Depends On**: TCH-AI-11, TCH-AI-12, TCH-AI-17
- **Tags**: testing, teacher, ai, vitest

### Goal
Write automated integration tests validating AI wizard parameters, action card generation, safety filters on teacher prompts, and rubric scoring integrity.

### Implementation Details
- Create `frontend/src/test/integration/teacher-ai-builders.test.tsx`.
- Test course generation job parameter payload and step progression.
- Test action card apply and undo execution.
- Test question bank search filter queries.
- Test AI pre-grading suggestion payload verification.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/test/integration/teacher-ai-builders.test.tsx`
- **Conflict Prevention**: Automated test suite.

**Acceptance Criteria**:
- All integration tests execute cleanly in Vitest.
- Action card modifications conform to schema requirements.
- Confirms AI pre-grading recommendations enforce human approval.

---

## Block: TCH-CORE (22 tasks)

### TCH-CORE-01: Teacher Dashboard: urgent grading pill, class cards and activity feed (TC-01)
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: UIK-24, BE-CORE-03
- **Tags**: teacher, dashboard, classes

### Goal
Build primary Teacher Dashboard (`TC-01`) featuring urgent ungraded submissions counter, active class performance cards, quick actions bar, and recent student activity log.

### Implementation Details
- Create `frontend/src/pages/teacher/DashboardPage/index.tsx`.
- Urgent grading banner ("14 submissions awaiting grading") linking directly to grading queue.
- Class overview cards: student count, attendance/activity rate today, pending work count.
- Quick action buttons: 'Create Assignment', 'Launch Quiz', 'Post Announcement'.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/DashboardPage/**`
- **Conflict Prevention**: Follow TC-01 specification in TEACHER-SPEC.

**Acceptance Criteria**:
- Renders active class cards with live student counts.
- Urgent grading badge highlights pending submissions.
- Quick actions navigate to respective creation flows.

---

### TCH-CORE-02: Classes directory and Create Class modal wizard (TC-02)
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: TCH-CORE-01
- **Tags**: teacher, classes, creation

### Goal
Implement `/teacher/classes` class list page and 'Create Class' modal wizard supporting academic term selection, grade level, and join code generation.

### Implementation Details
- Create `frontend/src/pages/teacher/ClassesListPage/index.tsx`.
- Create Class modal form: Class name, Grade level (Grade 1–12), Academic Term, Optional description.
- Generates unique 6-character uppercase join code upon creation.
- Class cards with quick links to Roster, Rules, and Curriculum.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/ClassesListPage/**`
- **Conflict Prevention**: Follow TC-02 in TEACHER-SPEC.

**Acceptance Criteria**:
- Lists all teaching classes assigned to authenticated teacher.
- Create Class modal validates inputs and creates class in database.
- New class appears immediately in class switcher.

---

### TCH-CORE-03: Class detail dashboard: roster summary, curriculum and announcements (TC-03)
- **Priority**: high | **Estimate**: 2h
- **Depends On**: TCH-CORE-02
- **Tags**: teacher, classes, overview

### Goal
Implement `/teacher/classes/:classId` detail hub showing enrolled students summary, assigned courses, active assignments, and class announcements feed.

### Implementation Details
- Create `frontend/src/pages/teacher/ClassDetailPage/index.tsx`.
- Class header: Class name, grade, join code copy chip, and co-teachers avatars.
- Tabbed view: 'Overview', 'Roster & Students', 'Assigned Work', 'Class Rules', 'Announcements'.
- Quick invite button displaying shareable class code and QR code.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/ClassDetailPage/index.tsx`
  - `frontend/src/pages/teacher/ClassDetailPage/ClassHeader.tsx`
- **Conflict Prevention**: Follow TC-03 in TEACHER-SPEC.

**Acceptance Criteria**:
- Renders class overview metrics and join code display.
- Tab navigation transitions smoothly between sub-views.
- Join code chip copies formatted link to clipboard with toast confirmation.

---

### TCH-CORE-04: Class roster management and student enrollment tools (TC-04)
- **Priority**: high | **Estimate**: 2h
- **Depends On**: TCH-CORE-03, UIK-18, BE-OPS-04
- **Tags**: teacher, roster, enrollment

### Goal
Implement `/teacher/classes/:classId/roster` table with search, student removal, attendance status, and 'Enroll Existing Students' modal.

### Implementation Details
- Create `frontend/src/pages/teacher/ClassDetailPage/RosterTab.tsx`.
- TanStack DataTable of enrolled students: Avatar, Name, Username, Enrolled Date, Current Streak, Last Active.
- 'Enroll Students' search modal allowing teacher to search school directory and add students.
- Remove student confirmation dialog with reason notes.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/ClassDetailPage/RosterTab.tsx`
  - `frontend/src/pages/teacher/ClassDetailPage/EnrollStudentsModal.tsx`
- **Conflict Prevention**: Follow TC-04 in TEACHER-SPEC.

**Acceptance Criteria**:
- Displays all enrolled students with search filtering.
- Teacher can search and bulk-enroll students into class.
- Removing student safely archives enrollment via RPC.

---

### TCH-CORE-05: Class rules, game limits and accommodation overrides (TC-05)
- **Priority**: high | **Estimate**: 1h
- **Depends On**: TCH-CORE-03, BE-CORE-04
- **Tags**: teacher, rules, accommodations

### Goal
Implement `/teacher/classes/:classId/rules` settings page configuring class rules: games availability, late submission policy, and student accommodations.

### Implementation Details
- Create `frontend/src/pages/teacher/ClassDetailPage/RulesTab.tsx`.
- Toggles: Enable Arcade Minigames (always / after lessons completed / disabled), Enable AI Tutor.
- Late work policy: Allow late submissions, penalty percentage slider (0% to 50%).
- Individual student accommodation overrides (extra time multiplier 1.5x, late penalty waiver).

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/ClassDetailPage/RulesTab.tsx`
- **Conflict Prevention**: Follow TC-05 in TEACHER-SPEC.

**Acceptance Criteria**:
- Allows teachers to toggle gamification and AI feature availability.
- Late penalty slider updates class policy in database.
- Student accommodation overrides save correctly.

---

### TCH-CORE-06: Class custom rewards and group milestone manager (TC-06)
- **Priority**: medium | **Estimate**: 1h
- **Depends On**: TCH-CORE-03, BE-OPS-06
- **Tags**: teacher, rewards, gamification

### Goal
Implement `/teacher/classes/:classId/rewards` page allowing teachers to set custom class rewards (e.g. "Pizza Party on 10,000 XP") and grant manual bonus coins.

### Implementation Details
- Create `frontend/src/pages/teacher/ClassDetailPage/RewardsTab.tsx`.
- Create and edit Class Milestone Quests with target XP values.
- 'Grant Bonus Coins' modal allowing teacher to award 50-200 coins to students for classroom excellence.
- Feed of granted bonuses and achievements.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/ClassDetailPage/RewardsTab.tsx`
- **Conflict Prevention**: Follow TC-06 in TEACHER-SPEC.

**Acceptance Criteria**:
- Teacher can launch group milestone goal with reward description.
- Awarding bonus coins updates student coin balances and logs reason.
- Bonus feed reflects recent awards.

---

### TCH-CORE-07: All my students master list with performance filters (TC-07)
- **Priority**: high | **Estimate**: 1h
- **Depends On**: TCH-CORE-01, UIK-18
- **Tags**: teacher, students, directory

### Goal
Implement `/teacher/students` multi-class student directory with filters for struggling students, streak champions, and missing work flags.

### Implementation Details
- Create `frontend/src/pages/teacher/StudentsDirectoryPage/index.tsx`.
- Comprehensive DataTable across all enrolled classes.
- Quick filter chips: 'Needs Attention' (<60% average or 2+ missing assignments), 'Top Performers', 'Inactive This Week'.
- Search by student name or username.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/StudentsDirectoryPage/**`
- **Conflict Prevention**: Follow TC-07 in TEACHER-SPEC.

**Acceptance Criteria**:
- Lists students across all classes taught by teacher.
- Filter chips immediately isolate struggling or inactive students.
- Clicking student row opens individual progress dossier.

---

### TCH-CORE-08: Individual student progress dossier and mastery history (TC-08)
- **Priority**: high | **Estimate**: 2h
- **Depends On**: TCH-CORE-07, BE-CORE-02
- **Tags**: teacher, student, progress, dossier

### Goal
Implement `/teacher/students/:studentId` deep-dive dossier showing complete assignment history, quiz grades, vocabulary mastery, and private teacher notes.

### Implementation Details
- Create `frontend/src/pages/teacher/StudentProgressPage/index.tsx`.
- Student overview: current level, overall GPA/grade percentage, attendance streak.
- Chronological timeline of completed assessments with score pills.
- Private 'Teacher Notes' notepad with auto-save for IEP/parent conferences.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/StudentProgressPage/**`
- **Conflict Prevention**: Follow TC-08 in TEACHER-SPEC.

**Acceptance Criteria**:
- Displays full academic track record for selected student.
- Visual charts depict score trajectory over time.
- Private teacher notes persist securely in `admin_notes`.

---

### TCH-CORE-09: Assignments manager: homework list, status badges and statistics (TC-13)
- **Priority**: high | **Estimate**: 1h
- **Depends On**: TCH-CORE-01
- **Tags**: teacher, assignments, hub

### Goal
Implement `/teacher/assignments` hub showing all created assignments, submission completion counts, and due date countdowns.

### Implementation Details
- Create `frontend/src/pages/teacher/AssignmentsHubPage/index.tsx`.
- Assignment card: Title, class tags, due date, submission counter (e.g. 22/28 submitted), ungraded pill.
- Actions: 'Grade Submissions', 'Edit', 'Duplicate', 'Archive'.
- Filter by class and publication status (Draft vs Published).

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/AssignmentsHubPage/**`
- **Conflict Prevention**: Follow TC-13 in TEACHER-SPEC.

**Acceptance Criteria**:
- Clean list of assignments filtered by active class.
- Submission counter accurately reflects student submissions.
- Quick action navigates directly to grading queue.

---

### TCH-CORE-10: Assignment submission results and item breakdown table (TC-15)
- **Priority**: high | **Estimate**: 1h
- **Depends On**: TCH-CORE-09, BE-OPS-13
- **Tags**: teacher, assignments, results

### Goal
Implement `/teacher/assignments/:assignmentId/results` results table displaying all student submissions, submission timestamps, and grade status.

### Implementation Details
- Create `frontend/src/pages/teacher/AssignmentResultsPage/index.tsx`.
- Student submission table: Student name, status ('Not Started', 'Submitted', 'Graded'), score, submission time, late flag.
- Export results to CSV button.
- 'Release All Grades' bulk button notifying students.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/AssignmentResultsPage/**`
- **Conflict Prevention**: Follow TC-15 in TEACHER-SPEC.

**Acceptance Criteria**:
- Lists all class students and their submission status.
- Highlights late submissions with red pill.
- Release Grades button publishes grades to students via RPC.

---

### TCH-CORE-11: Quizzes manager: active quizzes, scheduled runs and live attempts (TC-16)
- **Priority**: high | **Estimate**: 1h
- **Depends On**: TCH-CORE-01
- **Tags**: teacher, quizzes, hub

### Goal
Implement `/teacher/quizzes` hub listing created quizzes, active scheduled test windows, average class scores, and pass rates.

### Implementation Details
- Create `frontend/src/pages/teacher/QuizzesHubPage/index.tsx`.
- Quiz cards: Title, question count, time limit, class name, average score percentage, pass rate badge.
- Live test indicator: shows how many students are currently in an active quiz attempt.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/QuizzesHubPage/**`
- **Conflict Prevention**: Follow TC-16 in TEACHER-SPEC.

**Acceptance Criteria**:
- Lists all quizzes with status and average score stats.
- Indicates live ongoing student attempts.
- Links to Quiz Builder and Quiz Results.

---

### TCH-CORE-12: Quiz item analysis, question difficulty and distractors breakdown (TC-18)
- **Priority**: high | **Estimate**: 2h
- **Depends On**: TCH-CORE-11
- **Tags**: teacher, quizzes, item-analysis, analytics

### Goal
Implement `/teacher/quizzes/:quizId/results` item analysis screen detailing class score distributions, hardest questions, and common mistake patterns.

### Implementation Details
- Create `frontend/src/pages/teacher/QuizResultsPage/index.tsx`.
- Class score distribution histogram (Recharts).
- Question-by-question item analysis: percentage answered correctly, most common incorrect option chosen.
- 'Grant Extra Attempt' action allowing teacher to give specific students a retake.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/QuizResultsPage/**`
- **Conflict Prevention**: Follow TC-18 in TEACHER-SPEC.

**Acceptance Criteria**:
- Score histogram displays class grade distribution.
- Item analysis highlights questions with low success rates.
- Grant Extra Attempt increments student attempt allowance.

---

### TCH-CORE-13: Unified grading queue with class filter and urgency sorting (TC-20)
- **Priority**: critical | **Estimate**: 1h
- **Depends On**: TCH-CORE-01, BE-OPS-13
- **Tags**: teacher, grading, queue

### Goal
Implement `/teacher/grading` central queue displaying all un-graded student submissions across all classes, sorted by due date and submission age.

### Implementation Details
- Create `frontend/src/pages/teacher/GradingQueuePage/index.tsx`.
- Filter bar: by class, by assessment kind (Essay, Quiz review, Speaking), by due date.
- Queue row: Student name, assessment title, submitted timestamp, AI pre-grade badge (if AI grading ran).
- 'Start Grading Next' button launching focused continuous grading flow.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/GradingQueuePage/**`
- **Conflict Prevention**: Follow TC-20 in TEACHER-SPEC.

**Acceptance Criteria**:
- Groups all pending student submissions in single queue.
- Sorting puts oldest un-graded submissions at the top.
- 'Start Grading Next' opens first pending submission.

---

### TCH-CORE-14: Interactive grading screen: submission reader, rubric evaluator and comments (TC-21)
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: TCH-CORE-13, BE-OPS-13
- **Tags**: teacher, grading, rubrics, evaluator

### Goal
Implement `/teacher/grading/:submissionId` focused grading workspace featuring side-by-side student work reader, interactive rubric selector, and inline margin notes.

### Implementation Details
- Create `frontend/src/pages/teacher/GradingScreenPage/index.tsx`.
- Left pane: Student written submission with text selection to attach inline comments.
- Right pane: Rubric criteria evaluator (click level to assign points) and AI pre-grade suggestions.
- Audio feedback recording button (allowing teacher to record quick voice note).
- 'Save & Next' keyboard shortcut (Cmd/Ctrl + Enter) advancing to next queue item.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/GradingScreenPage/**`
- **Conflict Prevention**: Follow TC-21 in TEACHER-SPEC.

**Acceptance Criteria**:
- Clean split-pane layout for reading and rubric scoring.
- Tapping rubric levels recalculates score instantly.
- Save & Next records grade via `save_grade` RPC and opens next student work.

---

### TCH-CORE-15: Class performance reports hub and analytics overview (TC-22, TC-23)
- **Priority**: high | **Estimate**: 2h
- **Depends On**: TCH-CORE-03
- **Tags**: teacher, reports, analytics

### Goal
Implement `/teacher/reports` and `/teacher/reports/class/:classId` detailing curriculum completion rates, CEFR level distribution, and attendance trends.

### Implementation Details
- Create `frontend/src/pages/teacher/ReportsPage/index.tsx` and `ClassReportPage.tsx`.
- Charts: Average Quiz Scores over time, Vocabulary Mastery rate, Skills breakdown (Reading, Writing, Listening).
- Highlighting students needing targeted intervention.
- Export PDF / CSV report button.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/ReportsPage/**`
- **Conflict Prevention**: Follow TC-22 and TC-23 in TEACHER-SPEC.

**Acceptance Criteria**:
- Renders aggregate class performance charts clearly.
- Categorizes performance by CEFR language competencies.
- Exports printable report summary.

---

### TCH-CORE-16: Cross-class comparison and student progress report card (TC-24, TC-25)
- **Priority**: medium | **Estimate**: 2h
- **Depends On**: TCH-CORE-15
- **Tags**: teacher, reports, print, report-card

### Goal
Implement `/teacher/reports/compare` comparing multiple classes side-by-side, and `/teacher/reports/student/:studentId` printable student report card.

### Implementation Details
- Create `frontend/src/pages/teacher/CompareClassesPage/index.tsx`.
- Create `frontend/src/pages/teacher/StudentReportCardPage/index.tsx`.
- Multi-class comparative bar charts.
- Printable report card with school letterhead, teacher comments, and grade distributions for parent-teacher conferences.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/CompareClassesPage/**`
  - `frontend/src/pages/teacher/StudentReportCardPage/**`
- **Conflict Prevention**: Follow TC-24, TC-25 in TEACHER-SPEC.

**Acceptance Criteria**:
- Compares performance benchmarks across class sections.
- Printable report card adheres to A4 print stylesheet standards.
- Teacher can add personalized narrative summary before printing.

---

### TCH-CORE-17: Class announcements hub and rich announcement composer (TC-26, TC-27)
- **Priority**: high | **Estimate**: 1h
- **Depends On**: TCH-CORE-03, BE-OPS-19
- **Tags**: teacher, announcements, communication

### Goal
Implement `/teacher/announcements` feed and rich announcement composer allowing teachers to publish updates, homework reminders, and urgent alerts.

### Implementation Details
- Create `frontend/src/pages/teacher/AnnouncementsPage/index.tsx`.
- Composer modal: Title, target class selection, rich text body, priority toggle (Normal vs Urgent).
- Urgent toggle emits immediate Realtime alert banner to student screens.
- Read receipt stats: shows list of students who have opened announcement.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/AnnouncementsPage/**`
- **Conflict Prevention**: Follow TC-26, TC-27 in TEACHER-SPEC.

**Acceptance Criteria**:
- Creates and broadcasts announcement to enrolled students.
- Shows read receipts percentage for teacher.
- Urgent priority broadcasts Realtime notification immediately.

---

### TCH-CORE-18: Teacher notifications inbox and alerts drawer (TC-28)
- **Priority**: medium | **Estimate**: 1h
- **Depends On**: TCH-CORE-01
- **Tags**: teacher, notifications

### Goal
Implement `/teacher/notifications` inbox showing alerts for new student submissions, late submissions, help requests, and school admin notices.

### Implementation Details
- Create `frontend/src/pages/teacher/NotificationsPage/index.tsx`.
- Filter categories: 'Submissions', 'Class Requests', 'System Notices'.
- Clicking notification opens relevant grading screen or class approval modal.
- Mark all as read action.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/NotificationsPage/**`
- **Conflict Prevention**: Follow TC-28 in TEACHER-SPEC.

**Acceptance Criteria**:
- Receives real-time alerts on student submissions.
- Directly navigates to action item on click.
- Clean unread badge synchronization.

---

### TCH-CORE-19: Teacher account and classroom preferences settings (TC-29)
- **Priority**: low | **Estimate**: 1h
- **Depends On**: TCH-CORE-01
- **Tags**: teacher, settings

### Goal
Implement `/teacher/settings` page allowing teachers to manage profile, default class grading scales, notification email preferences, and password.

### Implementation Details
- Create `frontend/src/pages/teacher/SettingsPage/index.tsx`.
- Default grading scale settings (Percentage vs Letter Grade A-F).
- Notification preferences: submission digests, instant alerts on urgent questions.
- Profile update (Display name, title, bio).

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/SettingsPage/**`
- **Conflict Prevention**: Follow TC-29 in TEACHER-SPEC.

**Acceptance Criteria**:
- Updates teacher preferences cleanly in database.
- Adjusts default grading scales across builder workflows.
- Password change modal functions securely.

---

### TCH-CORE-20: Live quiz monitoring dashboard and active test control room
- **Priority**: medium | **Estimate**: 2h
- **Depends On**: TCH-CORE-11, BE-EDGE-17
- **Tags**: teacher, quizzes, realtime, monitoring

### Goal
Build real-time quiz monitoring room displaying a live grid of active student progress during ongoing exams (question number, active time, online status).

### Implementation Details
- Create `frontend/src/pages/teacher/QuizMonitorPage/index.tsx`.
- Realtime grid of all enrolled students taking active test.
- Indicators: Current question number, elapsed time, connection status (green dot = active, yellow = idle).
- Teacher actions: 'Extend Time for Class (+5 min)', 'Force Submit Student Attempt'.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/pages/teacher/QuizMonitorPage/**`
- **Conflict Prevention**: Connects via Realtime channel.

**Acceptance Criteria**:
- Real-time grid updates student progress without manual page reload.
- Extend Time action pushes extra minutes to student timers.
- Force Submit terminates and auto-scores attempt immediately.

---

### TCH-CORE-21: Audio feedback recorder component for grading oral student exercises
- **Priority**: medium | **Estimate**: 1h
- **Depends On**: TCH-CORE-14, BE-EDGE-15
- **Tags**: teacher, audio, grading, speaking

### Goal
Build audio feedback recording tool inside teacher grading screen enabling teachers to record up to 60 seconds of verbal encouragement and pronunciation tips.

### Implementation Details
- Create `frontend/src/shared/components/teacher/AudioFeedbackRecorder.tsx`.
- Microphone record, pause, and preview playback controls.
- Uploads audio recording to `media-audio` storage bucket via `storage-upload` Edge Function.
- Attaches audio URL to submission grading feedback.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/components/teacher/AudioFeedbackRecorder.tsx`
- **Conflict Prevention**: Integrates into `GradingScreenPage`.

**Acceptance Criteria**:
- Records crisp audio via MediaRecorder API.
- Previews audio with waveform prior to saving.
- Uploads and attaches public URL to student submission feedback.

---

### TCH-CORE-22: Teacher core workflows integration tests and grading verification
- **Priority**: high | **Estimate**: 2h
- **Depends On**: TCH-CORE-02, TCH-CORE-14
- **Tags**: testing, teacher, vitest

### Goal
Write end-to-end integration tests in Vitest validating the full teacher journey: class creation, student enrollment, assignment publishing, and rubric grading.

### Implementation Details
- Create `frontend/src/test/integration/teacher-core.test.tsx`.
- Test class creation and join code generation.
- Test roster student addition and removal.
- Test rubric grading calculation and submission.
- Test grade release notification dispatch.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/test/integration/teacher-core.test.tsx`
- **Conflict Prevention**: Automated test suite.

**Acceptance Criteria**:
- All teacher core integration tests run green.
- Confirms grading arithmetic conforms to rubric criteria rules.
- Verifies security boundaries so teachers cannot grade other classes.

---

## Block: UIK (28 tasks)

### UIK-01: WorldProvider context, world morph transitions and theme switcher
- **Priority**: critical | **Estimate**: 1h
- **Depends On**: FND-08, FND-10
- **Tags**: ui-kit, themes, worlds

### Goal
Implement `WorldProvider` and `ThemeProvider` handling active world switching (Coral, Amber, Mint, Sky, Violet, Rose) via `data-world` root attributes and animated color transitions.

### Implementation Details
- Create `frontend/src/shared/providers/WorldProvider.tsx` and `useWorld()` hook.
- Create `frontend/src/shared/providers/ThemeProvider.tsx` for full cosmetic reskins.
- Implement CSS smooth transition on background and text colors when world changes.
- Persist user preference to `localStorage` and synchronize with profile settings.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/providers/WorldProvider.tsx`
  - `frontend/src/shared/providers/ThemeProvider.tsx`
  - `frontend/src/shared/hooks/useWorld.ts`
- **Conflict Prevention**: Sets `data-world` on root document element; do not hardcode styles.

**Acceptance Criteria**:
- Switching world updates `data-world` attribute immediately.
- CSS color custom properties smoothly morph between palette themes.
- Persists across reloads.

---

### UIK-02: EffectsProvider, performance tiers and motion governor
- **Priority**: high | **Estimate**: 1h
- **Depends On**: UIK-01
- **Tags**: ui-kit, performance, motion, a11y

### Goal
Implement `EffectsProvider` detecting user device capability (Low, Balanced, High) and honoring `prefers-reduced-motion` to throttle heavy visual effects.

### Implementation Details
- Create `frontend/src/shared/providers/EffectsProvider.tsx` and `useEffectsTier()` hook.
- Low tier: disables 3D, disables confetti, minimal CSS transitions.
- Balanced tier: lightweight particle bursts, standard 2D motion.
- High tier: full 60fps GSAP ticker, interactive stickers, 3D celebratory stages.
- Listen to hardware concurrency, memory hints, and battery status.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/providers/EffectsProvider.tsx`
  - `frontend/src/shared/hooks/useEffectsTier.ts`
- **Conflict Prevention**: Core performance governor used by all motion and celebration tasks.

**Acceptance Criteria**:
- Automatically chooses balanced or low tier on low-spec devices or battery saver mode.
- Instantly respects OS `prefers-reduced-motion` toggle.
- Provides `canRender3D` and `canAnimateComplex` boolean flags.

---

### UIK-03: SoundProvider, Howler audio sprites and mute toggle
- **Priority**: medium | **Estimate**: 1h
- **Depends On**: UIK-01
- **Tags**: ui-kit, audio, sound, howler

### Goal
Implement `SoundProvider` utilizing Howler.js audio sprites for arcade sound effects (button click, correct answer, level up, coin ding, error buzz).

### Implementation Details
- Create `frontend/src/shared/providers/SoundProvider.tsx` and `useSound()` hook.
- Define sound sprite map (click, success, fanfare, coin, whoosh, buzz, pop).
- Provide volume control, mute toggle, and persist audio settings in localStorage.
- Respect user interaction requirement for Web Audio autoplay policy.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/providers/SoundProvider.tsx`
  - `frontend/src/shared/hooks/useSound.ts`
  - `frontend/src/assets/audio/sprites.json`
- **Conflict Prevention**: Fallback gracefully to silence if audio assets are missing or disabled.

**Acceptance Criteria**:
- Plays crisp arcade audio effects on trigger without stutter.
- Mute toggle silences all audio instantly.
- Handles browser autoplay policy cleanly without console warnings.

---

### UIK-04: Button and IconButton primitives with arcade press physics
- **Priority**: critical | **Estimate**: 1h
- **Depends On**: UIK-01, UIK-03
- **Tags**: ui-kit, button, primitives

### Goal
Implement arcade `Button` and `IconButton` components featuring 2px black outlines, 3D press physics (transform translateY on active), and solid shadows.

### Implementation Details
- Create `frontend/src/shared/components/ui/Button.tsx` and `IconButton.tsx`.
- Variants: `primary` (world theme), `secondary` (white surface), `outline`, `ghost`, `danger` (coral-600), `success` (mint-600).
- Sizes: `sm`, `md`, `lg`, `pill`.
- States: default, hover (shadow expand), active (translateY(2px) with flattened shadow), disabled, loading (with retro spinner).
- Integrate click sound effect via `useSound()`.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/components/ui/Button.tsx`
  - `frontend/src/shared/components/ui/IconButton.tsx`
- **Conflict Prevention**: Fully accessible via standard `<button>` HTML element and ARIA attributes.

**Acceptance Criteria**:
- Tactile button press animation with translateY and shadow collapse.
- Accessible keyboard focus ring matching base CSS specification.
- Loading state renders spinner and disables clicks.

---

### UIK-05: Arcade Badge, Chip, Tag and LevelIndicator primitives
- **Priority**: high | **Estimate**: 1h
- **Depends On**: UIK-01
- **Tags**: ui-kit, badge, chip

### Goal
Implement small badge, status tag, and chip primitives with solid borders, pill shapes, and high contrast typography.

### Implementation Details
- Create `Badge.tsx` (counts, notifications, new indicator).
- Create `Chip.tsx` (clickable filters, selectable tags, removable chips).
- Create `LevelIndicator.tsx` displaying student level pill with mini star or shield icon.
- Support world color variants and inverted styles.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/components/ui/Badge.tsx`
  - `frontend/src/shared/components/ui/Chip.tsx`
  - `frontend/src/shared/components/ui/LevelIndicator.tsx`
- **Conflict Prevention**: Ensure chips have visible keyboard focus and dismissal events.

**Acceptance Criteria**:
- Renders compact badges with 2px borders and legible typography.
- Removable chips support keyboard Backspace/Delete removal.
- Level badge adapts to current world color.

---

### UIK-06: ShapeFrame, Sticker and Squiggle arcade decorative primitives
- **Priority**: high | **Estimate**: 2h
- **Depends On**: UIK-02
- **Tags**: ui-kit, arcade, stickers, decorations

### Goal
Build the signature arcade sticker book decorative primitives: `ShapeFrame` (wavy, scalloped borders), `Sticker` (peeling tilt hover), and self-drawing SVG `Squiggle`.

### Implementation Details
- Create `ShapeFrame.tsx` generating custom SVG mask or border clip paths (wavy, ticket, postage stamp edges).
- Create `Sticker.tsx` with interactive slight tilt on hover, white border sticker outline, and drop shadow.
- Create `Squiggle.tsx` drawing animated highlighter squiggles and circles underneath text with SVG stroke dashoffset.
- Respect `prefers-reduced-motion` and EffectsProvider.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/components/ui/ShapeFrame.tsx`
  - `frontend/src/shared/components/ui/Sticker.tsx`
  - `frontend/src/shared/components/ui/Squiggle.tsx`
- **Conflict Prevention**: Keep SVG path definitions lightweight to preserve rendering performance.

**Acceptance Criteria**:
- Sticker displays white border outline and subtle spring hover tilt.
- Squiggle draws smoothly under key words without blocking text flow.
- Performance conforms to 60fps budget.

---

### UIK-07: Card, Surface and RetroShadow containers
- **Priority**: critical | **Estimate**: 1h
- **Depends On**: UIK-01
- **Tags**: ui-kit, card, containers

### Goal
Implement foundational layout containers: `Card`, `Surface`, and `RetroContainer` with solid outlines, offset black shadows, and optional header bands.

### Implementation Details
- Create `frontend/src/shared/components/ui/Card.tsx`.
- Support header band with world accent colors (`card-header-band`).
- Configurable shadow depths: `sm` (2px), `md` (4px), `lg` (8px).
- Hoverable card variants with lift animation (`-translate-y-1` and expanded shadow).

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/components/ui/Card.tsx`
  - `frontend/src/shared/components/ui/Surface.tsx`
- **Conflict Prevention**: Provide `as` prop for semantic HTML tag polymorphism (`section`, `article`, `div`).

**Acceptance Criteria**:
- Renders crisp 2px border and hard offset box shadow.
- Header band neatly attaches to top of card container.
- Interactive card lifts up smoothly on hover.

---

### UIK-08: User Avatar, Character Avatar and LevelRing components
- **Priority**: high | **Estimate**: 1h
- **Depends On**: UIK-01
- **Tags**: ui-kit, avatar, gamification

### Goal
Create avatar primitives: `Avatar` (student custom avatar, teacher photo, Pip & Nova AI mascots) with circular border and optional circular progress level ring.

### Implementation Details
- Create `Avatar.tsx` supporting image fallback, initials generator, and mascot SVGs.
- Create `LevelRing.tsx` SVG circular progress indicator wrapping avatar depicting student level percentage.
- Sizes: `xs` (24px), `sm` (32px), `md` (44px), `lg` (64px), `xl` (96px).
- Status indicator dot (online, offline, away).

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/components/ui/Avatar.tsx`
  - `frontend/src/shared/components/ui/LevelRing.tsx`
- **Conflict Prevention**: Fallback smoothly to colored initials on broken image URLs.

**Acceptance Criteria**:
- Avatar renders image, SVG mascot, or initials fallback cleanly.
- Level ring accurately charts progress percentage around perimeter.
- 2px solid border separates ring from avatar content.

---

### UIK-09: Input, Textarea and SearchField form controls
- **Priority**: critical | **Estimate**: 1h
- **Depends On**: UIK-01
- **Tags**: ui-kit, forms, inputs

### Goal
Implement accessible text input controls with 2px solid outlines, Fredoka/Figtree typography, clear buttons, and error message integration.

### Implementation Details
- Create `Input.tsx`, `Textarea.tsx`, and `SearchField.tsx`.
- Features: left/right icon slots, clearable input button, character counter, error validation state.
- Focus state: brand outline and subtle shadow pop.
- Integrates with React Hook Form via `forwardRef`.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/components/ui/Input.tsx`
  - `frontend/src/shared/components/ui/Textarea.tsx`
  - `frontend/src/shared/components/ui/SearchField.tsx`
- **Conflict Prevention**: Enforce ARIA invalid and describedby attributes for error states.

**Acceptance Criteria**:
- Clean input styling with 2px border and active retro shadow.
- `SearchField` includes search icon and instant clear button.
- React Hook Form validation errors clearly displayed.

---

### UIK-10: Select, Checkbox, Radio and Switch accessible selection controls
- **Priority**: high | **Estimate**: 2h
- **Depends On**: UIK-01, UIK-03
- **Tags**: ui-kit, forms, selection, radix

### Goal
Implement custom selection primitives built on Radix UI headless components with arcade styling.

### Implementation Details
- Create `Select.tsx` (custom dropdown using Radix Select with retro popover shadow).
- Create `Checkbox.tsx` (2px square checkbox with bouncy animated checkmark).
- Create `RadioGroup.tsx` (circular radio with solid center dot).
- Create `Switch.tsx` (tactile toggle switch with sliding thumb and sound effect).

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/components/ui/Select.tsx`
  - `frontend/src/shared/components/ui/Checkbox.tsx`
  - `frontend/src/shared/components/ui/RadioGroup.tsx`
  - `frontend/src/shared/components/ui/Switch.tsx`
- **Conflict Prevention**: Retain full standard keyboard navigation (Arrow keys, Space, Enter).

**Acceptance Criteria**:
- 100% accessible keyboard navigation via Radix primitives.
- Crisp retro aesthetic with high contrast checked states.
- Sound effect triggers on switch toggle.

---

### UIK-11: FormField wrapper with labels, helper text and error message animations
- **Priority**: high | **Estimate**: 1h
- **Depends On**: UIK-09
- **Tags**: ui-kit, forms, a11y

### Goal
Create unified `FormField` component managing labels, required asterisks, helper text, and animated error messaging.

### Implementation Details
- Create `frontend/src/shared/components/ui/FormField.tsx`.
- Automatically connect `id`, `aria-labelledby`, and `aria-describedby`.
- Animate error message entrance using Motion or CSS accordion slide.
- Support optional character count and tooltip info icon.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/components/ui/FormField.tsx`
- **Conflict Prevention**: Ensure wrapper does not add unnecessary DOM wrapper bloat.

**Acceptance Criteria**:
- Accessible association between label, input, and error messages.
- Error messages animate smoothly into view without layout jumps.
- Required indicator clearly visible.

---

### UIK-12: Dialog and Modal overlay components with accessible focus trap
- **Priority**: critical | **Estimate**: 1h
- **Depends On**: UIK-01, UIK-04
- **Tags**: ui-kit, dialog, modal, radix

### Goal
Create accessible `Dialog` and `Modal` components using Radix Dialog with backdrop blur, bouncy modal entrance, and retro drop shadow.

### Implementation Details
- Create `frontend/src/shared/components/ui/Dialog.tsx`.
- Features: title, description, close button, footer action slots.
- Backdrop: dark tint with subtle blur (`bg-black/40 backdrop-blur-sm`).
- Entrance animation: scale-in and fade with spring physics.
- Automatic focus trap and restore focus on dismiss.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/components/ui/Dialog.tsx`
- **Conflict Prevention**: Follow WAI-ARIA Dialog (Modal) design pattern.

**Acceptance Criteria**:
- Traps focus within modal while open; closes on Escape key or overlay click.
- Screen readers announce title and description automatically.
- Smooth spring entrance animation.

---

### UIK-13: Drawer slide-over panel for mobile drawers and inspection sheets
- **Priority**: high | **Estimate**: 1h
- **Depends On**: UIK-12
- **Tags**: ui-kit, drawer, mobile

### Goal
Implement slide-over `Drawer` component supporting bottom sheet on mobile and right side drawer on desktop.

### Implementation Details
- Create `frontend/src/shared/components/ui/Drawer.tsx` using Radix Dialog / Vaul.
- Mobile: draggable bottom sheet with touch drag handle, velocity gesture dismiss.
- Desktop: right-side slide-over panel for inspector sheets or Copilot chats.
- Accessible keyboard dismissal and focus containment.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/components/ui/Drawer.tsx`
- **Conflict Prevention**: Responsive breakpoint automatically selects bottom sheet vs right drawer.

**Acceptance Criteria**:
- Slides smoothly from bottom on mobile and right on desktop.
- Drag handle on mobile allows swipe-to-dismiss gesture.
- Focus trap operates reliably.

---

### UIK-14: DropdownMenu and ContextMenu primitives
- **Priority**: high | **Estimate**: 1h
- **Depends On**: UIK-01
- **Tags**: ui-kit, dropdown, radix

### Goal
Implement custom accessible dropdown menus and context menus styled with arcade border, popover shadow, and keyboard arrow navigation.

### Implementation Details
- Create `DropdownMenu.tsx` and `ContextMenu.tsx` using Radix UI.
- Items support icons, keyboard shortcuts, danger red highlights, and sub-menus.
- 2px solid border, 4px black shadow, crisp rounded corners.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/components/ui/DropdownMenu.tsx`
  - `frontend/src/shared/components/ui/ContextMenu.tsx`
- **Conflict Prevention**: Use Radix primitives for guaranteed accessibility compliance.

**Acceptance Criteria**:
- Dropdown opens cleanly on button click; navigates with arrow keys.
- Closes on Escape or item selection.
- Clear hover and active highlight indicators.

---

### UIK-15: Tooltip and Popover contextual help primitives
- **Priority**: medium | **Estimate**: 1h
- **Depends On**: UIK-01
- **Tags**: ui-kit, tooltip, popover

### Goal
Create lightweight accessible tooltips and rich popover panels for badges, XP formulas, and contextual help icons.

### Implementation Details
- Create `Tooltip.tsx` and `Popover.tsx` using Radix UI.
- Tooltips display on hover and keyboard focus with 200ms delay.
- Styled with dark background or high-contrast theme border, arrow indicator.
- Screen reader accessible via `aria-describedby`.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/components/ui/Tooltip.tsx`
  - `frontend/src/shared/components/ui/Popover.tsx`
- **Conflict Prevention**: Tooltips must not steal focus from parent elements.

**Acceptance Criteria**:
- Shows on hover and focus; dismisses on Escape.
- Positions automatically using collision detection to stay on screen.
- Screen reader accessible.

---

### UIK-16: ProgressBar, ProgressRing and XPBar gamified progress indicators
- **Priority**: high | **Estimate**: 1h
- **Depends On**: UIK-01
- **Tags**: ui-kit, progress, gamification

### Goal
Implement arcade progress indicators: horizontal `ProgressBar`, circular `ProgressRing`, and animated `XpBar` with striped pattern fills.

### Implementation Details
- Create `ProgressBar.tsx` (2px outline, rounded pill container, animated fill width).
- Create `ProgressRing.tsx` (SVG circular ring with customizable radius and stroke).
- Create `XpBar.tsx` featuring animated diagonal stripes in fill bar, XP numerical label, and pulse on increase.
- Support world accent colors.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/components/ui/ProgressBar.tsx`
  - `frontend/src/shared/components/ui/ProgressRing.tsx`
  - `frontend/src/shared/components/ui/XpBar.tsx`
- **Conflict Prevention**: Animate width using CSS transitions or Motion springs.

**Acceptance Criteria**:
- Smooth fill transitions when value changes.
- `aria-valuenow`, `aria-valuemin`, `aria-valuemax` attributes present.
- XpBar displays striped arcade fill animation.

---

### UIK-17: Skeleton loaders and EmptyState / ErrorState visual templates
- **Priority**: high | **Estimate**: 1h
- **Depends On**: UIK-04, UIK-07
- **Tags**: ui-kit, feedback, loading

### Goal
Implement skeleton loaders with subtle pulse and charming illustrated `EmptyState` and `ErrorState` components with action buttons.

### Implementation Details
- Create `Skeleton.tsx` (custom pulse animation without aggressive flash).
- Create `EmptyState.tsx` (empty box illustration, friendly title, description, CTA button).
- Create `ErrorState.tsx` (warning sticker icon, error message, retry button).
- Include Arabic localized fallbacks.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/components/ui/Skeleton.tsx`
  - `frontend/src/shared/components/ui/EmptyState.tsx`
  - `frontend/src/shared/components/ui/ErrorState.tsx`
- **Conflict Prevention**: Ensure empty states fit neatly inside cards or full-page layouts.

**Acceptance Criteria**:
- Skeletons match layout dimensions during loading states.
- Empty states present clear user call to action.
- Retry button triggers callback on error states.

---

### UIK-18: DataTable component with column sorting, search and bulk actions bar
- **Priority**: high | **Estimate**: 2h
- **Depends On**: UIK-10, UIK-04
- **Tags**: ui-kit, tables, data-display

### Goal
Implement high-performance `DataTable` component featuring sortable columns, row selection checkboxes, pagination, and floating bulk action bar.

### Implementation Details
- Create `frontend/src/shared/components/ui/DataTable.tsx` using TanStack Table.
- Retro table styling: 2px borders, alternating zebra rows, sticky header.
- Multi-row selection with floating bottom bulk actions bar (e.g. Delete, Archive, Export).
- Sorting arrows and per-column search filters.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/components/ui/DataTable.tsx`
- **Conflict Prevention**: Reusable table for teacher rosters and admin user management.

**Acceptance Criteria**:
- Smooth column sorting on header click.
- Bulk selection checkbox selects all page rows.
- Accessible keyboard navigation across cells and headers.

---

### UIK-19: Pagination and FilterBar search and faceted filtering components
- **Priority**: medium | **Estimate**: 1h
- **Depends On**: UIK-04, UIK-09
- **Tags**: ui-kit, pagination, filters

### Goal
Create accessible `Pagination` controls and `FilterBar` containing search input, filter chips, and sorting dropdown.

### Implementation Details
- Create `Pagination.tsx` (page numbers, previous/next buttons, page size selector).
- Create `FilterBar.tsx` combining search field, active filter tags with clear all button, and view mode toggle (grid vs list).
- Mobile responsive layout collapsing filter options into a drawer.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/components/ui/Pagination.tsx`
  - `frontend/src/shared/components/ui/FilterBar.tsx`
- **Conflict Prevention**: URL search params synchronized cleanly.

**Acceptance Criteria**:
- Pagination controls update page index without page jumps.
- FilterBar adapts cleanly to small mobile screens.
- Active filters show clear badges with instant removal.

---

### UIK-20: Tabs and SegmentedControl accessible navigation switches
- **Priority**: high | **Estimate**: 1h
- **Depends On**: UIK-01
- **Tags**: ui-kit, tabs, navigation, radix

### Goal
Implement accessible `Tabs` and `SegmentedControl` with sliding active pill highlight and keyboard arrow navigation.

### Implementation Details
- Create `Tabs.tsx` and `SegmentedControl.tsx` based on Radix Tabs.
- Sliding pill indicator behind active tab using layoutId animation.
- Arcade styling with 2px solid border and high contrast labels.
- Keyboard arrow left/right switches tabs.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/components/ui/Tabs.tsx`
  - `frontend/src/shared/components/ui/SegmentedControl.tsx`
- **Conflict Prevention**: Follow ARIA Tabs pattern.

**Acceptance Criteria**:
- Smooth pill sliding animation between selected tabs.
- Arrow keys switch active tab with keyboard focus.
- Unselected tabs retain clear contrast.

---

### UIK-21: Accordion and collapsible panel components
- **Priority**: medium | **Estimate**: 1h
- **Depends On**: UIK-01
- **Tags**: ui-kit, accordion, radix

### Goal
Create accessible `Accordion` component for FAQ sections, lesson unit breakdowns, and collapsible curriculum blocks.

### Implementation Details
- Create `Accordion.tsx` based on Radix Accordion.
- Support single and multiple expanded items.
- Smooth height expansion animation without layout stutter.
- Arrow icon rotates 180 degrees on expansion.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/components/ui/Accordion.tsx`
- **Conflict Prevention**: Screen readers must correctly read expanded state.

**Acceptance Criteria**:
- Smooth height expansion and collapse.
- Keyboard Enter and Space toggle items.
- Accessible ARIA expanded attributes.

---

### UIK-22: PublicHeader and PublicFooter navigation shells for visitors
- **Priority**: high | **Estimate**: 1h
- **Depends On**: UIK-04, UIK-13
- **Tags**: ui-kit, layout, public

### Goal
Build `PublicHeader` and `PublicFooter` components with sticky positioning, mobile menu drawer, and school branding.

### Implementation Details
- Create `PublicHeader.tsx` with logo, nav links (About, Curriculum, FAQ, Contact), and Sign In button.
- Create `PublicFooter.tsx` with school accreditation info, copyright, and legal links.
- Mobile burger menu sliding out responsive drawer on small viewports.
- Skip-to-content accessibility link.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/components/layout/PublicHeader.tsx`
  - `frontend/src/shared/components/layout/PublicFooter.tsx`
- **Conflict Prevention**: Shell components must not wrap router outlets directly; exported as layout pieces.

**Acceptance Criteria**:
- Header remains sticky on scroll with subtle backdrop blur.
- Mobile hamburger menu toggles accessible drawer.
- Footer displays all legal and school links cleanly.

---

### UIK-23: Student AppShell: sidebar, topbar, mobile bottom navigation and streak pill
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: UIK-04, UIK-08, UIK-16
- **Tags**: ui-kit, layout, student-shell

### Goal
Build student `StudentAppShell` layout incorporating arcade sidebar, top status bar (Coins, Streak Flame, Level, Theme switcher), and mobile bottom tab bar.

### Implementation Details
- Create `StudentAppShell.tsx`.
- Desktop sidebar: Dashboard, Courses, Quizzes, Assignments, Practice, AI Tutor, Games, Shop.
- Top bar: live coin counter, streak flame with days count, active world indicator, user avatar dropdown.
- Mobile: bottom navigation bar with 5 primary icons for touch navigation.
- Main content scroll container with Lenis integration.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/components/layout/StudentAppShell.tsx`
  - `frontend/src/shared/components/layout/StudentTopBar.tsx`
  - `frontend/src/shared/components/layout/StudentBottomNav.tsx`
- **Conflict Prevention**: Follow student shell specifications in STUDENT-SPEC §3.

**Acceptance Criteria**:
- Clean responsive layout adapting from 375px mobile to widescreen desktop.
- Displays live Coins, Streak, Level, and XP in top header.
- Mobile bottom bar highlights current active route.

---

### UIK-24: Teacher AppShell: sidebar, class switcher, action bar and focused mode
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: UIK-04, UIK-10, UIK-14
- **Tags**: ui-kit, layout, teacher-shell

### Goal
Build teacher `TeacherAppShell` layout with class quick-switcher, grading queue shortcut pill, AI Copilot toggle button, and focused grading mode.

### Implementation Details
- Create `TeacherAppShell.tsx`.
- Class switcher dropdown in header for instant class context filtering.
- Nav items: Dashboard, Classes, Students, Courses, Assignments, Quizzes, Question Bank, Grading, Reports, Copilot.
- Focused mode: hides sidebar when grading submissions to maximize screen estate.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/components/layout/TeacherAppShell.tsx`
  - `frontend/src/shared/components/layout/TeacherTopBar.tsx`
- **Conflict Prevention**: Follow TEACHER-SPEC §3 shell layout.

**Acceptance Criteria**:
- Class switcher dropdown lets teacher switch between active classes.
- Focused mode hides navigation drawer during intensive grading.
- Unread submissions badge counter visible next to Grading tab.

---

### UIK-25: Admin AppShell: sidebar navigation, system health badge and View-As banner
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: UIK-04, UIK-07
- **Tags**: ui-kit, layout, admin-shell, view-as

### Goal
Build `AdminAppShell` layout with administrative hierarchy navigation, system operational health pill, and persistent 'View-As' simulation banner.

### Implementation Details
- Create `AdminAppShell.tsx`.
- Sections: Overview, People (Users, Classes, Import, Rollover), Curriculum & Content, Engagement Studios, AI Governance, System (Audit, Settings).
- Sticky `ViewAsBanner`: high-visibility warning bar at top when admin simulates student/teacher views, with instant 'Exit Simulation' button.
- Super Admin badge on sensitive settings items.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/components/layout/AdminAppShell.tsx`
  - `frontend/src/shared/components/layout/ViewAsBanner.tsx`
- **Conflict Prevention**: Follow ADMIN-SPEC §4 shell specs.

**Acceptance Criteria**:
- View-As banner stays docked to top of screen whenever simulation is active.
- Exit simulation button immediately restores admin session.
- Submenu sections collapse neatly on smaller screens.

---

### UIK-26: QuestionRenderer modular architecture supporting all exercise question types
- **Priority**: critical | **Estimate**: 2h
- **Depends On**: UIK-04, UIK-07, UIK-09, UIK-10
- **Tags**: ui-kit, questions, exercises

### Goal
Build modular `QuestionRenderer` component dynamically rendering interactive exercises: multiple choice, fill in the blank, matching, reorder, short answer, and audio spelling.

### Implementation Details
- Create `frontend/src/shared/components/questions/QuestionRenderer.tsx`.
- Create subcomponents:
  - `MultipleChoiceQuestion.tsx` (tactile selection cards)
  - `FillBlankQuestion.tsx` (inline input slots inside sentence)
  - `MatchingQuestion.tsx` (connecting pairs with visual feedback)
  - `ReorderQuestion.tsx` (accessible reordering / drag and drop)
  - `ShortAnswerQuestion.tsx` (freeform text area)
  - `AudioSpellingQuestion.tsx` (audio play button with letter tiles)
- Expose unified interface: `value`, `onChange`, `readOnly`, `showSolution`.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/components/questions/**`
- **Conflict Prevention**: Keep question components pure; no direct database mutations.

**Acceptance Criteria**:
- Renders all 6 core question types cleanly.
- Full keyboard support for drag-and-drop / matching exercises.
- `showSolution` mode highlights correct vs incorrect student answers with feedback.

---

### UIK-27: AI Chat UI kit: ChatMessage, ChatInput, TypingIndicator and ActionCardDisplay
- **Priority**: high | **Estimate**: 2h
- **Depends On**: UIK-04, UIK-07, UIK-09
- **Tags**: ui-kit, ai, chat, action-cards

### Goal
Create shared AI chat components: user and assistant message bubbles, streaming typing indicator, voice input trigger, and visual `ActionCard` displays.

### Implementation Details
- Create `ChatMessage.tsx` (Pip mascot avatar, markdown rendering, copy button).
- Create `ChatInput.tsx` (auto-expanding textarea, send button, suggested prompt chips).
- Create `TypingIndicator.tsx` (pulsing dots or Pip thinking animation).
- Create `ActionCardDisplay.tsx` rendering proposed changes with 'Apply Changes' and 'Discard' buttons.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/components/ai/**`
- **Conflict Prevention**: Modular UI components used by both AI Tutor and Teacher Copilot.

**Acceptance Criteria**:
- Renders streaming token text without scrolling jitter.
- Action cards visually summarize database modifications with clear CTA buttons.
- Accessible focus handling on send and suggestions.

---

### UIK-28: ConfettiProvider and multi-tier CelebrationDialog queue
- **Priority**: high | **Estimate**: 2h
- **Depends On**: UIK-02, UIK-03, UIK-12
- **Tags**: ui-kit, celebrations, confetti, gamification

### Goal
Implement arcade celebration system with canvas confetti bursts, audio fanfares, and modal dialogs for level ups, quest completions, and streak milestones.

### Implementation Details
- Create `frontend/src/shared/providers/CelebrationProvider.tsx` and `useCelebration()` hook.
- Celebration tiers:
  - Small: coin ding sound, subtle particle burst at trigger element.
  - Medium: full screen confetti shower, sound fanfare, banner.
  - Large: Level Up / Milestone celebration modal with Rive/animated character and reward summary.
- Manage queue so celebrations display sequentially rather than overlapping.

### Execution & File Ownership
- **Owns**:
  - `frontend/src/shared/providers/CelebrationProvider.tsx`
  - `frontend/src/shared/components/feedback/CelebrationDialog.tsx`
- **Conflict Prevention**: Check `EffectsProvider` to ensure low-end devices run lightweight particle fallbacks.

**Acceptance Criteria**:
- `celebrate({ tier: 'large', title: 'Level 5 Reached!' })` triggers celebration sequence.
- Sequential queue displays multiple rewards cleanly one after another.
- Honors reduced motion and sound mute preferences.

---

