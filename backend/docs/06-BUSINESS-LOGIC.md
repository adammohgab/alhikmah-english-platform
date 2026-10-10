# 06. BUSINESS LOGIC

The rules the database (RPC functions, triggers) and Edge Functions enforce. Numbers come from docs/shared/ECONOMY-AND-GAMES.md and are read from the published `economy` config set at call time; nothing below hard-codes a value that the Admin can change. Function names are the contract names in 05-API-CONTRACT.md.

---

## 1. TIME

- School time zone and day boundary come from `platform_settings.region.timezone` and `preferences.day_boundary_time` (default 00:00).
- `school_day(ts)` returns the school date of a timestamp (shifted by the boundary). `week_start(date)` returns the Monday of that week (the configured `weekly_reset_day`, default Monday).
- Daily and weekly logic never uses the database server's local time. All "today" checks call `school_day(now())`.
- pg_cron runs in UTC. Day and week jobs therefore run frequently and are idempotent: each job checks `scheduler_state(key, last_period)` and does its work only when a new school day or week has started (section 12).

---

## 2. THE ENGINE: EVENTS, AWARDS, LEVELS

### 2.1 Pipeline
Every learning action runs in a single transaction:
1. The action's RPC performs its own work (for example `complete_lesson`).
2. It inserts a row into `domain_events` for the student (type, payload).
3. It calls `engine_process(student_id)` which processes this student's unprocessed events in order, synchronously, and returns the `AwardResult`.
4. Cron `process_domain_events()` (every minute) processes any leftover events (for example after an error) so nothing is lost.
Idempotency: the RPC's `idempotency_key` guards the whole transaction; ledger rows also carry unique keys derived from the source (`{source_type}:{source_id}:{student_id}` or the supplied key).

### 2.2 `award_xp` and `award_coins`
`award_xp(student_id, amount, source_type, source_id, reason, key)`:
1. If a row with the same `idempotency_key` exists, return its result (no change).
2. Apply the daily cap for the source type (section 2.3). The applied amount is `min(amount, cap_remaining)`; a capped result adds a `caps` note.
3. Insert the `xp_ledger` row (even for amount 0 when capped, with `meta.capped=true`, so the UI can explain).
4. Update `student_stats.xp_total`; compute the new level with `level_for_xp()`; if it changed, record the level-up (section 2.4) and queue the level event.
`award_coins` is the same with the coin caps and the balance check (`coins >= 0` always holds; spending uses `spend_coins`). All writes to `student_stats` happen only in these functions.

### 2.3 Caps (from the economy config)
| Cap | Rule |
|---|---|
| Practice XP | Max 5 sets per tool per school day; total practice XP 120 per day |
| Writing check XP | Max 2 per day |
| Tutor Quiz me XP | Max 3 rounds per day |
| Game XP and coins | 90 XP and 40 coins per day in total |
| Non-quest coins | Lessons, activities, quizzes, practice and games together: 120 coins per day |
| Teacher bonus | Per teacher per student per day: 100 XP and 50 coins |
Cap checks sum the ledger rows for the student and school day with the matching `source_type` (the `(day, student_id, source_type)` index). Dedupe rules (lesson once, activity once, quiz delta, assignment once) are enforced by unique ledger keys.

### 2.4 Levels and ranks
- At config publish, the backend materializes the level table (thresholds for levels 1 to 60) from the formula parameters (`need(n) = a + b*(n-1) + (n-1)^2` with a = 120 and b = 25 in v1) into the published config so `level_for_xp(xp)` is a binary search over 60 numbers.
- Level-up reward: coins `25 + new_level` per level gained (several levels at once pay each); every 5th level adds a sticker item from the rotating pool (`inventory.source='level_reward'`).
- Rank: derived from the level and the rank table in the config. A rank change grants the free rank frame (`inventory.source='rank'`), creates a rank certificate, and sets the `celebration` level to large.
- `AwardResult.celebration` is computed: small for correct answers and lesson completion, medium for quest claim, quiz passed, badge, streak day, level-up; large for rank-up, certificate, 7-or-more-day streak milestone, perfect quiz, Epic or Legendary shop reveal.
- XP above level 60 continues to accumulate in `xp_total` (leaderboard) and the level stays 60.

