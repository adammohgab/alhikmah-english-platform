# Implementation Roadmap — Phased Build Plan

This is the single file to hand a coding AI/agent when starting a build session:
"Read `docs/` for full context, we are implementing Phase N, here is the task."
Each phase is scoped to be independently shippable and reviewable. Do not jump ahead
to a later phase's components before its dependencies are done — later phases assume
earlier ones exist and are correct.

Every phase must be built following: `01-tech-stack/`, `02-design-system/` (including
`student-experience-amendment.md` for student-facing screens), `03-architecture/`,
`04-components/` (never invent a one-off style — extend `04-components/` first if a
primitive is missing), and `00-overview/principles-and-non-goals.md` at all times.

## Phase 0 — Project Foundation

**Goal:** an empty but correctly wired app; nothing user-facing yet.

- Vite + React 18 + TypeScript (strict) project per `tech-stack.md`.
- Tailwind configured with the full token set from `colors.md` and
  `spacing-and-layout.md` (no raw Tailwind color utilities allowed from day one).
- Folder structure created exactly per `folder-structure.md`.
- Supabase client wired (`lib/supabase/client.ts`), `.env.local` with public-safe
  values only.
- `AuthProvider`, `QueryProvider`, `I18nProvider` scaffolded (empty logic OK, correct
  shape required).
- ESLint/Prettier (Airbnb-based) + Vitest + React Testing Library installed and
  running on a placeholder test.
- Base design tokens available as Tailwind theme extensions: colors, radius,
  elevation, spacing, both type families loaded (Source Serif 4 / Lora, Inter, IBM
  Plex Sans Arabic, Noto Naskh Arabic) with correct fallback stacks.

**Definition of done:** `pnpm dev` runs, Tailwind tokens resolve, lint/test scripts
pass on a trivial test.

## Phase 1 — Design System Primitives

**Goal:** every component in `04-components/ui/` exists, styled, tested in isolation
(a simple demo route or Storybook-less manual page is fine — no design tool required).

Build in this order (later ones depend on earlier ones):
1. `Button`, `Badge`, `Card`, `Tooltip` (`component-guidelines.md`, `data-display.md`)
2. `Input`, `Textarea`, `Select`, `Checkbox`/`RadioGroup`, `Toggle`, `FormField`
   wrapper (`forms-and-inputs.md`) — Radix primitives underneath, styled per spec.
3. `Modal`, `ConfirmDialog`, `Toast`, `Banner` (`feedback.md`)
4. `Table`, `StatCard`, `ProgressBar`, `Avatar`, `EmptyState`, `Skeleton`
   (`data-display.md`)
5. `FileUpload`, `DatePicker`/`TimePicker` (`forms-and-inputs.md`)

Every component must implement all states listed in `component-guidelines.md`
(default/hover/active/focus/disabled/loading) before moving to the next phase —
this is the contract every page later relies on.

**Definition of done:** every primitive above exists as a named export in
`components/ui/`, matches its spec file exactly (colors, radius, states), and has at
least a basic Vitest render test.

## Phase 2 — App Shell, Auth & Routing

**Goal:** a logged-in user of any role lands on their correct home page inside the
full shell, and role boundaries are enforced.

- `AppShell`, `Sidebar`, `TopBar`, `MobileTabBar` (`layout-shell.md`).
- Full route tree per `routing.md`, `RoleGuard` wrapper enforced at the route level.
- Login page (`05-pages/shared/auth.md`) fully built: split layout, form validation,
  auth failure banner, forgot-password flow.
- `useAuth()` hook backed by React Query wrapping the Supabase session
  (`auth-and-roles.md`, `state-and-data.md`).
- i18n wired for EN/AR with `dir="rtl"` flip on `<html>`, logical-property Tailwind
  utilities used throughout the shell (no `pl-`/`mr-`/`text-left`).
- Route-level code splitting (`React.lazy` + `Suspense`) with skeleton fallbacks per
  route, not a generic spinner.

**Definition of done:** three seeded test accounts (one per role) can log in and each
lands on their correct default page inside a fully chromed, responsive shell;
attempting another role's route redirects with the specified toast.

## Phase 3 — Core Learning Structure (Content)

**Goal:** courses/units/lessons exist as real data and are viewable — no tests,
grading, or reports yet.

- `content/contentTypes.ts`, `content/skills.ts` per `06-features/content-structure.md`.
- `lib/api/courses.ts` React Query hooks.
- **Student:** Dashboard (`05-pages/student/dashboard.md`, static/aggregate parts can
  come after Phase 4 grading data exists — build the courses/continue-learning parts
  now), My Courses (`my-courses.md`), Lesson Page (`lesson-page.md`, without the
  AI tutor toggle wired yet — placeholder button is fine).
- **Teacher:** Course Editor list + detail (`05-pages/teacher/course-editor.md`),
  including the `UnitAccordion` and lesson editor, without AI-assist yet.
