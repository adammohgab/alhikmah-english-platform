# 02. DATA MODEL: CORE (ENUMS, IDENTITY, SCHOOL, CONTENT, ASSESSMENTS, PROGRESS)

Notation per table: `column type [constraints]`. Every table also has `created_at` and (where editable) `updated_at` unless stated. "pk" primary key, "fk" foreign key, "uq" unique, "idx" index. RLS rules are summarized per table and fully listed in 04-AUTH-AND-ACCESS.md section 6. Part 2 (engagement, AI, admin) is in 03-DATA-MODEL-ENGAGEMENT-AI-ADMIN.md.

---

## 1. ENUMS

```
user_role            student | teacher | admin
admin_level          super | school
account_status       active | invited | archived | locked
skill                vocabulary | grammar | reading | writing | listening | translation
difficulty           easy | medium | hard
rarity               common | rare | epic | legendary
course_category      main | reading_club | exam_prep | custom
content_source       official | teacher
content_status       draft | published | unpublished | archived
course_visibility    draft | private | library
question_type        multiple_choice | true_false | fill_blank | matching | listening | writing
block_type           text | audio | video | image | example | keywords | check | resources
assessment_status    draft | scheduled | open | closed
late_mode            not_accepted | penalty | free_until_close
grading_mode         review_each | overall | bulk | manual
grade_release        on_confirm | all_at_once
show_answers         never | after_submit | after_close
score_policy         best | latest | average
attempt_status       in_progress | submitted | auto_submitted | expired
submission_status    not_started | in_progress | submitted | ai_graded | graded | released
enrollment_status    active | invited | pending | removed
enrollment_via       roster | invite | join_code | import | rollover | admin
unlock_mode          open_early | lock_until | schedule
mastery              new | learning | mastered
job_status           queued | running | succeeded | failed | canceled
config_status        draft | published | archived
```
Further enums used only in part 2 (shop, quests, moderation, announcements and others) are defined there.

---

## 2. IDENTITY AND ACCOUNTS

#### profiles
One row per person; `id` equals `auth.users.id`.
Columns: `id uuid pk fk auth.users`; `username text not null` (stored lowercase; uq on lower(username); check `^[a-z0-9._-]{3,32}$`); `role user_role not null`; `admin_level admin_level` (required when role=admin, null otherwise); `first_name text not null`; `last_name text not null`; `display_name text not null` (leaderboard name; default first name plus initial); `student_code text` (uq when not null; student ID); `employee_code text` (uq when not null); `contact_email text` (optional, never used to sign in or send mail); `grade smallint` (7 to 12, students only); `status account_status not null default 'invited'`; `must_change_password bool not null default true`; `failed_attempts int default 0`; `locked_until timestamptz`; `last_active_at timestamptz`; `last_sign_in_at timestamptz`; `archived_at timestamptz`; `archived_by uuid`; `created_by uuid`.
Indexes: uq(lower(username)); trigram on first_name, last_name, username, student_code; idx(role, status); idx(grade) where role='student'.
RLS: a user reads own row; teachers read students of their classes; admins read all (school admin: no admin rows); students never read other students' rows (leaderboards use a view).
Constraints: a student has grade; teacher and admin have none. A trigger forbids changing role.

#### user_settings
One row per user. `user_id pk fk`; `effects_level text default 'full'` (full, reduced, minimal); `text_size text default 'default'`; `sound jsonb default {master: 0.35, ui: true, feedback: true, celebration: true, games: true}`; `haptics bool default false`; `show_arabic bool default false`; `auto_play_audio bool default false`; `daily_goal text default 'regular'` (light, regular, serious); `leaderboard_name_mode text default 'display_name'` (display_name, initials); `leaderboard_show_avatar bool default true`; `reading_text_size text`; `table_density text default 'comfortable'` (teachers, admins); `notification_prefs jsonb`; `onboarding jsonb`; `teacher_prefs jsonb` (teachers only: needs-attention thresholds, default grading mode and grade release, default late policy, default attempts and reminders, AI assistant preferences such as tone, reading level, default difficulty, suggested-action categories and refresh time, copilot options).
RLS: owner reads and writes own row.

#### admin_notes
`id`; `user_id fk profiles` (the subject); `note text`; `created_by fk`. RLS: admins only (school admin cannot see notes about admins).

