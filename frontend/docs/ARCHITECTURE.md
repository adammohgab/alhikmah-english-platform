# FRONTEND ARCHITECTURE (v1 DRAFT)

Status: DRAFT v1. This file replaces everything useful from frontend/docs (tech stack, folder structure, import rules) so that frontend/docs can be deleted.
Read with: 01-styles/GLOBAL-STYLES-SPEC.md (how it looks and moves), 07-contract/FRONTEND-BACKEND-CONTRACT.md (what the backend provides), 06-tasks/EXECUTION-PLAN.md (how work is split).

---

## 1. REPOSITORY LAYOUT

```
alhikmah-english-platform/
  README.md
  project-tasks/          Frontend documentation (these docs). Rename to docs/ later if wanted.
    00-architecture/      This file
    01-styles/            Global styles, motion and sound spec
    02-public/            Shared and public pages spec
    03-student/           Student spec
    04-teacher/           Teacher spec
    05-admin/             Admin spec
    06-tasks/             Execution plan and the generated task files
    07-contract/          Frontend and backend contract (input for the backend docs)
  frontend/               Code only. No docs folder inside.
  backend/                Separate directory with its own docs (Supabase migrations, functions, docs/)
```
- frontend/docs is DELETED. Nothing in it is kept: the design docs are replaced by the global styles spec, the tech stack and folder rules are moved into this file, the hero page doc describes a mock that is ignored.
- The existing landing page code (frontend/src/pages/landing) is a mock and is ignored. It is deleted when the new landing page is built (task PUB-B). Its generic hooks (Lenis, in-view, reduced motion, scroll navbar) may be moved to shared if they fit.
- The backend directory is documented separately. The only shared document is the contract in 07-contract, which the backend docs must satisfy.

---

## 2. TECH STACK (FINAL FOR V1)

| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript, strict | No `any` without a comment explaining why |
| UI library | React 18 | Function components and hooks only |
| Build | Vite 5 | Already in the project |
| Routing | React Router v6 (data router) | Route table with role guards; lazy route modules |
| Styling | Tailwind CSS 3.4 | Config generated from GLOBAL-STYLES tokens; CSS variables for worlds and themes |
| Accessible primitives | Radix UI | Dialog, dropdown, tabs, tooltip, select, popover, switch, etc., always styled with our system |
| Animation | GSAP (core, ScrollTrigger, Flip, SplitText), Lenis, Motion (Framer Motion), Rive, Lottie (only if needed) | Ownership rules in GLOBAL-STYLES section 8.1 |
| Sound and particles | Howler.js, canvas-confetti | Lazy loaded |
| 3D | three, @react-three/fiber, @react-three/drei | Lazy chunk, strict budget (GLOBAL-STYLES section 9) |
| Icons | Lucide React | Heavier stroke (2.25 to 2.5) |
| Forms | React Hook Form + Zod | Zod schemas are the source of truth for form types |
| Server state | TanStack Query | All reads and writes go through query and mutation hooks |
| Client state | Zustand | Small stores: effects tier, sound, sidebar, focused flow, celebration queue, theme preview |
| Backend client | @supabase/supabase-js | Auth, Postgres, Storage, Realtime, Edge Functions |
| Charts | Recharts | Custom chunky shapes, table alternative |
| Dates | date-fns | School time zone from platform settings |
| Rich text | Tiptap (restricted toolbar) | Builders and announcements |
| Drag and drop | dnd-kit | Builders, planner, avatar editor |
| Testing | Vitest + React Testing Library; Playwright (end to end); axe (accessibility checks) | |
| Lint and format | ESLint + Prettier | |
| Package manager | pnpm | Delete package-lock.json |

Not used: CSS-in-JS, Redux, any UI kit with its own visual identity (MUI, Ant, Chakra), backdrop blur effects, i18next (the UI is English only; Arabic exists only as content in the Translation tool, with `lang="ar"` and `dir="rtl"` on that content). All user-visible strings live in one central copy module per page or domain so that translation can be added later without a rewrite.

Browser support: the latest two versions of Chrome, Edge, Safari and Firefox, Safari on iOS and Chrome on Android (last two major versions).

---

## 3. FOLDER STRUCTURE ("PAGE ALONE")

Principle: one page equals one folder. Everything only that page needs lives in its folder. Deleting the folder removes the page completely.

