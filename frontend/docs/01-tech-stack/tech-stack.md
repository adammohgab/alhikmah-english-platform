# Tech Stack

Exact and final for v1. Do not introduce alternatives to anything listed here without
updating this file first.

## Core

| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript (strict mode) | `strict: true` in `tsconfig.json`, no `any` without a `// TODO` comment and a reason |
| Framework | React 18 | Function components + hooks only. No class components. |
| Build tool | Vite | Fast dev server, native TS/JSX support |
| Routing | React Router v6 | Nested routes matching the folder-per-role structure |
| Styling | Tailwind CSS | Config extended with the design tokens in `02-design-system/`. No inline `style={{}}` except for computed values (e.g. progress bar widths) |
| Component primitives | Radix UI | Unstyled, accessible primitives for dialog, dropdown, tabs, tooltip, select — styled with Tailwind to match our design system. Never used un-styled. |
| Forms | React Hook Form + Zod | Zod schemas define validation and double as the source of truth for form types |
| Data fetching / cache | TanStack Query (React Query) | All server reads/writes go through query/mutation hooks, never raw `fetch` in components |
| Backend client | Supabase JS client | Auth, Postgres reads via RPC/REST, file storage |
| Charts | Recharts | Bar/line charts for reports (score by class, progress over time) |
| Icons | Lucide React | One icon set only, used at 1.5px stroke, never mixed with emoji or other icon libraries |
| Dates | date-fns | With a `Hijri`-aware formatting wrapper if the school calendar requires it later |
| i18n | react-i18next | English + Arabic; drives RTL as well as translated strings |
| State (client-only UI state) | Zustand | Small, scoped stores (e.g. active test session, sidebar collapsed state). Not used for server data — that's React Query's job. |
| Testing | Vitest + React Testing Library | Component and hook tests |
| Linting/formatting | ESLint + Prettier | Airbnb-based config, adjusted for hooks and TS |
| Package manager | pnpm | |

## What we deliberately do NOT use

- No CSS-in-JS (styled-components, Emotion) — Tailwind only, for consistency and
  bundle size.
- No Redux / Redux Toolkit — React Query + Zustand cover every real need here.
- No component library that ships its own visual identity (no MUI, no Ant Design,
  no Chakra default theme) — Radix is unstyled by design, which is why it's the
  choice; anything with a strong default look fights the "not AI-slop" goal.
- No animation library beyond Tailwind's transition utilities and, where truly
  needed, Framer Motion for a handful of specific interactions (see
  `02-design-system/design-system.md` §3). Framer Motion is not a default — it's opt-in per
  interaction.

## AI integration (Gemini)

The frontend never calls the Gemini API directly and never holds an API key. It
calls our own backend endpoint (e.g. `/api/ai/tutor`, `/api/ai/generate-questions`),
which proxies to Gemini server-side. From the frontend's perspective this is just
another React Query mutation with a typed request/response contract — see
`06-features/ai-tutor.md`.

## Environment & config

- `.env.local` holds only public, non-secret values (Supabase URL, Supabase anon
  key — both safe for the client by design). Anything sensitive (Gemini key,
  service role key) lives server-side only, never referenced in frontend code or
  `.env` files that ship to the client bundle.
- Feature flags (e.g. enabling Games before they're fully ready) via a simple typed
  `config/features.ts`, not a third-party flag service, for v1.

## Browser support target

Latest two versions of Chrome, Safari, Edge, and Firefox, plus Safari on iOS (last 2
major versions) and Chrome on Android. No IE11, no legacy polyfill budget spent.
