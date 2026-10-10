# 05. API CONTRACT (FRONTEND TO BACKEND)

This is what the frontend can rely on. Every page spec in frontend/docs maps to the operations below. Changes are additive (new fields, new operations); removing or changing meaning requires a version bump and a migration plan.
How to read: "RPC" means `supabase.rpc(name, args)`; "Table" means `supabase.from(table)` under RLS; "Edge" means `supabase.functions.invoke(name)` or a direct fetch for streams; "Job" means an Edge or RPC call that returns a job id (section 1.7).
All RPC and Edge names are snake_case (RPC) or kebab-case (Edge). Argument names are the same as the keys shown.

---

## 1. CONVENTIONS

### 1.1 Envelope and errors
- RPC success returns the documented JSON. RPC errors are Postgres exceptions whose message is a stable code and whose detail is JSON; the frontend API layer converts both RPC and Edge errors to `{ code, message, details, request_id }` (01-ARCHITECTURE.md section 4.5).
- Edge success returns JSON with HTTP 200 (201 for created, 202 for accepted jobs). Edge errors return the error body with the matching HTTP status (401, 403, 404, 409, 422, 429, 500, 503).
- Every Edge response carries `x-request-id`.

### 1.2 Pagination
Page request: `{ limit?: 1..100 (default 25), cursor?: string }`. Page response: `{ items: [...], next_cursor: string | null, total_estimate?: number }`. Cursors are opaque.

### 1.3 Idempotency
Operations marked (idem) require `idempotency_key` (UUID). Replaying a key returns the original result with `replayed: true`.

### 1.4 Time
All timestamps are ISO 8601 UTC strings. Date-only values (`day`, `week_start`) are ISO dates in school time. `server_time()` returns the authoritative now; countdowns use its offset.

### 1.5 Common shapes
```
Page<T>        { items: T[], next_cursor: string|null, total_estimate?: number }
AwardResult    { xp: int, coins: int, bonus: [{label, xp, coins}], level_before: int, level_after: int,
                 rank_before: string, rank_after: string, quests: [{id, progress, target, state}],
                 badges: [{id, name, rarity}], streak: {current, best, milestone: int|null},
                 caps: [{type, note}], items: [{id, name}], celebration: 'small'|'medium'|'large'|null,
                 xp_total: int, coins_total: int }
QuestionForClient  { key: string, type, prompt: {text, html?, media?}, options?, points, skill, meta }   (no answers, no explanation until allowed)
QuestionReview     QuestionForClient + { your_answer, correct: bool|null, correct_answer?, explanation?, points_awarded }
Lock           { locked: bool, reason?: string, unlocks_when?: {lessons_remaining?: int, date?: string} }
Money          integers only (coins, xp)
```
`celebration` tells the frontend which celebration level to play (GLOBAL-STYLES section 8.7); the frontend never calculates it.

### 1.6 Streaming (AI conversations)
POST to the Edge Function with `Authorization: Bearer <access token>`; the response is `text/event-stream`. Events (each `event:` name plus JSON `data:`):
`meta` {conversation_id, message_id, request_id, model_tier}; `status` {phase: 'checking'|'thinking'|'writing'}; `delta` {text}; `card` {card} (Copilot only); `safety` {blocked: true, message}; `usage` {tokens_in, tokens_out}; `done` {message_id}; `error` {code, message}.
Cancel: abort the fetch; the server stops generation, stores the partial message with `meta.cancelled=true`, and counts tokens used. A blocked request returns a `safety` event then `done`; a limit or feature-off state returns an `error` event with code `limit_reached` or `feature_disabled` before any text.

### 1.7 Jobs
Start call returns `202 { job_id }`. Progress and result are on the `jobs` row (`status`, `progress`, `result`, `error`) delivered through Realtime channel `job:{job_id}` and available with `get_job(job_id)`. `cancel_job(job_id)` sets `cancel_requested`. Job kinds and their result shapes are in section 8.

### 1.8 Uploads
`create_upload { bucket, kind, filename, mime, size }` (Edge) validates type and size, creates a `media_assets` row (status uploading) and returns `{ asset_id, upload_url, token, expires_at }` (signed upload). The browser uploads the file to the URL, then calls `complete_upload { asset_id }` which verifies size, mime and checksum and marks the asset ready (or rejects with `upload_rejected`). `get_asset_url { asset_id }` returns a signed URL for private files (short expiry) or the public URL.

### 1.9 Realtime channels
| Channel | Content | Who |
|---|---|---|
| `notifications:{uid}` | inserts on `notifications` for the user | everyone |
| `job:{job_id}` | updates on the `jobs` row | the job owner |
| `grading:{assignment_id}` | presence (who has which submission open) | teachers of the assignment's classes |
| `platform` | broadcast `{maintenance, urgent_announcement_ids}` on change | everyone |
Subscriptions use RLS-aware Postgres Changes or Broadcast with authorization; unauthorized subscriptions are rejected.

---

## 2. PUBLIC, SESSION AND SHARED (SHARED-SPEC SH-xx)

