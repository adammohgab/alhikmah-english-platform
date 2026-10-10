# 13. ROADMAP AND GATES

Delivery is organized in six gates (BG0 to BG5). A gate is closed when its contract operations exist, its tests pass in CI, the seed supports its pages, and the generated types are merged into the frontend. The frontend tasks reference these gates (`backend_gate` in project-tasks) and become available when the gate is closed.
Backend task prefixes (used when tasks are generated): BSE (setup, CI, tooling), DBM (schema and RLS), AUT (auth and identity functions), CNT (content, publishing, media), ENG (engine: rewards, streaks, quests, badges, leaderboards, games, shop), ASM (assessments and grading), NOT (notifications, realtime, search, reports), AIS (AI system), ADF (admin functions), SED (seed), TST (tests), OPS (operations and hardening).

---

## 1. GATE SUMMARY

| Gate | Theme | Unlocks in the frontend |
|---|---|---|
| BG0 | Foundation: environments, CI, identity and auth, school structure, settings, classes, basic user admin | Sign-in and password pages, route guards, role redirects, public state (maintenance, contact), student and teacher shells with real sessions, teacher classes and roster, admin users basics |
| BG1 | Content and progress: curriculum and courses, snapshots and publishing, media, lessons and activities, practice libraries, XP core (ledgers, levels, streaks) | Student dashboard stats and courses, course, unit, lesson and activity pages with real XP, practice libraries (non-AI), teacher course builder and publishing, admin curriculum and content basics |
| BG2 | Assessments and engagement: questions, quizzes, assignments, grading, quests, badges, leaderboards, games, certificates, bonus and class quests | Quizzes, assignments, grading (manual and bulk without AI), question bank, class rewards, quests, achievements, leaderboard, games, certificates |
| BG3 | Shop, communication and insight: shop, avatar, themes, announcements, notifications, realtime, search, reports, materialized views | Shop and themes, profile and avatar editor, notifications and announcements, global search, teacher and admin reports, dashboards with aggregates |
| BG4 | AI: adapter, safety, streaming, jobs, action cards, limits, metering, TTS | AI Tutor, writing feedback, translation, Copilot, AI builders, course wizard, AI grading, planner, support plans, suggested actions, listening and spelling audio |
| BG5 | Admin operations and hardening: imports, rollover, moderation, config governance, view-as, audit, health, usage dashboards, security and load verification | Admin dashboard, moderation, import and rollover wizards, XP and quest and badge and shop and theme studios, leaderboard moderation, AI governance pages, settings, audit, view-as |

Dependencies: BG0 before everything. BG1 before BG2 and BG3. BG2 before BG3's reports. The AI foundation (adapter, safety, streaming, metering) can start in parallel with BG1 once BG0 closes; BG4 closes after BG2 (grading) and BG1 (content) exist. BG5 pieces that only need BG0 (user admin) are delivered early.

---

## 2. BG0: FOUNDATION

Backend packages:
- BSE: repository layout; Supabase project init and `config.toml`; local stack scripts; dev project creation and secrets; GitHub Actions `backend-ci`, `deploy-dev`, `types-sync`; pgTAP and Deno test harnesses; `app_now()`; error helpers and the shared Edge library (`auth`, `errors`, `schemas`, `audit`, `idempotency`, `ratelimit`, `settings`); contract manifest generator.
- DBM-0: enums; identity tables (profiles, user_settings, admin_notes, password_reset_requests, auth_attempts, view_as_sessions, rate_limits, idempotency_keys); school tables (school_years, terms, classes, class_rules, class_teachers, class_enrollments, class_courses, class_unlock_overrides); platform_settings, config_sets, scheduler_state, audit_log; helper functions; RLS and restrictive policies for all of the above; `v_public_settings`.
- AUT: custom access token hook; `auth_login`, `auth_change_password`, `auth_logout`, `request_password_reset`, `reset_password`, `unlock_account`; password rules module.
- ADF-0: `admin_create_user`, `admin_update_user`, `admin_archive_users`, `admin_restore_users`, `admin_list_users`, `admin_get_user`, `reset_requests`, admin notes; class admin RPCs.
- Classes (teacher side RPCs): `create_class`, `update_class`, `archive_class`, `list_my_classes`, `class_roster`, `search_students`, `add_students_to_class`, `invite_students_validate`, `invite_students`, `rotate_join_code`, `decide_join_request`, `join_class_by_code`, `respond_class_invite`, `remove_student_from_class`, co-teacher RPCs, `class_rules` update with versions and unlock overrides.
- Shared RPCs: `get_public_state`, `get_session_context`, `server_time`.
- SED: system seed (settings and config defaults), dev accounts and classes (09 sections 2 and 3.1), e2e fixtures v0.
- TST: access matrix for BG0 tables, auth and password suites, class rule tests, contract tests for BG0 operations.
Acceptance: seeded accounts sign in (each role and each special state), lockout and reset flows work, a teacher creates a class, enrolls by every method, and an admin manages users, all under RLS with tests green; types generated and merged.

