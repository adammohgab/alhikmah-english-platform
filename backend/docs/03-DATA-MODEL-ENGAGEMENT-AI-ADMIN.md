# 03. DATA MODEL: ENGAGEMENT, AI, TEACHING TOOLS, JOBS, MODERATION, ADMIN, SETTINGS

Same notation as 02-DATA-MODEL-CORE.md. Rules and algorithms are in 06-BUSINESS-LOGIC.md; AI tables are explained further in 07-AI-SYSTEM.md.

---

## 1. ENUMS (PART 2)

```
quest_pool             daily | weekly
quest_state            in_progress | ready | claimed | expired
shop_kind              theme | avatar_item | frame | title | power_up
shop_status            draft | live | retired
avatar_slot            base | outfit | accessory | background
announcement_priority  normal | important | urgent
announcement_status    draft | scheduled | published | expired
moderation_type        flagged | reported | failed_job
severity               low | medium | high
moderation_status      new | in_review | resolved | dismissed
card_status            generating | ready | approved | edited | discarded | failed | stale
```

---

## 2. SETTINGS AND CONFIGURATION

#### platform_settings
Key-value singleton settings edited by Super admins. `key text pk`; `value jsonb`; `version int`; `updated_by`; `updated_at`.
Keys and value shapes:
- `general`: `{platform_name, school_name, logo_asset_id, contact_email, contact_phone, office_hours, location, support_link, terms_url, privacy_url, footer_text}`
- `region`: `{timezone, date_format, time_format, week_start, spelling_variant}` (spelling_variant british or american)
- `notifications`: `{defaults: {...per kind}, reminder_time, admin_alerts: {...}}`
- `features`: `{games, shop, leaderboards, avatars_themes, certificates, translation, announcements, practice_libraries}` each `{enabled: bool, grades: [..] | null}`
- `preferences`: `{weekly_reset_day, day_boundary_time, default_pass_mark, default_attempts, default_late_policy, session_length_min, leaderboard_privacy_default}`
- `security`: `{password_rules, temp_password_rules, lockout_attempts, lockout_minutes, idle_timeout_min, remember_me_days, require_two_step_admin, view_as: {max_minutes, extension_minutes, notify_user}}`
- `data`: `{audit_retention_months, ai_log_retention_months, archived_user_retention_months, ...}` (values decided later; defaults null)
- `maintenance`: `{enabled, message, expected_back_at}`
RLS: everyone (including signed-out sign-in screen) reads only the safe projection `v_public_settings` (platform name, school logo, contact details, maintenance flag, password rules text, idle timeout); full rows readable by admins; writable by Super admins through an RPC that also writes audit.

#### scheduler_state
Guards scheduled jobs that depend on school time. `key text pk` (day_rollover, week_rollover, streak_at_risk, ...); `last_period text` (the school date or week start last processed); `last_run_at timestamptz`. Functions compare `last_period` with the current school period so repeated cron calls do nothing. No client access.

#### config_sets
Versioned configuration with Draft, Publish and Versions. `id`; `key text` (economy, ai_features, ai_limits, ai_safety, ai_instructions); `version int`; `status config_status`; `effective_from timestamptz`; `payload jsonb`; `note text`; `created_by`; `published_by`; `published_at`.
Indexes: uq(key, version); partial uq(key) where status='published' (exactly one published version per key).
Payload shapes: `economy` mirrors docs/shared/ECONOMY-AND-GAMES.md (xp values and caps, level formula parameters and rank titles, coin sources and caps, streak rules, bonus caps, shop price bands); `ai_features` `{feature_key: {enabled, scope: {grades?: [], classes?: []}, schedule?: [{from, to}], note}}`; `ai_limits` `{student: {...}, teacher: {...}, school_budget: {monthly_micro_usd, thresholds, at_limit}, reset}`; `ai_safety` `{filter_level, blocked_categories, allowed_focus, off_topic, tone, privacy, sensitive_topics_message, integrity, per_feature}`; `ai_instructions` `{school_text, feature_addons}`.
Publish is an RPC (`publish_config`) that validates the payload with the shared schema, runs dependent checks (for ai_safety, the test cases), sets the previous published row to archived, and writes audit.

