# BACKEND DOCUMENTATION (v1)

Backend for the school's English learning platform (working title: Wordland). Built on Supabase: Postgres, Auth, Row Level Security (RLS), Storage, Realtime and Edge Functions, plus an AI provider and a text-to-speech provider behind adapters.
The frontend talks to Supabase DIRECTLY from the browser (tables, views and RPC functions protected by RLS) and calls Edge Functions for AI, admin and other privileged or long-running actions. There is no separate API server.

---

## 1. READING ORDER

| # | File | What it defines |
|---|---|---|
| 1 | 01-ARCHITECTURE.md | Components, repo layout, conventions, error model, when to use which mechanism |
| 2 | 02-DATA-MODEL-CORE.md | Enums and tables: identity, school structure, content, questions, assessments, progress |
| 3 | 03-DATA-MODEL-ENGAGEMENT-AI-ADMIN.md | Tables: gamification, games, shop, communication, AI, teacher tooling, moderation, admin operations, settings, audit |
| 4 | 04-AUTH-AND-ACCESS.md | Username sign-in, sessions, roles, JWT claims, view-as, RLS policy catalog |
| 5 | 05-API-CONTRACT.md | Every read, RPC and Edge Function the frontend uses (inputs, outputs, errors), realtime channels, pagination |
| 6 | 06-BUSINESS-LOGIC.md | The rules the database and functions enforce: gamification engine, assessments, unlocks, shop, leaderboards, scheduled jobs |
| 7 | 07-AI-SYSTEM.md | AI provider adapter, prompt assembly, safety pipeline, streaming, jobs, action cards, usage and limits, evaluation |
| 8 | 08-STORAGE-REALTIME-NOTIFICATIONS.md | Buckets, media pipeline, text to speech, realtime channels, notification rules |
| 9 | 09-SEED-DATA.md | The dev and test seed that makes every page demonstrable with real data |
| 10 | 10-SECURITY-PRIVACY.md | Threat model, protections for students' data, audit, privacy and compliance items |
| 11 | 11-OPERATIONS-CICD.md | Environments, GitHub Actions, migrations, backups, monitoring, cost control, runbooks |
| 12 | 12-TESTING.md | Test strategy for RLS, functions, jobs, AI evaluation, load |
| 13 | 13-ROADMAP-AND-GATES.md | Delivery milestones BG0 to BG5, what each unlocks for the frontend |

Shared product rules (implemented here, displayed by the frontend): docs/shared/ECONOMY-AND-GAMES.md and docs/shared/AI-BEHAVIOR.md.
Frontend docs: frontend/docs (page specs ST-, TC-, AD-, SH-). Page specs say WHAT the user sees; these backend docs say WHAT the backend provides.

## 2. PRECEDENCE WHEN FILES DISAGREE
1. docs/shared (numbers and behavior rules)
2. 05-API-CONTRACT.md (what the frontend can rely on)
3. 02/03 data model and 04 access rules
4. 06 business logic, 07 AI system
5. The frontend page specs for what a page needs; if a page needs data that the contract does not provide, the contract is extended (additive change) rather than the page invented a workaround.

## 3. GLOSSARY
- Domain: a group of related tables and functions (identity, school, content, assessment, progress, gamification, shop, communication, ai, teaching tools, moderation, admin operations).
- RPC: a Postgres function called through Supabase's rpc interface.
- Edge Function: a Deno TypeScript server function. Used where secrets, the service role, external calls, streaming or long work are needed.
- Job: a long-running unit of work stored in the `jobs` table and executed by the job runner in steps, with progress delivered through Realtime.
- Action card: an AI-prepared change set that only takes effect when the teacher or admin approves it.
- Server-authoritative: computed and enforced by the backend. The client never decides rewards, scores, unlocks, limits or permissions.
- School time: the school's time zone (platform setting) used for day and week boundaries.
- Gate (BG0 to BG5): a delivery milestone that unlocks frontend tasks (see 13-ROADMAP-AND-GATES.md).

## 4. SCALE ASSUMPTIONS (used for design, adjustable)
Up to 2,500 users (about 2,200 students, 200 teachers, 10 admins). Peak about 700 concurrent users at the start of a school day. About 400 AI requests per minute at peak (tutor streaming dominates). Database size under 20 GB in the first year. These numbers fit a standard Supabase paid project with a modest compute add-on.

## 5. DECISIONS (RESOLVED)
1. Supabase used directly from the client plus Edge Functions for privileged work.
2. Sign-in is username and password. Supabase Auth stores a synthetic internal email per user (never used to send mail). No emails are sent by the platform.
3. All rewards, scores, unlocks, limits and permissions are computed by the backend.
4. AI is provider-agnostic behind an adapter; streaming for conversations, jobs for long generation.
5. A real dev backend with seeded data is the frontend's development target (no mocks).
6. Admin "view as user" is read-only and enforced by the database.
7. Parent accounts are out of scope. Data retention periods are decided before launch (placeholders in 10-SECURITY-PRIVACY.md).
8. Deployment automation uses GitHub Actions (11-OPERATIONS-CICD.md). Production hosting choices for the frontend are decided after testing; the backend is hosted on Supabase.

## 6. STILL NEEDED FROM THE SCHOOL OR OWNER (not design decisions)
- The Supabase project region and plan to use (a data-residency and legal review is listed in 10-SECURITY-PRIVACY.md).
- The AI provider account and the text-to-speech provider account (keys go into secrets, never into the repo).
- The school time zone value (default placeholder: the school's local zone) and the academic calendar for the first school year.
- The real student and teacher lists for import (CSV template defined in 05-API-CONTRACT.md).
