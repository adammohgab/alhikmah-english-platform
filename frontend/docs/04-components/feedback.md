# Feedback Components

`components/ui/`, built on Radix primitives (Dialog, Toast) for accessibility,
styled per the design system.

## `Modal` (Radix Dialog)

`surface-0` panel, `radius-lg`, `elevation-3`, backdrop `brand-navy-900` at 40%
opacity (not black). Header: `h3` title + close (X) icon button, top-inline-end.
Footer: right-aligned (`justify-end`, logical: `justify-end` respects RTL via
flex-direction flip) button row, secondary button first, primary action last —
consistent order everywhere ("Cancel" then "Save", never reversed).

Sizes: `sm` (400px, confirmations), `md` (560px, most forms), `lg` (800px, e.g.
question editor with preview pane). Max-height 90vh with internal scroll on the
body region, header/footer stay fixed.

## `ConfirmDialog`

A constrained `Modal` variant for destructive/consequential actions (delete a
course, remove a student, publish a test to students). Always states the specific
consequence in the body text (see tone rules in `motion-and-interaction.md`) —
never a bare "Are you sure?". Primary button uses the `destructive` variant when
the action is destructive, `primary` otherwise (e.g. "Publish test" isn't
destructive, doesn't need red).

## `Toast`

Top-inline-end corner, stacked (newest on top), `surface-0` background, `line-200`
border, `elevation-2`, `radius-md`, small colored left/start accent bar (4px)
matching semantic intent (success/danger/warning/info) — the only place a thick
color accent bar is used in the whole system, precisely because toasts are
transient and need instant scannability. Icon + message (`body-sm`) + optional
inline action link ("Undo") + close button.

## `Banner` (inline, page-level)

For persistent, non-transient notices (e.g. "This test is in draft — students can't
see it yet" at the top of the test builder). Full-width within its container,
`radius-md`, semantic background tint (`warning-100`/`info-100` etc.) with matching
darker text/icon — never the loud toast accent bar treatment; banners are calmer
since they persist on screen.

## `Tooltip`

See `data-display.md` — shared spec, used for both data labels and icon-only
button explanations.

## Loading / error boundaries

- Route-level `ErrorBoundary` renders a centered `EmptyState`-style message
  ("Something went wrong loading this page." + a "Try again" button that resets the
  boundary) — never a raw stack trace or the default React error screen in
  production.
- Network/query errors surface via `Toast` for actions (mutations) and via an
  inline `Banner`-or-`EmptyState` for failed page-level reads, depending on whether
  the whole page or just one section failed to load.