---

## 3. GAMIFICATION ENGINE TABLES

#### student_stats
One row per student, created with the profile. `student_id pk fk`; `xp_total bigint default 0`; `level smallint default 1`; `coins int default 0`; `streak_current int default 0`; `streak_best int default 0`; `last_streak_date date`; `freezes int default 0`; `hint_packs int default 0`; `time_packs int default 0`; `equipped jsonb default {}` (`{avatar: {base, outfit, accessory, background}, frame_id, title_id, theme_id}`); `pinned_badges uuid[] default {}`; `updated_at`.
Only the engine functions write it (no client writes). RLS: the student reads own; teachers read their students'; admins read all. Constraints: coins >= 0, level between 1 and 60, freezes between 0 and 3.

#### xp_ledger
Append-only record of every XP award. `id bigint identity pk`; `student_id fk`; `amount int`; `source_type text` (lesson, activity, quiz, assignment, assignment_grade, practice, writing_check, tutor_quiz, game, quest, weekly_goal, chest, badge, streak, bonus, level_reward); `source_id uuid`; `reason text`; `day date`; `week_start date`; `leaderboard bool default true`; `idempotency_key text`; `meta jsonb`; `created_at`.
Indexes: uq(idempotency_key); idx(student_id, created_at desc); idx(week_start, student_id); idx(day, student_id, source_type) (daily caps).

#### coin_ledger
`id bigint pk`; `student_id`; `amount int` (negative for spending); `balance_after int`; `source_type text` (adds shop, purchase, refund_admin); `source_id`; `reason`; `day date`; `idempotency_key text uq`; `meta jsonb`; `created_at`. Index idx(student_id, created_at desc).

#### domain_events
Outbox for the engine. `id bigint pk`; `type text` (lesson_completed, activity_completed, quiz_submitted, assignment_submitted, assignment_released, practice_finished, writing_checked, game_finished, tutor_quiz_finished, words_learned, translation_saved, quest_claimed, purchase_made, item_equipped, ai_message_sent, login_day); `student_id fk`; `actor_id`; `payload jsonb`; `occurred_at`; `processed_at`; `error text`.
Index: partial idx on id where processed_at is null. Written by triggers and RPCs inside the same transaction as the action; processed by `process_domain_events()` (quests, badges, streaks, leaderboards, notifications).

#### streak_days
`student_id`; `day date`; `qualified bool`; `freeze_used bool default false`; `events int default 0`; pk(student_id, day).

#### quest_templates
`id`; `code text uq`; `pool quest_pool`; `title_pattern text` (for example "Finish {n} lessons"); `target_type text` (lessons, activities, quiz_score, words, practice_sets, writing_checks, games, game_best, tutor_chat, review_words, xp_today, correct_streak, listening_sets, translations, assignment_submit, weak_practice, weekly_xp, streak_days, quizzes_passed, games_week, words_mastered); `targets jsonb` (`{A, B, C}` values by level band); `difficulty difficulty`; `skill skill null`; `availability jsonb` (rule keys such as requires_open_quiz, requires_feature); `grade_min`; `grade_max`; `active bool`; `status config_status`; `version int`; `created_by`.

#### quest_instances
`id`; `student_id fk`; `template_id fk`; `pool quest_pool`; `period_start date`; `title text`; `target int`; `progress int default 0`; `difficulty difficulty`; `reward_xp int`; `reward_coins int`; `state quest_state default 'in_progress'`; `completed_at`; `claimed_at`.
Unique: uq(student_id, pool, period_start, template_id). Index: idx(student_id, pool, period_start).

#### quest_chests
`student_id`; `pool quest_pool`; `period_start date`; `opened_at`; `reward jsonb`; pk(student_id, pool, period_start).

#### class_quests and class_quest_progress
class_quests: `id`; `class_id fk`; `title`; `description`; `target jsonb` (`{type, value}` or `{manual: true}`); `starts_at`; `ends_at`; `reward_xp int` (max 100); `reward_coins int` (max 50); `audience uuid[]` (null means the whole class); `status text` (draft, active, ended); `created_by`.
class_quest_progress: `quest_id`; `student_id`; `progress int`; `target int`; `completed_at`; `confirmed_by`; `rewarded bool`; pk(quest_id, student_id).