| Name | Kind | Who | Input to output | Notes |
|---|---|---|---|---|
| `get_public_state` | RPC (anon ok) | anyone | `{}` to `{server_time, platform_name, school: {name, logo_url, contact...}, maintenance: {enabled, message, expected_back_at}, password_rules, idle_timeout_min, remember_me_days}` | Used by the landing, sign-in, help, forgot-password, set-password and maintenance pages |
| `auth_login` | Edge | anyone | `{username, password, remember_me}` to session and profile (04-AUTH-AND-ACCESS.md section 2) | Errors: `invalid_credentials`, `account_locked` (minutes_left), `account_inactive`, `maintenance`, `rate_limited` |
| `auth_change_password` | Edge | signed in | `{current_password, new_password}` to `{session}` | Errors: `validation_failed` with `details.rules_failed[]` |
| `auth_logout` | Edge | signed in | `{everywhere?: bool}` to `{ok}` | Revokes sessions |
| `request_password_reset` | Edge (anon) | anyone | `{username, full_name, grade_class?, note?}` to `{ok: true}` | Always the same response; `rate_limited` after the limits |
| `get_session_context` | RPC | signed in | `{}` to `{profile, stats_summary, features: {...enabled for this user}, unread_notifications, urgent_announcements[], flags: {must_change_password}}` | Called after sign-in and on app load |
| `server_time` | RPC | anyone | `{}` to `{now}` | |
| `view_as_start` / `view_as_extend` / `view_as_end` / `view_as_log_page` | Edge | admins (see 04 section 5) | start: `{target_id, reason}` to `{token, expires_at, target}` | Read-only session |
| `report_problem` | RPC | signed in | `{target_type, target_id, reason, note?}` to `{id}` | Creates a moderation item |
| `global_search` | RPC | signed in | `{q, kinds?: string[], limit?}` to `{results: [{kind, id, title, subtitle, route}]}` | Respects RLS; students: courses, lessons, words; teachers: students, classes, assignments, quizzes, questions; admins: users, classes, content, settings |
| `get_asset_url` | Edge | signed in | `{asset_id}` to `{url, expires_at}` | |
| `create_upload` / `complete_upload` | Edge | signed in | section 1.8 | |

---

## 3. STUDENT DOMAIN (STUDENT-SPEC ST-xx)

### 3.1 Dashboard (ST-01)
Each section loads independently.
| Name | Kind | Input to output |
|---|---|---|
| `my_stats` | RPC | `{}` to `{xp_total, level, rank, xp_in_level, xp_to_next, coins, streak: {current, best, last_date, freezes}, equipped: {...}, pinned_badges[]}` |
| `my_quests` | RPC | `{}` to `{daily: Quest[3], weekly: Quest[3], teacher: Quest[], daily_chest: {progress: "2/3", state}, weekly_chest: {...}, resets_at: {daily, weekly}}` where `Quest = {id, title, target, progress, difficulty, reward: {xp, coins}, state, source: 'system'|'teacher'}` |
| `my_streak` | RPC | `{}` to `{current, best, days: [{day, qualified, freeze_used}] (7), month: [...]?, freezes, milestones: [{days, reached, reward}]}` |
| `my_xp_week` | RPC | `{}` to `{days: [{day, xp}], total, goals: [{id, title, progress, target, state}]}` |
| `my_deadlines` | RPC | `{limit}` to `[{kind: 'assignment'|'quiz', id, title, course, due_at, status, action, overdue}]` |
| `my_announcements` | RPC | `{limit, cursor?}` to Page of `{id, title, preview, author_name, priority, created_at, read}` |
| `my_courses` | RPC | `{limit?, category?, sort?}` to `[{id, title, category, grade, teacher_name, units_count, progress_pct, next_label, cover_pattern, completed, official}]` |
| `my_resume` | RPC | `{}` to `{kind: 'lesson'|'activity', id, title, course_title, progress_pct}` or null |
| `leaderboard_snapshot` | RPC | `{}` to `{class: {top3, me}, ...}` |
| `my_badges_summary` | RPC | `{}` to `{recent: Badge[3], next: {badge, progress, target}}` |

### 3.2 Courses, units, lessons, activities (ST-02 to ST-06)
| Name | Kind | Input to output | Notes |
|---|---|---|---|
| `my_courses` | RPC | see above | |
| `get_course` | RPC | `{course_id}` to `{course, units: [{id, title, position, status, progress: {done, total}, lessons: [{id, title, minutes, done}], activities: [...], quiz: {id, lock: Lock, ...}|null}], side: {about, term, lessons, hours, xp_earned, upcoming[], certificate: {earned, id?}}}` | Reads the current snapshot; hybrid unlock rule applied (06 section 4) |
| `get_unit` | RPC | `{unit_id, course_id}` to `{unit, objectives, skills, lessons[], activities_by_skill, assessment: {...lock}, vocabulary[]}` | |
| `get_lesson` | RPC | `{lesson_id, course_id}` to `{lesson, blocks[], prev_id, next_id, outline[], resources[], notes, completed}` | Answer keys of check questions are not included |
| `check_lesson_answer` | RPC | `{lesson_id, block_id, question_key, answer}` to `{correct, explanation}` | Ungraded; no rewards |
| `complete_lesson` (idem) | RPC | `{lesson_id, course_id, idempotency_key}` to `AwardResult` | First completion pays XP and coins; review pays nothing; fires events |
| `save_lesson_notes` | Table | `lesson_progress.notes` upsert | Direct write |
| `touch_lesson` | RPC | `{lesson_id}` to ok | Sets last_opened_at (used by Resume) |
| `get_activity` | RPC | `{activity_id}` to `{activity, questions: QuestionForClient[], state}` | |
| `save_activity_state` | Table | `activity_progress.state` | Autosave |
| `submit_activity` (idem) | RPC | `{activity_id, answers, idempotency_key}` to `{score_pct, per_question: QuestionReview[], award: AwardResult}` | Graded server side |
| `add_words_to_library` | RPC | `{items: [{word, ...}], from}` to `{added, skipped}` | |

### 3.3 Quizzes (ST-07 to ST-10)
| Name | Kind | Input to output | Notes |
|---|---|---|---|
| `my_quizzes` | RPC | `{tab: 'available'|'history', course_id?, status?, sort?, cursor?}` to Page | Available rows carry `lock` and attempts used and allowed |
| `get_quiz_brief` | RPC | `{quiz_id}` to `{quiz: {title, course, unit, question_count, time_limit_min, pass_mark, attempts_left, best}, rules[], question_types[], lock: Lock}` | |
| `start_quiz_attempt` (idem) | RPC | `{quiz_id, idempotency_key}` to `{attempt_id, attempt_no, started_at, deadline_at, server_time, questions: QuestionForClient[], order}` | Fails with `assessment_locked`, `attempts_exhausted`, `window_closed`; resumes an in-progress attempt instead of creating another |
| `save_quiz_answers` | RPC | `{attempt_id, answers, flagged?}` to `{saved_at}` | Autosave |
| `submit_quiz_attempt` (idem) | RPC | `{attempt_id, answers, idempotency_key}` to `{result: {score_pct, points, passed, time_spent_s, attempt_no, best_before}, review?: QuestionReview[], topics: [{skill, accuracy}], award: AwardResult}` | Also called with `auto: true` by the timer; the server also auto-submits expired attempts (06 section 3) |
| `get_quiz_result` | RPC | `{attempt_id}` to the same result and review according to the quiz's `show_answers` | |
| `my_quiz_attempts` | RPC | `{quiz_id}` to `[{attempt_id, attempt_no, score_pct, passed, submitted_at}]` | |

