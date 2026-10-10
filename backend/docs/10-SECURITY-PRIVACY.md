# 10. SECURITY AND PRIVACY

The platform stores learning data about minors (ages about 12 to 18), including their writing and AI conversations. Security and privacy are design requirements, not a late review.

---

## 1. DATA CLASSIFICATION

| Class | Examples | Rules |
|---|---|---|
| Restricted | Passwords (hashed by Auth), temporary passwords (shown once, never stored), AI provider keys, service role key, JWT signing key | Secrets store only; never in the repo, logs, or client |
| Sensitive student data | Names, usernames, grade, class, grades and feedback, writing, AI conversations, support plans, activity | Visible only to the student, their teachers and admins as defined in 04-AUTH-AND-ACCESS.md |
| Limited-public | Leaderboard display name, avatar, level, XP | Visible to other students in scope; no real name unless the student's display name is their name |
| Operational | Audit log, usage, jobs, moderation items | Admins only; contains pseudonymous identifiers and masked content |
| Public | School logo, platform name, contact details, theme art | Public bucket and public settings projection |

---

## 2. THREAT MODEL AND CONTROLS

| Threat | Controls |
|---|---|
| Stolen or guessed passwords (credential stuffing) | Per-account lockout (default 5 attempts, 15 minutes), per-IP and per-username rate limits, generic failure message and timing, leaked-password protection where the plan allows, optional two-step verification for admins, access tokens of 15 minutes, refresh rotation |
| Username enumeration | Sign-in and reset-request responses identical for unknown and known usernames; dummy password verification for unknown users; reset requests never confirm existence |
| Reading other users' data (IDOR, RLS gaps) | RLS on every table with deny-by-default, restrictive policies, helper functions with locked search_path, an access matrix test generated from 04-AUTH-AND-ACCESS.md for every table and role, no use of the service role for user-initiated reads |
| Privilege escalation | Role immutable by trigger; role and level in the profile and claim; admin functions re-check the role from the database; last Super admin protection; no client-writable role or flag fields |
| Cheating: reading answers | Answer keys, explanations before allowed, writing sample answers and AI rubrics never returned to students; quiz and game keys stay server-side; snapshots are immutable |
| Cheating: tampering with time and scores | Server time authority, server-computed deadlines, scores recomputed from answer logs, plausibility checks on games, rewards computed only in the database, idempotency keys |
| Farming rewards | Daily caps in the ledger, dedupe keys, anomaly flags, Admin leaderboard moderation |
| XSS from rich text | Rich text stored as restricted HTML and sanitized on write by a server function and again by the frontend renderer; allowlist: p, br, strong, em, u, ul, ol, li, h2, h3, blockquote, a (https only, `rel=noopener noreferrer`, `target=_blank`), span with a limited class list; no inline styles, scripts, iframes, images except through asset ids |
| SQL injection | Parameterized queries only; RPC functions take typed arguments; no dynamic SQL built from user text (dynamic identifiers only from allowlists) |
| CSRF and token theft | Bearer tokens in headers (no cookie auth); strict CORS allowlist of the frontend origins; recommended CSP on the host (frame-ancestors none, script-src self plus required libraries, connect-src the Supabase project and nothing else, img-src and media-src the project storage and data) |
| Unsafe file uploads | Type allowlist by extension, MIME and magic bytes, size limits, SVG sanitization, private buckets with signed URLs, no inline HTML serving, uploads only by teachers and admins |
| AI prompt injection and data exfiltration | Layered prompts with the platform floor last, injection detection, minimal context (no other students' data), teachers' tools fetch context under RLS, aliases instead of names, outputs validated by schemas, action cards require Approve |
| Harmful or inappropriate AI output | Pre and post safety checks, Strict filter for students, neutral refusal copy, moderation queue, test suite before publishing safety changes |
| AI cost abuse and denial of wallet | Per-user, per-feature limits, school budget with thresholds and behaviors, request size limits, dry-run tracking |
| Denial of service | Rate limits on public functions (sign-in, reset request), job concurrency limits, pagination caps, statement timeouts for client roles, connection pooling |
| Insider misuse | Audit log for every privileged action (append-only), view-as is read-only with a reason and logging, conversation viewing needs a reason and is logged, School admin has reduced rights, separation of Super admin |
| Secret leakage | Secrets only in Supabase secrets and GitHub encrypted secrets, secret scanning on the repo, no secrets in client bundles, rotation runbook |
| Supply chain | Lockfiles, Dependabot or equivalent, `pnpm audit` and Deno dependency review in CI, pinned versions for functions |
| Session theft | Short access tokens, refresh rotation with reuse detection, sign-out everywhere on password reset or archive, idle timeout in the app |
| Account takeover through support flows | Reset only by an admin or the student's teacher, temporary password shown once, forced change, audit with actor, all sessions revoked |
| Backup exposure | Encrypted backups by the platform; restricted access to restore |

---

## 3. SECURITY REQUIREMENTS BY AREA

### 3.1 Database
- RLS enabled and forced on every table; a CI check fails if any table in `public` lacks RLS or a policy.
- The `anon` role can call only the functions explicitly granted (`get_public_state`, sign-in related Edge Functions are separate). Default privileges are revoked and granted explicitly.
- `authenticated` has no direct write on tables that the engine owns (stats, ledgers, events, quests, badges, snapshots, audit); those tables have no INSERT, UPDATE or DELETE policy for clients.
- SECURITY DEFINER functions set `search_path = public, pg_temp`, validate inputs, and begin with the standard authorization helper call.
- Statement timeout 10 seconds for client roles; idle-in-transaction timeout 30 seconds.
- Audit log has revoked UPDATE and DELETE and a blocking trigger.
### 3.2 Edge Functions
- Verify the JWT in every function except the explicit public ones (`auth_login`, `request_password_reset`).
- Validate every input with Zod; reject unknown fields.
- Return generic errors; log details with the request id only.
- Service role used only as described in 01-ARCHITECTURE.md section 4.9.
- CORS: only the configured frontend origins (dev preview origin, production origin).
### 3.3 Authentication
- Passwords hashed by Supabase Auth; rules enforced by our functions (04-AUTH-AND-ACCESS.md section 3.1).
- Optional two-step verification for admin accounts (setting `require_two_step_admin`; uses Supabase MFA TOTP).
- No email-based recovery exists by design; recovery is through the reset flow (admin or teacher) which is audited.
### 3.4 Storage
Private buckets by default, signed URLs, sanitized SVG, metadata verification, deletion rules (02 and 08).
### 3.5 Logging
Structured logs with request ids; no passwords, tokens, message text, student names or free-text fields; IP addresses stored only as salted hashes in `auth_attempts`, `password_reset_requests` and `audit_log`.

---

## 4. PRIVACY

### 4.1 Principles
Data minimization (only what a feature needs), purpose limitation (learning and school administration), least privilege (role-based visibility), transparency (Terms and Privacy pages written by the school), student dignity (no public ranking by grades, leaderboard shows XP only, support plans invisible to students), and accountability (audit trail for access to sensitive data).
### 4.2 Who sees what (summary)
| Data | Student | Teacher | Admin |
|---|---|---|---|
| Own grades, writing, AI chats, progress | Yes | Teachers of their classes see grades, writing and progress; AI chats are not visible | Admins see grades and progress; AI chats only through the reason-logged view |
| Another student's data | No (leaderboard projection only) | Own classes only | All, scoped by level |
| Support plans | Never | Teachers of the class | Admins |
| Audit log | No | No | Super admin all; School admin scoped |
### 4.3 AI and children's data
- Prompts contain no names, usernames, emails or student codes; PII is masked.
- The provider contract must disable training on customer data and offer the shortest retention available; the school's data processing terms must be reviewed before launch.
- Conversation text is stored only in our database; admins can read it only through the logged view; a student's AI history can be anonymized on request (message content nulled, usage kept).
- The AI never collects personal details from students (platform floor).
### 4.4 Data subject requests (procedure, no UI in v1)
Export and deletion or anonymization of a student's data are admin runbook procedures implemented as database functions run by a Super admin, each audited: `export_student_data(student_id)` (returns a structured export of profile, progress, submissions, AI conversations, stats) and `anonymize_student(student_id)` (replaces names with a placeholder, nulls writing and conversation text, keeps aggregate and ledger rows). Who may request, how identity is verified, and legal timelines are decided by the school.
### 4.5 Retention (decided before launch)
Retention periods are NOT set yet. The data model supports them: cleanup functions exist but are not scheduled for these categories until values are set in `platform_settings.data`. Proposed starting values for the school to approve: audit log 24 months, AI usage and activity log 12 months, AI conversation text 12 months after the last message, archived users 24 months after archive, notifications 12 months, grade records for the life of the student record plus the school's records policy, failed sign-in attempts 30 days (already fixed).
### 4.6 Compliance items to confirm with the school's legal advisor (not decided by the engineering team)
- Which data protection law and which education regulator requirements apply to a school's student data and to processing by cloud and AI providers, including consent and notice for minors and guardians.
- Data residency: choose the Supabase region and AI provider region accordingly; document cross-border transfers if any.
- Data processing agreements with Supabase, the AI provider, the TTS provider and the hosting provider.
- Breach notification obligations and timelines.
- Age-appropriate design requirements, parental notice for AI features, and whether AI conversations must be disclosed to guardians.

---

## 5. INCIDENT RESPONSE (SUMMARY)
1. Detect (alerts in 11-OPERATIONS-CICD.md), 2. Contain (disable the feature by config, revoke sessions, rotate keys, maintenance mode), 3. Assess (audit log, access logs, which data), 4. Notify (school leadership first; regulators and guardians as the school's legal advisor directs), 5. Recover and fix, 6. Review and record. Runbooks are in 11-OPERATIONS-CICD.md section 8.

---

## 6. SECURITY VERIFICATION BEFORE LAUNCH
1. The access matrix test passes for 100 percent of tables and roles (12-TESTING.md).
2. An automated RLS fuzz run as each role against every table and function shows no unauthorized read or write.
3. Penetration test by someone outside the team covering auth flows, RLS bypass, IDOR, file upload, AI prompt injection, and view-as.
4. Secrets audit: nothing in the repo or client bundle; all keys rotated after the test.
5. Dependency and container scan clean.
6. AI safety suite and the quality sets pass on the production configuration.
7. Backup restore drill completed.
8. Privacy review with the school completed (section 4.6) and the Terms and Privacy pages approved.