#### password_reset_requests
`id`; `username text`; `full_name text`; `grade_class text`; `note text` (max 200); `status` check in (new, handled, dismissed) default new; `profile_id uuid` (set when the username matches, never exposed to the requester); `handled_by uuid`; `handled_at timestamptz`; `device_hash text`; `ip_hash text`.
Indexes: idx(status, created_at). RLS: insert only through the `request-password-reset` function; reads by admins and by teachers of that student's classes (through helper `can_manage_student(profile_id)`).

#### auth_attempts
Sign-in attempts for lockout and abuse control. `id`; `username_hash text`; `profile_id uuid`; `ip_hash text`; `success bool`; `reason text`; `created_at`. Retained 30 days. No client access.

#### view_as_sessions
`id`; `admin_id fk`; `target_id fk`; `reason text not null`; `started_at`; `expires_at`; `extended bool default false`; `ended_at`; `pages jsonb default []`; `notify_target bool`.
RLS: admins read their own; no client writes (functions only).

#### rate_limits
Token buckets for functions. `key text pk`; `tokens numeric`; `updated_at`. No client access.

#### idempotency_keys
`key uuid`; `scope text` (function name); `user_id`; `response jsonb`; `created_at`; pk(key, scope, user_id). Cleaned after 7 days. No client access.

---

## 3. SCHOOL STRUCTURE

#### school_years
`id`; `name text` (for example 2026-2027); `starts_on date`; `ends_on date`; `is_current bool` (exactly one true, partial uq index).

#### terms
`id`; `school_year_id fk`; `name text`; `starts_on date`; `ends_on date`; `position smallint`.

#### classes
`id`; `name text not null`; `grade smallint not null` (7 to 12); `school_year_id fk`; `term_id fk null`; `description text`; `status text default 'active'` (active, archived); `join_code text` (uq when not null); `join_code_enabled bool default false`; `join_code_expires_at timestamptz`; `require_join_approval bool default true`; `created_by fk`; `created_by_role user_role`; `archived_at`.
Indexes: idx(school_year_id, grade); idx(status).
Rules: a class always has at least one teacher (enforced by trigger on class_teachers delete).

#### class_rules
`class_id pk fk`; `quiz_attempts smallint default 1` (null means unlimited); `score_policy score_policy default 'best'`; `wait_minutes int default 0`; `default_due_time time default '17:00'`; `reminders jsonb default {"day_before": true, "hour_before": true}`; `default_late_policy jsonb default {"mode": "not_accepted"}`; `answer_visibility show_answers default 'after_submit'`; `version int`; `updated_by`; `updated_at`.

#### class_teachers
`class_id fk`; `teacher_id fk`; `added_by fk`; `added_at`; pk(class_id, teacher_id). Trigger: cannot remove the last teacher.

#### class_enrollments
`class_id fk`; `student_id fk`; `status enrollment_status`; `via enrollment_via`; `invited_by fk`; `requested_at`; `joined_at`; `removed_at`; `removed_by`; pk(class_id, student_id). Index: idx(student_id, status).

#### class_courses
`class_id fk`; `course_id fk`; `assigned_by fk`; `start_on date`; `assigned_at`; `status text default 'active'`; pk(class_id, course_id).

#### class_unlock_overrides
`id`; `class_id fk`; `target_type text` (unit, lesson, quiz, assignment); `target_id uuid`; `mode unlock_mode`; `student_ids uuid[]` (null means whole class); `starts_at`; `ends_at`; `created_by`; `note`.
Index: idx(class_id, target_type, target_id).

---

## 4. CURRICULUM AND CONTENT

#### curriculum_versions
Official curriculum per school year. `id`; `school_year_id fk`; `name`; `status config_status`; `parent_version_id fk null`; `published_at`; `published_by`; `note`.

#### grade_outcomes
Learning outcomes per grade. `id`; `curriculum_version_id fk`; `grade smallint`; `code text`; `text text`; `skill skill null`; `position`.

#### courses
`id`; `title text`; `description text`; `grade smallint`; `category course_category`; `source content_source`; `author_id fk`; `curriculum_version_id fk null` (official courses); `visibility course_visibility default 'draft'`; `status content_status default 'draft'`; `cover_pattern text`; `estimated_hours numeric`; `version int default 1` (working copy version, bumps on edit); `published_version int` (the current snapshot version); `has_unpublished_changes bool default false`; `published_at`; `unpublished_reason text`; `unpublished_by fk`; `duplicated_from fk null`.
Indexes: idx(source, status, grade); idx(author_id); trigram on title.
Rules: students only see a course through a class assignment (`class_courses`) or as part of library browsing is NOT allowed (library is for teachers). Official courses are editable only by admins; teacher courses only by their author.

