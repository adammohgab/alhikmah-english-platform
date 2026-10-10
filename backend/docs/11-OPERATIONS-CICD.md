# 11. OPERATIONS AND CI/CD

---

## 1. ENVIRONMENTS

| Environment | Where | Data | Used by |
|---|---|---|---|
| local | Supabase CLI (Docker) on each developer machine | System seed plus demo seed (or e2e fixtures) | Backend and frontend development, tests |
| dev | One shared Supabase project | System seed plus demo seed (reset on demand) | The frontend preview deployment (GitHub Pages), team testing, nightly end to end runs |
| prod | A separate Supabase project, created after testing is complete | System seed only plus real data | Launch |
A staging project is optional: the dev project serves as staging until testing completes; a production-like staging project is created if the school wants a dress rehearsal before launch (decided later). Production hosting for the frontend is chosen after testing; the backend always runs on Supabase.
Each environment has its own secrets, its own Auth configuration (same settings), its own AI keys, and its own budget.

---

## 2. REPOSITORY AND BRANCHING
- One repository (frontend, backend, docs, tasks). `main` is always deployable to dev. Work happens on short-lived branches named `task/{ID}-short-name`, merged by squash after review and green checks.
- Migrations are the only way to change the schema. They live in `backend/supabase/migrations`, are forward-only, and are reviewed like code.
- Migration policy (expand and contract): add columns and tables first (backward compatible), deploy code that uses them, remove old structures in a later release. Destructive changes need a second approval and a backup note. Frontend and backend deploys never need to happen in lockstep.
- The contract (05-API-CONTRACT.md) changes additively; a breaking change requires a version bump header (`x-contract-version`) and a transition plan.

---

## 3. GITHUB ACTIONS (BACKEND)

| Workflow | Trigger | Steps |
|---|---|---|
| `backend-ci.yml` | Pull request touching `backend/**` or `docs/shared/**`; push to main | Install Supabase CLI and Deno; `supabase start`; apply migrations from scratch; `supabase db lint`; SQL lint; run pgTAP tests (`supabase test db`); Deno lint, type check and tests for functions (with the fake AI adapter); run `seed:system` and `seed:e2e`; run contract tests; check that generated TypeScript types are up to date (fail with a diff otherwise); check every `public` table has RLS and policies; check the page coverage manifest |
| `types-sync.yml` | Push to main after backend-ci passes | Regenerate `database.types.ts` and the shared Zod schema package and open a pull request into `frontend/src/shared/lib/` when they changed |
| `deploy-dev.yml` | Push to main (after backend-ci); manual dispatch | Link the dev project; `supabase db push` (migrations); deploy all Edge Functions; set or update secrets from GitHub Environment `dev` (never printed); run smoke tests (sign in as seeded accounts, read dashboard RPCs, run one function of each kind); optional input `reset_demo_data` runs `seed:reset` |
| `nightly.yml` | Cron nightly; manual | End to end contract suite against dev; RLS performance checks on the load project; AI quality sets against the dev provider key (results stored); dependency and secret scans; storage and database size report |
| `deploy-prod.yml` | Manual dispatch with required approval from a Super admin owner (GitHub Environment `prod` with reviewers) | Verify tests green on the commit; create a database backup point; `supabase db push`; deploy functions; apply secrets; smoke tests; publish a release note; if smoke fails, stop and roll forward or restore (runbook 8.7) |
| `security.yml` | Weekly; on dependency changes | Dependency review, `pnpm audit` for the frontend, Deno dependency check, secret scanning |
Workflow rules: least-privilege tokens; secrets only through GitHub Environments; production secrets accessible only to the `prod` environment; no workflow prints a secret; third-party actions pinned by commit SHA.
The frontend's workflows (frontend/docs/ARCHITECTURE.md section 12) call the dev project through public variables only.

---

## 4. SECRETS INVENTORY

