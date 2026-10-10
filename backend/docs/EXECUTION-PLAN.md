# PARALLEL EXECUTION PLAN (v2 DRAFT)

Status: v2. Replaces v1 (which assumed Next.js and mock data). This is the plan for how the task files will be created. The tasks themselves are generated after the frontend docs are approved and before the backend docs phase starts, one phase at a time.
Inputs: frontend/docs/ARCHITECTURE.md, frontend/docs/01-styles/GLOBAL-STYLES-SPEC.md, frontend/docs/02-public/SHARED-SPEC.md, frontend/docs/03-student/STUDENT-SPEC.md, frontend/docs/04-teacher/TEACHER-SPEC.md, frontend/docs/05-admin/ADMIN-SPEC.md, docs/shared/*.
Team: 2 to 3 frontend people working in parallel; the backend is built by a separate team in parallel. Task size: small (1 to 2 hours, one component or one simple page section).
Claim tracker: DEFERRED (decided later). Task files are designed so the tracker can be added without rewriting any task.
Deployment: GitHub Actions (see ARCHITECTURE section 12).

---

## 1. PRINCIPLES

1. The specs are the source of truth. A task never repeats the spec. It points to the exact spec section and says what to build and when it is done.
2. No boilerplate. The generic rules (design system compliance, states, responsive, accessibility, performance, tests, PR checklist) live ONCE in project-tasks/CONTRIBUTING.md. Task files contain only what is specific to that task.
3. One task = one PR = one owner.
4. Tasks declare the files they own. Two open tasks never own the same file.
5. Every task lists its dependencies by ID. A task is AVAILABLE only when every dependency is merged AND its backend gate (if any) has been reached.
6. REAL DATA ONLY. There is no mock data in the product. Pages read and write through the API layer against the dev backend with seeded data. If something the page needs is not in the backend yet, the task waits for its backend gate (it is never faked).
7. Shared pieces (tokens, styles and effects layer, primitives, shells, API hooks) are finished before the pages that use them, so pages are not reworked.
8. Motion and sound are part of "done." A page task is not finished until its interactions and animations from GLOBAL-STYLES (and its page spec) work, respect the effects tiers, and run within the performance budget.

---

## 2. TASK ID SCHEME

| Prefix | Area |
|---|---|
| FND | Foundation (scaffold, tooling, tokens, infrastructure) |
| API | Data access layer: typed query and mutation hooks, Zod schemas, streaming and job clients |
| STY | Styles and effects layer: worlds, themes, shapes, motion, sound, celebrations, 3D, dev pages |
| UIK | Shared UI kit (components styled per GLOBAL-STYLES section 10) |
| PUB | Public and shared pages (SHARED-SPEC) |
| STU | Student core |
| STP | Student practice, AI Tutor, games, rewards |
| TCH | Teacher core |
| TCB | Teacher builders and AI layer |
| ADM | Admin |
| INT | Integration, art and content integration, quality passes |
IDs never change. Example: STU-014. File name: STU-014-quiz-start-page.md.

---

## 3. TASK FILE FORMAT

```
---
id: STU-014
title: Quiz start page
phase: 4
block: STU-C Quizzes
spec: STUDENT-SPEC ST-08
rules: docs/shared/ECONOMY-AND-GAMES §3      # optional pointer to a rulebook section
size: S                  # S about 1 hour, M about 2 hours
depends_on: [UIK-020, UIK-041, API-017, STY-010]
backend_gate: BG2        # optional; the task is available only after the gate is reached
owns:
  - frontend/src/pages/student-quiz-start/**
status: todo             # todo | claimed | in-progress | in-review | done
claimed_by:
claimed_at:
pr:
---

## Build
Two to six lines saying exactly what to build, pointing at the spec section.

## Done when
- 3 to 6 checks specific to this task (including the motion and states that apply).

## Notes (optional)
```
Status lifecycle: todo, claimed, in-progress, in-review (PR open), done (merged). "Blocked" is derived (a dependency is not done or the backend gate is not reached).

Backend gates (defined in backend/docs/13-ROADMAP-AND-GATES.md; named here so tasks can reference them):
- BG0: environments and CI, authentication, profiles and roles, school structure (years, classes, enrollment, rules), platform settings, basic user administration, seeded dev accounts.
- BG1: curriculum and content (courses, units, lessons, snapshots, publishing, media), progress, practice libraries, the XP core (ledgers, levels, streaks).
- BG2: assessments (quizzes, assignments, attempts, grading), quests, badges, leaderboards, games, certificates, bonus and class quests.
- BG3: shop, avatar and themes, announcements, notifications, Realtime, search, reports.
- BG4: AI (streaming conversations, jobs, action cards, limits and metering, safety, text to speech).
- BG5: admin operations (imports, rollover, moderation, configuration governance, view-as, audit, usage dashboards) and hardening.

---

## 4. PHASES AND BLOCKS

Estimated task counts are approximate; they become exact on generation.

### Phase 0: FND Foundation (about 16 tasks, first)
- FND-A Scaffold (existing Vite project): remove the landing mock and frontend/docs, switch to pnpm, TypeScript strict, ESLint and Prettier, path aliases, Vitest and React Testing Library, Playwright, GitHub Actions workflows (ci, preview, e2e), environment handling.
- FND-B Tokens: tailwind.config and tokens.css generated from GLOBAL-STYLES (worlds, neutrals, semantic colors, type scale, strokes, shadows, breakpoints), fonts (Fredoka, Figtree, Caveat, Arabic fonts), base CSS and the global focus ring.
- FND-C Infrastructure: Supabase client and type generation script, AuthProvider and the route table with guards (SHARED-SPEC section 6), QueryProvider and error normalization, toast and dialog providers, features hook (platform settings from the backend).
Gate G0: all FND tasks merged.

### Phase 1: API Data access layer (about 34 tasks, after FND-C)
One module per backend domain with typed queries, mutations, Zod schemas, query keys and tests: identity and school structure; curriculum, content and progress; questions and assessments and grading; gamification, shop, leaderboard and games; communication, notifications and Realtime; AI (streaming client, job tracker, action cards, usage and limits); teacher tooling (classes, rules, reports, planner, support plans); admin operations (users, import, rollover, moderation, settings, audit, view-as); storage, uploads, autosave, search helpers.
These tasks implement against the backend's generated types and the contract. When a domain's backend gate is not reached, its API task waits.
Gate G1: the API modules a page needs are merged (pages depend only on the modules they use).

### Phase 2: STY Styles and effects layer (about 38 tasks, after FND-B)
- STY-A Worlds and shapes: WorldProvider (data-world and the morph), ThemeProvider (full re-skin and starters), ShapeFrame, Sticker, Squiggle (self-drawing), Grain and Halftone layers, Marquee.
- STY-B Motion core: Lenis provider integrated with the GSAP ticker, EffectsProvider (tiers and the frame governor), SplitReveal, scroll progress sticker, parallax helper, TransitionOutlet (per-area wipes and Flip morphs).
- STY-C Interaction: CursorLayer, MagneticWrap, TiltCard, press and hover behaviors, form control animations.
- STY-D Feedback: SoundProvider (Howler sprites, mute control), ConfettiProvider, celebration queue (Small, Medium, Large), Rive host, R3F Stage (lazy, with fallbacks), haptics.
- STY-E Placeholder assets: sticker pack placeholders from the shape system, Pip and Nova placeholder Rive files, sound sprite placeholders, 3D placeholders (real art arrives in INT).
- STY-F Dev tools: /dev/styleguide and /dev/motion.
Gate G2a: STY-A, STY-B (except transitions), and FND-B merged.

### Phase 3: UIK Shared UI kit (about 55 tasks, after STY-A)
- UIK-A Primitives: Button, IconButton, Chip, Badge, Avatar, Tabs, Segmented control, Tooltip, Skeleton, ProgressBar, ProgressRing, EmptyState, ErrorState.
- UIK-B Forms: Field wrapper, Input, Textarea, Select, Checkbox, Radio, Switch, PasswordField, SearchField, rich text lite (Tiptap), date and time pickers.
- UIK-C Overlays and feedback: Dialog, Drawer, Dropdown, Toast, InlineAlert, ConfirmDialog (typed confirmation and impact preview).
- UIK-D Data display: Table (sort, select, bulk bar), Pagination, FilterBar, Accordion, Timeline, Calendar, Stat tile.
- UIK-E Charts: bar, line, histogram, stacked bars, heat table, each with a "view as table" alternative.
- UIK-F Shells: student, teacher and admin AppShells (sidebar, top bar, mobile tab bar), PublicHeader, PublicFooter, AuthCard, ErrorPageTemplate, focused-flow layout, page header band, view-as banner.
- UIK-G Gamification components: BadgePlate, XpBar, LevelChip, StreakFlame, CoinCount, SkillChip, QuestCard, BadgeTile, LeaderboardRow, ShopItemCard, ThemePreview, CelebrationDialog.
- UIK-H Learning and assessment components: CourseCard, UnitRow, LessonRow, ActivityRow, DeadlineRow, QuestionRenderer (one task per type), QuestionNavigator, TimerPill, ResultSummary, FeedbackBlock.
- UIK-I AI components: ChatMessage, ChatInput, TypingIndicator, PromptSuggestionChips, AI action card, Copilot panel shell.
Gates: G2b = UIK-A, UIK-B, UIK-C merged; G2c = UIK-F merged.

### Phase 4: PUB Public and shared pages (about 32 tasks)
PUB-A Auth (sign-in, forgot password, set new password, account not active, guard behavior, idle timeout dialog, view-as banner behavior); PUB-B Landing (one task per section, hero art, scroll storytelling); PUB-C Info pages (help, FAQ, legal, about); PUB-D System pages (404, error, offline, maintenance, no access). Backend gate: BG0.

### Phase 5: STU Student core (about 78 tasks)
STU-A Shell and dashboard; STU-B Courses and lessons; STU-C Quizzes; STU-D Assignments; STU-E Account (notifications, profile and avatar editor, settings, certificates). Backend gates: BG1 and BG2.

### Phase 6: STP Student practice, AI, games and rewards (about 62 tasks)
STP-A Practice tools (five tools); STP-B AI Tutor; STP-C Games (selection, shell, seven games, results; rules in ECONOMY-AND-GAMES section 9); STP-D Rewards (quests, leaderboard, achievements, shop, celebrations). Backend gates: BG2, BG3, BG4.

### Phase 7: TCH Teacher core (about 62 tasks)
TCH-A Dashboard and classes (roster, enrollment, rules, rewards); TCH-B Students; TCH-C Work and results (assignments, quizzes, announcements); TCH-D Grading (queue, screen, grade history); TCH-E Reports and print; TCH-F Account. Backend gates: BG0, BG2, BG3.

### Phase 8: TCB Teacher builders and AI layer (about 72 tasks)
TCB-A Course building; TCB-B Assessment builders and the question bank; TCB-C AI core (action cards, Copilot, suggested actions, AI settings and log); TCB-D AI workflows (course wizard, planner, support plans, per-page AI buttons). Backend gates: BG1, BG2, BG4.

### Phase 9: ADM Admin (about 118 tasks)
ADM-A People (users, create, CSV import, rollover, classes, view-as); ADM-B Learning (curriculum, AI curriculum wizard, content, editor, moderation); ADM-C Engagement (XP rules, quests and badges, shop, avatar studio, themes studio, leaderboard moderation); ADM-D AI governance (features and limits, safety and instructions, usage and cost, log); ADM-E System (dashboard, announcements, reports, audit, settings, admins and roles, notifications). Backend gates: BG1 to BG5.

### Phase 10: INT Integration and polish (about 28 tasks)
INT-A Cross-spec verification (walk every spec's page list against the built app); INT-B Art and content: sticker pack, Pip and Nova Rive files, sound sprites, 3D models, the ten purchasable themes (one task each), FAQ and copy pass; INT-C Quality passes: responsive per role, accessibility per role, effects-tier and reduced-motion pass, performance budget pass, print stylesheets, Playwright end to end flows, demo scenarios against the seeded backend.

Estimated total: about 595 tasks.

---

## 5. PARALLEL LANES

Weeks 1 to 3 (foundation, API, styles, kit), three people:
- Person 1: FND-A, FND-C, then API modules, then UIK-F shells.
- Person 2: FND-B, then STY-A and STY-B, then UIK-A to UIK-C.
- Person 3: STY-C to STY-F, then UIK-D to UIK-E and the gamification and assessment components (UIK-G, UIK-H), with UIK-I shared.
After the gates (lanes, by default):
- Lane 1 Student: STU then STP.
- Lane 2 Teacher: TCH then TCB.
- Lane 3 Public and Admin: PUB then ADM, then INT.
With two people: Lane 1 takes Student and half of Admin; Lane 2 takes Teacher, Public and the other half of Admin.
Anyone can pick any available task at any time. Lanes reduce merge conflicts and context switching; they are not a rule.
Rough effort: about 595 tasks at about 1.5 hours is about 890 working hours. At about 25 productive hours per person per week that is about 12 weeks for three people or 18 weeks for two. Estimates are tuned after the first three weeks. The backend runs on its own timeline; tasks are paced by the backend gates.

---

## 6. CONFLICT AVOIDANCE

1. One page equals one folder (ARCHITECTURE section 3), so page tasks never touch the same files. The router (frontend/src/app/router.tsx) is edited by a dedicated route-registration task per page group, not by each page task.
2. Shared components are owned by exactly one UIK, STY or API task. A page task that needs a change in a shared component creates a small new task or asks the owner.
3. Tailwind config, tokens.css and the theme files are owned by FND-B and STY-A only.
4. Every task lists `owns` paths. If a task needs a file owned by another open task, it waits or splits.
5. Large pages are split by SECTION (each section component is a task) plus one small "assemble the page" task.
6. API modules are owned one per domain; page tasks only import them.

---

## 7. PR AND REVIEW FLOW

- Branch: task/{ID}-short-name. One task, one PR.
- The PR template asks for: the task ID, desktop and mobile screenshots, a short screen recording for any motion, the "Done when" checklist, and which effects tier was tested.
- A teammate reviews every PR against the spec section and GLOBAL-STYLES, not against taste.
- Squash merge. A task is done when merged.
- ci.yml (typecheck, lint, tests, build, bundle budget) must pass.
- Generic quality rules are in project-tasks/CONTRIBUTING.md and are not repeated in tasks.

---

## 8. CONTRIBUTING.MD (CONTENT THAT WILL BE GENERATED WITH THE TASKS)

The one shared file every task points to. It will state: follow GLOBAL-STYLES (outline, shadow, shape, world, typography, no gradients, decoration budget); use shared components, never restyle per page; real data through the API layer only; implement loading, empty, error, feature-off and limit-reached states; responsive at mobile and desktop; keyboard and focus; screen reader labels; reduced motion and effects tiers; sound hooks where the spec says; performance rules (animate transform and opacity only, lazy heavy libraries, no layout shift); tests (unit, accessibility check); PR checklist.

---

## 9. TRACKER (DEFERRED)

The tracker reads the task files (id, title, phase, block, depends_on, backend_gate, status, claimed_by, claimed_at, pr). It must show: all tasks with status, who claimed what, which are available (dependencies done and gate reached), which are blocked and by what (including backend gates), per phase and per person progress, and a dependency view. The implementation (a file in the repo, a small web board, or GitHub Issues and Projects) is chosen later.

---

## 10. DECISIONS

1. Libraries: Lucide, Recharts, dnd-kit, Tiptap, Radix, Motion, GSAP, Lenis, Rive, Howler, canvas-confetti, three and react-three-fiber (see ARCHITECTURE section 2).
2. Package manager: pnpm. Routing: React Router v6 data router. Backend: Supabase from the client plus server functions.
3. Generate tasks phase by phase, starting with FND, API, STY and UIK so the team can start while later phases are written.
4. Task folders: project-tasks/phase-0-FND/, phase-1-API/ and so on, one file per task, plus project-tasks/INDEX.md with the dependency table.
5. Real art (stickers, Pip and Nova, sounds, 3D) is produced in parallel; until it exists the placeholders from STY-E are used and INT-B swaps them in.