---

## 3. BG1: CONTENT, PROGRESS AND XP CORE

Backend packages:
- DBM-1: content and curriculum tables (curriculum_versions, grade_outcomes, courses, units, course_units, lessons, lesson_blocks, activities, activity_questions, content_snapshots, content_versions, media_assets, vocabulary, grammar, reading, writing prompts), questions, rubrics (table only), progress tables (lesson_progress, activity_progress, library tables, writing_drafts, practice_sessions, translation_history), engine core tables (student_stats, xp_ledger, coin_ledger, domain_events, streak_days), RLS for all.
- CNT: authoring triggers (version bump, `has_unpublished_changes`), `create_course`, `duplicate_course`, `reorder_children`, `course_checklist`, `course_pending_changes`, `publish_course`, `publish_course_changes`, `unpublish_course`, `preview_course`, `library_courses`, `assign_course_to_classes`; curriculum RPCs (`curriculum_tree`, versions, `publish_curriculum`, packages); admin content list and status RPCs; storage buckets, policies, `create_upload`, `complete_upload`, `get_asset_url`, SVG sanitizer, rich text sanitizer.
- Student reads: `my_courses`, `get_course`, `get_unit`, `get_lesson`, `get_activity`, `touch_lesson`, `check_lesson_answer`, `my_resume`, `my_stats`, `my_streak`, `my_xp_week`, `my_deadlines` (assessments arrive in BG2; returns empty until then), practice libraries (`practice_groups`, `list_*`, `get_*`, `add_words_to_library`, `review_word`).
- ENG-1: `app` economy config shape and the materialized level table; `level_for_xp`; `award_xp`, `award_coins`, `spend_coins`; `engine_process`; streak logic and `close_streak_day`; `complete_lesson`, `submit_activity`, `start_practice_session`, `finish_practice_session` with caps; `AwardResult` assembly; cron jobs `process_domain_events`, `day_rollover` (streak part).
- SED: official curriculum and content packs (09 section 4), student progress and ledgers.
- TST: content RLS, snapshot immutability, publish flows, XP and cap rules, streak edge cases, practice scoring.
Acceptance: a student completes lessons and activities and sees real XP, coins, levels and streaks; a teacher builds, publishes and assigns a course; an admin publishes official curriculum; media uploads work.

---

## 4. BG2: ASSESSMENTS AND ENGAGEMENT

