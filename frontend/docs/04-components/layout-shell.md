# Layout Shell Components

`components/layout/`. These wrap every authenticated page.

## `AppShell`

Top-level layout: renders `Sidebar` + `TopBar` + a content outlet (`<Outlet />`).
Handles the responsive switch between desktop sidebar and mobile tab bar/drawer at
the `lg` (1024px) breakpoint.

**Props:** none — reads role from `useAuth()` internally to decide nav content.

## `Sidebar`

- Desktop: fixed, 264px wide, `brand-navy-900` background, full height.
- Top: school crest mark (small, ~28px) + "Al Hikmah" wordmark in white, `h3` size,
  sans (not serif — the sidebar is UI chrome, not editorial content).
- Nav items: icon (20px, `ink-300` default / white on active) + label (`body`,
  white). Active item gets a `brand-gold-500` left border (4px, `border-inline-
  start` for RTL correctness) and a `brand-navy-700` background pill behind the
  item — not a full-width highlight bar.
- Nav sections match the role's page list from `05-pages/` (e.g. student sidebar:
  Dashboard, My Courses, My Results, Assignments — "Take a test" is not a nav item,
  it's entered from a course/dashboard link).
- Collapse toggle at the bottom (icon-only rail mode, 72px, labels replaced by
  tooltips on hover) — state persisted in `stores/sidebarStore.ts`.
- Bottom: user's avatar + name + role label (`body-sm`, `ink-300`) + a chevron
  opening the profile/logout menu.

## `TopBar`

- Height 64px, `surface-0` background, `elevation-1` on scroll only (flat at rest).
- Left: page title (`h2`, derived from route `handle`) — on mobile, a hamburger
  menu button replaces/precedes it to open the drawer.
- Right: search (icon button expanding to an input on click — global search is
  post-v1 unless a page needs local search, which lives in that page instead),
  notification bell (badge count in `brand-gold-500` when >0), language toggle
  (EN/AR), avatar menu.
- No breadcrumbs beyond the single page title in v1 — the sidebar nav already shows
  location; a second breadcrumb row is redundant chrome.

## `MobileTabBar`

- Student role only, <768px: fixed bottom bar, 4–5 items max (Dashboard, Courses,
  Results, Assignments), `surface-0` background, `elevation-2` (it's floating above
  content), active item in `brand-gold-500` icon + label.
- Teacher/Supervisor on mobile use the drawer pattern instead (their nav has more
  items than fit a tab bar comfortably) — hamburger in `TopBar` opens a full-height
  drawer styled identically to the desktop `Sidebar`.
