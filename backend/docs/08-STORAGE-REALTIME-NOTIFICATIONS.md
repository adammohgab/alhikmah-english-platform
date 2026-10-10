# 08. STORAGE, MEDIA, TEXT TO SPEECH, REALTIME AND NOTIFICATIONS

---

## 1. BUCKETS

| Bucket | Visibility | Content | Write access | Read access |
|---|---|---|---|---|
| `public-assets` | Public read | School logo, sticker pack, avatar parts, frames, badge icons, theme previews, shop previews, character files | Admins | Anyone |
| `lesson-media` | Private | Lesson images, audio, video, documents uploaded by teachers and admins | Authors and admins (through `create_upload`) | Signed URLs issued by `get_asset_url` after an access check |
| `audio-tts` | Private | Generated voice files (cache) | Service role only | Signed URLs via `get_asset_url` |
| `imports` | Private | CSV uploads, import error reports, credentials files | Admins | Admins only; credentials files expire after 24 hours |
| `exports` | Private | Optional generated report files (print uses the browser; reserved for later) | Service role | Owner via signed URL |
Students never upload files (assignments are solved in the platform). Paths: `{bucket}/{owner_id}/{asset_id}/{safe_filename}`; TTS files: `audio-tts/{hash[0:2]}/{hash}.mp3`.