#### badge_definitions, student_badges, badge_progress
badge_definitions: `id`; `code text uq`; `name`; `category text` (learning, streak, quiz, practice, games, social, collector, secret); `rarity`; `description`; `hint`; `icon_asset_id`; `criteria jsonb` (`{event, threshold, window, conditions}`); `reward jsonb` (`{xp, coins, item_id?}`); `secret bool`; `active bool`; `status config_status`; `version`.
student_badges: `student_id`; `badge_id`; `earned_at`; `source_event_id`; pk both.
badge_progress: `student_id`; `badge_id`; `progress numeric`; `target numeric`; `updated_at`; pk both.

#### leaderboard tables
leaderboard_snapshots: `id`; `scope text` (class, grade, school); `scope_id text` (class uuid, grade number, or 'school'); `period text` (week); `period_start date`; `rows jsonb` (`[{rank, student_id, xp}]` top 200); unique(scope, scope_id, period, period_start). Written at the weekly reset.
leaderboard_moderation: `id`; `student_id`; `action text` (hide, reset_score, rename); `scope text null`; `period_start date null`; `reason`; `notify bool`; `active bool default true`; `created_by`; `ended_at`.
leaderboard_flags: `id`; `student_id`; `reason text` (xp_spike, game_farming, display_name, duplicate); `evidence jsonb`; `status text` (open, dismissed, actioned); `created_at`.
Live boards are computed by RPC from `xp_ledger` (sum by `week_start`) excluding hidden and score-reset rows.

#### bonus_awards
`id`; `teacher_id fk`; `student_id fk`; `class_id fk`; `xp int`; `coins int`; `reason text not null`; `xp_ledger_id`; `created_at`.

#### certificates
`id`; `student_id`; `kind text` (course, rank, streak); `title`; `reference_id uuid`; `code text uq`; `data jsonb`; `issued_at`. Unique: uq(student_id, kind, reference_id).

---

## 4. GAMES

#### games
Seeded catalog. `id`; `slug text uq` (vocabulary-match, word-builder, grammar-challenge, reading-challenge, sentence-builder, spelling, timed-quiz); `name`; `description`; `skills skill[]`; `active bool`; `reference_scores jsonb` (per difficulty); `config jsonb` (per difficulty rules from docs/shared/ECONOMY-AND-GAMES.md section 9).

#### game_sessions
`id`; `student_id fk`; `game_id fk`; `difficulty difficulty`; `content_source text` (courses, library, mixed); `status text` (started, finished, abandoned, rejected); `seed int`; `items jsonb` (the items dealt, including answer keys; never sent to the client with keys); `started_at`; `finished_at`; `answer_log jsonb`; `score int`; `normalized numeric`; `xp_awarded int`; `coins_awarded int`; `personal_best bool`; `hints_used smallint`; `extra_time_used smallint`; `cap_note text`; `reject_reason text`.
Index: idx(student_id, started_at desc); idx(student_id, game_id, difficulty).

#### game_bests and game_of_day
game_bests: `student_id`; `game_id`; `difficulty`; `best_score int`; `session_id`; `achieved_at`; pk(student_id, game_id, difficulty).
game_of_day: `day date pk`; `game_id fk`.

---

## 5. SHOP AND CUSTOMIZATION

#### shop_items
`id`; `kind shop_kind`; `name`; `description`; `rarity`; `price int`; `level_required smallint default 1`; `availability jsonb` (`{always: true}` or `{from, to}`); `status shop_status default 'draft'`; `payload jsonb` (theme: `{theme_id}`; avatar_item: `{slot, avatar_asset_id}`; frame: `{avatar_asset_id}`; title: `{text}`; power_up: `{type: freeze|hint|time, pack_size, max_owned, daily_limit}`); `preview_asset_id`; `sort int`; `units_sold int default 0`; `version int`; `created_by`.