### 3.4 Assignments (ST-11 to ST-14)
| Name | Kind | Input to output | Notes |
|---|---|---|---|
| `my_assignments` | RPC | `{tab: 'todo'|'submitted'|'graded', course_id?, sort?, cursor?}` to Page | Status chips: not_started, in_progress, submitted, awaiting_teacher, graded; late-work info |
| `get_assignment_brief` | RPC | `{assignment_id}` to `{assignment: {...}, resources, question_types[], has_writing, due_at, close_at, late_policy_text, points, status}` | |
| `start_assignment` | RPC | `{assignment_id}` to `{submission_id, questions: QuestionForClient[], draft, draft_version}` | Creates or resumes |
| `save_assignment_draft` | RPC | `{submission_id, answers, draft_version}` to `{draft_version, saved_at}` | `conflict` if the version is stale |
| `submit_assignment` (idem) | RPC | `{submission_id, answers, idempotency_key}` to `{status, is_late, late_penalty_pct, auto_score?, award: AwardResult}` | Triggers AI grading job for writing when the mode uses AI |
| `get_assignment_result` | RPC | `{assignment_id}` to `{status, released, grade?: {points, pct, graded_at, teacher_name, comment}, per_question: [{...QuestionReview, ai?: {summary, rubric, preliminary: true}, teacher?: {score, comment}, comments[]}]}` | AI details marked preliminary until teacher confirmation; hidden until release |

### 3.5 Practice tools and library (ST-15 to ST-19)
| Name | Kind | Input to output |
|---|---|---|
| `practice_groups` | RPC | `{tool}` to `[{unit_id, title, count}]` (lesson-linked content) |
| `list_vocab_items` / `list_grammar_topics` / `list_passages` / `list_writing_prompts` | RPC | `{unit_id? | search? | level? | cursor?}` to Page |
| `get_grammar_topic` / `get_passage` | RPC | `{id}` to the item with practice questions as `QuestionForClient[]` |
| `library_words`, `library_topics`, `library_passages`, `writing_drafts`, `translation_history` | Table | Own CRUD |
| `start_practice_session` | RPC | `{tool, mode, source: 'lesson'|'library', source_ref?, count?}` to `{session_id, items: QuestionForClient[]}` |
| `finish_practice_session` (idem) | RPC | `{session_id, answer_log, idempotency_key}` to `{score_pct, review[], words_to_save[], award: AwardResult}` |
| `review_word` | RPC | `{word_id, correct}` to `{mastery, next_review_at}` |
| `ai_writing_feedback` | Edge (stream) | `{text, prompt_id?, show_scores?}` to events with a final structured `card`-less payload `{summary, scores, corrections[], corrected_text?, tips[]}` in the `done` event | Counts toward the writing-check limit; rewards via `finish_writing_check` |
| `finish_writing_check` (idem) | RPC | `{draft_id, idempotency_key}` to `AwardResult` | XP once per check, daily cap |
| `ai_translate` | Edge | `{text, direction}` to `{translation, pos?, examples[], related[]}` | 300 characters max |

### 3.6 AI Tutor (ST-20)
| Name | Kind | Input to output |
|---|---|---|
| `ai_tutor_chat` | Edge (stream) | `{conversation_id?, mode: 'chat'|'explain'|'check_writing'|'quiz_me', message, attachments?: [{type: 'lesson'|'word'|'text', id|text}]}` to the stream in section 1.6 |
| `ai_conversations` / `ai_messages` | Table | Own select; conversations updated for title and archive |
| `rate_ai_message` | RPC | `{message_id, value: 1|-1}` |
| `finish_tutor_quiz` (idem) | RPC | `{conversation_id, correct, total, idempotency_key}` to `AwardResult` (round counts only with at least 5 questions) |
| `my_ai_limits` | RPC | `{}` to `{features: {tutor: {enabled, used, limit, resets_at}, writing_checks: {...}, quiz_me: {...}}}` |

### 3.7 Games (ST-21 to ST-23)
| Name | Kind | Input to output | Notes |
|---|---|---|---|
| `list_games` | RPC | `{}` to `[{slug, name, description, skills, best: {easy, medium, hard}, plays_today, unlocked: {easy, medium, hard}, game_of_day, enabled}]` plus `{power_ups: {hint, time}, caps: {xp_used, xp_cap, coins_used, coins_cap}}` | |
| `start_game_session` (idem) | RPC | `{game_slug, difficulty, source, idempotency_key}` to `{session_id, config, items (no answer keys), started_at, server_time}` | Errors: `feature_disabled`, `assessment_locked` (difficulty locked) |
| `game_hint` | RPC | `{session_id, item_index}` to `{payload}` (what to reveal) | Consumes one hint power-up; max 2 per session |
| `game_extra_time` | RPC | `{session_id}` to `{seconds: 30}` | Consumes one power-up; max 1 |
| `finish_game_session` (idem) | RPC | `{session_id, answer_log, idempotency_key}` to `{score, normalized, accuracy, best_combo, personal_best, missed: [...], award: AwardResult, caps}` | Server recomputes the score from the log (06 section 8) |
| `abandon_game_session` | RPC | `{session_id}` | No rewards |

