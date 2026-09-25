# Spacing, Layout & Elevation

## Spacing scale

4px base unit. Use Tailwind's default scale mapped to these tokens — do not invent
arbitrary values like `px-[13px]`.

| Token | Value | Typical use |
|---|---|---|
| `space-1` | 4px | Icon-to-text gap |
| `space-2` | 8px | Tight internal padding, chip padding |
| `space-3` | 12px | Form field internal padding |
| `space-4` | 16px | Default card padding, gap between related items |
| `space-6` | 24px | Gap between cards in a grid, section internal padding |
| `space-8` | 32px | Gap between major sections on a page |
| `space-12` | 48px | Page top padding on desktop |

## Radius

| Token | Value | Use |
|---|---|---|
| `radius-sm` | 4px | Chips, badges, small buttons |
| `radius-md` | 8px | Cards, inputs, standard buttons |
| `radius-lg` | 12px | Modals, large containers |

Nothing in the product exceeds 12px radius. No pill buttons except for true
toggle/filter chips (`radius-full` is allowed only there).

## Elevation

Flat by default. Shadow is reserved for things that visually float above the page:

| Token | CSS | Use |
|---|---|---|
| `elevation-0` | none, 1px `line-200` border | Cards, panels — the default |
| `elevation-1` | `0 1px 2px rgba(15,29,69,0.06)` | Sticky headers, subtle separation on scroll |
| `elevation-2` | `0 8px 24px rgba(15,29,69,0.12)` | Dropdowns, popovers, tooltips |
| `elevation-3` | `0 16px 40px rgba(15,29,69,0.18)` | Modals, dialogs |

Cards never use `elevation-2`/`3` — that's reserved for true overlays. A card is a
bordered flat surface, not a floating one.

## Layout grid

- **Desktop (≥1280px):** 12-column grid, 24px gutters, max content width 1440px,
  centered. Page content area (right of sidebar) has 32px horizontal padding.
- **Tablet (768–1279px):** sidebar collapses to icon-only rail (64px) or an
  overlay drawer; content area uses 4-column grid internally where relevant.
- **Mobile (<768px):** single column. Sidebar becomes a bottom tab bar (student) or
  a slide-in drawer behind a top-bar menu button (teacher/supervisor — see
  `04-components/layout-shell.md`).

## App shell structure (all roles)

```
┌─────────────────────────────────────────────┐
│ Top bar: breadcrumb/page title · search ·    │
│          notifications · profile menu        │
├───────────┬───────────────────────────────────┤
│           │                                   │
│  Sidebar  │        Page content                │
│  (nav)    │        (max-w 1440px, centered)     │
│           │                                   │
└───────────┴───────────────────────────────────┘
```

Sidebar: `brand-navy-900` background, fixed width 264px on desktop, collapsible to
72px icon rail. Content area: `surface-50` background with `surface-0` cards.

## Responsive breakpoints (Tailwind defaults, used as-is)

`sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`, `2xl: 1536px`.

## RTL

All spacing/layout uses Tailwind's logical-property utilities (`ps-4` not `pl-4`,
`me-2` not `mr-2`, `text-start` not `text-left`). The sidebar flips to the right in
Arabic via `dir="rtl"` on `<html>` — no per-page RTL overrides.