#### units
`id`; `owner_course_id fk null`; `curriculum_version_id fk null`; `term_id fk null`; `grade smallint`; `title`; `description`; `objectives text[]`; `skills skill[]`; `term_label text`; `estimated_hours numeric`; `outcome_ids uuid[]`; `status content_status`; `author_id`; `version int`.
Check: exactly one of owner_course_id or curriculum_version_id is set.

#### course_units
`course_id fk`; `unit_id fk`; `position smallint`; pk(course_id, unit_id). Teacher courses get rows automatically for their own units; official packages may include units from several terms.

#### lessons
`id`; `unit_id fk`; `position smallint`; `title`; `summary`; `minutes smallint`; `skills skill[]`; `status content_status`; `version int`.

#### lesson_blocks
`id`; `lesson_id fk`; `position smallint`; `type block_type`; `content jsonb`; `version int`.
Content shapes: text `{html}` (restricted rich text); audio `{asset_id, transcript, caption_asset_id?}`; video `{asset_id|url, captions_asset_id?}`; image `{asset_id, alt}`; example `{sentence, highlights[{start,end}], note}`; keywords `{items:[{word, pos, meaning, arabic, example, vocab_item_id?}]}`; check `{question_ids[] | questions[]}` (ungraded); resources `{items:[{label, asset_id|url}]}`.

#### activities
`id`; `unit_id fk`; `lesson_id fk null`; `position`; `title`; `skill skill`; `instructions text`; `xp_level text` (low, medium, high; mapped to values by the economy rules); `minutes smallint`; `status content_status`; `version int`.

#### activity_questions
`activity_id fk`; `position`; `question_id fk`; `points numeric`; `snapshot jsonb` (frozen at publish); pk(activity_id, position).

#### content_snapshots
Immutable published copies. `id`; `entity_type text` (course, unit, lesson, activity, quiz_outline); `entity_id uuid`; `course_id fk`; `version int`; `payload jsonb`; `is_current bool`; `published_by`; `published_at`.
Indexes: uq(entity_type, entity_id, version); partial idx(entity_type, entity_id) where is_current.
Payloads: course = ordered tree of unit and lesson and activity summaries with quiz references; lesson = blocks with resolved asset references; activity = instructions and question snapshots.
Learners and classes read only snapshots through RPC. A publish writes new snapshots in one transaction and flips `is_current`.

#### content_versions
Edit history for the admin version panel. `id`; `entity_type`; `entity_id`; `version int`; `payload jsonb`; `changed_by`; `changed_at`; `note`. Written by triggers on content tables at publish and on admin "save version." Restore copies a payload back into the working copy.

#### media_assets
`id`; `kind text` (image, audio, video, document, other); `bucket text`; `path text`; `mime text`; `size_bytes bigint`; `duration_s numeric`; `width int`; `height int`; `alt_text text`; `transcript text`; `source text` (upload, tts, system); `tts_hash text` (uq when not null: hash of text, voice, speed); `owner_id fk`; `status text` (uploading, ready, rejected, deleted); `checksum text`.
Indexes: uq(bucket, path); idx(owner_id).

#### vocabulary_lists and vocabulary_items
vocabulary_lists: `id`; `title`; `grade`; `level text`; `unit_id fk null`; `source content_source`; `author_id`; `status content_status`; `tags text[]`.
vocabulary_items: `id`; `list_id fk`; `position`; `word text`; `part_of_speech text`; `pronunciation text`; `meaning text`; `arabic_meaning text`; `example text`; `audio_asset_id fk null`; `level text`.
Index: trigram on word.

#### grammar_topics
`id`; `title`; `grade`; `level`; `rule jsonb`; `examples jsonb`; `common_mistakes jsonb`; `practice_question_ids uuid[]`; `unit_id null`; `source`; `author_id`; `status`; `tags`.

#### reading_passages
`id`; `title`; `text text`; `level`; `topic text`; `word_count int` (generated); `est_minutes numeric`; `glossary jsonb`; `question_ids uuid[]`; `audio_asset_id null`; `unit_id null`; `source`; `author_id`; `status`; `grade`; `tags`.