### 2.5 Source rules (what each action pays)
| Source | XP | Coins | Notes |
|---|---|---|---|
| `complete_lesson` | 20 (first completion) | 5 | Review pays 0 |
| `submit_activity` | 15 plus bonus (+10 at 90 percent or more, +5 at 70 to 89) | 4 | Retry pays only an increased bonus difference |
| `submit_quiz_attempt` | `20 + round(30 * score_pct/100)` plus 10 for a perfect score, as a delta over the best previous quiz XP | 15 if passed plus 10 for perfect, once per quiz | |
| `submit_assignment` | 30 once | 15 once | |
| release of an assignment grade | +20 if at least 85 percent, +10 if 70 to 84 | +20 or +10 | At release time |
| `finish_practice_session` | 10 | 3 | Caps in 2.3 |
| `finish_writing_check` | 15 | 0 | Cap 2 per day |
| `finish_tutor_quiz` | 10 | 0 | At least 5 questions, cap 3 per day |
| `finish_game_session` | `5 + round(20*normalized)` | `2 + round(8*normalized)` | Section 8 |
| `claim_quest` | 15, 25 or 35 by difficulty | 8, 12 or 18 | |
| weekly goal claim | 80, 110 or 150 | 40, 60 or 80 | |
| chest (all three quests) | +20 | 25 to 75 weighted | |
| badge earned | 20, 50, 120 or 300 by rarity | 20, 60, 150 or 400 | |
| streak milestone | 20, 50, 100, 250, 500, 1000 | 30, 80, 150, 400, 800, 1500 | At 3, 7, 14, 30, 60, 100 days |
| `award_bonus` | as given | as given | Counts toward level and the leaderboard when `economy.bonus_counts_for_leaderboard` is true (default) |

---

## 3. QUIZZES

