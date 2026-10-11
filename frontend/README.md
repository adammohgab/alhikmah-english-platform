# Frontend — Al Hikmah English Platform

React + TypeScript single-page app for the Al Hikmah English learning platform. Built with Vite 5, deployed to GitHub Pages from `frontend/dist`.

## Tech stack

- Language: TypeScript (strict), React 18 (function components + hooks)
- Build: Vite 5, `tsc --noEmit` typecheck on build
- Routing: React Router v6 (`createBrowserRouter`)
- Styling: Tailwind CSS 3.4 + PostCSS + Autoprefixer
- Animation/scroll: GSAP 3.12, Lenis 1.1
- Icons: Lucide React
- Package manager: pnpm 9
- Path alias: `@/*` maps to `src/*` (see `tsconfig.json`, `vite.config.ts`)

Full v1 target stack (Supabase, TanStack Query, Zustand, Radix, forms, testing) is defined in `docs/ARCHITECTURE.md`. Only the packages listed in `package.json` are installed right now.

## Prerequisites

- Node.js >= 20 and pnpm >= 9 (enforced by `engines` in `package.json` with `engine-strict=true` in `.npmrc`)
- Enable Corepack so the `packageManager` pin is respected: `corepack enable`

## Getting started

```bash
cd frontend
pnpm install
pnpm dev
```

Dev server runs on http://localhost:5173.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start Vite dev server |
| `pnpm build` | Typecheck (`tsc --noEmit`) then production build to `dist/` |
| `pnpm preview` | Serve the production `dist/` build locally |
| `pnpm test` | Run Vitest (`vitest run`) |

## Project structure

Mirrors `docs/ARCHITECTURE.md` §3 ("Page Alone"):

```
frontend/
  index.html              Entry HTML, mounts #root, loads src/app/main.tsx
  vite.config.ts          base "/alhikmah-english-platform/", @ alias, dev port 5173
  tailwind.config.ts      Design tokens (navy/gold/ink/surface + student accents)
  postcss.config.js       tailwindcss + autoprefixer
  tsconfig.json           Strict TS, bundler resolution, @/* paths
  .npmrc                  engine-strict=true
  src/
    app/
      main.tsx            createRoot entry, imports global CSS
      App.tsx             Providers (Auth, Query, I18n) + RouterProvider
      router.tsx          Route table: path, lazy page, role guard, world, transition
      providers/          AuthProvider, QueryProvider, I18nProvider
    pages/                One folder per route-level page (flat), see convention below
    shared/
      ui/                 Primitives (Button, Input, Dialog, ...), one file per component
      layout/             AppShell, headers, footers, page bands
      effects/            ShapeFrame, Sticker, Grain, TiltCard, ...
      motion/             Lenis integration, transitions, scroll helpers
      audio/              Sound provider, sprite loader, sound map
      domain/             Components shared by 2+ pages
      lib/
        supabase/         client.ts, generated database types
        api/              One module per backend domain (queries, mutations, Zod)
        ai/               Streaming client, job tracker
        auth/             Session hooks, role helpers, guards
        utils/            cn.ts, format and time zone helpers
      stores/             Zustand stores
      styles/             globals.css, tokens.css, worlds.css, themes/
      assets/             Fonts, logo (unchanged), stickers, sprites
      types/              Cross-cutting types
    dev/                  Dev-only pages (/dev/styleguide, /dev/motion)
    vite-env.d.ts
  dist/                   Build output (gitignored, published to Pages)
```

Empty directories are kept with a `.gitkeep` until their task fills them.

## Page Alone convention

From `docs/ARCHITECTURE.md` §3: **one page equals one folder.** Everything only that page needs lives in its folder — deleting the folder removes the page completely.

- `pages/` is flat: one folder per route-level page, named `<role>-<page>` (for example `public-landing`, `student-quiz-attempt`, `teacher-grading`, `admin-users`).
- Every page folder follows the same template:

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

1. A page may import from `shared/` and from its own folder. Never from another page.
2. `shared/` never imports from `pages/`.
3. If two pages need the same thing, promote it to `shared/` (ui, layout, effects, domain) at that moment. Not before.
4. `app/` contains wiring only (providers, router). No UI logic and no data calls.
5. One component per file; the file name matches the export; named exports only.
6. A page's data access goes through `shared/lib/api` modules only. No raw supabase calls in components.

## Routing and base path

- `vite.config.ts` sets `base: "/alhikmah-english-platform/"` for project Pages hosting.
- `router.tsx` sets `basename: import.meta.env.BASE_URL` so routes work under that subpath.
- Pages are registered in `router.tsx` as they are built (first: `public-landing`, task PUB-B). Until then the route table has no page routes.

## Styling

- Tokens live in `tailwind.config.ts`: brand navy/gold, neutrals (ink/line/surface), semantic (success/warning/danger/info), plus bright student accents (`spark/coral/sky/violet`).
- Fonts (in `index.html`): Inter + Source Serif 4.
- No CSS-in-JS, no backdrop-blur decoration.

## Environment variables

No `.env` files are committed. The v1 backend contract expects these public vars when Supabase wiring lands (see `docs/ARCHITECTURE.md` §10):

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_ENV=development
```

No secrets go in the client.

## Deployment

Push to `main` triggers `.github/workflows/deploy.yml`:

1. `pnpm install --frozen-lockfile` + `pnpm build` in `frontend/`
2. `cp dist/index.html dist/404.html` (SPA fallback) + `touch dist/.nojekyll`
3. Upload `frontend/dist` and deploy to GitHub Pages

## Docs

- `docs/ARCHITECTURE.md` — tech stack, folder/import rules, data/auth/routing plan
- `docs/01-styles/GLOBAL-STYLES-SPEC.md` — visual and motion spec
- `docs/02-public/SHARED-SPEC.md` — shared/public pages spec
- `docs/03-student/STUDENT-SPEC.md`, `docs/04-teacher/TEACHER-SPEC.md`, `docs/05-admin/ADMIN-SPEC.md` — role specs
