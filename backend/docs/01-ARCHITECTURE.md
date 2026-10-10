# 01. BACKEND ARCHITECTURE

---

## 1. COMPONENTS

| Component | Used for | Notes |
|---|---|---|
| Postgres 15+ | All data, business rules in RPC functions and triggers, scheduled work | Extensions: pgcrypto, pg_trgm, unaccent, pg_cron, pg_net, supabase_vault, pgtap (tests only), pg_stat_statements |
| Supabase Auth (GoTrue) | Accounts, passwords, sessions, refresh tokens | Email sending disabled; synthetic internal email per user; custom access token hook adds claims |
| PostgREST (Supabase API) | Direct reads and simple writes from the browser, RPC calls | Every table has RLS enabled; no table is exposed without policies |
| Supabase Storage | Lesson media, avatar and theme art, audio (recordings and generated voice), import files, report files | Buckets and policies in 08-STORAGE-REALTIME-NOTIFICATIONS.md |
| Supabase Realtime | Notifications, job progress, grading presence, urgent banners, maintenance flag | Postgres Changes (RLS aware), Broadcast and Presence with authorization |
| Edge Functions (Deno, TypeScript) | AI, sign-in wrapper, admin actions, job runner, anything needing secrets, service role, external calls, streaming or atomic multi-step logic | Shared library in `_shared/` |
| pg_cron + pg_net | Scheduled jobs and the job runner trigger | Schedules in 06-BUSINESS-LOGIC.md |
| AI provider (adapter) | Chat, generation, grading, safety classification | See 07-AI-SYSTEM.md |
| Text to speech provider (adapter) | Audio for listening and spelling, cached in Storage | See 08-STORAGE-REALTIME-NOTIFICATIONS.md |

---

## 2. REPOSITORY LAYOUT (backend/)

```
backend/
  docs/                       These documents
  supabase/
    config.toml               Local stack configuration (auth, storage, realtime, functions)
    migrations/               Ordered SQL migrations (the only way the schema changes)
    seed/                     Seed scripts (see 09-SEED-DATA.md)
    functions/
      _shared/                Auth helpers, error model, Zod schemas, audit writer, idempotency, AI adapter, safety, usage meter
      auth-login/ ...         One folder per Edge Function (names in 05-API-CONTRACT.md)
    tests/
      db/                     pgTAP tests (RLS, functions, triggers)
      functions/              Deno tests for Edge Functions
      e2e/                    Contract tests that call the API like the frontend does
  scripts/                    Dev utilities (reset db, generate types, seed, check policies)
```
Types for the frontend are generated from this schema (`supabase gen types typescript`) and committed to frontend/src/shared/lib/supabase/database.types.ts by a CI step.

---

## 3. WHICH MECHANISM FOR WHICH JOB

| Need | Use | Why |
|---|---|---|
| Read a table or a simple filtered list the user is allowed to see | Table or view through PostgREST with RLS | Fast, no code, safe by default |
| Read that joins many tables or aggregates (dashboards, reports) | RPC function (SECURITY INVOKER when RLS is enough, SECURITY DEFINER with explicit checks otherwise) or a view | One round trip, stable shape |
| Simple user-owned writes (a note, a setting, a draft, a library word) | Direct table write with RLS | CRUD with no rules beyond ownership |
| Any write that changes rewards, scores, grades, purchases, permissions, publishing or multiple tables | RPC function (transaction) | Atomic and rule-enforcing |
| Anything needing a secret, the service role, an external API, streaming, or more than about 2 seconds of work | Edge Function | Keeps secrets server-side and supports streaming |
| Work longer than one request (generation, imports, rollover, bulk grading, reports, text to speech batches) | A row in `jobs` executed by the job runner | Resumable, observable, cancelable |
| Notify a user | Insert into `notifications` (Realtime delivers) | One path for all notifications |
| Do something later or repeatedly | pg_cron entry | Defined in 06-BUSINESS-LOGIC.md |

