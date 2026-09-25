# State & Data Architecture

## Split of responsibility

| Kind of state | Tool | Examples |
|---|---|---|
| Server data (anything from Supabase/API) | TanStack Query | Courses, lessons, tests, submissions, reports, users |
| Client-only UI state, session-scoped | Zustand | Active test-taking session (current question index, answers-in-progress, timer), sidebar collapsed/expanded, AI tutor panel open/closed + conversation buffer |
| Form state | React Hook Form (local to the form component) | Any create/edit form |
| Ephemeral UI state | `useState` in the component | Dropdown open, tab selection not reflected in URL |
| Shareable UI state | URL search params | Table filters, active report tab, pagination |

Never store server data (a list of courses, a user's results) in Zustand or context
— it goes stale and duplicates React Query's cache. Zustand is strictly for state
that has no "server truth."

## React Query conventions

- One hooks file per domain in `lib/api/` (e.g. `courses.ts` exports
  `useCourses()`, `useCourse(id)`, `useCreateCourse()`, `useUpdateCourse()`).
- Query keys are arrays with a consistent shape: `['courses', courseId]`,
  `['tests', testId, 'questions']`. Invalidation after a mutation targets the
  narrowest correct key, not a blanket `invalidateQueries()`.
- Every list query supports pagination/filtering via query params passed into the
  query key so React Query caches each filtered view separately:
  `['submissions', { classId, status: 'pending' }]`.
- Mutations always define `onError` with a toast (see `motion-and-interaction.md`
  tone rules) — no silent failures.
- Optimistic updates only for low-risk, easily-reversible actions (e.g. marking an
  announcement as read). Grading, test submission, and course edits wait for
  server confirmation before updating the UI — correctness over snappiness for
  anything that affects a grade.

## Auth & role data

- `useAuth()` (in `lib/auth/`) wraps Supabase's session with a React Query-backed
  cache, exposing `{ user, role, isLoading, isAuthenticated }`.
- Role-specific permission checks (e.g. "can this teacher edit this course")
  happen server-side (RLS policies in Supabase) as the actual security boundary.
  Frontend role checks are for UX only (hiding/disabling controls) — never treated
  as the security layer.

## Data shapes (high level — full types live in `lib/supabase/types.ts`, generated
from the Supabase schema, not hand-maintained)

Core entities the frontend consumes: `User` (role: student/teacher/supervisor),
`Course`, `Unit`, `Lesson`, `Activity`, `Assessment` (test/quiz), `Question`,
`Submission`, `Assignment`, `Announcement`, `SkillTag`. See
`06-features/content-structure.md` for the full content model this maps to.