### 3.8 Rewards and profile (ST-24 to ST-29)
| Name | Kind | Input to output |
|---|---|---|
| `my_quests` | RPC | see 3.1 |
| `claim_quest` (idem) | RPC | `{quest_id, idempotency_key}` to `AwardResult` |
| `open_chest` (idem) | RPC | `{pool, idempotency_key}` to `{reward: {xp, coins}, award: AwardResult}` |
| `leaderboard` | RPC | `{scope: 'class'|'grade'|'school', scope_id?, period: 'week'|'all', limit?, cursor?}` to `{items: [{rank, movement, display_name, avatar, level, xp, is_me}], me, resets_at, nearest_rivals}` |
| `my_badges` | RPC | `{category?}` to `[{id, name, category, rarity, description, hint?, state: 'earned'|'progress'|'locked'|'secret', progress?, target?, earned_at?}]` |
| `pin_badges` | RPC | `{badge_ids: uuid[<=3]}` |
| `shop_list` | RPC | `{kind, rarity?, owned?, sort?, cursor?}` to Page `{id, kind, name, rarity, price, sale_price?, level_required, owned, locked_reason?, availability, preview}` |
| `shop_theme` | RPC | `{item_id}` to the theme tokens for the live preview |
| `purchase_item` (idem) | RPC | `{item_id, quantity?, idempotency_key}` to `{purchase_id, price_paid, coins_total, item, award: AwardResult (badges/quests)}` or errors `insufficient_coins`, `level_required`, `item_unavailable` |
| `equip_item` | RPC | `{slot|kind, item_id|null}` to `{equipped}` |
| `save_avatar` | RPC | `{loadout}` to `{equipped}` (validates ownership of each part) |
| `my_profile` | RPC | `{}` to stats, equipped, pins, recent activity, certificates preview, skill strengths |
| `my_certificates` / `get_certificate` | RPC | to `[{id, kind, title, issued_at, code}]` / full printable data |
| `my_profile_stats` | RPC | `{}` to totals (XP, lessons, quiz average, assignments, words, study days, longest streak, skill bars, weekly XP chart) |

### 3.9 Notifications, announcements, classes (ST-30, class invites)
| Name | Kind | Input to output |
|---|---|---|
| `notifications` | Table | Own select (page by `created_at`), update `read_at` |
| `mark_notifications_read` | RPC | `{ids?: uuid[], all?: bool}` |
| `get_announcement` | RPC | `{id}` to the full announcement and marks it read |
| `respond_class_invite` | RPC | `{class_id, accept: bool}` to `{ok}` (accept adds the student) |
| `join_class_by_code` | RPC | `{code}` to `{status: 'joined'|'pending', class_name}` (pending when approval is required) |

### 3.10 Student settings (ST-31)
`user_settings` Table (own row). Theme selection uses `equip_item({kind:'theme', item_id})`. Password via `auth_change_password`.

---

## 4. TEACHER DOMAIN (TEACHER-SPEC TC-xx)

### 4.1 Dashboard (TC-01)
| Name | Kind | Input to output |
|---|---|---|
| `teacher_grading_queue_summary` | RPC | `{class_id?}` to `[{assignment_id, title, class, waiting, ai_ready, oldest_at, grading_mode}]` |
| `teacher_attention_students` | RPC | `{class_id?, limit?}` to `[{student, class, reasons: [{code, label}], last_active_at}]` (rules from TEACHER-SPEC 4.4 and thresholds in teacher settings) |
| `teacher_activity_feed` | RPC | `{class_id?, filter?, cursor?}` to Page of events |
| `teacher_classes_summary` | RPC | `{}` to `[{class, students, avg_progress, avg_score, awaiting_grading, join_code_enabled}]` |
| `teacher_deadlines` | RPC | `{class_id?, limit}` to `[{kind, id, title, class, due_at, submitted, total}]` |
| `suggested_actions` | Table + RPC | `suggested_actions` own select; `update_suggested_action {id, status, snooze_until?}`; `refresh_suggested_actions` (Edge job) |

### 4.2 Classes and enrollment (TC-02 to TC-06)
| Name | Kind | Input to output | Notes |
|---|---|---|---|
| `list_my_classes` | RPC | `{status?, grade?, q?}` to Page | |
| `create_class` | RPC | `{name, grade, school_year_id, term_id?, description?, co_teacher_ids?, course_ids?, join_code_enabled?}` to `{class_id}` | The creator becomes a teacher; no approval step |
| `update_class` / `archive_class` | RPC | | |
| `class_overview` | RPC | `{class_id}` to stats tiles, 4-week activity series, deadlines, attention list, activity |
| `class_work` | RPC | `{class_id}` to the combined assignments and quizzes list |
| `class_progress` | RPC | `{class_id}` to `{heat: {students, units, cells}, skills, most_missed_questions[]}` |
| `class_roster` | RPC | `{class_id}` to rows `{student, username, student_code, status, last_active_at, progress, avg_score}` plus `requests[]` (pending join requests) and `reset_requests[]` |
| `search_students` | RPC | `{q?, grade?, exclude_class_id?, limit}` to rows with `{in_my_other_classes}` |
| `add_students_to_class` | RPC | `{class_id, student_ids[]}` to `{added, skipped}` |
| `invite_students_validate` | RPC | `{class_id, identifiers: string[]}` to `{found[], not_found[], already_enrolled[]}` | Identifiers are usernames or student IDs |
| `invite_students` | RPC | `{class_id, student_ids[]}` to `{invited}` | Creates `invited` enrollments and notifications with Accept and Decline |
| `rotate_join_code` | RPC | `{class_id, enabled?, expires_at?, require_approval?}` to `{code}` | |
| `decide_join_request` | RPC | `{class_id, student_id, approve}` | |
| `remove_student_from_class` | RPC | `{class_id, student_id}` | |
| `add_co_teacher` / `remove_co_teacher` | RPC | `{class_id, teacher_id}` | The last teacher cannot be removed |
| `class_rules` | Table + RPC | read; `update_class_rules {class_id, rules, version}` to conflict-checked update with audit; `list_unlock_overrides` / unlock override CRUD (Table under RLS) | Rule changes show impact counts via `class_rules_impact {class_id, rules}` |
| `class_leaderboard` | RPC | `{class_id, period}` to rows with `{student, level, xp_week, xp_total, streak, best_streak, last_active_at}` |
| `class_streaks` | RPC | `{class_id}` to rows with at-risk flag |
| `class_quests` / `class_quest_progress` | Table | CRUD under RLS; `confirm_class_quest {quest_id, student_id}` (RPC) for manual quests |
| `award_bonus` (idem) | RPC | `{class_id, student_ids[], xp, coins, reason, idempotency_key}` to `{awarded: [{student_id, xp, coins}], capped: [{student_id, remaining}]}` | Caps from the economy config |
| `bonus_history` | RPC | `{class_id, cursor?}` to Page |

