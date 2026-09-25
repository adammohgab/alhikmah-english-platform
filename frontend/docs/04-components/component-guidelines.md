# Component Guidelines

These are the rules every component in `04-components/` and every page in
`05-pages/` must follow. This file is the contract; `04-components/` is the catalog.

## Source of truth

- A page **never** invents a new button style, card style, input style, or color
  usage. If the right component doesn't exist yet, it's added to `04-components/`
  first, with a name, props, and states defined — then used.
- Components live in `src/components/ui/` (primitives: Button, Card, Input, Badge,
  Table, Modal, Tabs, Select, Tooltip...) and `src/components/domain/` (composed,
  product-specific: `CourseCard`, `QuestionEditor`, `ScoreTrendChart`,
  `SkillTagList`...). See `03-architecture/folder-structure.md`.

## Every interactive component must define

1. **Default, hover, active/pressed, focus, disabled, and loading states** — not
   just default and hover.
2. **Size variants** where relevant (`sm`/`md`/`lg`) using the spacing scale, not
   arbitrary values.
3. **A single semantic intent per variant** — e.g. Button variants are `primary`
   (gold, one per view max), `secondary` (navy outline), `ghost` (text-only), and
   `destructive` (danger-colored, confirmation required). No "just make it look
   different" variants.

## Buttons — canonical spec

| Variant | Background | Text | Border | Use |
|---|---|---|---|---|
| `primary` | `brand-gold-500`, hover `brand-gold-600` | `ink-900` | none | The one primary action per screen/section (Save, Submit, Create) |
| `secondary` | `surface-0` | `brand-navy-900` | 1px `line-200`, hover `brand-navy-500` | Secondary actions (Cancel next to Save, Export, Filter) |
| `ghost` | transparent | `ink-700`, hover `ink-900` | none | Tertiary/inline actions (table row actions, "View all") |
| `destructive` | `danger-600`, hover darker | white | none | Delete/remove, always behind a confirmation dialog |

Heights: `sm` 32px, `md` 40px, `lg` 48px. Radius `radius-md`. Label in `body`
weight 600, never uppercase (uppercase reserved for `label` tokens like table
headers/tags).

## Cards — canonical spec

`surface-0` background, 1px `line-200` border, `radius-md`, `space-4` or `space-6`
padding depending on density, `elevation-0`. Hover state (when the whole card is
clickable, e.g. a course card) is a border color shift to `brand-navy-500` plus a
subtle background shift to `surface-50` — never a shadow pop or scale-up.

## Forms

- Labels above inputs (`label` token), never placeholder-as-label.
- Helper/error text below the field, `body-sm`, `ink-500` for helper / `danger-600`
  for error, with an inline icon on error.
- Required fields marked with a trailing asterisk in `danger-600`, not a "(required)"
  suffix in body text.
- All forms built with React Hook Form + a Zod schema; the schema file lives beside
  the form component (`CourseForm.schema.ts`) and is the single source of validation
  truth used by both client validation and (via shared types) the API contract.

## Tables

- Header row: `label` token, `ink-700`, `surface-50` background, sticky on scroll
  for long tables.
- Row height 48px default, 56px for rows containing an avatar or two-line content.
- Zebra striping is **not** used — separation comes from a 1px `line-100` row
  border. Row hover: `surface-50` background.
- Row actions (edit/delete/view) are `ghost` icon buttons, right-aligned, visible
  on hover on desktop / always visible on touch devices.

## Do not

- Do not use raw Tailwind color utilities (`bg-blue-500`) anywhere — only the
  tokenized names from `colors.md` (`bg-navy-500`), so a palette change is a
  one-file edit.
- Do not build a component that only one page will ever use as a "one-off" styled
  div when an existing primitive plus props would do the job.
