# 04. AUTH AND ACCESS

Implements frontend/docs/02-public/SHARED-SPEC.md sections 5 to 8 (sign-in, sessions, reset flow, view-as) and the permission matrices in the TEACHER and ADMIN specs.

---

## 1. IDENTITY MODEL

- One account = one role (student, teacher, admin). Admins have a level: super or school.
- Users sign in with a USERNAME and password. The username is assigned by the school, lowercase, 3 to 32 characters of `a-z 0-9 . _ -`, unique, and immutable in v1 (an Admin cannot rename; they archive and recreate if ever needed).
- Supabase Auth stores each user with a synthetic internal email `{username}@accounts.invalid` (a reserved, undeliverable domain). The email is never shown, never used to sign in directly from the client, and no email is ever sent.
- The Supabase Auth project is configured with: public sign-ups disabled, email confirmation off, email change off, magic links and OTP off, no social providers, refresh token rotation on, access token lifetime 15 minutes, and email sending disabled. Accounts are created only by the Admin API inside Edge Functions.
- `profiles.id` equals `auth.users.id`. The profile holds role, level, status, flags and names (02-DATA-MODEL-CORE.md section 2).

---

## 2. SIGN-IN FLOW (`auth-login`)

The browser calls the Edge Function `auth-login`, not Auth directly, so lockout, maintenance and activity rules are enforced.
Input: `{ username, password, remember_me }`. Output on success: `{ session: {access_token, refresh_token, expires_at}, profile: {id, role, admin_level, display_name, grade, must_change_password}, platform: {maintenance, features} }`. The browser then calls `supabase.auth.setSession`.
Steps:
1. Rate limit: 10 attempts per minute per username hash and 30 per 10 minutes per IP hash (`rate_limits`). Exceeded: `rate_limited`.
2. Read platform settings (maintenance, lockout threshold and duration).
3. Look up the profile by lowercase username with the service role. Unknown username: run a dummy password verification (constant time) and return `invalid_credentials`-style failure with the generic message.
4. Status checks: `archived` returns `account_inactive`; `locked` with `locked_until` in the future returns `account_locked` with the minutes left (a stale lock clears itself).
5. Maintenance: if enabled and the role is not admin, return `maintenance` with the message and expected time.
6. Verify the password by calling Auth `signInWithPassword` with the synthetic email using an anon client.
7. On failure: increment `failed_attempts`; when it reaches the threshold set `status='locked'` and `locked_until`; write `auth_attempts`; return the generic failure. On success: reset `failed_attempts`, set `last_sign_in_at`, write `auth_attempts` and an audit row (category logins) for admins only.
8. Return the session. If `must_change_password` is true the frontend sends the user to the set-password screen; the claim also restricts data access until it is cleared (section 4).
The generic failure message is identical for unknown username and wrong password. Success and failure timing are kept similar.
Remember me: the frontend stores the session in persistent storage only when `remember_me` is true (otherwise session storage). Server side, session length is bounded by the Auth setting "time-box user sessions" configured to the `remember_me_days` platform setting (default 14); idle timeout is enforced by the frontend (SHARED-SPEC section 7) and by the 15 minute access token plus refresh rules.

---

## 3. PASSWORDS, TEMPORARY PASSWORDS AND RESETS

### 3.1 Rules
Password rules come from `platform_settings.security.password_rules` (default: at least 8 characters, upper and lower case, a number, a symbol optional, not equal to the username or the temporary password). `_shared/passwords.ts` validates every password set through our functions. The same rules are published in `v_public_settings` so the frontend can show the live checklist.
Accepted limitation: Supabase Auth lets a signed-in user change their own password directly. The frontend must not use that call; it calls `auth-change-password`, which enforces the rules. A user who bypasses the frontend could set a weaker password on their own account only. The Auth project minimum length is set to the same minimum and leaked-password protection is enabled where the plan allows.

### 3.2 Functions
- `auth-change-password` (signed in): `{ current_password, new_password }`. Re-verifies the current password (or, when `must_change_password` is true, the temporary password), validates the rules, updates the password with the Admin API, sets `must_change_password=false`, revokes all other sessions, returns a fresh session so the claim updates.
- `request-password-reset` (public, rate limited to 3 per hour per device hash and 20 per hour per IP hash): `{ username, full_name, grade_class?, note? }`. Always returns the same success body. Inserts a row in `password_reset_requests` and links `profile_id` when the username exists. Creates a notification for the admins and for the teachers of that student's classes.
- `reset-password`: `{ profile_id, request_id? }`. Allowed for: an admin (a School admin may reset students and teachers; only a Super admin may reset admins) and a teacher for students with an active enrollment in one of their classes. Generates a temporary password (10 characters from an unambiguous alphabet that satisfies the rules), sets it through the Admin API, sets `must_change_password=true`, clears lock state, revokes all sessions, marks the request handled (the first handler wins; a second handler gets `conflict`), writes an audit row (category password_resets with the actor), and returns the temporary password ONCE in the response. It is never stored, logged or re-readable.
- `unlock-account` (admin): clears `locked_until` and `failed_attempts` and sets status active.
- `admin-create-user` and the import job generate temporary passwords the same way and return them once (import returns them in a credentials file written to a private bucket with a short expiry; see 08-STORAGE-REALTIME-NOTIFICATIONS.md).