### 4.3 Students (TC-07, TC-08)
| Name | Kind | Input to output |
|---|---|---|
| `my_students` | RPC | `{class_id?, flag?, q?, cursor?}` to Page `{student, class, level, progress, avg_score, last_active_at, streak, flags[]}` |
| `student_overview` | RPC | `{student_id}` to header, tiles, score trend, weekly activity, attention reasons with suggestions |
| `student_courses` / `student_quiz_results` / `student_assignment_results` | RPC | `{student_id, cursor?}` to tables |
| `student_skills` | RPC | `{student_id}` to `{skills: [{skill, accuracy, trend}], mistakes: {grammar_topics[], words[], question_types[]}}` |
| `student_activity_log` | RPC | `{student_id, cursor?}` to Page |
| `reset_password` | Edge | see 04 section 3.2 |
| `send_reset_request_handled` | covered by `reset_password` | |

### 4.4 Courses and lessons (TC-09 to TC-12)
Authoring tables (`courses`, `units`, `course_units`, `lessons`, `lesson_blocks`, `activities`, `activity_questions`) are edited with direct writes under RLS (each row carries `version`; writes must send it for conflict checks). Supporting RPCs:
| Name | Input to output | Notes |
|---|---|---|
| `my_courses_authoring` | `{tab: 'mine'|'library', filters, cursor}` to Page with visibility, units, classes using, students |
| `create_course` | `{title, grade, category, description, start_from: 'blank'|'duplicate'|'template', source_course_id?}` to `{course_id}` | |
| `duplicate_course` | `{course_id}` to `{course_id}` | Works for own and library courses (including official) |
| `reorder_children` | `{parent_type, parent_id, ordered_ids[]}` | Units in a course, lessons in a unit, blocks in a lesson, questions in a quiz or assignment |
| `course_checklist` | `{course_id}` to `{items: [{level: 'error'|'warning', text, target}], ready: bool}` | |
| `course_pending_changes` | `{course_id}` to `{changes: [...], students_in_progress}` | Drives the "Unpublished changes" dialog |
| `publish_course` | `{course_id, visibility: 'private'|'library', class_ids[], start_on?, reviewed_ack: bool}` to `{published_version, assigned_classes, students}` | Requires `reviewed_ack` when any item has origin AI and is unreviewed; writes snapshots atomically |
| `publish_course_changes` | `{course_id}` | Applies pending changes |
| `unpublish_course` | `{course_id}` | Library removal by the author |
| `preview_course` | `{course_id}` to the student-style course tree with `preview: true` | Records nothing |
| `library_courses` | `{grade?, category?, q?, cursor?}` to Page (includes Official courses with `official: true`) |
| `assign_course_to_classes` | `{course_id, class_ids[], start_on?}` | |

### 4.5 Assignments and quizzes (TC-13 to TC-18)
Drafts use direct writes (`assignments`, `assignment_classes`, `assignment_questions`, `quizzes`, `quiz_classes`, `quiz_questions`) under RLS with `version`.
| Name | Input to output |
|---|---|
| `list_assignments` / `list_quizzes` | `{class_id?, course_id?, status?, q?, sort?, cursor?}` to Page with counts and averages |
| `validate_assessment` | `{kind, id}` to `{errors[], warnings[]}` (the publish checklist) |
| `publish_assessment` | `{kind: 'assignment'|'quiz', id, schedule: 'now'|iso}` to `{status, opens_at}`; copies question snapshots, computes points, creates student notifications |
| `close_assessment_early` | `{kind, id}` |
| `assignment_results` | `{assignment_id}` to `{summary, submissions: [{student, status, submitted_at, is_late, time_spent, auto_score, writing_score, writing_source, final}], histogram, per_question_accuracy}` |
| `send_submission_reminder` | `{assignment_id}` to `{sent}` |
| `release_grades` | `{assignment_id}` |
| `quiz_results` | `{quiz_id}` to `{summary, histogram, students[], items: [{question, percent_correct, common_wrong, avg_time, flag}], skills[]}` |
| `grant_extra_attempt` | `{quiz_id, student_id}` |
| `add_question_to_assessment` | `{kind, id, question_id}` | Copies a snapshot |
| `random_questions_for_quiz` | `{quiz_id, filters, count}` to the added questions |

### 4.6 Question bank (TC-19)
| Name | Kind | Input to output |
|---|---|---|
| `list_questions` | RPC | `{source: 'mine'|'school', type?, skill?, difficulty?, grade?, tags?, q?, cursor?}` to Page with usage and correct rate |
| `questions` | Table | CRUD own (validated by trigger per type) |
| `find_duplicate_questions` | RPC | `{}` to groups |
| `autotag_questions` | Job (Edge) | `{question_ids[]}` |
| `ai_generate_questions` | Job (Edge) | `{source: {type: 'topic'|'lesson'|'text', value}, count, types[], skill?, difficulty?, grade?, notes?, target?: {kind, id}}` to a card of kind create_questions |