| Secret | Where used | Stored in |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Frontend (public), functions | GitHub variables per environment |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions only | Supabase secrets |
| `JWT_SIGNING_KEY` (for view-as tokens) | `view-as-start` only | Supabase secrets |
| `AI_PROVIDER`, `AI_MODEL_FAST`, `AI_MODEL_SMART`, `AI_API_KEY`, `AI_FALLBACK_*` | AI adapter | Supabase secrets |
| `AI_PRICING` | Cost metering | Supabase secrets (JSON) |
| `TTS_PROVIDER`, `TTS_API_KEY`, `TTS_VOICE_BRITISH`, `TTS_VOICE_AMERICAN` | TTS adapter | Supabase secrets |
| `BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_PASSWORD` | First-time seed only | GitHub environment secret, removed after first use |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF` | CI deploy | GitHub environment secrets |
| `IP_HASH_SALT` | Hashing of IP and device identifiers | Supabase secrets |
Rotation: all keys can be rotated without code changes; the runbook (8.8) lists the order.

---

## 5. BACKUPS AND RECOVERY
- Database: use the Supabase plan's daily backups; enable point-in-time recovery for production (target RPO 15 minutes; RTO 4 hours). Development has no recovery guarantee.
- Storage: nightly copy of the `lesson-media` and `public-assets` buckets to a second bucket or provider in a different project (a scheduled workflow); generated TTS audio can be regenerated and is not backed up.
- Configuration: schema in migrations, functions in git, system seed in git. Secrets are recorded in the team's password manager (names and owners, not values in docs).
- Restore drill: once before launch and then quarterly, restore a backup to a scratch project and run `seed:verify` style invariants and smoke tests.
- Before any destructive migration or rollover execution: a backup point is created and its identifier is recorded in the audit log.

---

## 6. MONITORING AND ALERTS

| Signal | Source | Alert condition | Who |
|---|---|---|---|
| API and function errors | Supabase logs | Error rate above 2 percent for 5 minutes | On-call engineer |
| Latency | Logs and traces | p95 above 1 second for reads for 10 minutes | On-call engineer |
| Database CPU, memory, connections | Supabase dashboard metrics | Above 80 percent for 10 minutes or connections above 80 percent of the pool | On-call engineer |
| Database and storage size | Nightly report | Above 80 percent of plan | Owner |
| Job queue | `health` function and cron check | Oldest queued job above 5 minutes, failed jobs above 5 in an hour | On-call engineer and Admin notification |
| AI | `ai_budget_check`, usage | Budget thresholds 70, 90, 100 percent; provider error rate above 5 percent for 5 minutes | Admins and on-call |
| Auth | `auth_attempts` | More than 50 failed sign-ins per minute or lock bursts | Admin security event and on-call |
| Realtime | Platform metrics | Connections above 80 percent of the plan limit | On-call engineer |
| Backups | Platform status | A missed daily backup | Owner |
| Cron | `scheduler_state` age | Any scheduled job not run for 3 intervals | On-call engineer |
On-call during the school term: one named engineer per week (a rota set by the team); outside term time, best effort.

---

## 7. CAPACITY, SIZING AND COST

- Starting plan: Supabase Pro with a small or medium compute add-on, connection pooling on (transaction mode for the API), and enough Realtime connections and upload size (100 MB) per section 7 of 08. Review after the first two weeks of real use and after the first exam period.
- Expected load: 700 concurrent users, 400 AI requests per minute at peak, 20 concurrent jobs. Targets are in 01-ARCHITECTURE.md section 6 and validated by the load tests (12-TESTING.md).
- Cost drivers and controls: AI tokens (limits, budget, `fast` tier by default, caching of TTS and repeated prompts that do not contain personal data), database compute and storage (indexes, partitioning plan, cleanup jobs), egress (media through CDN, image transforms, signed URL expiry).
- A monthly cost report is produced from `ai_usage` and the platform bill; the AI budget in `ai_limits` is set by the Super admin from this report.

---

## 8. RUNBOOKS

### 8.1 A user cannot sign in
1. Admin opens the user (AD-03): status archived (restore) or locked (unlock). 2. If the password is lost: reset (temporary password shown once). 3. If maintenance is on: students and teachers cannot sign in by design. 4. Check `auth_attempts` for bursts.
### 8.2 Many users locked out at once
Likely a shared network or an attack. Check the IP hash distribution in `auth_attempts`. If an attack: raise the per-IP limits' strictness temporarily; unlock affected accounts in bulk (admin function). If a shared school network triggered the per-IP limit: raise the IP limit setting and communicate.
### 8.3 AI provider outage or degradation
1. Confirm in function logs and the provider status. 2. The adapter falls back to the secondary provider if configured. 3. If both fail: set the affected AI features off in AD-20 (users see the feature-off copy) and post an urgent announcement. 4. Jobs retry automatically; failed jobs are listed in the moderation queue. 5. Re-enable and monitor.
### 8.4 AI budget reached
Behavior follows `at_limit` (stop all, stop non-essential, warn only). Super admin reviews AD-22, raises the budget or adjusts limits, and the platform resumes without a deploy.
### 8.5 Job backlog or stuck jobs
Check `health` (queue depth, oldest age). The reaper re-queues stale locks. If the runner fails repeatedly, inspect function logs, fix, and re-run `run_jobs`. Cancel or retry individual jobs from the Admin tools.
### 8.6 Rollover problems
If a rollover fails midway the job stops and records the changes made; use `rollover_undo` (within 7 days) to restore grades and class membership from `rollover_changes`. If undo is not possible, restore from the backup point recorded at execution.
### 8.7 Failed deployment
Migrations are forward-only: fix forward with a new migration whenever possible. For a bad function deploy, redeploy the previous commit's functions. For data damage, restore from the backup point (point-in-time) to a scratch project, extract the needed rows, and apply them back through a reviewed script.
### 8.8 Key leak or rotation
Revoke and replace the key at the provider or Supabase; update GitHub Environment and Supabase secrets; redeploy functions; if the service role or JWT signing key leaked, rotate Auth keys and force all sessions to sign out; review audit and access logs; follow the incident process (10-SECURITY-PRIVACY.md section 5).
### 8.9 Accidental deletion of content
Authoring content is archived rather than deleted; restore from `content_versions`. For hard deletes, use point-in-time recovery to a scratch project.
### 8.10 Maintenance mode
Super admin sets maintenance with a message and expected time (AD-27). Students and teachers see the maintenance page; admins continue. Writes by non-admins are rejected by `require_writable()`. Disable maintenance when done; the `platform` broadcast updates open apps.
### 8.11 Communication during incidents
Urgent announcements for in-app notices; the school office handles outside communication. The incident record lists times, actions and follow-ups.

---

## 9. RELEASE PROCESS
1. Merge to main (checks green) deploys to dev automatically. 2. Team testing on dev with the frontend preview. 3. For production: a Super admin owner approves `deploy-prod.yml`; a release tag and note are created; the smoke suite runs; a post-release check of dashboards and alerts follows. 4. Hotfixes follow the same path with a shortened review. 5. The contract version and the migration list are included in the release note.

---

## 10. PLAN CHECKS BEFORE LAUNCH
Confirm the chosen Supabase plan provides: daily backups and point-in-time recovery, enough compute for the load tests, at least 1,500 concurrent Realtime connections, 100 MB uploads, Edge Function execution limits compatible with the job runner (steps under 100 seconds), custom access token hooks, time-boxed sessions, leaked-password protection and MFA, and a region that satisfies the data residency decision.