#### shop_bundles and shop_sales
shop_bundles: `id`; `name`; `price int`; `item_ids uuid[]`; `status shop_status`; `availability jsonb`.
shop_sales: `id`; `name`; `discount_pct smallint`; `starts_at`; `ends_at`; `applies jsonb` (`{item_ids?, rarity?, kind?}`); `status text`.

#### purchases and inventory
purchases: `id`; `student_id`; `item_id`; `bundle_id null`; `quantity int`; `price_paid int`; `sale_id null`; `idempotency_key uuid uq`; `created_at`.
inventory: `student_id`; `item_id`; `qty int default 1`; `acquired_at`; `source text` (shop, level_reward, badge, rank, event, starter); pk(student_id, item_id).

#### themes
`id`; `name`; `description`; `rarity`; `mode text` (light, night); `tokens jsonb` (the 12 worlds with main, tint, soft, pop, deep, plus ink, surface, night values); `background jsonb`; `grain jsonb`; `decoration jsonb`; `shape_bias text`; `preview_asset_id`; `status text` (draft, live); `checks jsonb` (contrast results; publishing requires all required pairs to pass); `is_system bool` (Candy Pop and Sorbet); `version`; `created_by`.

#### avatar_assets
`id`; `category text` (base, outfit, accessory, background, frame); `slot avatar_slot null`; `name`; `rarity`; `obtain jsonb` (`{type: shop|level|badge|rank|event|free, ...}`); `asset_id fk media_assets`; `alt_text`; `rank smallint null` (rank frames); `status shop_status`; `created_by`.

---

## 6. COMMUNICATION

#### announcements
`id`; `author_id fk`; `author_role user_role`; `title`; `body text` (restricted rich text); `audience jsonb` (`{type: all|students|teachers|grades|classes|users, ids: []}`); `priority announcement_priority default 'normal'`; `publish_at`; `expires_at`; `status announcement_status`; `link jsonb` (`{type, id}`); `attachments jsonb` (links only).
#### announcement_recipients
`announcement_id`; `user_id`; `delivered_at`; `read_at`; pk both. Index: idx(user_id, read_at). Created at publish time by fan-out (resolves the audience into rows so read counts and unread lists are exact).
#### notifications
`id`; `user_id fk`; `kind text`; `title`; `body`; `payload jsonb`; `link text`; `priority text default 'normal'`; `group_key text`; `created_at`; `read_at`.
Indexes: idx(user_id, created_at desc); partial idx(user_id) where read_at is null.
Kinds are listed in 08-STORAGE-REALTIME-NOTIFICATIONS.md section 5.

---

## 7. AI TABLES

#### ai_conversations
`id`; `user_id fk`; `feature text` (tutor, copilot, admin_copilot); `mode text` (chat, explain, check_writing, quiz_me); `title`; `context jsonb` (attached lesson, word, text, class, page); `status text default 'active'`; `message_count int`; `flagged bool default false`; `created_at`; `updated_at`.
RLS: the owner reads and writes; admins read only through `view-ai-conversation` (reason required, logged). No other access.
#### ai_messages
`id`; `conversation_id fk`; `role text` (user, assistant, tool); `content text`; `attachments jsonb`; `card_ids uuid[]`; `safety jsonb` (`{pre, post, blocked, category}`); `feedback smallint` (1 or -1); `flagged bool`; `tokens_in int`; `tokens_out int`; `cost_micro bigint`; `model text`; `latency_ms int`; `request_id text`; `created_at`.
#### ai_action_cards
`id`; `user_id fk`; `conversation_id null`; `feature text`; `kind text` (create_quiz, create_assignment, create_questions, create_lesson, create_course, create_announcement, grade_draft, support_plan_step, schedule_change, bonus_award, quest, report_comments, class_setup, rules_suggestion, curriculum_draft, content_item); `summary`; `preview jsonb`; `changes jsonb`; `sources jsonb`; `notes jsonb`; `status card_status`; `stamps jsonb` (version stamps of the records the card depends on, for the stale check); `result jsonb`; `job_id null`; `created_at`; `resolved_at`; `resolved_by`.
#### ai_usage
`id bigint pk`; `user_id`; `role`; `grade smallint`; `class_id null`; `feature text`; `model text`; `tokens_in int`; `tokens_out int`; `cost_micro bigint` (micro US dollars); `credits numeric`; `status text` (ok, blocked, limit, error, timeout); `safety_category text`; `dry_run bool default false`; `meta jsonb` (prompt version, base rules version, tier, retries); `request_id`; `created_at`.
Indexes: idx(created_at); idx(user_id, created_at); idx(feature, created_at).
#### ai_month_totals
`month date pk` (first day of the month); `cost_micro bigint`; `requests bigint`; `blocked bigint`; `updated_at`. Maintained by a trigger on `ai_usage` (dry runs excluded). Used by the budget check and the admin dashboard.