Backend packages:
- DBM-2: quizzes, assignments and related tables, attempts, submissions, answers, comments, grade_history; quest, badge, leaderboard, bonus, certificate tables; game tables; RLS.
- ASM: `start_quiz_attempt`, `save_quiz_answers`, `submit_quiz_attempt`, `get_quiz_result`, `my_quizzes`, auto-submit cron, unlock rule function; assignment flows (`start_assignment`, `save_assignment_draft`, `submit_assignment`, results, late policy); teacher side: `publish_assessment`, `validate_assessment`, results RPCs, `grant_extra_attempt`, `release_grades`, grading RPCs (`grading_queue`, `get_submission_for_grading`, `lock_submission`, `save_grade`, `confirm_submission`, `override_score`, `approve_all_ai_grades`, `grade_history`, inline comments), question bank RPCs, `transition_assessments` cron, reminders.
- ENG-2: quest templates and instances, daily and weekly generation, progress mapping, `claim_quest`, `open_chest`, class quests, `award_bonus`; badge definitions and evaluation; leaderboards (`leaderboard`, `leaderboard_snapshot`, snapshots, anomalies); certificates; games (`list_games`, sessions, scoring per game, hints, finish, bests, game of the day); `my_quests`, `my_badges`, `pin_badges`; student and class progress RPCs for teachers.
- SED: assessments in every state, quests, badges, leaderboard history, game sessions, certificates.
- TST: quiz and assignment rules, grading modes, game scoring golden logs, quest and badge rules, leaderboard rules, load scenario "quiz rush".
Acceptance: quizzes and assignments run end to end including grading and release with rewards; quests, badges, leaderboards and all seven games work with server-side scoring.

---

## 5. BG3: SHOP, COMMUNICATION AND INSIGHT

Backend packages:
- DBM-3: shop, inventory, purchases, themes, avatar assets; announcements, recipients, notifications; reports snapshots; materialized views.
- ENG-3: `shop_list`, `shop_theme`, `purchase_item`, `equip_item`, `save_avatar`, `my_profile`, `my_certificates` and printable data, profile stats; theme contrast checker function; level and rank grants.
- NOT: `notify` library and templates for all kinds in 08 section 5; announcements (`publish_announcement`, fan-out job, stats, reminders, urgent broadcast); Realtime channels and policies (notifications, jobs, grading presence, platform); `mark_notifications_read`; `global_search`; reports RPCs (`report_class`, `report_compare`, `report_student`, saved reports); teacher dashboard RPCs and `student_flags`; materialized view refresh cron.
- SED: shop catalog with art placeholders, 10 themes, announcements, notifications.
- TST: purchase transaction tests, notification triggers, fan-out sizes, search RLS, report correctness, realtime authorization, load scenario "realtime".
Acceptance: purchases and equipping change the whole app theme; notifications and announcements arrive live; search and reports work with correct permissions.

---

## 6. BG4: AI

Backend packages:
- DBM-4: AI tables (conversations, messages, action cards, usage, counters, overrides, test cases and runs, activity log, conversation views, suggested actions, support plans, planner items, lesson plans), `jobs` and `job_steps`, `ai_month_totals`; RLS.
- AIS: adapter and implementations (primary, fallback, fake); prompt modules and base rules; safety pipeline; limits and budget; `ai_tutor_chat`, `ai_writing_feedback`, `ai_translate`, `finish_tutor_quiz`, `finish_writing_check`, `my_ai_limits`; structured schemas; action card creation and `apply_action_card`, undo, discard, regenerate; job runner and planners per kind; teacher AI features (`ai_copilot`, `ai_generate_*`, `ai_check_assessment`, `ai_planner`, `ai_lesson_plan`, `ai_support_plan`, `ai_report_*`, `ai_draft_announcement`, `ai_grade_submissions`, suggested actions); admin AI features in BG5 (curriculum generation, quality checks, triage).
- CNT-AI: TTS adapter, `tts_batch`, cache and audio attachment; audio checks in publishing.
- SED: AI conversations, cards, jobs, usage history, test cases.
- TST: safety suite, fake-adapter pipeline tests, streaming protocol tests, job runner tests, card apply and undo tests, quality sets baseline, load scenarios "AI streaming" and "jobs".
Acceptance: AI Tutor, writing feedback, translation, Copilot, generation jobs and AI grading work with limits, safety and metering; teacher approval gates hold.

---

## 7. BG5: ADMIN OPERATIONS AND HARDENING

