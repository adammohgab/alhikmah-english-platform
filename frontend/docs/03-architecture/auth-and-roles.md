# Authentication & Roles

## Roles

Exactly three, matching the reference plan: `student`, `teacher`, `supervisor`. A
user has exactly one role. Role is stored server-side (Supabase user metadata /
profile table) and is never selectable by the user at login or in the UI.

## Login

- Single login screen, email + password (school-issued accounts — no public
  self-signup in v1; accounts are provisioned by a supervisor via "Manage users").
- On success, redirect to the role's default page per `routing.md`.
- "Forgot password" flow via Supabase's built-in reset-by-email.
- No social login in v1 (school-managed accounts only).

## Session handling

- Supabase session persisted in local storage by the Supabase client (its default,
  secure-enough mechanism for this use case); session refresh handled
  automatically by the client, surfaced to the app via `useAuth()`.
- On session expiry mid-use (e.g. during a test), the app must not silently log the
  user out — see `05-pages/student/take-a-test.md` for the specific safeguard
  (local answer buffering + re-auth prompt without losing progress).

## Authorization boundary

- **Real security is server-side**: Supabase Row Level Security policies enforce
  that a teacher can only edit their own courses/tests, a student can only see
  their own submissions and results, and a supervisor has read access across the
  school plus user management rights.
- **Frontend authorization is UX-only**: `RoleGuard` on routes, conditional
  rendering of nav items and action buttons based on role. This prevents confusion,
  not unauthorized access — the API/DB layer is the actual gate.

## Permission summary (frontend-facing, for UI conditionals)

| Action | Student | Teacher | Supervisor |
|---|---|---|---|
| View own courses/results | ✓ | — | — |
| Create/edit courses, lessons | — | ✓ (own) | view-only, all |
| Build tests/question bank | — | ✓ (own) | view-only, all |
| Grade submissions | — | ✓ (own class) | view-only |
| View class/school reports | — | own class | all |
| Manage user accounts | — | — | ✓ |
| Post announcements | — | ✓ (own class) | ✓ (school-wide) |