### 4.7 Grading (TC-20, TC-21)
| Name | Kind | Input to output |
|---|---|---|
| `grading_queue` | RPC | `{class_id?, assignment_id?, status?, ai?, view: 'grouped'|'flat', cursor?}` to Page with AI status, confidence, flags and lock info |
| `get_submission_for_grading` | RPC | `{submission_id}` to the student's answers, auto scores, AI results, rubric, grading mode, history, comments, `neighbors: {prev, next}` |
| `lock_submission` / `unlock_submission` | RPC | `{submission_id}` to `{locked_by?}`; also announced on `grading:{assignment_id}` presence |
| `save_grade` | RPC | `{submission_id, answers: [{question_id, score?, comment?}], overall_comment?, version}` to `{totals}` (autosave while grading) |
| `confirm_submission` | RPC | `{submission_id, mode_payload, version}` to `{status, released, next_submission_id}` | Applies late penalty, writes grade history, releases per setting, triggers student XP bonus and notification on release |
| `override_score` | RPC | `{submission_id, question_id, new_score, reason}` | Writes grade history; reason required |
| `approve_all_ai_grades` | RPC | `{assignment_id, only_ids?}` to `{approved, skipped: [{id, reason}]}` | Only submissions with confidence >= 0.75 and no flags |
| `grade_history` | RPC | `{submission_id, question_id?}` to rows |
| `add_inline_comment` | RPC | `{submission_id, question_id?, body}` |
| `ai_grade_submissions` | Job (Edge) | `{assignment_id, submission_ids?}` |
| `comment_snippets`, `rubrics` | Table | own CRUD |

### 4.8 Reports (TC-22 to TC-25)
| Name | Kind | Input to output |
|---|---|---|
| `report_class` | RPC | `{class_id, period}` to `{summary, trend, histogram, skills, assessments[], top[], support[], roster[]}` |
| `report_compare` | RPC | `{class_ids[2..4], period}` to metric columns, skill series, weekly series |
| `report_student` | RPC | `{student_id, period}` to `{courses[], skills[], participation, strengths[], improve[]}` |
| `save_report` | RPC | `{kind, params, notes?}` to `{id}` (stores a snapshot for "Recent reports") |
| `recent_reports` | RPC | `{}` to the list |
| `ai_report_narrative` | Edge | `{kind, params|snapshot_id}` to `{narrative}` (card) |
| `ai_report_comments` | Job (Edge) | `{class_id, period, student_ids?}` to a card of kind report_comments |

### 4.9 Announcements and notifications (TC-26 to TC-28)
| Name | Kind | Input to output |
|---|---|---|
| `announcements` | Table | CRUD own drafts |
| `publish_announcement` | RPC | `{id, when: 'now'|iso}` to `{recipients}`; fans out recipients and notifications; urgent ones also broadcast on `platform` |
| `announcement_stats` | RPC | `{id}` to `{read, total, unread: [{user}]}` |
| `remind_unread` | RPC | `{id}` to `{reminded}` |
| `ai_draft_announcement` | Edge | `{note, audience?, tone?, length?}` to a card |
| `notifications`, `mark_notifications_read` | as student |

### 4.10 Teacher settings (TC-29)
`user_settings` (density, text size, effects, sound), `my_ai_limits` (credits and daily limits), `my_ai_activity {filters, cursor}` (own `ai_activity_log`), rubrics and comment snippets (Table), needs-attention thresholds and defaults (stored in `user_settings.notification_prefs` and a `teacher_prefs` JSON inside `user_settings.onboarding` field group; see 02 section 2).

---

## 5. TEACHER AI DOMAIN (TEACHER-SPEC 4.8 to 4.12, TC-30 to TC-32)

| Name | Kind | Input to output | Notes |
|---|---|---|---|
| `ai_copilot` | Edge (stream) | `{conversation_id?, message, context: {page, class_id?, student_id?, assignment_id?, quiz_id?, course_id?}}` to the stream (section 1.6) with `card` events | Cards are persisted in `ai_action_cards` |
| `ai_action_apply` | Edge | `{card_id, edits?}` to `{status: 'approved'|'edited', result}` | Applies the card's changes in one transaction under the approver's permissions; `stale_card` if dependencies changed; Undo token returned `{undo_token, expires_at}` |
| `ai_action_undo` | Edge | `{undo_token}` | 30 seconds; reverts publishing to draft or deletes created drafts |
| `ai_action_discard` | RPC | `{card_id}` | |
| `ai_action_regenerate` | Edge | `{card_id, instruction?}` to a new card |
| `ai_generate_course` | Job | `{source: {type, value}, shape: {grade, category, units, lessons_per_unit, weeks, skills, level, tone, include: {...}}, notes}` to job result `{course_id, outline, review_summary}` |
| `ai_generate_lesson` | Job | `{lesson_id, action: 'draft'|'examples'|'simplify'|'harder'|'audio_script'|'check_questions'|'shorten'|'lengthen', instruction?}` to a card |
| `ai_generate_assessment` | Job | `{kind, from: {unit_id|lesson_id}, options}` to a card |
| `ai_check_assessment` | Edge | `{kind, id}` to `{findings[]}` |
| `ai_planner` | Job | `{class_ids[], range, goals[], constraints, notes}` to cards grouped by day |
| `ai_lesson_plan` | Edge | `{lesson_id, class_id?}` to a card with a lesson plan |
| `ai_support_plan` | Edge | `{student_ids[], class_id, issue?}` to a card with diagnosis, goals and steps |
| `planner_items` | Table | CRUD own; `apply_plan` is an `ai_action_apply` |
| `support_plans` | Table | CRUD under RLS; `support_plan_progress {plan_id}` (RPC) to metrics against goals |
| `lesson_plans` | Table | own |
| `suggested_actions` | Table/RPC | see 4.1 |
| `ai_page_action` | Edge | `{page, action, params}` (one-click AI buttons on pages, section 6B of the Teacher spec) to a card |

---

## 6. ADMIN DOMAIN (ADMIN-SPEC AD-xx)

### 6.1 Dashboard (AD-01)
| Name | Input to output |
|---|---|
| `admin_pending_issues` | `{limit}` to `{counts: {flagged, reported, failed_jobs, total}, items[]}` |
| `admin_users_overview` | `{}` to `{students, teachers, admins, active_today, active_week, new_week, dau_series[14], signin_problems: {locked[], failed_bursts[], open_reset_requests}}` |
| `admin_ai_summary` | `{}` to `{month_spend, budget, forecast, requests_today, by_feature[5], limit_hits_today}` |
| `health` | Edge `{}` to `{db: ok, queue_depth, oldest_job_age_s, failed_jobs_24h, error_rate_24h, p95_ms, last_backup_at, maintenance}` |
| `admin_content_overview` | `{}` to counts and top courses |
| `audit_recent` | `{limit}` |

