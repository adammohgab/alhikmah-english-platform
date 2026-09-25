# Design Principles & Non-Goals

This file exists to be pasted into an AI coding agent's context whenever it starts
generating UI. Its only job is to keep the output looking like a real, designed
product instead of a default AI-generated interface.

## Principles

1. **Institutional, not startup.** This is a school platform, not a SaaS product
   trying to look funded. Reference points: a well-designed university LMS, a bank's
   client portal, a serious admissions system — not a Y-Combinator landing page.
2. **Type does the work.** Hierarchy comes from a serif/sans pairing, weight, and
   spacing — not from color, shadows, or icons. See `02-design-system/typography.md`.
3. **Restraint over decoration.** One accent color, used sparingly, on things the
   user acts on (primary buttons, active states, key numbers). Everything else is
   navy, ink, and neutral grays.
4. **Flat surfaces.** Cards are defined by a 1px border and a very small radius, not
   by drop shadow. Shadow is reserved for true overlays (modals, dropdowns).
5. **Real content, not filler.** Every mock/example in the docs uses realistic school
   data (grade levels, unit names, actual question types) — never "Lorem Ipsum" or
   "Item 1, Item 2, Item 3."
6. **Density with clarity.** Teachers and supervisors work with tables and lists all
   day. Favor compact, well-aligned data over generous whitespace "for the vibe."
7. **Bilingual by construction.** Every layout is built with logical CSS properties
   (`margin-inline-start`, not `margin-left`) so Arabic RTL is a data attribute
   flip, not a rebuild.

## Explicit non-goals — do not do these

- **No emoji.** Not in buttons, empty states, toasts, onboarding, nav labels,
  nothing. Use text or a proper icon from the approved icon set instead.
- **No gradients used as decoration.** No purple-to-blue hero gradients, no gradient
  text, no gradient buttons. A gradient may only appear in a data visualization
  (e.g. a heatmap) where it encodes information.
- **No glassmorphism / frosted blur panels.** No `backdrop-filter: blur()` cards
  floating over busy backgrounds.
- **No oversized rounded corners.** Radius scale tops out at 12px (see design
  system). No pill-shaped cards, no `rounded-3xl` everything.
- **No stock "AI dashboard" color palette** (violet/indigo primary + neon green
  success + hot pink accent). Palette is defined once in `colors.md` and nothing
  else is introduced.
- **No decorative icon-in-a-colored-circle pattern repeated on every single card.**
  Use it where it earns its place (role badges, step indicators) — not as generic
  card furniture.
- **No auto-generated placeholder illustrations** (the generic "person at desk with
  laptop and giant checkmark" SVG style). If an illustration is needed, it must be
  simple, geometric, and on-brand, or omitted in favor of typography and data.
- **No excessive micro-copy or exclamation points.** "Test submitted." not "Awesome!
  You crushed it! 🎉" — see `motion-and-interaction.md` for tone in transient
  messages.
- **No component reinvented per page.** If a table, card, or form field is needed,
  it comes from `04-components/`. Pages do not define their own one-off button
  styles.

## The test

Before shipping any screen, ask: *if I removed the logo, could someone mistake this
for a generic AI-generated SaaS template?* If yes, it fails review.