#### ai_limit_counters
`user_id`; `feature text`; `period text` (`day:YYYY-MM-DD` or `month:YYYY-MM`); `count int`; `credits numeric`; `tokens bigint`; pk(user_id, feature, period). Incremented atomically by the limits check.
#### ai_overrides
`id`; `scope text` (user, class); `target_id uuid`; `feature text null`; `limits jsonb`; `reason`; `expires_at`; `created_by`.
#### ai_test_cases and ai_test_runs
ai_test_cases: `id`; `feature`; `role`; `prompt`; `expected text` (allowed, redirect, blocked, hint_only); `source text` (manual, moderation); `active`; `last_result jsonb`; `last_run_at`.
ai_test_runs: `id`; `config_versions jsonb`; `results jsonb`; `passed bool`; `run_by`; `created_at`.
#### ai_activity_log
Human-readable record for teachers and admins. `id bigint`; `user_id`; `role`; `feature`; `page text`; `summary text`; `result text` (approved, edited, discarded, failed, blocked, limit, ok); `cost_micro`; `credits`; `safety_outcome text`; `conversation_id`; `message_id`; `card_id`; `job_id`; `flagged bool`; `created_at`.
#### conversation_views
`id`; `admin_id`; `conversation_id`; `reason text not null`; `view_as_session_id null`; `created_at`. Every admin view of a student conversation writes here and to the audit log.
#### suggested_actions
`id`; `teacher_id fk`; `category text` (grading, attention, planning, communication, reports); `text`; `why jsonb`; `card_kind text`; `status text` (new, snoozed, dismissed, done); `snooze_until`; `valid_until`; `dedupe_key text` (uq per teacher while active); `created_at`.

---

## 8. TEACHING TOOLS

#### support_plans and support_plan_students
support_plans: `id`; `class_id fk`; `issues text[]`; `diagnosis jsonb` (statements with evidence links); `goals jsonb`; `steps jsonb` (`[{card_id, kind, status}]`); `review_date date`; `status text` (draft, active, review_due, completed); `outcome_note text`; `created_by`; `version int`.
support_plan_students: `plan_id`; `student_id`; pk both.
RLS: visible only to teachers of the class and admins; never to students.
#### planner_items
`id`; `class_id fk`; `teacher_id fk`; `type text` (lesson, quiz, assignment, announcement, quest, exam, note); `item_date date`; `starts_at timestamptz null`; `ref_type text`; `ref_id uuid`; `title`; `notes`; `status text` (planned, scheduled, done, canceled); `created_via text` (manual, ai).
#### lesson_plans
`id`; `lesson_id fk`; `class_id null`; `teacher_id fk`; `content jsonb` (objectives, timing, activities, discussion, materials, differentiation, exit question); `created_via text`; `version int`. Teacher only.
#### report_snapshots
`id`; `kind text` (class, compare, student, school_overview, learning_health, teacher_activity, content_usage, ai_summary); `params jsonb`; `data jsonb`; `narrative text`; `created_by`; `created_at`. Feeds "Recent reports" and printable reports.

---

## 9. JOBS