Authoring tables (courses, units, lessons, blocks, questions, quizzes and assignments while in draft) are edited with direct writes under RLS by their author. Publishing, scheduling, grading, awarding, enrolling, purchasing, importing and every AI call go through RPC or Edge Functions.

---

## 4. CONVENTIONS

### 4.1 Naming and types
- Tables and columns: snake_case, plural table names. Enums are Postgres enums (snake_case values).
- Every table has `id uuid primary key default gen_random_uuid()` unless it is a join or one-row-per-user table (composite key or user id as key).
- `created_at timestamptz not null default now()`; `updated_at timestamptz not null default now()` maintained by a trigger where rows are edited.
- `created_by uuid references profiles(id)` on content and configuration tables.
- Status columns are enums with explicit values (draft, published, archived and so on). Hard deletes are used only for join rows and drafts; user-facing records are archived, not deleted.
- JSONB is used for flexible, versioned payloads (rich content blocks, option lists, rubric criteria, snapshots, configuration). Anything that is filtered, sorted or joined is a real column.
- Money is not used. Coins and XP are integers (`int` or `bigint`).
- All timestamps are stored in UTC. "Day" and "week" values are stored as `date` computed in school time (see 06-BUSINESS-LOGIC.md section 1). Business functions call `app_now()` instead of `now()` so tests and dev demos can simulate time (12-TESTING.md section 2); in production it always equals `now()`.

### 4.2 Versioning of published content
Authoring rows are editable drafts. Publishing creates an immutable snapshot row in `content_snapshots` (and quizzes and assignments copy question snapshots at publish). Learners and classes read snapshots; authors edit the working copy. Details in 02-DATA-MODEL-CORE.md.

### 4.3 Idempotency
Every function that awards, spends, claims, submits, purchases or applies something accepts an `idempotency_key` (client-generated UUID) stored in a unique index with the result. A repeated call returns the first result instead of repeating the effect.

### 4.4 Optimistic concurrency
Editable records that several people or tabs can change (assignment drafts, builder content, class rules, configuration sets) carry `version int`. Updates must send the version they read; a mismatch returns the `conflict` error.

### 4.5 Error model
All RPC and Edge Function failures use one shape.
- Edge Functions respond with HTTP status and JSON `{ "error": { "code": "...", "message": "...", "details": {}, "request_id": "..." } }`.
- RPC functions raise an exception whose message is the error code and whose detail is a JSON string of details; the frontend's API layer parses it into the same shape.
Codes (stable, additive):
`unauthenticated`, `forbidden`, `not_found`, `validation_failed`, `conflict`, `rate_limited`, `account_locked`, `account_inactive`, `must_change_password`, `maintenance`, `feature_disabled`, `limit_reached`, `safety_blocked`, `provider_error`, `timeout`, `read_only_session`, `assessment_locked`, `attempts_exhausted`, `window_closed`, `already_submitted`, `insufficient_coins`, `level_required`, `item_unavailable`, `cap_reached` (informational result field, not an error), `stale_card`, `invalid_state`, `quota_exceeded`, `upload_rejected`.

### 4.6 Request identity and logging
Every Edge Function creates or reads a `x-request-id`, includes it in logs and error bodies, and records it in audit and usage rows. Logs are structured JSON. Personal data and message contents are never written to application logs (usage and conversation tables are the record).