```
frontend/src/
  app/
    App.tsx                 Providers and router only
    main.tsx
    router.tsx              Route table: path, lazy page, role guard, world, transition style
    providers/              Auth, Query, Effects, Lenis, Sound, Theme, Celebration providers
  pages/                    One folder per route-level page (flat). Name: <role>-<page>
    public-landing/
    public-login/
    student-dashboard/
    student-quiz-attempt/
    teacher-grading/
    admin-users/
    ...
  shared/
    ui/                     Primitives (Button, Input, Dialog, Table...), one file per component, named exports
    layout/                 AppShell variants, Sidebar, TopBar, MobileTabBar, PublicHeader, PublicFooter, PageHeaderBand
    effects/                ShapeFrame, Sticker, Squiggle, Marquee, Grain, Halftone, WorldProvider, TiltCard, MagneticWrap, CursorLayer, SplitReveal
    motion/                 Lenis integration, TransitionOutlet, celebration queue, scroll helpers, spring and ease tokens
    audio/                  Sound provider, sprite loader, sound map
    domain/                 Product components shared by 2+ pages (course, question, quiz, gamification, ai, reports)
    lib/
      supabase/             client.ts, generated types (database.types.ts)
      api/                  One module per backend domain: queries, mutations, Zod schemas (see section 4)
      ai/                   Streaming client, job tracker, action card helpers
      auth/                 Session hooks, role helpers, guards
      utils/                cn.ts, format helpers, time zone helpers
    stores/                 Zustand stores
    styles/                 globals.css, tokens.css, worlds.css, themes/
    assets/                 Fonts, logo (unchanged), sticker and character files, sprites
    types/                  Cross-cutting types
  dev/                      Dev-only pages: /dev/styleguide and /dev/motion (removed from production builds)
```

Page template (every page folder):
```
pages/student-quiz-attempt/
  StudentQuizAttemptPage.tsx    Route entry. Thin: composes components and wires hooks
  components/                   Only used by this page. One component per file
  hooks/                        Page-scoped hooks
  copy.ts                       The page's text (all user-visible strings)
  types.ts                      Page-only types
  StudentQuizAttemptPage.test.tsx
```

Import rules:
1. A page may import from shared/ and from its own folder. Never from another page.
2. shared/ never imports from pages/.
3. If two pages need the same thing, promote it to shared/ (ui, layout, effects, domain) at that moment. Not before.
4. app/ contains wiring only (providers, router). No UI logic and no data calls.
5. One component per file; the file name matches the export; named exports only.
6. A page's data access goes through shared/lib/api modules only. No raw supabase calls in components.

---

## 4. DATA LAYER

- One Supabase client singleton. Types are generated from the database (`supabase gen types`) and committed as database.types.ts. Nobody hand-writes table types.
- shared/lib/api has one module per backend domain (the domains are listed in the contract). Each module exports typed query hooks (read), mutation hooks (write), the Zod schemas for server function inputs and outputs, and a query key factory.
- Reads use tables, views and RPC functions as defined in the contract. Writes that carry business rules go through server functions or RPC (never direct table writes), as the contract specifies.
- Query keys: `[domain, entity, params]`. Mutations invalidate by domain. staleTime defaults: lists 30 s, details 60 s, configuration 5 min, anything gamified (xp, quests, coins) 10 s plus refetch on window focus.
- Optimistic updates only where the backend is the same result by definition (toggle a star, mark a notification read). Rewards, scores, purchases and grades are NEVER optimistic: the UI waits for the backend result and then plays the animation with the real numbers.
- Pagination is keyset-based (cursor), 25 items by default; tables use "Load more" or pages as the page spec says.
- Errors are normalized into the contract error model (code, message, request id) and mapped to the shared error, empty and limit states (feature off, limit reached, safety blocked).
- Streaming (AI conversation): a streaming client reads Server-Sent Events from the AI functions and exposes a hook per use (Tutor, Copilot, writing feedback). Cancel on unmount; reconnect not automatic (user retries).
- Jobs (AI generation, imports, rollover, reports): a job tracker hook subscribes to the job row through Realtime and falls back to polling every 3 s if the socket drops. The UI shows progress per step and never blocks.
- File uploads go through one upload helper (type and size validation, progress, cancel, signed URLs for private files).
- Autosave (activities, assignments, builders, drafts): a debounced hook (about 1.5 s) writes to the backend; while offline or failing it keeps the draft in IndexedDB, shows "Saved on this device", and syncs when the connection returns. Conflicts use the updated_at version check; the user sees "This changed elsewhere" with Keep mine or Use theirs.
- Time: the server time is the authority for timers, deadlines and unlocks. The client reads the server offset once and uses it for countdown displays.
- No business rules in the client: XP, coins, levels, streaks, quests, badges, leaderboards, scoring, unlock rules, purchase checks, limits and permissions all come from the backend. The client displays and animates the results.