### 6.2 People (AD-02 to AD-08)
| Name | Kind | Input to output | Notes |
|---|---|---|---|
| `admin_list_users` | RPC | `{tab, grade?, class_id?, status?, last_active?, q?, cursor?}` to Page | |
| `admin_get_user` | RPC | `{user_id}` to profile, learning summary, activity, AI usage, notes |
| `admin_create_user` | Edge | `{role, first_name, last_name, display_name?, username?, student_code?, email?, grade?, class_ids?, subjects?}` to `{user_id, username, temporary_password}` | Password shown once |
| `admin_update_user` | Edge | `{user_id, fields}` with audit (before and after) |
| `admin_archive_users` / `admin_restore_users` | Edge | `{user_ids[], reason?}` to `{count, blocked: [{id, reason}]}` | Teachers who are the only teacher of a class are blocked with a reason |
| `unlock_account`, `reset_password` | Edge | see 04 |
| `reset_requests` | RPC | `{status?, cursor?}` to Page; `dismiss_reset_request {id}` |
| `admin_user_notes` | Table | admin_notes CRUD |
| `import_users_start` | Job (Edge) | `{kind: 'students'|'teachers'|'enrollments', file_asset_id}` to `{job_id}`; step 1 parses and detects columns |
| `import_set_mapping` | RPC | `{job_id, mapping}` ; `ai_suggest_import_mapping {job_id}` |
| `import_validate` | Job | runs validation; results in `import_rows` |
| `import_rows` | RPC | `{job_id, status?, cursor?}` to Page |
| `import_fix_row` / `import_exclude_rows` | RPC | `{job_id, row_no, values}` / `{job_id, row_nos[]}`; `ai_fix_import_rows {job_id}` to a card of diffs |
| `import_commit` | Job | `{job_id, duplicates: 'skip'|'update'}` to counts and a credentials file asset |
| `rollover_plan` | RPC | `{from_year_id, to_year_id, scope, grade_map, exceptions, class_plan}` to `{counts, warnings[], preview}` (no changes) |
| `ai_suggest_rollover_classes` | Edge | `{...}` to a card |
| `rollover_execute` | Job | `{plan, scheduled_at?, confirm_text: 'ROLLOVER'}` to `{run_id, job_id}` |
| `rollover_undo` | Job | `{run_id}` within 7 days |
| `admin_classes` | RPC | list, create (single and pattern), update, archive; `delete_class {class_id, confirm}` only when empty |
| `admin_class_detail` | RPC | `{class_id}` to teachers, students, courses, rules summary, activity |

### 6.3 Curriculum and content (AD-09 to AD-13)
| Name | Kind | Input to output |
|---|---|---|
| `curriculum_versions` | Table | CRUD (admin) |
| `curriculum_tree` | RPC | `{version_id, grade?}` to the tree grade, term, unit, lesson, activity, assessment with statuses |
| `curriculum_coverage` | RPC | `{version_id, grade}` to `{skills_balance, gaps[], duplicates[], outcomes_covered}` |
| `curriculum_impact` | RPC | `{version_id}` to classes and students affected |
| `publish_curriculum` | RPC | `{version_id, reviewed_ack}` |
| `duplicate_curriculum_version` | RPC | `{version_id, to_school_year_id}` |
| `course_packages` | Table + RPC | official courses are `courses` rows with `source='official'`; `set_package_units {course_id, unit_ids[]}` |
| `ai_generate_curriculum` | Job | `{grades[], terms[], source, shape, notes}` |
| `admin_content_list` | RPC | `{type, source?, status?, grade?, skill?, author?, flagged?, q?, cursor?}` to Page |
| `content_impact` | RPC | `{entity_type, id}` to `{classes, students}` |
| `set_content_status` | RPC | `{entity_type, id, status, reason?, keep_for_current?: bool}` | Unpublish notifies the author with the reason |
| `content_versions` | RPC | `{entity_type, id}`; `restore_content_version {entity_type, id, version}` |
| `ai_generate_practice_content` | Job | `{type: 'vocabulary'|'reading'|'grammar'|'writing_prompts', params}` |
| `ai_content_quality_check` | Job | `{entity_type, id | ids[]}` to findings |
| `ai_autotag_content` | Job | `{ids[]}` |
| `moderation_list` | RPC | `{tab, severity?, status?, assignee?, cursor?}` to Page with counts |
| `moderation_get` | RPC | `{id}` to snapshot, context links, history |
| `moderation_act` | RPC | `{id, action, note?, assignee_id?}` where action is assign, dismiss, resolve, unpublish, notify_author, retry_job, escalate, add_test_case |
| `ai_moderation_triage` | Edge | `{id}` to `{summary, severity, recommended_action}` |

### 6.4 Engagement (AD-14 to AD-19)
| Name | Kind | Input to output |
|---|---|---|
| `get_config` | RPC | `{key}` to `{published, draft, versions[]}` |
| `save_config_draft` | RPC | `{key, payload, version}` to the draft |
| `config_impact` | RPC | `{key, draft_id}` to `{affected_students, examples[], level_changes?}` |
| `publish_config` | RPC | `{key, draft_id, effective_from?, recalc_levels?: bool}` | Runs shared-schema validation, impact check and (for ai_safety) the test suite |
| `restore_config` | RPC | `{key, version}` to a new draft |
| `simulate_student` | RPC | `{draft_id, xp}` to level and rank |
| `economy_health` | RPC | `{}` to average coins, coins in and out, coins per active day, XP per active day, level distribution, percent at caps, purchases by rarity |
| `quest_templates` / `badge_definitions` | Table | admin CRUD with status draft or published |
| `simulate_quest_day` | RPC | `{student_id|profile}` to the 3 quests that would be drawn |
| `simulate_badge` | RPC | `{criteria, history}` to `{unlocks: bool, why}` |
| `ai_suggest_quests` / `ai_suggest_badges` / `ai_suggest_prices` | Edge | to cards |
| `shop_items`, `shop_bundles`, `shop_sales` | Table | admin CRUD; `shop_admin_list {kind}` adds units sold |
| `avatar_assets` | Table | admin CRUD; assets via `create_upload` |
| `themes` | Table | admin CRUD; `check_theme_contrast {tokens}` (RPC) to `{pairs: [{name, ratio, pass}], all_required_pass}`; `publish_theme {id}` blocked on failure; `ai_generate_theme {mood}` to 3 palettes |
| `leaderboard_admin` | RPC | `{scope, scope_id?, period, cursor?}` to entries; `leaderboard_flags {status?}` |
| `leaderboard_action` | RPC | `{student_id, action: 'hide'|'unhide'|'reset_score'|'rename', scope?, period?, reason, notify?}` |
| `leaderboard_reset_board` | RPC | `{scope, scope_id, reason, confirm}` | Danger zone |
| `ai_explain_flag` | Edge | `{flag_id}` |