### 3.3 Lockout settings
Defaults: 5 failed attempts, 15 minutes. Both come from `platform_settings.security`. Locks apply per account (not per IP).

---

## 4. TOKEN CLAIMS (CUSTOM ACCESS TOKEN HOOK)

A Postgres function registered as the Auth "custom access token" hook adds these claims on every token issue and refresh:
`app_role` (student, teacher, admin), `admin_level` (super, school, or absent), `status`, `must_change_password` (bool), and for view-as sessions `view_as` (object with `session_id` and `admin_id`, set only by the view-as function; the hook preserves it).
Rules:
- If `must_change_password` is true, RESTRICTIVE policies allow the user to read only their own profile and the public settings, and to call `auth-change-password` and `auth-logout`. Every other table and function rejects with `must_change_password`.
- RLS reads roles from the claim for speed; sensitive checks (`require_writable()`, admin functions) also confirm role and status from the database.
- Changing a user's role is not allowed; archiving, resetting and demoting revoke sessions so stale tokens expire within 15 minutes at most.

---

## 5. VIEW-AS (ADMIN SUPPORT, READ-ONLY)

Implements frontend/docs/02-public/SHARED-SPEC.md section 6A.
- `view-as-start` (admin): `{ target_id, reason }`. Rules: reason at least 5 characters; a Super admin can view anyone except another Super admin; a School admin can view students and teachers only. Creates a `view_as_sessions` row with `expires_at = now + security.view_as.max_minutes` (default 30) and writes an audit row (category view_as). Mints a short-lived access token for the target user (subject = target, role authenticated, the target's `app_role` and `admin_level`, plus `view_as = {session_id, admin_id}`), signed with the project's JWT signing key, which exists only as a secret of this function. The response contains the token and the target's profile summary. The frontend opens the target's app in a new tab using this token (no refresh token is issued; the token expires with the session).
- If minting a custom token is not available on the chosen Supabase plan, the fallback is: read RPCs accept a `p_view_as_session` parameter validated against `view_as_sessions` and run as the target using SECURITY DEFINER reads. The frontend contract stays the same; this is the only part of the backend allowed to deviate, and it is decided in BG5.
- Read-only enforcement is in the database: every table with writes has a RESTRICTIVE policy for INSERT, UPDATE and DELETE requiring `(auth.jwt()->'view_as') is null`; storage write policies check the same; `require_writable()` raises `read_only_session`; Realtime presence and broadcast writes are denied.
- Nothing is recorded as the user's activity: `last_active_at`, progress, streak, events, notifications read state and AI calls are not touched (the frontend does not call those paths and the database rejects the writes anyway).
- Hidden data in a view-as token: policies on `ai_conversations`, `ai_messages` and `user_settings` require `view_as is null` for SELECT too, so conversation contents and settings cannot be read in view-as. (Conversation viewing is only through `view-ai-conversation`, with its own reason.)
- `view-as-extend`: allowed once (+ `extension_minutes`, default 30) while the session is valid; returns a new token. `view-as-end`: sets `ended_at`, writes audit. `view-as-log-page`: appends a visited route to `pages` (the one permitted write in a view-as token, executed by the function after verifying the claim). A cron job closes expired sessions and writes their end audit rows.
- Optional notification to the viewed user afterward (`security.view_as.notify_user`, default off): a notification "An administrator viewed your account on {date} for support."

---

## 5A. ADMIN VIEWING AI CONVERSATIONS (`view-ai-conversation`)
`{ conversation_id, reason }` (reason required, at least 5 characters). Admin only (School admin sees summaries only per the Admin spec: this function is Super admin only; School admin gets `forbidden`). Returns the messages, writes `conversation_views` and an audit row (category conversation_views). Flagged or reported conversations still require the reason.

---

## 6. HELPER FUNCTIONS (SQL, SECURITY DEFINER, STABLE, search_path locked)

| Function | Returns | Logic |
|---|---|---|
| `uid()` | uuid | `(select auth.uid())` |
| `app_role()` | user_role | claim `app_role`, else a lookup in profiles |
| `is_admin()` / `is_super_admin()` / `is_school_admin()` | bool | role admin and level checks |
| `is_active()` | bool | profile status is active |
| `not_view_as()` | bool | `(auth.jwt()->'view_as') is null` |
| `must_change()` | bool | claim `must_change_password` is true |
| `teaches_class(class_id)` | bool | row in class_teachers for uid |
| `in_class(class_id)` | bool | active enrollment for uid |
| `teaches_student(student_id)` | bool | uid teaches any class where the student has an active enrollment |
| `can_see_student(student_id)` | bool | self, or teaches_student, or admin |
| `can_manage_student(student_id)` | bool | teaches_student or admin (for password reset and notes about the student) |
| `my_class_ids()` | setof uuid | classes where the student is active or the teacher teaches |
| `student_can_see_course(course_id)` | bool | an active enrollment in a class that has the course assigned and active |
| `feature_enabled(key)` | bool | `platform_settings.features` for the key and the caller's grade (cached per statement) |
| `maintenance_blocks()` | bool | maintenance enabled and the caller is not admin |
| `require_writable()` | void | raises `read_only_session`, `account_inactive`, `maintenance`, or `must_change_password` when applicable |
Index support: `class_teachers(teacher_id)`, `class_enrollments(student_id, status)`, `class_courses(class_id)`, `profiles(id)`.

---

## 7. RLS POLICY CATALOG

General rules for ALL tables:
- RLS is enabled and forced. No policy means no access.
- A RESTRICTIVE policy `active_only` on every private table requires `is_active()` (or the claim status 'active') for any command.
- A RESTRICTIVE policy `no_writes_in_view_as` on every table requires `not_view_as()` for INSERT, UPDATE and DELETE.
- A RESTRICTIVE policy `password_gate` requires `not must_change()` on every table except profiles (own row select) and v_public_settings.
- Policies use `(select uid())` style initPlan caching; they call helper functions rather than subqueries on large tables.
- "Own" means `user_id = uid()` or `student_id = uid()`. "Teacher of" means `can_see_student()` through class teaching. Admin means any admin; Super means super admin only.

### 7.1 Identity and settings
| Table | Student | Teacher | Admin |
|---|---|---|---|
| profiles | select own; update own display_name via RPC only | select students they teach and own; update own via RPC | select all (School admin: not admin rows); writes via functions |
| user_settings | select/insert/update own | own | own |
| admin_notes | none | none | select/insert/update (School admin: not about admins) |
| password_reset_requests | none (insert only via function) | select for students they teach | select all |
| auth_attempts, rate_limits, idempotency_keys | none | none | none (functions only) |
| view_as_sessions | none | none | select own sessions; Super reads all |
| platform_settings | none (public projection view only) | public projection | select all; update Super only via RPC |
| config_sets | none | none | select all; write Super only via RPC |

### 7.2 School structure
| Table | Student | Teacher | Admin |
|---|---|---|---|
| school_years, terms | select | select | all writes (Super and School) |
| classes | select classes they are in (active or invited) | select classes they teach; insert (becomes a teacher of it); update classes they teach | all; delete only if empty |
| class_rules | select for own classes | select/update for classes they teach | all |
| class_teachers | select for own classes (names only through view) | select/insert/delete for classes they teach (not the last teacher) | all |
| class_enrollments | select own rows | select/insert/update for classes they teach | all |
| class_courses | select for own classes | select/insert/update for classes they teach | all |
| class_unlock_overrides | select where it concerns them (through RPC) | all for classes they teach | all |

### 7.3 Content
| Table | Student | Teacher | Admin |
|---|---|---|---|
| courses | select only when `student_can_see_course` and published (snapshot via RPC; table select restricted to title and cover fields through a view) | select own, select library (visibility library, status published), insert own, update/delete own drafts | all; official courses write by admin only |
| units, lessons, lesson_blocks, activities, activity_questions | none (students read snapshots through RPC) | author of the owning course only | all |
| course_units | none | author of the course | all |
| content_snapshots | select through RPC `get_*` only (direct select allowed where `student_can_see_course` and `is_current`) | select for own and library courses | all |
| content_versions | none | select own | all |
| curriculum_versions, grade_outcomes | none | select published | all |
| media_assets | select assets referenced by content they can see (through RPC; table access via signed URLs) | own and referenced by content they can see | all |
| vocabulary_*, grammar_topics, reading_passages, writing_prompts | select published and `source='official'` or in their lessons; practice libraries filtered by grade | select published; insert/update own | all |

### 7.4 Questions and assessments
| Table | Student | Teacher | Admin |
|---|---|---|---|
| questions | none | select own and `visibility='school'`; write own | all |
| rubrics | none | select defaults and own; write own | all |
| comment_snippets | none | own | none |
| quizzes, quiz_classes, quiz_questions | none directly (an RPC returns the student's view without answer keys) | write own while draft; select own and for classes they teach; co-teachers of the class may edit quizzes of that class | all |
| quiz_attempts, quiz_attempt_answers | select own (answers after the quiz rules allow); writes via RPC only | select for classes they teach | select all |
| assignments, assignment_classes, assignment_questions | none directly (RPC) | same as quizzes | all |
| assignment_submissions | select own; update `draft` only through the autosave RPC | select/update (grading fields) for classes they teach | select all |
| submission_answers | select own, with AI and teacher fields visible only when the submission is released (enforced by a view `v_my_submission_answers`) | select/update for classes they teach | select all |
| submission_comments | select own after release | insert/select for classes they teach | select all |
| grade_history | none | select for classes they teach | select all |
Answer keys and writing sample answers never reach students: students read `quiz_questions.snapshot` only through RPCs that strip keys, and `questions.sample_answer` is not selectable by students.

### 7.5 Progress
| Table | Student | Teacher | Admin |
|---|---|---|---|
| lesson_progress, activity_progress | select own; insert/update `notes` and `state` own (autosave); completion through RPC | select for students they teach | select all |
| library_words, library_topics, library_passages, writing_drafts, translation_history | own CRUD | none (counts only through RPC) | none |
| practice_sessions | select own; writes via RPC | select summaries for students they teach through RPC | select all |

### 7.6 Gamification, games, shop
| Table | Student | Teacher | Admin |
|---|---|---|---|
| student_stats | select own | select students they teach | select all; no client writes |
| xp_ledger, coin_ledger | select own | select for students they teach (through views) | select all |
| domain_events, streak_days | select own (streak_days) | none | select all |
| quest_templates, badge_definitions | select active and published | select | all (Super edits; School view only) |
| quest_instances, quest_chests, student_badges, badge_progress | select own; claim through RPC | select for students they teach | select all |
| class_quests, class_quest_progress | select where audience includes them | write for classes they teach | select all |
| leaderboard_snapshots | through RPC only | through RPC for own classes | select all |
| leaderboard_moderation, leaderboard_flags | none | none | all |
| bonus_awards | select own | insert through RPC; select own awards | select all |
| certificates | select own | select for students they teach | select all |
| games, game_of_day | select | select | write Super |
| game_sessions, game_bests | select own; writes via RPC | none | select all |
| shop_items, shop_bundles, shop_sales, themes, avatar_assets | select live items (and owned retired items through inventory) | none | write Super; School admin select |
| purchases, inventory | select own; writes via RPC | none | select all |

### 7.7 Communication and notifications
| Table | Student | Teacher | Admin |
|---|---|---|---|
| announcements | select published ones addressed to them (through `announcement_recipients`) | write own for classes they teach; select own | write all |
| announcement_recipients | select own; update `read_at` own | select counts for own announcements | select all |
| notifications | select own; update `read_at` own | own | own |

### 7.8 AI
| Table | Student | Teacher | Admin |
|---|---|---|---|
| ai_conversations, ai_messages | select/insert own via function; never readable in view-as | own | own; others only through `view-ai-conversation` |
| ai_action_cards | none | own (select, update status through RPC) | own |
| ai_usage, ai_limit_counters | none (limits shown through RPC `my_ai_limits`) | own counters through RPC | select all |
| ai_overrides, ai_test_cases, ai_test_runs | none | none | select all; write Super |
| ai_activity_log | none | select own | select all (School admin: no content) |
| conversation_views | none | none | select all (Super) |
| suggested_actions | none | own | none |

### 7.9 Teaching tools, jobs, moderation, admin operations, audit
| Table | Student | Teacher | Admin |
|---|---|---|---|
| support_plans, support_plan_students | none | classes they teach | select all |
| planner_items, lesson_plans | none | own (and co-teachers of the class for planner items) | select all |
| report_snapshots | none | own | own and all |
| jobs, job_steps | select own jobs (student features: practice and TTS only) | own | select all |
| moderation_items, moderation_actions | none | none | all |
| problem_reports | insert own through function | insert own through function | select all |
| import_rows, rollover_runs, rollover_changes | none | none | all |
| audit_log | none | none | Super: all; School: scoped (see 03 section 12); no writes except functions |

---

## 8. STORAGE POLICIES
Defined in 08-STORAGE-REALTIME-NOTIFICATIONS.md section 2. They use the same helper functions and the same RESTRICTIVE view-as policy.

---

## 9. ACCESS TESTS (MUST EXIST BEFORE BG0 IS CLOSED)
For every table and role (student, teacher, co-teacher, school admin, super admin, signed-out, archived, must-change-password, view-as) a pgTAP test asserts the allowed and denied commands in this document. 12-TESTING.md lists the required suites.