#### writing_prompts
`id`; `task text`; `audience text`; `min_words int`; `max_words int`; `grade`; `level`; `rubric_id fk null`; `unit_id null`; `source`; `author_id`; `status`; `tags`.

---

## 5. QUESTIONS AND RUBRICS

#### questions
The question bank. `id`; `type question_type`; `prompt jsonb` (`{text, html?, media?:[asset ids]}`); `options jsonb`; `answer jsonb`; `explanation text`; `points numeric default 1`; `skill skill`; `difficulty difficulty`; `grade smallint`; `tags text[]`; `author_id fk`; `source content_source`; `visibility text default 'mine'` (mine, school); `origin text default 'manual'` (manual, ai); `status text default 'active'` (active, archived); `times_used int default 0`; `correct_rate numeric`; `audio_asset_id null`; `rubric_id null`; `min_words int`; `max_words int`; `sample_answer text` (writing; never sent to students); `version int`.
Payload shapes:
- multiple_choice: options `[{id, text}]`; answer `{correct: [ids]}` (one or more); settings `{shuffle: bool, multi: bool}`.
- true_false: answer `{value: bool}`.
- fill_blank: prompt contains `{{1}}` markers; answer `{blanks: [[accepted strings]], case_sensitive: bool}` or word bank in options.
- matching: options `{left: [{id,text}], right: [{id,text}]}`; answer `{pairs: [[leftId, rightId]]}`.
- listening: prompt has `audio_asset_id` and `transcript`; the answer type is one of the above in `answer.sub_type`.
- writing: no correct answer; `min_words`, `max_words`, `rubric_id`.
Indexes: idx(author_id); idx(visibility, skill, difficulty, grade); gin(tags); trigram on prompt text.
RLS: authors read and write their own; teachers read `visibility='school'`; admins read all; students never read this table (they only receive question snapshots inside attempts).

#### rubrics
`id`; `owner_id fk null` (null for platform defaults); `name`; `criteria jsonb` (`[{key, name, max_points, descriptors}]`); `is_default bool`.

#### comment_snippets
`id`; `teacher_id fk`; `text text`.

---

## 6. ASSESSMENTS

#### quizzes
`id`; `title`; `instructions text`; `course_id fk null`; `unit_id fk null`; `grade smallint`; `author_id fk`; `time_limit_min int null`; `pass_mark numeric default 60`; `attempts_allowed smallint null` (null means class default); `score_policy score_policy null`; `wait_minutes int null`; `shuffle_questions bool`; `shuffle_options bool`; `show_answers show_answers default 'after_submit'`; `opens_at timestamptz`; `closes_at timestamptz`; `status assessment_status default 'draft'`; `total_points numeric` (computed at publish); `version int`; `published_at`.
Index: idx(author_id, status); idx(unit_id).

#### quiz_classes
`quiz_id fk`; `class_id fk`; pk(quiz_id, class_id).

#### quiz_questions
`quiz_id fk`; `position`; `question_id fk`; `points numeric`; `snapshot jsonb` (the question as published, without the answer key leaving the server for students); pk(quiz_id, position).

#### quiz_extra_attempts
`quiz_id`; `student_id`; `granted_by`; `granted_at`; `count smallint default 1`; pk(quiz_id, student_id).

#### quiz_attempts
`id`; `quiz_id fk`; `student_id fk`; `class_id fk`; `attempt_no smallint`; `status attempt_status`; `started_at timestamptz` (server time); `deadline_at timestamptz` (started plus time limit, capped by closes_at); `submitted_at`; `draft_answers jsonb` (saved while in progress); `score_points numeric`; `score_pct numeric`; `passed bool`; `time_spent_s int`; `counted bool` (true if this attempt is the one counted by the score policy); `question_order jsonb` (shuffled order used).
Unique: uq(quiz_id, student_id, attempt_no). Index: idx(student_id, status).

#### quiz_attempt_answers
`attempt_id fk`; `question_id`; `answer jsonb`; `is_correct bool`; `points_awarded numeric`; `flagged bool`; `time_spent_s int`; pk(attempt_id, question_id).

#### assignments
`id`; `title`; `instructions text`; `course_id null`; `unit_id null`; `grade`; `author_id`; `points numeric` (sum computed at publish); `publish_at`; `due_at`; `close_at`; `late_policy jsonb` (`{mode, penalty_per_day, max_penalty}`); `grading_mode grading_mode`; `grade_release grade_release`; `released_at`; `shuffle_questions bool`; `shuffle_options bool`; `show_answers show_answers`; `resources jsonb`; `pass_mark numeric null`; `status assessment_status`; `version int`; `published_at`.