### 6.5 AI governance (AD-20 to AD-23)
| Name | Kind | Input to output |
|---|---|---|
| `get_config` / `save_config_draft` / `publish_config` | RPC | for keys `ai_features`, `ai_limits`, `ai_safety`, `ai_instructions` |
| `ai_overrides` | Table | admin CRUD |
| `ai_test_sandbox` | Edge | `{feature, role, prompt, config_draft_id?}` to `{response, rules_fired[], outcome}` (dry run: stored as test usage, not counted against users) |
| `ai_run_test_suite` | Job | `{config_draft_id}` to results |
| `ai_test_cases` | Table | admin CRUD (cases from moderation can be added) |
| `ai_draft_instructions` / `ai_lint_instructions` | Edge | `{text|source}` to a card |
| `ai_usage_summary` | RPC | `{range, filters}` to `{spend, budget, forecast, series, by_feature[], by_audience[]}` |
| `ai_usage_breakdown` | RPC | `{dimension, range, filters}` |
| `ai_top_consumers` / `ai_limit_hits` / `ai_anomalies` | RPC | to lists |
| `ai_explain_usage_spike` | Edge | `{anomaly_id|range}` to `{narrative}` |
| `ai_log_list` | RPC | `{filters, cursor?}` to Page; `ai_log_detail {id}` |
| `view_ai_conversation` | Edge | see 04 section 5A |

### 6.6 System (AD-24 to AD-29)
| Name | Kind | Input to output |
|---|---|---|
| Announcements | Table + RPC | as 4.9 with the audience types of AD-24; `active_urgent_announcements` for banners |
| `admin_report` | RPC | `{kind: 'school_overview'|'learning_health'|'teacher_activity'|'content_usage'|'ai_summary', period, compare_grades?}`; `ai_report_narrative` |
| `audit_list` | RPC | `{filters, cursor?}` to Page (scope by admin level) ; `audit_get {id}` to the diff |
| `get_platform_settings` | RPC | `{}` to all keys (Super) or the permitted subset |
| `update_platform_settings` | RPC | `{key, value, version}` (Super only; audit; impact preview for features and security) |
| `set_maintenance` | RPC | `{enabled, message?, expected_back_at?}` (Super) and broadcast on `platform` |
| `admins` | RPC/Edge | `admin_list_admins`, `admin_invite_admin {username, name, role}` (temporary password once), `admin_change_role`, `admin_deactivate`; the last Super admin cannot be demoted |
| `admin_recipients` | stored in `platform_settings.notifications.admin_alerts` | |
| `notifications`, `mark_notifications_read` | as student |

---

## 7. ADMIN COPILOT
`ai_admin_copilot` (Edge, stream): same protocol as `ai_copilot` with context `{page, user_id?, class_id?, content_id?}`; it can navigate, run read-only queries through the same RPCs the page uses, and produce action cards (applied through `ai_action_apply`). It cannot apply anything without Approve.

---

## 8. JOB KINDS AND RESULT SHAPES

| Kind | Params summary | Steps | Result |
|---|---|---|---|
| `ai_course` | wizard input | outline, one step per unit (lessons, activities, quiz), assemble | `{course_id, counts, low_confidence_items[]}` |
| `ai_curriculum` | scope, shape | outline, unit steps, coverage report | `{curriculum_version_id, coverage}` |
| `ai_questions` | source, count | generate, validate, dedupe | `{card_id}` |
| `ai_lesson` | lesson and action | generate | `{card_id}` |
| `ai_grade_batch` | assignment | one step per submission (or batches of 5) | `{graded, flagged, failed}` |
| `ai_report_comments` | class, period | one step per batch of 8 students | `{card_id}` |
| `ai_planner` | class, range | generate, validate | `{card_ids[]}` |
| `import_users` | file, mapping | parse, validate, commit | `{created, updated, skipped, credentials_asset_id}` |
| `rollover` | plan | snapshot, promote, classes, enrollments, courses | `{counts, undo_until}` |
| `report` | kind, params | compute | `{snapshot_id}` |
| `tts_batch` | text items | one step per item | `{asset_ids[]}` |
| `content_quality_check` | ids | one step per item | `{findings}` |
| `notification_fanout` | announcement | resolve, insert in chunks | `{recipients}` |
Each step writes `job_steps`; a failed step can be retried (`retry_job_step {job_id, step_no}`); jobs older than 7 days are archived.

---

## 9. ERROR MATRIX (WHICH CODES EACH AREA CAN RETURN)

| Area | Codes |
|---|---|
| Any authenticated call | `unauthenticated`, `forbidden`, `account_inactive`, `must_change_password`, `maintenance`, `read_only_session`, `rate_limited`, `validation_failed` |
| Writes with versions | `conflict` |
| Quiz and assignment | `assessment_locked`, `attempts_exhausted`, `window_closed`, `already_submitted`, `invalid_state` |
| Shop | `insufficient_coins`, `level_required`, `item_unavailable` |
| AI | `feature_disabled`, `limit_reached`, `safety_blocked`, `provider_error`, `timeout`, `stale_card`, `quota_exceeded` |
| Uploads | `upload_rejected` |