- **Supervisor:** Course Review (`05-pages/supervisor/course-review.md`) reusing the
  Course Editor in read-only mode.

**Definition of done:** a supervisor-provisioned teacher can build a course with
units/lessons/media/resources; a student sees it on their dashboard and can read a
lesson end-to-end; a supervisor can view it read-only.

## Phase 4 — Tests, Quizzes & Grading

**Goal:** the full assessment loop: build → take → auto-grade → review.

- `components/domain/test/` full set: `QuestionRenderer` (all six question types,
  `preview`/`answer`/`review` modes), `TestTimer`, `QuestionNavigator`,
  `TestSubmitBar`, `QuestionEditor`, `ResultSummaryCard` — exactly per
  `04-components/quiz-and-test-components.md`.
- `stores/testSessionStore.ts` with the mid-test session-expiry safeguard.
- **Teacher:** Test Builder list + detail + Question Bank
  (`05-pages/teacher/test-builder.md`).
- **Student:** Take a Test (`05-pages/student/take-a-test.md`), My Results
  (`my-results.md`) with `ScoreTrendChart`/`SkillBreakdownChart`.
- **Teacher:** Grade Submissions (`05-pages/teacher/grade-submissions.md`) for
  `writing`-type questions specifically.
- **Supervisor:** Test Results (`05-pages/supervisor/test-results.md`).

**Definition of done:** a teacher builds a mixed-type test, a student takes it under
the timer with the navigator, auto-graded types score instantly, a writing question
shows "Graded manually" until a teacher grades it, and the score appears correctly on
the student's My Results, the teacher's overview, and the supervisor's Test Results.

## Phase 5 — Assignments, Reports & Communication

**Goal:** everything else in the "Core features" list from `project-overview.md`.

- **Student:** Assignments (`05-pages/student/assignments.md`).
- **Teacher:** Grade Submissions extended to cover assignment file/text submissions
  (not just test writing questions), Announcements (`05-pages/teacher/announcements.md`).
- **Supervisor:** Class Reports (`05-pages/supervisor/class-reports.md`) including
  PDF export, School Overview (`05-pages/supervisor/school-overview.md`), Manage
  Users (`05-pages/supervisor/manage-users.md`), Announcements (shared component).
- Notification bell in `TopBar` wired to real announcement/grading events.

**Definition of done:** the full v1 feature list from the reference plan's
"What Is in Version 1" slide is functional end-to-end for all three roles.

## Phase 6 — Extended Scope: AI Tutor & Games

**Goal:** the additive features layered on top of a stable, working core. Do not
start this phase until Phase 5 is fully done — these features depend on the content
structure and skill tagging being correct and complete.

- Backend AI proxy endpoints assumed to exist (`/api/ai/tutor`,
  `/api/ai/generate-questions`) — frontend work only, per `06-features/ai-tutor.md`.
- `TutorChatPanel` wired into the Lesson Page and, for teachers, AI-assist wired into
  the Course Editor's lesson/quiz authoring flow.
- Games hub + all seven games per `06-features/games.md`, added to student routing.

**Definition of done:** a student can ask the AI tutor a question about the lesson
they're on and get a grade-appropriate answer; a teacher can AI-draft quiz questions
that land in the editable `QuestionEditor`; a student can play all seven games sourced
from real unit content, and results feed into the same skill-tagged results data as
quizzes.

## Phase 7 — Hardening & Launch

**Goal:** the "Deployment, Testing & Release" and "Security, Privacy & Reliability"
sections of the reference plan, in full.

- Full functional test pass: login/roles/permissions/data-saving/errors across all
  three roles, on desktop, tablet, and mobile.
- RLS policies verified as the real security boundary (frontend `RoleGuard` is UX
  only — confirm this is true in practice, not just in docs).
- Performance pass: pages request only the data they need, route-level skeletons in
  place everywhere, no waterfall requests on initial dashboard load.
- Preview-deploy → functional test → production-check flow for the release, per the
  reference plan's "Deployment, Testing & Release" slide.
- Daily backups confirmed, secrets confirmed environment-variable-only, GitHub
  workflow (feature branch → build & test → PR → review & merge, main always stable)
  confirmed in use.

**Definition of done:** the success targets from the reference plan are the
launch bar — 90% weekly student login, a teacher can build a quiz in under 5 minutes,
80%+ pilot satisfaction — plus a clean pass of every item above.

## How to use this file with a coding AI

Prompt shape for each session:

> "Read everything in `docs/`. We are implementing **Phase N** from
> `07-roadmap/implementation-phases.md`. Build [specific item from that phase's list].
> Follow the relevant page/component docs exactly — do not invent styles, colors, or
> component variants not defined in `docs/02-design-system/` and
> `docs/04-components/`."

Keep sessions scoped to one phase item at a time (e.g. "Test Builder detail view,"
not "all of Phase 4") so review stays manageable and drift from the docs is easy to
catch early.