### 3.1 Starting an attempt (`start_quiz_attempt`)
Checks in order:
1. The quiz is published and assigned to a class where the student is actively enrolled; `status` is open (opens_at <= now < closes_at), or an unlock override opens it for this student.
2. Unlock rule (hybrid): when the quiz is the assessment of a unit, every lesson in that unit's current course snapshot must be completed by the student, unless an override `open_early` applies to the class or the student. A `lock_until` override blocks until its date. Result is a `Lock` object `{locked, reason, unlocks_when}` on reads; start raises `assessment_locked`.
3. Attempts: allowed = quiz value, else class default, else 1; plus `quiz_extra_attempts.count`. If used attempts (submitted or auto-submitted) >= allowed raise `attempts_exhausted`. `wait_minutes` since the last submission must have passed (`assessment_locked` with the wait in details).
4. If an in-progress attempt exists and `deadline_at` is still in the future, return it (resume). Otherwise create attempt number n+1 with `started_at = now()`, `deadline_at = least(now() + time_limit, closes_at)` (no limit means `closes_at`), shuffle order (questions and options) if configured, and return questions without answer keys.
### 3.2 Autosave and timing
`save_quiz_answers` stores `draft_answers` while `now() <= deadline_at + grace` (grace 5 seconds). The server clock is authoritative; the client countdown uses `server_time`.
### 3.3 Scoring (`submit_quiz_attempt`)
Answers received after `deadline_at + grace` are ignored in favor of the last saved draft. For each question (from the attempt's snapshot):
- multiple_choice single: correct if the selected id equals the key. Multi-answer: full points only if the selected set equals the key set.
- true_false: exact.
- fill_blank: each blank compares a normalized answer (trim, collapse spaces, Unicode normalize, case-insensitive unless configured) to the accepted list; spelling variants British or American both accepted according to the region setting; points are split equally per blank (partial credit allowed).
- matching: points proportional to correct pairs.
- listening: scored by its `sub_type`.
`score_points` is the sum, `score_pct = points/total*100`, `passed = score_pct >= pass_mark`.
Counting: according to `score_policy` (best, latest, average) the attempt rows are re-marked `counted` for the student/quiz. Auto-submit: every minute `autosubmit_expired_attempts()` finds attempts `in_progress` with `deadline_at < now() - grace` and submits their last draft with status `auto_submitted`.
Awards: XP as in 2.5 (delta over the best previous quiz XP); coins once. Events: `quiz_submitted` (payload includes score, skills accuracy).
### 3.4 Results visibility
`get_quiz_result` returns the review only when the quiz's `show_answers` allows (`after_submit`, or `after_close` and the quiz is closed); otherwise only score and skill breakdown.

---

## 4. UNLOCKS, COURSE ACCESS AND PROGRESS

- Course visibility to students: a student sees a course only through `class_courses` of a class they are actively enrolled in and the course's current snapshot (`published_version`). Units and lessons are open by default; `class_unlock_overrides` can lock until a date or schedule release.
- Course percent: completed lessons divided by lessons in the current snapshot. Removed lessons leave the totals; completed lessons stay completed; new lessons appear as not started.
- Resume: the most recent `last_opened_at` among lesson_progress and activity_progress.
- Course completion (certificate trigger): every lesson in the current snapshot completed and every unit quiz passed (best counted score >= pass mark; default 60). Evaluated on `lesson_completed` and `quiz_submitted` events; one certificate per student per course.

---

## 5. ASSIGNMENTS AND GRADING

### 5.1 Availability and lateness
- `start_assignment` requires published, `publish_at <= now`, and enrollment.
- Window by late policy: `not_accepted`: starting or submitting after `due_at` raises `window_closed` unless an unlock override opens it for that student; `penalty`: accepted until `close_at` (if null, until a configured default of 7 days after due); `free_until_close`: accepted without penalty until `close_at`. After `close_at` always `window_closed` (teachers can grant an override).
- `is_late = submitted_at > due_at`. Penalty percent = `min(max_penalty, penalty_per_day * ceil((submitted_at - due_at)/1 day))` for `penalty`; 0 otherwise.
### 5.2 Drafts
`save_assignment_draft` stores answers with `draft_version`; a stale version raises `conflict`. The student can resume until submit; submit is idempotent.
### 5.3 Submit
`submit_assignment`: auto-grade the auto-gradable questions (same scoring as quizzes) into `auto_score`; store writing answers with word counts; set `status='submitted'`. If there are no writing questions the submission is fully graded: `final_score = auto_score`, `status='graded'`, `confirmed_at = now()`, `graded_by = null` (system), and release follows `grade_release` (`on_confirm` releases immediately; `all_at_once` waits for `release_grades`). If writing exists and the mode uses AI (`review_each`, `overall`, `bulk`), a `ai_grade_batch` job is queued for this submission; the status becomes `ai_graded` when the AI part finishes. `manual` skips AI.
Awards at submit: XP 30 and coins 15 once.
### 5.4 Grading (teacher)
- Each writing answer has `ai_*` fields and `teacher_*` fields; `final_score` per question = teacher score if set, else (in `bulk` mode after approval) the AI score.
- `review_each`: `confirm_submission` requires a teacher decision on every writing question. `overall`: requires one overall writing score (stored on `submission_answers` of the first writing question with `meta.overall=true`, or `writing_score` on the submission). `bulk`: `approve_all_ai_grades` marks eligible submissions (confidence >= 0.75 and no flags) as graded using the AI scores; the rest go to review. `manual`: no AI fields.
- Totals: `final_score = auto_score + writing_score`; late penalty applied on the percentage: `final_pct = (final_score / points * 100) * (1 - penalty/100)`; the original and penalized values are both stored; an override of the penalty needs a reason (grade_history source `penalty`).
- Every change writes `grade_history`. Optimistic `version` protects concurrent edits; a soft lock (`locked_by`, `locked_at`, and Realtime presence) shows who has a submission open; opening an already locked item (lock younger than 10 minutes) returns the lock info and the UI may open anyway.
- Release: students see grades and feedback only when `released_at` is set. On release the engine pays the grade bonus (2.5) and creates a notification.
### 5.5 Reminders and deadlines
Cron creates reminders per class rules (1 day and 1 hour before due) for students without a submission, and a teacher notification when a deadline passes with missing submissions.

---

## 6. PRACTICE AND LIBRARY

- `start_practice_session` builds a set (default 10 items) from the chosen source: lesson-linked content for the student's units, or the personal library; items are weighted toward `new` and `learning` words and recent mistakes; keys are not sent.
- `finish_practice_session` scores from the answer log with the quiz scoring rules, writes `score_pct`, applies XP and coins with the practice caps, and returns `words_to_save` (wrong items).
- Mastery (`review_word`): a correct review increases `correct_streak`; `new` becomes `learning` after the first correct answer; `learning` becomes `mastered` after 3 correct reviews on at least 2 different days; a wrong review sets `learning` and `correct_streak=0`. `next_review_at` follows the intervals 1, 3, 7, 14, 30 days by streak.
- `words_learned` events count words that move to `learning` or `mastered` (for quests and badges).

---

## 7. STREAKS, QUESTS, BADGES, LEADERBOARDS

### 7.1 Streaks
- Qualifying events: lesson_completed, activity_completed, quiz_submitted, assignment_submitted, practice_finished (not games or AI chat).
- On a qualifying event: upsert `streak_days(student, school_day)` with `qualified=true`; if this is the first qualification of the day, set `streak_current = previous_day_qualified_or_freeze ? streak_current + 1 : 1`, update `streak_best`, set `last_streak_date`, and check milestones (3, 7, 14, 30, 60, 100): pay once, award the streak badge, notify.
- Day close (`close_streak_day()` at the start of a new school day): for every student with `streak_current > 0` and no qualified day yesterday: if `freezes > 0` and the missed day count is exactly one, decrement `freezes`, mark `freeze_used=true`, keep the streak (notification "Freeze used"); otherwise set `streak_current = 0` and record the break.
- Streak at risk: at 18:00 school time, a notification to students with `streak_current > 0` and no qualified day today (once per day).
### 7.2 Quests
- Generation: `generate_daily_quests(student_id, day)` runs for all active students in batches at the day boundary and lazily on the first `my_quests` call of a day. Algorithm (ECONOMY-AND-GAMES section 4.2): filter templates by availability (open lessons, open quiz, features enabled, library size, recent quiz result, prior score exists), by grade range and `status='published'`; level band by `student_stats.level` (A 1 to 15, B 16 to 35, C 36 to 60) selects the target; draw 3 with the rules (at least one core learning quest, at most one game-based, no repeat from yesterday, at most one Hard; fill with the XP quest when fewer than 3 are available). Weekly goals at the week start: one XP goal, one habit goal, one random.
- Progress: `engine_process` maps events to `target_type`: lesson_completed to lessons; activity_completed to activities; quiz_submitted to quiz_score (progress 1 when score >= target) and quizzes_passed; words_learned to words; practice_finished to practice_sets and listening_sets (listening skill) and weak_practice (when started from a quiz result); writing_checked to writing_checks; game_finished to games, games_week and game_best (when personal best); tutor conversation with 3 or more messages to tutor_chat; review_words from review events; xp today from the ledger; correct_streak from game and practice logs (max run); translation_saved to translations; assignment_submitted to assignment_submit; weekly_xp, streak_days from the ledger and streak tables.
- State: `in_progress` to `ready` when progress >= target (a notification and a Small celebration flag); `claim_quest` (idem) pays the reward and sets `claimed`. Unclaimed quests expire at the day end (rewards lost; the UI says so). The chest becomes available when all three are claimed (`open_chest` pays 20 XP and weighted coins).
- Class quests: `class_quest_progress` advances with the same events when the target type matches (and the audience includes the student); manual quests are confirmed by the teacher (`confirm_class_quest`); rewards are paid once when completed or confirmed (capped by the quest's own reward limits).
### 7.3 Badges
- Criteria format: `{event: <domain event type>, count: N, window?: {days: n}, conditions?: {...}}` for counters; `{metric: <name>, gte|lte: N}` for state metrics (streak_current, level, words_mastered, badges_count, items_owned, rarity_owned...); `{composite: [...]}` for combined conditions (for example a Legendary theme and a Legendary avatar item).
- On each event, `evaluate_badges(student_id, event)` increments `badge_progress` for badges whose criteria listen to that event, and awards when progress >= target (once; unique key). Secret badges are evaluated the same way and hidden in reads.
- Awards: rarity XP and coins (2.5), notification, `celebration` medium.
### 7.4 Leaderboards
- Weekly XP = sum of `xp_ledger.amount` with `leaderboard=true` and `week_start = current week`, per student, honoring: archived students excluded; students with an active `hide` moderation row excluded; students with an active `reset_score` row count only XP created after the reset time for that period; teacher bonus included when configured.
- All-time = `student_stats.xp_total` (minus nothing; resets apply to weekly only unless the Admin chooses an all-time reset, which sets a floor timestamp the same way).
- Scopes: class (active members), grade (students with the same grade), school. Ties broken by earlier reach time (the timestamp of the ledger row that reached the total).
- Names: display name or initials per the student's setting; avatar only if enabled. Other students never receive grades, scores, usernames or ids beyond what the row needs.
- Weekly reset (Monday): snapshot the final top 200 per scope into `leaderboard_snapshots` before the new week starts; movement arrows compare current rank with the snapshot rank; leaderboard badges are evaluated from the snapshot.
- Anomaly detection (every 10 minutes): XP in a school day above 3 times the 28-day weekly average per day and above 500, or more than 30 sessions of one game in a day, creates a `leaderboard_flags` row (once per student per day).
- `nearest_rivals`: two above and two below with XP gaps.

---

## 8. GAMES

### 8.1 Session creation (`start_game_session`)
1. Feature enabled and difficulty unlocked: Easy always; Medium after one finished Easy session of this game; Hard after a Medium session with `normalized >= 0.6`.
2. Deal items for the chosen content source (courses, library, mixed): candidate pool built from the student's started or finished units, or the library, topped up with grade-level official practice content when short; exclude items shown in the last 30; weight by weakness (`correct_rate` and mistakes); take the number of rounds from the game config; for multiple choice items generate distractors from the same level. Store the dealt items with keys in `game_sessions.items`; return items without keys.
3. Return config (timers, lives, combo table) and `started_at`/`server_time`.
### 8.2 Hints and power-ups
`game_hint` consumes one `hint_packs` unit (max 2 per session) and returns the reveal payload (two wrong options removed, the first or next letter, one correct pair, the next correct chip, or another peek). `game_extra_time` consumes one `time_packs` unit (max 1 per session) and returns 30 seconds. Both are logged on the session (`hints_used`, `extra_time_used`) and are validated again at finish.
### 8.3 Finish and scoring (`finish_game_session`)
The client sends the answer log: per item `{index, answer, ms, hint?}`. The server:
1. Rejects the session (`status='rejected'`, no rewards) if the log is impossible: more answers than items, an answer faster than 300 ms, total time over the session length plus grace, hints or extra time beyond what was consumed.
2. Recomputes correctness from the stored keys and the score per game rules (ECONOMY-AND-GAMES section 9.2): base points per correct (100, 150 for reading and sentence builder perfect order, 120 for spelling first try or 60 after hint, 80 for sentence builder after one fix), difficulty and combo multipliers (combo table x1.0, x1.2, x1.5, x2.0), time bonus (per-second rates by game computed from the remaining time as logged), lives and penalties (Grammar lives, Timed Quiz lives and time penalties, boss window doubling in the last 10 seconds of Timed Quiz).
3. `normalized = clamp(score / reference_score, 0, 1)` using `games.reference_scores`.
4. XP = `5 + round(20*normalized)`, coins = `2 + round(8*normalized)`; the first session of the day in the game of the day gets XP multiplied by 1.5; personal best bonus +5 XP and +5 coins once per game per day; apply the game caps (2.3); if capped the session shows "Practice mode" and still updates bests.
5. Update `game_bests`, write the result, emit `game_finished`.
`abandon_game_session` and sessions idle for 30 minutes become `abandoned` with no rewards.
### 8.3a Game of the day
Chosen at the day boundary by rotating through the active games with a seed from the date (so everyone sees the same one).

---

## 9. SHOP AND CUSTOMIZATION

### 9.1 `purchase_item` (one transaction)
1. Idempotency key lookup.
2. Load the item: status `live` and within `availability`; level requirement versus `student_stats.level`; for non-power-ups the student must not already own it; for power-ups enforce `max_owned` and the daily purchase limit (5 per type per school day).
3. Price: the lowest applicable active sale discount on that item; bundles price the bundle and add every item not already owned.
4. `spend_coins` (fails with `insufficient_coins`); insert `purchases`; upsert `inventory` (or increase power-up stock in `student_stats`); increment `units_sold`.
5. Emit `purchase_made` (badges: first theme, collector, treasure hunter) and return the result, with `celebration` medium (large for Epic and Legendary reveals).
### 9.2 Equip
`equip_item` and `save_avatar` verify ownership (inventory or free starter or rank frame) and slot compatibility, then update `student_stats.equipped`. Selecting a theme sets `equipped.theme_id`; the frontend reads the theme tokens through `shop_theme`.
### 9.3 Starters and grants
At account creation: Candy Pop and Sorbet themes, the 6 base characters, and the rank 1 frame are granted. Rank frames are granted at rank-up. Level rewards add a sticker from the pool at levels 5, 10, 15 and so on.
### 9.4 Retired items
Retired items disappear from `shop_list` unless owned; owned items remain equippable. Sales end by time without a job (price computed at purchase).

---

## 10. CERTIFICATES
`maybe_issue_certificate(student_id, kind, reference_id)` is called by the engine on course completion, rank change and the 100-day streak. It inserts a row with a unique code (`WL-` plus 8 random characters from an unambiguous alphabet) and returns it; unique on (student, kind, reference). The printable data (student name, title, date, code, school) comes from `get_certificate`.

---

## 11. PUBLISHING AND SNAPSHOTS

### 11.1 `publish_course`
In one transaction: validate with `course_checklist` (errors block); require `reviewed_ack` when any item has an AI origin and is unreviewed; write `content_snapshots` for the course, each unit, lesson and activity with `version = published_version + 1`, flip `is_current`, set `courses.published_version`, `status='published'`, `visibility`, `has_unpublished_changes=false`; insert `class_courses` rows for the chosen classes; create notifications for students ("New course"); write audit and `content_versions`.
### 11.2 Editing after publish
Edits change the working copy and set `has_unpublished_changes=true`; students keep reading the current snapshot. `publish_course_changes` writes a new snapshot version atomically. Progress rows reference stable lesson ids so completed lessons stay completed.
### 11.3 Unpublish and removal
Teacher unpublish of a library course removes `visibility=library` only. Admin `set_content_status` to unpublished removes the item from the library and from new assignments; with `keep_for_current=true` (default) existing class assignments keep using the last snapshot; otherwise `class_courses.status='hidden'`. The author gets a notification with the reason.
### 11.4 Quizzes and assignments
`publish_assessment` validates, copies each question's current payload into `snapshot` (so later bank edits do not change published assessments), computes `total_points`, sets `status` to `scheduled` or `open` by `opens_at`/`publish_at`, and creates student notifications. Cron transitions scheduled to open and open to closed by time (section 12).
### 11.5 Official curriculum
Publishing a curriculum version snapshots its official courses the same way. Official courses are editable only by admins; teachers can duplicate them (the copy is a teacher course with `duplicated_from` set).

---

## 12. SCHEDULED JOBS (pg_cron)

pg_cron runs these in UTC at the intervals shown. Each function is idempotent and decides internally whether the school-time condition is met (using `scheduler_state`).
| Job | Interval | Action |
|---|---|---|
| `run_jobs` | every minute | Wake the job runner (pg_net call) when jobs are queued |
| `process_domain_events` | every minute | Process leftover events |
| `autosubmit_expired_attempts` | every minute | Section 3.3 |
| `transition_assessments` | every minute | scheduled to open at `opens_at`/`publish_at`; open to closed at `closes_at`/`close_at`; notify |
| `publish_scheduled_announcements` | every minute | Publish due announcements; expire old ones |
| `expire_view_as_sessions` | every minute | Close expired sessions and write audit |
| `day_rollover` | every 10 minutes | At a new school day: generate daily quests, expire old quests, close the streak day, choose the game of the day |
| `week_rollover` | every 10 minutes | At a new school week: snapshot leaderboards, draw weekly goals, expire weekly quests |
| `streak_at_risk` | every 10 minutes | At 18:00 school time once per day |
| `deadline_reminders` | every 15 minutes | Student reminders (1 day, 1 hour), teacher missing-submission notices |
| `unlock_overrides_tick` | every 15 minutes | Notify on scheduled releases |
| `refresh_materialized_views` | every 15 minutes | Section 13 of 03-DATA-MODEL |
| `leaderboard_anomalies` | every 10 minutes | Section 7.4 |
| `suggested_actions_refresh` | daily 02:00 school time | Generate teacher suggestions (job) |
| `ai_budget_check` | hourly | Compare month spend with thresholds, notify admins at 70, 90, 100 percent; apply the at-limit behavior |
| `cleanup` | daily | Delete idempotency keys older than 7 days, auth_attempts older than 30, expired rate limits, translation_history beyond 10 per student, stuck uploads older than 24 hours, expired credential files, archive old jobs (older than 7 days), archive reset requests older than 14 days |
| `job_reaper` | every 5 minutes | Re-queue jobs whose lock is older than 10 minutes (up to `max_attempts`) |
Retention deletions for audit, AI log and archived users are not scheduled until the retention periods are set in platform settings (decided before launch).

---

## 13. NEEDS-ATTENTION RULES (teacher dashboard and student lists)
Computed by `student_flags(class_id)` using thresholds from the teacher's settings (defaults): average of the last 3 assessments below 50 percent (code `low_avg`); no qualifying activity for 5 or more days (`inactive`); lost a streak of 7 or more days in the last 7 days (`streak_lost`); missed 2 or more deadlines in 30 days (`missed_deadlines`); average dropped 20 points or more against the previous average (`score_drop`). Each flag returns its reason code and a plain label with the numbers. Results are cached in the class materialized view and recomputed on demand for a single student.

---

## 14. CLASSES AND ENROLLMENT RULES
- Join code: 8 characters from an unambiguous alphabet, unique; `join_class_by_code` returns `joined` when approval is off, otherwise creates a `pending` enrollment and notifies the class teachers.
- Invites: create `invited` enrollments and a notification with Accept and Decline; accepting sets `active`.
- Removing a student sets `removed` (history stays). Removing the last teacher is blocked by trigger. Archiving a class keeps all data and hides it from active lists.
- A student can be in several classes; progress is per student and lesson, not per class.
- Co-teachers have equal rights on the class (rules, roster, assessments of that class, grading); course content editing stays with the course author.

---

## 15. NOTIFICATION TRIGGERS
Defined in 08-STORAGE-REALTIME-NOTIFICATIONS.md section 5; all notifications are created by the functions above in the same transaction as the event that causes them.

---

## 16. INVARIANTS (CHECKED BY TESTS)
1. `student_stats.xp_total` equals the sum of `xp_ledger.amount`; `coins` equals the sum of `coin_ledger.amount` and never goes negative.
2. A lesson, activity, assignment submission or purchase never pays twice.
3. No student can read another student's rows (except the leaderboard projection).
4. No answer key or sample answer is ever returned to a student role.
5. A class always has at least one teacher.
6. Published snapshots never change; only new versions are added.
7. Every privileged action writes an audit row.
8. A view-as token can never write.