#### assignment_classes
`assignment_id`; `class_id`; pk both.

#### assignment_questions
`assignment_id`; `position`; `question_id`; `points`; `snapshot jsonb`; pk(assignment_id, position).

#### assignment_submissions
`id`; `assignment_id fk`; `student_id fk`; `class_id fk`; `status submission_status default 'not_started'`; `draft jsonb` (autosaved answers); `draft_version int`; `started_at`; `submitted_at`; `is_late bool`; `late_penalty_pct numeric`; `auto_score numeric`; `writing_score numeric`; `final_score numeric`; `final_pct numeric`; `graded_by fk null`; `confirmed_at`; `released_at`; `locked_by fk null`; `locked_at timestamptz`.
Unique: uq(assignment_id, student_id). Indexes: idx(assignment_id, status); idx(student_id, status); partial idx on status in ('submitted','ai_graded').

#### submission_answers
`submission_id fk`; `question_id`; `answer jsonb`; `word_count int`; `auto_score numeric`; `ai_score numeric`; `ai_rubric jsonb`; `ai_comment text`; `ai_confidence numeric`; `ai_flags text[]`; `ai_model text`; `teacher_score numeric`; `teacher_comment text`; `final_score numeric`; `graded_by`; `graded_at`; pk(submission_id, question_id).

#### submission_comments
`id`; `submission_id fk`; `question_id null`; `author_id fk`; `body text`. Visible to the student after release.

#### grade_history
Append-only. `id`; `submission_id fk`; `question_id null`; `changed_by fk`; `source text` (ai_accept, teacher, override, penalty, system, bulk_approve); `old_score numeric`; `new_score numeric`; `reason text`; `created_at`. Feeds the audit log category Grades.

---

## 7. LEARNING PROGRESS (STUDENT DATA)

#### lesson_progress
`student_id fk`; `lesson_id fk`; `course_id fk`; `status text` (in_progress, completed); `first_completed_at`; `last_opened_at`; `notes text`; `xp_awarded bool`; pk(student_id, lesson_id). Index: idx(student_id, last_opened_at desc) (feeds the Resume strip).

#### activity_progress
`student_id`; `activity_id`; `course_id`; `state jsonb` (autosave); `attempts smallint`; `best_score_pct numeric`; `last_score_pct numeric`; `first_completed_at`; `xp_awarded_pct numeric`; `updated_at`; pk(student_id, activity_id).

#### library_words
`id`; `student_id fk`; `word text`; `part_of_speech`; `meaning`; `arabic_meaning`; `example`; `vocab_item_id fk null`; `added_from text` (lesson, translator, manual, game); `mastery mastery default 'new'`; `starred bool`; `correct_streak smallint`; `next_review_at`; `last_reviewed_at`. Unique: uq(student_id, lower(word)).

#### library_topics and library_passages
library_topics: `student_id`; `grammar_topic_id`; `saved_at`; `note`; pk both. library_passages: `student_id`; `passage_id`; `saved_at`; pk both.

#### writing_drafts
`id`; `student_id`; `prompt_id null`; `title`; `text text`; `word_count int`; `status text` (draft, finished); `ai_feedback jsonb`; `feedback_at`.

#### practice_sessions
`id`; `student_id`; `tool text` (vocabulary, grammar, reading, writing, translation); `mode text`; `source text` (lesson, library); `source_ref uuid`; `items jsonb`; `answer_log jsonb`; `score_pct numeric`; `status text`; `started_at`; `finished_at`; `xp_awarded int`; `coins_awarded int`.

#### translation_history
`id`; `student_id`; `direction text` (en_ar, ar_en); `source_text text` (max 300); `result jsonb`; `created_at`. Only the last 10 are shown; older rows are pruned by a scheduled job.

#### Progress views (read through RPC or views)
- `v_unit_progress(student_id, unit_id)`: lessons completed over total from current snapshots.
- `v_course_progress(student_id, course_id)`: percent complete, next lesson, XP earned in the course.
- `v_student_resume(student_id)`: the most recent opened lesson or activity with course name and progress.
All views run with the caller's RLS (`security_invoker`).
