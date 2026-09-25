# Data Display Components

`components/ui/` unless noted.

## `Card`

Base container per `component-guidelines.md`. Variants: `default` (border only),
`interactive` (adds hover state, used when the whole card is a click target),
`stat` (see below).

## `StatCard`

Used on dashboards/overview pages (student streak, class average, pending
submissions count). Layout: `label` token caption on top, a large numeral
(`h1`-equivalent weight but sans, tabular-nums) below, optional trend indicator
(small arrow + `body-sm` in `success-600`/`danger-600`) beside the numeral. No icon
badge by default — add one only if the stat is genuinely ambiguous without it.

## `ProgressBar`

Horizontal bar, 8px height, `radius-full`, track in `surface-100`, fill in
`brand-navy-500` (or `brand-gold-500` specifically for "current/active" progress
being highlighted, e.g. "Continue learning" module on the student dashboard — pick
one meaning per context and stay consistent within that page). Label (`body-sm`,
percentage or fraction) placed to the end (`inset-inline-end`) of the bar, not
inside it.

## `Table`

Built on a plain semantic `<table>` (not a div-grid) for accessibility, styled per
`component-guidelines.md`. Supports: sortable column headers (click toggles
asc/desc, small arrow indicator), row selection (checkbox column, for bulk actions
like grading multiple submissions), sticky header, empty state (renders
`EmptyState` inside the table body), loading state (renders `Skeleton` rows
matching column count).

## `Badge`

Small pill/rect (radius-sm, not full-pill except status dots), `label`-scale text.
Variants map directly to semantic colors: `neutral` (ink-700/surface-100),
`success`, `warning`, `danger`, `info`, plus `brand` (gold, used sparingly for
"New" or similar). Used for: submission status (Graded/Pending/Late), test status
(Draft/Published/Closed), skill tags.

## `SkillTag`

Specific badge variant for the six skills (Reading, Writing, Listening, Speaking,
Grammar, Vocabulary). Each skill gets a fixed, quiet color mapping (defined once in
`content/skills.ts`, reusing the neutral/info palette with distinct but muted hues
— not six loud rainbow colors). Same visual weight everywhere it appears (lesson
tags, report breakdowns, question bank filters).

## Charts (`components/domain/reports/`, built on Recharts)

- `ScoreTrendChart` — line chart, score over time, `brand-navy-500` line,
  `brand-gold-500` dot on the latest point only.
- `ClassAverageBarChart` — bar chart comparing classes/units, bars in
  `brand-navy-500`, the selected/highlighted bar (if any) in `brand-gold-500`.
- `SkillBreakdownChart` — horizontal bars or a simple radar, one bar per skill
  using the `SkillTag` color mapping for consistency between the tag and the chart.
- All charts: no 3D, no drop shadows on bars/lines, gridlines in `line-100` only,
  axis labels in `body-sm`/`ink-500`, tooltips styled as a small `elevation-2` card
  matching `Tooltip` component below — never Recharts' default tooltip styling.

## `Tooltip`

Radix Tooltip, styled: `ink-900` background, white text, `body-sm`, `radius-sm`,
`elevation-2`, small arrow. 300ms open delay (avoid tooltip spam on fast mouse
movement), no delay on close.

## `Avatar`

Circle, sizes `xs`(24) `sm`(32) `md`(40) `lg`(56). Initials fallback: `brand-navy-
900` background / white text, except the current logged-in user's own avatar
across the app uses `brand-gold-500` background / `ink-900` text to be
self-identifying at a glance in threads/lists.

## `EmptyState`

Per `iconography-and-imagery.md`: centered icon (`ink-300`, 28px), `h3` headline,
one line `body-sm`/`ink-500` description, optional single primary/secondary button.

## `Skeleton`

Base shimmer block (`surface-100` to `surface-50` subtle pulse, 1.5s ease-in-out
loop, no shine/sweep animation — a plain opacity pulse only, since a sweeping
highlight reads as more "flashy startup" than this product wants). Composed into
`CardSkeleton`, `TableRowSkeleton`, `TextSkeleton` per context.
