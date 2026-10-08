# Frontend — Al Hikmah English Platform

React + TypeScript single-page app for the Al Hikmah English learning platform. Built with Vite 5, deployed to GitHub Pages from `frontend/dist`.

## Tech stack

- Language: TypeScript (strict), React 18 (function components + hooks)
- Build: Vite 5, `tsc --noEmit` typecheck on build
- Routing: React Router v6 (`createBrowserRouter`)
- Styling: Tailwind CSS 3.4 + PostCSS + Autoprefixer
- Animation/scroll: GSAP 3.12, Lenis 1.1
- Icons: Lucide React
- Path alias: `@/*` maps to `src/*` (see `tsconfig.json`, `vite.config.ts`)

Full v1 target stack (Supabase, TanStack Query, Zustand, Radix, forms, testing) is defined in `docs/ARCHITECTURE.md`. Only the packages listed in `package.json` are installed right now.

## Prerequisites

- Node.js 20 (matches `.github/workflows/deploy.yml`)
- npm (repo currently uses `package-lock.json`)

## Getting started

```bash
cd frontend
npm ci
npm run dev
```

Dev server runs on http://localhost:5173.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Typecheck (`tsc --noEmit`) then production build to `dist/` |
| `npm run preview` | Serve the production `dist/` build locally |
| `npm test` | Run Vitest (`vitest run`) |

## Project structure

```
frontend/
  index.html              Entry HTML, mounts #root, loads src/app/main.tsx
  vite.config.ts          base "/alhikmah-english-platform/", @ alias, dev port 5173
  tailwind.config.ts      Design tokens (navy/gold/ink/surface + student accents)
  postcss.config.js       tailwindcss + autoprefixer
  tsconfig.json           Strict TS, bundler resolution, @/* paths
  src/
    app/
      main.tsx            createRoot entry, imports global + landing CSS
      App.tsx             Providers (Auth, Query, I18n) + RouterProvider
      router.tsx          Route table (currently "/" and "*" -> HeroPage)
      providers/          AuthProvider, QueryProvider, I18nProvider
    pages/
      landing/            Current landing/hero page (mock per docs/ARCHITECTURE.md)
        HeroPage.tsx
        components/       Carousel, slides, games, tutor, sections
        hooks/            useHeroCarousel, useLenis, useInView,
                          usePrefersReducedMotion, useScrollNavbar
        data.ts / types.ts / styles.css
    shared/
      layout/             Navbar, Footer
      ui/                 Button (shared primitives)
      lib/utils/cn.ts     Class-name helper
      styles/globals.css  Global styles
      assets/logo.png     School logo (must stay unchanged)
    vite-env.d.ts
  docs/                   Specs only, not shipped (see below)
  dist/                   Build output (gitignored, published to Pages)
```

Import rules (from `docs/ARCHITECTURE.md`): pages import from `shared/` and their own folder only, never from another page; `shared/` never imports from `pages/`; `app/` is wiring only (providers, router).

## Routing and base path

- `vite.config.ts` sets `base: "/alhikmah-english-platform/"` for project Pages hosting.
- `router.tsx` sets `basename: import.meta.env.BASE_URL` so routes work under that subpath.
- Current routes: `/` and catch-all `*` both render `HeroPage`.

## Styling

- Tokens live in `tailwind.config.ts`: brand navy/gold, neutrals (ink/line/surface), semantic (success/warning/danger/info), plus bright student accents (`spark/coral/sky/violet`) used only on energetic landing sections.
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

1. `npm ci` + `npm run build` in `frontend/`
2. `cp dist/index.html dist/404.html` (SPA fallback) + `touch dist/.nojekyll`
3. Upload `frontend/dist` and deploy to GitHub Pages

## Docs

- `docs/ARCHITECTURE.md` — tech stack, folder/import rules, data/auth/routing plan
- `docs/01-styles/GLOBAL-STYLES-SPEC.md` — visual and motion spec
- `docs/02-public/SHARED-SPEC.md` — shared/public pages spec
- `docs/03-student/STUDENT-SPEC.md`, `docs/04-teacher/TEACHER-SPEC.md`, `docs/05-admin/ADMIN-SPEC.md` — role specs
