# 12. TESTING

Goal: the backend is correct, secure, and fast enough, and the contract the frontend relies on cannot drift silently.

---

## 1. TEST LAYERS

| Layer | Tooling | Runs in | Scope |
|---|---|---|---|
| Database tests | pgTAP via `supabase test db` | backend-ci on every PR | Schema, RLS, constraints, triggers, SQL functions, engine rules |
| Function tests | Deno test with the fake AI adapter and a local Supabase | backend-ci | Edge Functions: auth, admin, AI pipeline, jobs, streaming |
| Contract tests | TypeScript client that behaves like the frontend, against the local stack | backend-ci and nightly on dev | Every operation in 05-API-CONTRACT.md: shape, errors, permissions |
| End to end | Playwright (owned by the frontend) against dev | nightly and before release | Critical user flows across UI and backend |
| Load and performance | k6 and SQL explain checks on the load project | nightly (subset), before launch (full) | Peak scenarios, RLS performance |
| Security | RLS fuzz, authorization tests, dependency and secret scans, external pentest | CI, weekly, pre-launch | Section 6 |
| AI evaluation | Safety suite and quality sets (07-AI-SYSTEM.md section 11) | on prompt or config changes and nightly | Safety and quality thresholds |

---

## 2. TEST SUPPORT

- Time control: business functions call `app_now()` instead of `now()`. `app_now()` returns `coalesce(nullif(current_setting('app.test_now', true), '')::timestamptz, now())` and the setting is honored only when `app.allow_time_travel = 'on'` (local, CI and dev; never production). Tests and `seed:advance` use it to simulate day boundaries, weeks, deadlines, expirations and streaks.
- Fake AI adapter: deterministic responses keyed by prompt fixtures, including streaming chunks, structured outputs, provider errors, timeouts and safety outcomes. Selected by `AI_PROVIDER=fake`.
- Fake TTS adapter returns a tiny fixed audio file.
- Fixtures: `seed:e2e` (fixed ids) is loaded before suites; each suite uses transactions or `seed:e2e` resets.
- Helper to run SQL as a role: `set_config('request.jwt.claims', ...)` plus `set role authenticated` to simulate any user, claim set (including `view_as` and `must_change_password`) and the anon role.

---

## 3. DATABASE TESTS (pgTAP)

### 3.1 Access matrix (generated)
`tests/db/access-matrix.yml` lists, for every table, each actor (anon, student, student in another class, teacher, co-teacher, teacher of another class, school admin, super admin, archived user, must-change-password user, view-as session) and each command (select, insert, update, delete) with expected allow or deny, mirroring 04-AUTH-AND-ACCESS.md section 7. A generator produces the pgTAP files. CI fails if any table is missing from the matrix or any policy exists that the matrix does not describe.
### 3.2 Constraints and triggers
- Username format and uniqueness; role immutable; grade range; one current school year; last teacher cannot be removed; audit log append-only; coins never negative; snapshot immutability; unique attempt numbers; one submission per student and assignment.
### 3.3 Business logic (each function has success, rule-violation and boundary cases)
| Area | Cases |
|---|---|
| Levels | `level_for_xp` at every boundary (levels 1 to 60, XP exactly at thresholds, above level 60); multi-level jumps pay each level's coins |
| XP and coins | Each source rule in 06 section 2.5; daily caps per type and the cap note; idempotency; teacher bonus caps; ledger sums equal stats |
| Streaks | First day, consecutive days, a missed day with and without a freeze, two missed days, milestone payouts once, day boundary at 23:59 and 00:00 in the school time zone, a time zone with a non-midnight boundary setting, daylight saving shifts (if the zone has them) |
| Quests | Template availability filters, level bands, draw rules (core quest present, one game quest at most, no repeat, Hard limit), lazy generation, progress mapping for every target type, claim idempotency, expiry, chest weights distribution (statistical test with a fixed seed), class quests including manual confirmation |
| Badges | Each criteria form (counter, window, state metric, composite); progress rows; secret badges; award once |
| Leaderboards | Scope membership, tie-break, hidden students, reset-score floors, archived exclusion, weekly snapshot and movement, nearest rivals, anomaly flags |
| Quizzes | Every question type scoring (single, multi-answer, true false, blanks with variants and partial credit, matching partial credit, listening); pass mark; attempts and wait rules; extra attempts; deadline and grace; auto-submit; unlock rule (all lessons complete, open early, lock until); score policies best, latest, average; show-answers rules; XP delta on retakes |
| Assignments | Late policy modes and penalty math (day rounding, max cap), window rules, draft version conflict, submit idempotency, auto-graded full assignments, each grading mode and its confirm requirements, bulk approve eligibility, grade history entries, release modes, soft lock |
| Games | Scoring per game from golden answer logs (each game and difficulty), combo table, lives, boss window, hints and extra time validation, impossible-log rejection (fast answers, too many answers, too long), normalized score, caps, personal best bonus, game of the day bonus, difficulty unlocks |
| Shop | Purchase success; insufficient coins; level gate; unavailable; already owned; sales and bundles pricing; power-up limits; idempotency; equip ownership checks; rank frame grants |
| Publishing | Snapshot creation, `has_unpublished_changes`, publish changes, progress compatibility after edits, unpublish with and without `keep_for_current`, library visibility, official courses read-only for teachers |
| Classes | Join codes (approval on and off), invites, removal, co-teacher rules, archive |
| Certificates | Course completion detection, rank and streak certificates, uniqueness |
| Config | Draft, publish, restore; economy level table generation; only one published version per key |
| Search and views | Search respects RLS; progress views; materialized view refresh |