#### jobs
One table for all long-running work. `id`; `kind text` (ai_course, ai_curriculum, ai_questions, ai_lesson, ai_grade_batch, ai_report_comments, ai_planner, import_users, rollover, report, tts_batch, notification_fanout, content_quality_check); `user_id fk`; `status job_status default 'queued'`; `params jsonb`; `progress jsonb` (`{steps_total, steps_done, current, message}`); `result jsonb`; `error jsonb`; `attempts int default 0`; `max_attempts int default 3`; `priority smallint default 5`; `run_after timestamptz default now()`; `locked_by text`; `locked_at timestamptz`; `started_at`; `finished_at`; `cancel_requested bool default false`; `cost_micro bigint`; `dedupe_key text`.
Indexes: idx(status, priority, run_after); idx(user_id, created_at desc); uq(dedupe_key) where status in ('queued','running').
#### job_steps
`job_id fk`; `step_no int`; `key text`; `status job_status`; `input jsonb`; `output jsonb`; `error jsonb`; `started_at`; `finished_at`; pk(job_id, step_no).
RLS: the job owner reads; admins read all. Workers use the service role.

---

## 10. MODERATION AND PROBLEM REPORTS

#### moderation_items
`id`; `type moderation_type`; `severity severity`; `status moderation_status default 'new'`; `source_type text` (ai_message, content, announcement, job, user_report); `source_id uuid`; `reporter_id null`; `assignee_id null`; `summary text`; `snapshot jsonb`; `ai_triage jsonb`; `safety_category text`; `resolution text`; `resolution_note text`; `resolved_at`; `resolved_by`.
Index: partial idx(severity, created_at) where status in ('new','in_review').
#### moderation_actions
`id`; `item_id fk`; `admin_id fk`; `action text` (assign, dismiss, resolve, unpublish, edit, notify_author, retry_job, escalate, add_test_case); `note`; `created_at`.
#### problem_reports
`id`; `reporter_id fk`; `reporter_role`; `target_type text` (ai_message, lesson, content, ai_card); `target_id uuid`; `reason text`; `note text`; `moderation_item_id fk`; `created_at`.

---

## 11. ADMIN OPERATIONS

#### import_rows
`job_id fk`; `row_no int`; `raw jsonb`; `status text` (ok, warning, error, excluded, imported, failed); `errors jsonb`; `entity_id uuid`; pk(job_id, row_no). The job (kind import_users) holds the mapping and counts in `params` and `result`.
#### rollover_runs
`id`; `from_year_id fk`; `to_year_id fk`; `scope jsonb`; `grade_map jsonb`; `exceptions jsonb`; `class_plan jsonb`; `status text` (planned, scheduled, running, done, failed, undone); `counts jsonb`; `scheduled_at`; `executed_at`; `undo_until timestamptz`; `created_by`; `job_id`.
#### rollover_changes
`run_id fk`; `seq bigint`; `entity_type text`; `entity_id uuid`; `before jsonb`; `after jsonb`; pk(run_id, seq). Enables the 7-day undo.

---

## 12. AUDIT LOG

#### audit_log
Append-only (no update or delete grants, and a trigger blocks both). `id bigint pk`; `actor_id`; `actor_role user_role`; `actor_admin_level admin_level`; `action_type text` (users, roles, classes, curriculum, content, gamification, ai_settings, leaderboard, settings, rollover, logins, view_as, conversation_views, password_resets, grades, moderation, imports); `action text`; `target_type text`; `target_id text`; `summary text`; `before jsonb`; `after jsonb`; `reason text`; `ip_hash text`; `device text`; `view_as_session_id uuid`; `created_at`.
Indexes: idx(created_at desc); idx(actor_id, created_at); idx(action_type, created_at); idx(target_type, target_id).
RLS: Super admin reads all; School admin reads rows whose action_type is in (users, classes, content, curriculum, moderation, imports, grades, password_resets, view_as). Writes only through `write_audit()` (function) and the functions' service role.

---

## 13. DERIVED DATA (MATERIALIZED VIEWS)

Refreshed by cron every 10 to 15 minutes (CONCURRENTLY) and on demand for reports.
- `mv_class_overview(class_id, avg_score_pct, completion_pct, active_students_7d, awaiting_grading, updated_at)`.
- `mv_student_skill_strength(student_id, skill, accuracy_pct, trend, sample_size)` built from quiz answers, activities and practice results.
- `mv_school_daily_activity(day, role, active_users, signins)`.
- `mv_ai_daily_usage(day, feature, role, requests, cost_micro, blocked)`.
Student-facing live numbers (XP, quests, streak) never come from materialized views; they come from the engine tables.
