# CONTRIBUTING TO AL HIKMAH ENGLISH PLATFORM

Welcome to the Al Hikmah English Platform engineering repository. This document defines the engineering standards, architecture rules, git branching workflow, conflict prevention mechanisms, and pull request checklist required for all human engineers and autonomous coding agents.

---

## 1. ARCHITECTURE & SPECIFICATIONS AS SOURCE OF TRUTH

1. **The Specs are Immutable Contracts**: All implementations must strictly conform to:
   - `frontend/docs/ARCHITECTURE.md` (Tech stack: React 18 + Vite + TypeScript strict + Tailwind v3 + Radix UI + Motion / GSAP / Lenis + Howler + Rive + Supabase client)
   - `frontend/docs/01-styles/GLOBAL-STYLES-SPEC.md` (Design tokens, 6 worlds, strokes, shadows, typography, motion budgets, sound effects)
   - `frontend/docs/02-public/SHARED-SPEC.md`
   - `frontend/docs/03-student/STUDENT-SPEC.md`, `ECONOMY-AND-GAMES.md`, `AI-BEHAVIOR.md`
   - `frontend/docs/04-teacher/TEACHER-SPEC.md`
   - `frontend/docs/05-admin/ADMIN-SPEC.md`
   - `backend/docs/01-ARCHITECTURE.md` through `14-TRACEABILITY-MATRIX.md`
2. **Real Data Only**: No mock data or in-memory bypasses in production code. All features connect through typed API hooks against the Supabase backend.
3. **Task Claiming System**: All work items are tracked in the task claiming tracker with precise micro-task codes (e.g., `FND-01`, `BE-CORE-05`, `UIK-12`, `STU-CORE-08`).

---

## 2. WORKFLOW & CONFLICT PREVENTION (NO BRANCH BLOAT)

### 2.1 Pragmatic Workflow: Direct Main or Feature Lanes
You do **NOT** need to create 224 separate git branches! Creating a branch for every 1-hour micro-task is complete overkill.
- **Direct Commits / Push to `main`**: Autonomous agents or single developers can commit and push directly to `main` as tasks finish, provided tests pass and file ownership is respected.
- **Feature / Block Branches (Optional)**: If working with a team or multiple AI agents concurrently, work on coarse block-level branches (e.g. `feat/fnd-foundation`, `feat/stu-core`, `feat/be-schema`) or keep short-lived feature branches that merge multiple related tasks together.

---

## 3. STRICT FILE OWNERSHIP & CONFLICT PREVENTION

To allow multiple engineers and AI subagents to develop in parallel without merge conflicts, adhere to these isolation boundaries:

1. **Declared File Ownership (`owns: [...]`)**:
   - Every task defines its exact owned file paths in its metadata.
   - You must NOT modify files owned by another active or concurrent task.
2. **Page Alone Architecture (`frontend/src/pages/{page-domain}/...`)**:
   - Each page lives in its own isolated directory containing its page component, local subcomponents, and page-specific hooks.
   - Do NOT edit other pages' folders.
3. **Shared Modules (`src/shared/components/...`, `src/shared/api/...`)**:
   - Shared UI primitives are created in `src/shared/components/` under dedicated `UIK-*` tasks.
   - Shared API domain hooks are created in `src/shared/api/{domain}/` under dedicated `FND-*` or backend bridge tasks.
   - Route registration in `frontend/src/app/router.tsx` is performed only in dedicated router tasks per phase, or through modular route bundle exports.
4. **Database Migrations & Edge Functions**:
   - Backend migrations in `supabase/migrations/` must be sequentially timestamped or ordered.
   - Edge functions in `supabase/functions/{function-name}/` live in separate directories per function.

---

## 4. DESIGN SYSTEM & UI STANDARDS

All UI code must comply with `GLOBAL-STYLES-SPEC.md`:
- **Outlines & Borders**: 2px solid border (`border-2 border-primary/20` or theme token `border-neutral-stroke`).
- **Shadows**: 2px/4px/8px solid offset retro shadows (`shadow-[2px_2px_0px_#000]`, `shadow-[4px_4px_0px_#000]`). No blurry realistic drop shadows unless layered.
- **Color Worlds**: Use CSS variables and `data-world` selectors (`world-coral`, `world-amber`, `world-mint`, `world-sky`, `world-violet`, `world-rose`).
- **Typography**:
  - Headings: `font-heading` (`Fredoka`, semi-bold / bold).
  - Body & UI: `font-body` (`Figtree`, regular / medium / bold).
  - Handwriting & Callouts: `font-accent` (`Caveat`).
  - Arabic scripts: `Amiri` / `Scheherazade New` / `Noto Naskh Arabic`.
- **States**: Every interactive component must handle: `default`, `hover`, `active`/`pressed`, `focus-visible`, `disabled`, `loading` (Skeleton/Spinner), and `error` state.
- **Effects Tiers**: Respect user's device capability: Low (CSS only, no 3D/canvas), Balanced (lite confetti, simplified particles), High (full GSAP ticker, Lenis smooth scrolling, rich celebrations). Always honor `prefers-reduced-motion`.

---

## 5. PULL REQUEST CHECKLIST

Before opening a PR or submitting a task:

- [ ] **Task Code Verified**: PR title follows `[TASK_CODE] Brief description of work done`.
- [ ] **Branch Verified**: Branch name is `task/{code}-{slug}` branched cleanly off latest `main`.
- [ ] **File Ownership Complied**: Touched ONLY files within the declared `owns` scope.
- [ ] **Typecheck Clean**: `pnpm typecheck` (or `tsc --noEmit`) passes with 0 errors.
- [ ] **Lint & Format Clean**: `pnpm lint` and `pnpm format:check` pass without warnings.
- [ ] **Automated Tests**: Unit / integration tests added or updated for new functions, running green (`pnpm test`).
- [ ] **Responsive Tested**: Verified on Mobile (375px), Tablet (768px), and Desktop (1280px+).
- [ ] **Accessibility (a11y)**: Proper ARIA roles, keyboard navigable, visible focus rings (`focus-visible:ring-2`), adequate color contrast.
- [ ] **Reduced Motion**: Tested with `prefers-reduced-motion` enabled.
- [ ] **Acceptance Criteria**: Every bullet in the task's `acceptance_criteria` is confirmed satisfied.