Backend packages:
- ADF-5: import jobs (parse, mapping, validate, fix, commit, credentials file) and rollover (plan, execute, undo); moderation (`moderation_*`, triage); config governance (`get_config`, drafts, impact, publish, restore, simulations, economy health); admin engagement CRUD (quests, badges, shop, avatar, themes studio functions, leaderboard moderation); AI governance (overrides, test sandbox, test suite runs, usage and log RPCs, `view_ai_conversation`); `view_as_*`; `health`; platform settings RPCs and maintenance; admins and roles; admin reports, audit RPCs; admin dashboard RPCs; admin AI features (curriculum generation, content quality, triage, import assistant, usage explanation).
- OPS: `deploy-prod`, `nightly`, `security` workflows; monitoring and alerts; backup and restore drill; runbooks verified; cost report; plan checks.
- TST: view-as read-only suite, config publish gating, import and rollover suites, full access matrix and RLS fuzz, load tests (all scenarios), migration upgrade test.
- Security review and external penetration test; privacy review with the school (10 section 4.6).
Acceptance: every admin page has its operations; production deployment can be performed from a clean state with runbooks verified.

---

## 8. PARALLELIZATION AMONG BACKEND WORKERS

With 2 to 3 backend engineers (in addition to the frontend team):
- Lane A, data and access: BSE and DBM packages, RLS, access matrix, seeds.
- Lane B, engine and assessments: ENG, ASM, CNT functions, business tests.
- Lane C, AI and operations: AIS (can start the adapter, safety and metering after BG0), jobs, NOT, OPS.
Within a gate, packages are split by table group and by function so that two people rarely edit the same migration or function. Migrations are small and numbered by timestamp; each package owns its migration files. Contract operations are tasks (one per operation or small group) so the frontend can see exactly what unlocks.

---

## 9. DEFINITION OF DONE (EVERY BACKEND TASK)
- Implements the contract entry or data model section it names (no behavior beyond the docs without a doc change).
- Migrations apply from scratch and on top of the previous release; RLS enabled and covered by the access matrix.
- pgTAP or Deno tests added for success, forbidden and boundary cases; contract manifest updated.
- Errors use the documented codes; every write begins with `require_writable()`; privileged actions write audit rows; rewards go only through the engine functions.
- Generated types and shared schemas updated; seed updated if the page coverage manifest needs it.
- No secrets, no PII in logs; performance checked with EXPLAIN for new queries on lists and dashboards.

---

## 10. RISKS AND MITIGATIONS

| Risk | Impact | Mitigation |
|---|---|---|
| Edge Function execution limits cut long AI jobs | Generation fails | Step-based jobs under 100 s, resumable runner, reaper |
| View-as custom token not available on the chosen plan | Feature blocked | Documented fallback (read RPCs with a validated view-as session parameter), decided in BG5 |
| RLS performance at scale | Slow pages | Helper functions with indexes, EXPLAIN checks, materialized views, load tests before launch |
| AI cost overruns | Budget exceeded | Limits, budget behaviors, `fast` tier default, dry-run segregation, nightly cost report |
| Provider outages or policy changes | AI features down | Adapter with fallback, feature switches, runbook |
| Scoring or reward bugs | Unfair results | Server-authoritative design, golden-log tests, ledger invariants checked by `seed:verify` and nightly |
| Realtime connection limits | Missed notifications | Plan check, polling fallback, backoff |
| Migration mistakes | Data loss | Forward-only, expand and contract, backups before destructive steps, upgrade tests |
| Legal and privacy review late | Launch delay | Start the review (10 section 4.6) at BG1, not at the end |
| Frontend and backend drift | Rework | Contract manifest, response snapshots, types-sync workflow |

---

## 11. DECISIONS NEEDED BEFORE BG0 STARTS
1. Supabase plan and region (data residency decision with the school).
2. AI provider and TTS provider choices and accounts (keys go to secrets).
3. The school time zone and the first school year calendar.
4. Who is the first Super admin (bootstrap account) and the on-call person per week once real users exist.
5. The dev project name and who owns the GitHub Environments and approvals.