---

## 5. AUTH, ROUTING AND GUARDS

- AuthProvider holds the Supabase session, the profile (role, admin level, flags) and the platform state (maintenance, features). It exposes `useAuth`.
- Sign-in uses a server function (username and password; see contract). The session is a normal Supabase session after that.
- The route table lists for each route: path, lazy page, allowed roles (and admin level), color world, transition style, and whether it is a focused layout.
- Guards implement SHARED-SPEC section 6 in order: maintenance, signed out, archived, must change password, wrong role, missing permission.
- Idle timeout dialog and sign-out everywhere follow SHARED-SPEC section 7. Focused flows pause the idle timer.
- Features and limits (AI on or off, games on or off, shop on or off) come from the backend settings and are read through one `useFeatures` hook. Components never read environment flags for product features.

---

## 6. STATE, FORMS AND URL

- Server data lives in TanStack Query only.
- UI-only state lives in small Zustand stores: effects tier, sound, sidebar, focused flow session (quiz timer display, answers draft), celebration queue, theme preview.
- Forms use React Hook Form with Zod schemas; the schema file sits next to the form and doubles as its type.
- Filters, sorting, tabs and pagination live in the URL (search params) so pages are shareable and back works.

---

## 7. STYLING

- tailwind.config.ts and tokens.css are generated from GLOBAL-STYLES section 3 (worlds, neutrals, semantic colors), section 5 (type scale), section 6 (strokes, shadows, shapes, spacing).
- Pages set `data-world` on their root. Themes set all world variables at once.
- No inline `style` except computed values (progress widths, drag transforms, CSS variable values for dynamic worlds).
- No component is restyled per page. Pages compose shared components.

---

## 8. PERFORMANCE

- Every page is a lazy route chunk. Heavy libraries (Rive, Howler, confetti, three, Recharts, Tiptap) load only when needed.
- Budgets and rules: GLOBAL-STYLES section 9. CI fails the build if a route chunk exceeds its budget or the lazy 3D chunk exceeds 250 KB gzipped.
- The effects governor (GLOBAL-STYLES section 8.9) is part of the shell and runs on every page.

---

## 9. TESTING AND QUALITY

- Components and hooks: Vitest and React Testing Library, colocated.
- Critical flows end to end with Playwright against the dev backend with seeded data: sign in and redirect, set new password, quiz attempt and submit, assignment autosave and submit, grading and confirm, shop purchase, quest claim, class enrollment, AI Tutor streaming, course generation job.
- Accessibility: axe checks in component tests and in the Playwright flows; keyboard-only passes; reduced motion pass.
- Dev pages: /dev/styleguide (every token, shape, component state) and /dev/motion (every animation, a frame meter, a tier switcher, sound test). They are excluded from production builds.
- CI runs: typecheck, lint, unit tests, build, bundle budget check. End to end tests run on the dev backend nightly and before release.

---

## 10. ENVIRONMENT AND CONFIGURATION

- Public variables only, in .env.local: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_APP_ENV (development, staging, production).
- No secret ever reaches the client. AI provider keys and the Supabase service role key exist only in the backend.
- Product feature switches come from the backend (platform settings), not from a local file. A development-only override panel can force flags locally.
- Dev accounts and seed data come from the backend seed (see the contract). The login page in development builds shows the dev accounts panel.

---

## 11. MIGRATION CHECKLIST (DO ONCE)

1. Delete frontend/docs.
2. Move the docs from this package into project-tasks (00 to 07 and README.md).
3. Delete package-lock.json and install with pnpm.
4. Remove the landing mock: frontend/src/pages/landing and its assets are removed when PUB-B starts. The logo file stays unchanged.
5. Replace tailwind.config.ts and globals.css from the global styles spec (task FND-B).
6. Remove i18n and Supabase placeholder providers that mock behavior. Keep AuthProvider and QueryProvider as the real wiring (task FND-C).
7. Create the backend directory with its own docs; the first backend document is the answer to 07-contract.

---

## 12. OPEN DECISIONS

- Shared contract package: keep Zod schemas for server functions in the frontend only, or in a shared package that both the frontend and the Edge Functions import (recommended if the repo becomes a pnpm workspace).
- Storybook: not planned (dev pages cover it). Add only if the team wants isolated component work.
- Analytics and error reporting (for example Sentry): not planned in v1; decide before launch.