---

## 4. FUNCTION TESTS (DENO)

| Function group | Cases |
|---|---|
| `auth_login` | Success; wrong password increments attempts; lockout at the threshold and clearing after the time; archived; maintenance for non-admin; unknown username (same response and similar timing); rate limits; remember me flag; must-change flag |
| Password flows | Rules validation; temporary password shown once and never stored; reset permissions (teacher for own student only, school admin cannot reset admins); first handler wins; sessions revoked |
| Admin user functions | Create, update with audit, archive blocked for the only teacher of a class, import validation and commit, credentials file expiry, rollover plan and execute and undo |
| View-as | Start rules by level; token claims; reads allowed; every write path denied (tables, RPC, storage, functions); hidden conversations and settings; extend once; expiry; audit |
| AI pipeline (fake adapter) | Allowed, redirect, blocked, hint-only outcomes; injection; PII masking; repeated block escalation; streaming event order and cancel; limit and feature-off errors; structured output repair; cost metering and counters; dry run excluded; budget behaviors |
| Action cards | Create, apply with stale detection, partial failure rollback, undo window, discard, regenerate, permissions (cannot apply someone else's card) |
| Jobs | Claim concurrency (no double run), step progress, cancel, retry with backoff, failure creates a moderation item, reaper, per-user and per-kind concurrency |
| Uploads | Each allowed and rejected type, magic byte mismatch, oversized file, SVG sanitization, access check for signed URLs |
| TTS | Cache hit, generation, failure marking, dealing only items with audio |
| Notifications | Fan-out sizes, dedupe by group key, preferences, required kinds, urgent broadcast |

---

## 5. CONTRACT TESTS
- Every operation in 05-API-CONTRACT.md has at least: one success case, one authorization failure (wrong role) and, where it takes input, one validation failure. A manifest `tests/contract/manifest.yml` lists all operations; CI fails if one is missing from the manifest or the manifest lists one that does not exist.
- Response shapes are validated with the shared Zod schemas; snapshot files of response shapes are committed so that removing or renaming a field fails the build until the contract is intentionally changed.
- Error codes are asserted for the cases in the error matrix (05 section 9).
- The contract suite runs as seeded personas (student.mid, teacher.rana, admin.super and others) so permissions are exercised exactly as in the product.

---

## 6. SECURITY TESTS
1. RLS fuzz: for each role, call every table and RPC with random ids and parameters; assert no rows or fields outside the matrix are returned.
2. Authorization tests for every Edge Function with tokens of each role, expired tokens, tokens with the wrong audience, and view-as tokens.
3. Input fuzzing on Zod schemas (oversized strings, unexpected fields, injection strings).
4. Rich text sanitizer tests with an XSS payload corpus.
5. Cheating tests: attempt to read answer keys through every student-reachable path; tamper with scores, timestamps and answer logs; replay requests with and without idempotency keys.
6. Secrets scan and dependency scan in CI.
7. External penetration test before launch (10-SECURITY-PRIVACY.md section 6).

---

## 7. LOAD AND PERFORMANCE
Scenarios (k6) against the load project with the load seed:
| Scenario | Profile | Pass criteria |
|---|---|---|
| Morning peak | 700 virtual users: sign in, dashboard RPCs (10 calls), open a course and a lesson, complete a lesson, claim a quest | p95 reads under 300 ms, writes under 500 ms, error rate under 0.5 percent |
| Quiz rush | 300 students start and submit a 20-question quiz within 5 minutes | No lost submissions, p95 submit under 1 second |
| AI streaming | 200 concurrent tutor streams | First token p95 under 1.5 s (fake adapter with realistic delays), no dropped streams |
| Jobs | 20 concurrent generation jobs plus 600 AI grading steps | No double execution, queue drains, steps under 100 s |
| Realtime | 1,500 connections with notification inserts at 50 per second | Delivery under 2 seconds |
| Teacher day | 40 teachers grading and loading reports | p95 report RPC under 1.5 s |
| Leaderboard | Weekly board for school scope with 2,500 students | Under 400 ms |
SQL performance checks: `EXPLAIN (ANALYZE, BUFFERS)` on the key queries (dashboard RPCs, leaderboard, class progress, grading queue, search) with RLS enabled on the load project; each must use indexes and stay within budget. Statement and lock timeouts are verified under concurrency (ledger inserts for one student from several requests).

---

## 8. MIGRATION AND OPERATIONS TESTS
- Apply all migrations to an empty database and to a copy of the previous release with data (upgrade test). Both must produce the same schema.
- Seed tests: system seed on empty, demo seed, verify script, page coverage manifest.
- Backup and restore drill (quarterly and before launch).
- Cron tests: simulate time with `app_now()` for day rollover, week rollover, streak close and reminders; assert idempotency by running each job twice.
- Failure injection: provider errors and timeouts, storage failures, a function crash mid-job (reaper), database statement timeout.

---

## 9. COVERAGE TARGETS AND GATES
- 100 percent of tables in the access matrix; 100 percent of contract operations in the manifest; every business rule in 06 has a test; every error code has at least one test.
- A gate (BG0 to BG5) closes only when its tests pass in CI, the seed supports its pages (page coverage manifest), and the generated types are merged into the frontend.