### 4.7 Pagination and filtering
Lists use keyset pagination: `limit` (default 25, max 100) and a `cursor` (the last row's sort key and id). Filter and sort options are explicit parameters of the RPC or documented column filters on views. Offset pagination is not used for large tables.

### 4.8 Authorization checks
Policies and functions call small SECURITY DEFINER helper functions (`is_admin()`, `is_super_admin()`, `is_teacher_of_class(class_id)`, `is_student_in_class(class_id)`, `can_see_student(student_id)` and others listed in 04-AUTH-AND-ACCESS.md) with a locked `search_path`. Policies wrap `auth.uid()` as `(select auth.uid())` so it is evaluated once per statement. Every mutating RPC and Edge Function first calls `require_writable()`, which rejects calls made in a view-as session.

### 4.9 Service role usage
The service role key exists only in Edge Function secrets. It is used only for: sign-in and password operations, admin operations that write across users, the job runner, scheduled functions, notification fan-out, AI usage metering, and writing audit rows. Functions that act on behalf of a user create a client with the user's token whenever RLS is enough, and only escalate for the specific steps that need it. Every escalated write also writes an audit entry.

---

## 5. SHARED LIBRARY (supabase/functions/_shared)

| Module | Responsibility |
|---|---|
| auth.ts | Verify JWT, read claims, build user-scoped and service clients, `requireRole`, `requireWritable` |
| errors.ts | Error classes and the response mapper |
| schemas.ts | Zod schemas for every function input and output (also published as a TypeScript package for the frontend) |
| audit.ts | `writeAudit(actor, action, target, before, after, reason)` |
| idempotency.ts | Key lookup, store and replay |
| ratelimit.ts | Token bucket per user, per IP hash and per function backed by a table |
| settings.ts | Cached read of the current platform settings and published config sets |
| ai/adapter.ts | Provider interface and implementations (chat, stream, structured output, embeddings not used) |
| ai/prompts.ts | Layered prompt assembly (07-AI-SYSTEM.md section 3) |
| ai/safety.ts | Pre and post safety pipeline |
| ai/usage.ts | Limits check and usage metering |
| ai/cards.ts | Action card creation and apply registry |
| jobs.ts | Job creation, step runner, progress publishing |
| tts.ts | Text to speech adapter with cache lookup |
| time.ts | School time helpers |
| notify.ts | Notification creation and templates |

---

## 6. PERFORMANCE TARGETS AND DATABASE GUIDELINES

- p95 latency: table or RPC reads under 150 ms; writes under 250 ms; dashboard RPCs under 300 ms; first token of an AI stream under 1.5 s; job step under 120 s (Edge Function time limits apply; long work is split into steps).
- Index every foreign key used in RLS policies and every filter or sort used by the contract. Use partial indexes for status filters (for example open items) and trigram indexes for search.
- Dashboard and report data come from RPC functions or materialized views refreshed by cron (class and school aggregates), not from client-side aggregation.
- Large append-only tables (`xp_ledger`, `coin_ledger`, `ai_usage`, `ai_messages`, `audit_log`, `domain_events`) are indexed by user and time and are partitioned by month when they pass 20 million rows (a documented migration, not needed at launch).
- RLS policies avoid per-row subqueries on large tables by using helper functions with indexes, and are covered by performance tests (12-TESTING.md).

---

## 7. OBSERVABILITY

- Structured logs from Edge Functions with request id, function name, user id (hashed), duration and outcome.
- Metrics (exported or queried from logs): requests per function, error rates by code, p50 and p95 latency, AI cost per feature, job queue depth and age, rate limit hits, failed sign-ins, realtime connections.
- Alerts (11-OPERATIONS-CICD.md section 7): error rate, job backlog, AI budget thresholds, auth failure bursts, database size and connection saturation.
- The Admin dashboard's "platform status" reads a `health` function (database ping, queue depth, recent failures, last backup time reported by the platform).

---

## 8. SECURITY STANCE IN ONE PARAGRAPH
Every table has RLS enabled and deny-by-default. The browser holds only the public anon key and the user's session. Anything that must not be forged (rewards, scores, grades, permissions, AI limits, view-as mode) is decided in the database or an Edge Function. The service role never leaves Edge Function secrets. Student data is visible only to the student, their teachers and admins, and other students see only display name, avatar, level and XP on leaderboards. Full detail in 10-SECURITY-PRIVACY.md.
