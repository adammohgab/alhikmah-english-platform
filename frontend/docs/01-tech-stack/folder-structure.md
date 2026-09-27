# Frontend Folder Structure — Page-Alone

Principle: **one page = one folder.** Everything a page needs lives inside
that page's folder. If you delete `pages/hero`, the hero page is gone and
nothing else breaks. If you want to build the hero page, you only open
`pages/hero`.

```
src/
├── app/
│   ├── App.tsx              # Root: providers + router only, no UI logic
│   ├── router.tsx           # Route table: path -> pages/*, role guards live here
│   ├── main.tsx
│   └── providers/
│       ├── AuthProvider.tsx
│       ├── QueryProvider.tsx
│       └── I18nProvider.tsx
│
├── pages/                   # One folder per route-level page. Flat, no nesting.
│   ├── hero/                # "/" — full landing/hero experience (worked example below)
│   ├── courses/
│   ├── lesson/
│   ├── skills-practice/
│   ├── tests/
│   ├── results/
│   ├── assignments/
│   ├── ai-tutor/
│   ├── games/
│   ├── magazine/
│   ├── announcements/
│   ├── dashboard/           # Student progress / "Your Journey"
│   ├── login/               # Auth page
│   ├── class-overview/      # Teacher pages:
│   ├── course-editor/       # (each gets its own folder, same template)
│   ├── test-builder/
│   ├── question-bank/
│   ├── grade-submissions/
│   ├── school-overview/     # Supervisor pages:
│   ├── class-reports/
│   └── manage-users/
│
└── shared/                  # Only what is used by 2+ pages. Nothing page-specific.
    ├── ui/                  # Generic primitives (one file per component, named exports)
    │   ├── Button.tsx
    │   ├── Card.tsx
    │   ├── Input.tsx
    │   ├── Select.tsx
    │   ├── Badge.tsx
    │   ├── Table.tsx
    │   ├── Modal.tsx
    │   ├── Tabs.tsx
    │   ├── Tooltip.tsx
    │   ├── Toast.tsx
    │   ├── ProgressBar.tsx
    │   ├── Avatar.tsx
    │   ├── EmptyState.tsx
    │   └── Skeleton.tsx
    ├── layout/              # Site-wide shell
    │   ├── Navbar.tsx
    │   ├── Footer.tsx
    │   ├── AppShell.tsx
    │   ├── Sidebar.tsx
    │   ├── TopBar.tsx
    │   └── MobileTabBar.tsx
    ├── assets/              # Shared static assets (logo, brand)
    │   └── logo.png         # School logo, used by Navbar
    ├── domain/              # Product components shared by 2+ pages
    │   ├── course/          # e.g. CourseCard (used by hero + courses + dashboard)
    │   ├── test/            # e.g. QuestionRenderer, Timer
    │   ├── reports/         # e.g. ScoreTrendChart, SkillRadar
    │   ├── ai-tutor/        # e.g. TutorMessageBubble
    │   └── games/           # e.g. GameCard
    ├── lib/
    │   ├── supabase/
    │   │   ├── client.ts
    │   │   └── types.ts     # Generated DB types
    │   ├── api/             # React Query hooks grouped by domain
    │   │   ├── courses.ts
    │   │   ├── tests.ts
    │   │   ├── assignments.ts
    │   │   ├── reports.ts
    │   │   ├── users.ts
    │   │   └── ai.ts
    │   ├── auth/
    │   │   ├── useAuth.ts
    │   │   └── roles.ts
    │   ├── content/
    │   │   ├── contentTypes.ts  # Grade/Term/Unit/Lesson/Activity/Assessment types
    │   │   └── skills.ts        # Reading/Writing/Listening/Speaking/Grammar/Vocabulary config
    │   └── utils/
    │       ├── formatDate.ts
    │       ├── formatScore.ts
    │       └── cn.ts
    ├── stores/              # Zustand — client-only UI state
    │   ├── testSessionStore.ts
    │   ├── sidebarStore.ts
    │   └── aiTutorStore.ts
    ├── styles/
    │   └── globals.css
    ├── locales/
    │   ├── en/
    │   └── ar/
    └── types/
        └── shared.ts        # Cross-cutting types (Role, User, ApiError...)
```