### 1.1 Limits and allowed types
| Kind | Types (checked by extension, declared MIME and magic bytes) | Max size |
|---|---|---|
| Image | jpeg, png, webp; svg only for admin-uploaded art and only after sanitizing (scripts, event handlers, external references removed) | 5 MB (svg 1 MB) |
| Audio | mp3, m4a, ogg | 20 MB |
| Video | mp4, webm | 100 MB (raise only if the plan's upload limit allows) |
| Document | pdf | 20 MB |
| Import | csv (UTF-8) | 5 MB, 2,000 rows |
Anything else returns `upload_rejected`. Uploaded files are served with `Content-Disposition` rules and never as inline HTML.

### 1.2 Storage policies (storage.objects)
- A RESTRICTIVE policy denies INSERT, UPDATE and DELETE when `(auth.jwt()->'view_as') is not null`.
- `public-assets`: select for all; write for admins.
- `lesson-media`: select for the owner, admins and teachers whose content references the asset; students never select directly (signed URLs after the RPC access check); insert only via the upload flow (the policy checks that a `media_assets` row in status `uploading` owned by the caller exists for the path); delete for the owner while the asset is unreferenced, and for admins.
- `audio-tts`: no direct access for anyone but the service role.
- `imports`: admins only; credentials files are deleted by the cleanup job after 24 hours.

---

## 2. MEDIA PIPELINE
1. `create_upload` validates kind, MIME, size against the table above and the caller's role (teachers and admins), creates a `media_assets` row (status `uploading`), and returns a signed upload URL.
2. The browser uploads directly to Storage with progress.
3. `complete_upload` loads the object, verifies size, magic bytes and a SHA-256 checksum, sanitizes SVG, extracts basic metadata (image width and height, audio and video duration where parseable), and marks the asset `ready` or `rejected` (the file is deleted when rejected).
4. Required metadata: images need `alt_text`; audio and video need a `transcript` (or captions asset) before the lesson that uses them can be published (the course checklist flags it).
5. Deleting an asset that is referenced by published snapshots is blocked; unreferenced assets are removed by the cleanup job after 30 days in status `deleted`.
6. Images use Storage image transformations (resize and webp) where the plan supports them; otherwise the frontend requests the original with explicit width and height attributes.
7. Signed URL expiry: media 1 hour, imports and credentials 5 minutes.

---

## 3. SIGNED URL ACCESS CHECK (`get_asset_url`)
Allowed when any is true: the caller owns the asset; the caller is an admin; the asset is referenced by a published snapshot of a course the caller can access (a student through an active class assignment, a teacher through authorship or the library); or it is a public asset. Otherwise `forbidden`. Audit is not written for ordinary reads.

---

## 4. TEXT TO SPEECH (TTS)

### 4.1 Rules
- Source order for any audio need: (1) an uploaded recording attached to the item; (2) a cached generated file; (3) generate. Browser speech synthesis is not used in production.
- Voice: one voice per spelling variant (British default; American when `platform_settings.region.spelling_variant` is american), at normal speed. Speed changes (0.75x and 1.25x) are done in the player with playback rate.
- Cache key: `sha256(normalized_text | voice | variant | format)`; stored as `media_assets.tts_hash` (unique) so identical text is generated once for the whole school.
### 4.2 When audio is generated
- On publishing a vocabulary list, listening question or lesson with audio scripts, a `tts_batch` job generates audio for every item missing it (words, example sentences, listening transcripts).
- When a teacher presses "Generate audio" in the editors (single item).
- Student library words from the translator get audio lazily in the background (a `tts_batch` job with low priority); until it exists those words are not used in the Spelling game (the game deals only items that already have audio; the official practice content always does).
### 4.3 Failure and cost
A failed item is marked `audio_missing` and listed in the content checklist; the Spelling game excludes it. TTS usage is counted in `ai_usage` (feature `tts`, school budget). Text longer than 1,000 characters is split.
### 4.4 Playback contract
Items expose `audio: {asset_id}`; the frontend requests `get_asset_url`. Listening questions store the `transcript` and keep it hidden until review.

---

## 5. NOTIFICATION CATALOG

All notifications are rows in `notifications` created in the same transaction as the event. Channels: in-app only (Realtime delivers; the bell and the notifications page read the table). `notify(user_ids[], kind, payload)` is the only creator; templates (title and body from payload) live in `_shared/notify.ts`. `group_key` dedupes repeats (for example `streak_at_risk:{date}`); users can switch kinds off in `user_settings.notification_prefs` except those marked required.

### 5.1 Students
| Kind | Trigger | Link | Required |
|---|---|---|---|
| `new_course` | Course assigned to the class | the course | no |
| `new_assignment`, `new_quiz` | Published and opened | the item | no |
| `deadline_1d`, `deadline_1h` | Cron per class rules, only if not submitted | the item | no |
| `assignment_released` | Grade released | the result | no |
| `quest_ready` | A quest reaches its target | quests | no |
| `badge_earned`, `level_up`, `rank_up`, `streak_milestone`, `certificate_earned` | Engine | profile or badge | no |
| `streak_at_risk` | 18:00 school time, once per day | dashboard | no |
| `bonus_received` | Teacher award with the reason | profile | no |
| `teacher_quest_new` | Class quest created | quests | no |
| `submit_reminder` | Teacher reminder | the assignment | no |
| `class_invite` | Teacher invite (with Accept and Decline) | the notification | yes |
| `announcement`, `announcement_urgent` | Published announcement | the announcement | urgent is required |
| `join_approved`, `join_declined` | Teacher decision | classes | no |

### 5.2 Teachers
| Kind | Trigger | Link |
|---|---|---|
| `submission_received` (batched per assignment per 10 minutes) | Student submits | grading queue |
| `ai_grading_finished`, `ai_grading_flagged` | Grade batch done | grading queue |
| `join_request`, `invite_accepted`, `invite_declined` | Enrollment events | roster |
| `quiz_closed`, `deadline_missing_submissions` | Cron | results |
| `reset_request` | A student of the teacher requests a reset | roster |
| `course_generation_ready`, `job_failed` | Jobs | the course or job |
| `ai_credits_low` (80 percent), `ai_credits_exhausted` | Metering | settings |
| `admin_message` | Admin unpublished content or sent a note (with reason) | the item |
| `announcement` | School announcement | the announcement |
| `attention_digest` (daily, if any new flags) | Cron | students |
| `suggested_actions_ready` | Daily refresh | dashboard |

### 5.3 Admins
| Kind | Trigger |
|---|---|
| `issue_high`, `issue_new` (batched) | Moderation items |
| `job_failed` | A job fails after retries |
| `ai_budget_threshold` (70, 90, 100 percent), `feature_paused` | Metering |
| `import_finished`, `rollover_finished` | Jobs |
| `library_publish_digest` (optional daily) | Teachers publish to the library |
| `reset_request` | Any reset request |
| `security_event` | Lockout bursts, repeated failed sign-ins |
| `admin_invited` | New admin account |
Recipients for budget, security and issue digests come from `platform_settings.notifications.admin_alerts`.

### 5.4 Announcement fan-out
`publish_announcement` resolves the audience (all, students, teachers, grades, classes, individual users) into `announcement_recipients` rows (chunks of 500 in a `notification_fanout` job for large audiences), creates one `announcement` notification per recipient, and for `urgent` priority broadcasts on the `platform` channel so open apps show the banner. Scheduled announcements are published by cron. Read state is `announcement_recipients.read_at`; unread lists come from the same table. Expired announcements stop appearing; their rows remain.

### 5.5 Preferences and housekeeping
Notification preferences (per kind) and the reminder time live in `user_settings`. Read notifications are kept (retention decided before launch). `mark_notifications_read` batches updates.

---

## 6. REALTIME

### 6.1 Channels and authorization
| Topic | Type | Payload | Authorization |
|---|---|---|---|
| `notifications:{uid}` | Postgres Changes on `notifications`, filter `user_id=eq.{uid}` | the inserted row | RLS select on the table |
| `job:{job_id}` | Postgres Changes on `jobs`, filter `id=eq.{job_id}` | status, progress, result, error | RLS (owner or admin) |
| `grading:{assignment_id}` | Presence | `{teacher_id, name, submission_id, since}` | A policy on `realtime.messages` allows teachers of the assignment's classes |
| `platform` | Broadcast | `{maintenance: {...}, urgent_announcement_ids: []}` | All authenticated users may receive; only database triggers and Super admin functions send |
Realtime uses RLS-aware features only; no table is exposed to anonymous subscribers. View-as tokens may subscribe to `platform` only.
### 6.2 Triggers that broadcast
- An update of `platform_settings` key `maintenance` broadcasts `platform`.
- Publishing or expiring an urgent announcement broadcasts `platform`.
### 6.3 Client behavior (contract)
Subscribe after sign-in; on disconnect, reconnect with backoff and re-fetch unread notifications and active job state once reconnected; jobs also support polling every 3 seconds as a fallback.
### 6.4 Grading soft locks
Presence is advisory. The authoritative lock is `assignment_submissions.locked_by/locked_at` set by `lock_submission` (valid 10 minutes, refreshed while the page is open, released on `unlock_submission` or expiry). Opening a locked item returns the lock owner and the UI asks "Open anyway."

---

## 7. LIMITS AND CAPACITY (REALTIME AND STORAGE)
Design for 700 concurrent connections at peak (each user holds `notifications:{uid}` and at most one `job:*`); teachers add presence on grading. The chosen Supabase plan must allow at least 1,500 concurrent Realtime connections and 100 MB uploads; 11-OPERATIONS-CICD.md lists the plan checks before launch.