## Page template — every folder under `pages/` looks the same

```
pages/hero/
├── HeroPage.tsx        # Route entry. Thin: composes components + wires hooks. No raw fetch.
├── components/         # ONLY used by this page. One component per file, named exports.
│   ├── HeroCarousel.tsx
│   ├── MagazineSlide.tsx
│   ├── GameSlide.tsx
│   ├── TutorSlide.tsx
│   ├── CourseSlide.tsx
│   ├── CarouselControls.tsx
│   ├── ScrollInvitation.tsx
│   ├── PlatformIntro.tsx
│   ├── CoursesSection.tsx
│   ├── SkillsSection.tsx
│   ├── TestsSection.tsx
│   ├── AssignmentsSection.tsx
│   ├── TutorSection.tsx
│   ├── GamesSection.tsx
│   ├── MagazineSection.tsx
│   ├── AnnouncementsSection.tsx
│   ├── ProgressSection.tsx
│   └── FinalCta.tsx
├── hooks/              # Page-scoped hooks. Shared hooks live in shared/lib.
│   ├── useHeroCarousel.ts      # 10s autoplay, pause-on-interact, 700–1200ms transition
│   ├── useScrollNavbar.ts      # transparent over hero, hide on scroll-down, show on scroll-up
│   └── useHeroContent.ts       # React Query read for featured slides (magazine/game/course)
├── data.ts             # Page copy, slide order, section order. No business logic.
├── types.ts            # Page-only types. Shared types live in shared/types/shared.ts.
├── styles.css          # Optional. Page-scoped overrides only. Tokens come from shared/styles.
└── HeroPage.test.tsx   # Optional. Colocated test for this page only.
```

Any other page follows the exact same shape, e.g.:

```
pages/games/
├── GamesPage.tsx
├── components/         # GameCard grid, GamePreview, ScoreCounter — only for this page
├── hooks/              # useGames, useGameSession
├── data.ts
├── types.ts
└── GamesPage.test.tsx

pages/magazine/
├── MagazinePage.tsx
├── components/         # MagazineReader, PageSpread — only for this page
├── hooks/              # useMagazineIssue
├── data.ts
└── types.ts
```

## Import rules

1. A page may import from `shared/*` and from its own folder. Never from another page:
   ```ts
   // inside pages/hero/* — GOOD
   import { Button } from "@/shared/ui/Button";
   import { Navbar } from "@/shared/layout/Navbar";
   import { useHeroCarousel } from "../hooks/useHeroCarousel";

   // inside pages/hero/* — BAD
   import { GameCard } from "@/pages/games/components/GameCard";
   ```
2. `shared/*` may never import from `pages/*`. If two pages need the same thing,
   promote it to `shared/ui`, `shared/layout`, or `shared/domain` — don't
   cross-import between pages.
3. `app/*` imports pages and shared only for wiring (providers, router). No UI
   logic, no fetch calls, no business logic in `app/`.

## Rules

- Page entry (`<Name>Page.tsx`) is thin: it composes `components/` and wires
  `hooks/` + `shared/lib/api/*`. No raw fetch, no business logic that belongs
  in `shared/lib/`, no copy-paste Tailwind soup that belongs in `shared/ui/`.
- Colocate aggressively: hooks, types, copy/data, styles, tests, and assets a
  page needs live in that page's folder — not in `shared/`.
- `shared/` holds only what 2+ pages (or `app/`) actually use: `Navbar`,
  `Footer`, primitives, api clients, stores, tokens, locales.
- One component per file. File name matches export name. Named exports only,
  no default exports.
- Deleting `pages/<name>/` must remove that page completely with no orphans
  elsewhere.

## Adding a new page — checklist

1. Create `pages/<page-name>/` from the template above.
2. Add the route in `app/router.tsx` (path + role guard). Roles live in the
   router, not in folder nesting — folders stay flat.
3. Build with `shared/ui` + `shared/layout` first; add page-local components
   only for what doesn't exist in shared.
4. If you build something a second page will need, promote it to `shared/`
   at that point — not before.
