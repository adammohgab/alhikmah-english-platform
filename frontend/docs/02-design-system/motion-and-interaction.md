# Motion, Interaction & Tone

## Motion principles

Motion should confirm what already happened or is about to happen — it never exists
to feel "delightful" on its own. Fast, small, purposeful.

| Interaction | Duration | Easing | Notes |
|---|---|---|---|
| Hover/press state change | 100–120ms | ease-out | Background/border color only, no scale-bounce |
| Dropdown/popover open | 120ms | ease-out, 4px translate + fade | Radix defaults, tuned to this timing |
| Modal open | 160ms | ease-out, fade + 8px translate-up | Backdrop fades in parallel at 120ms |
| Page/route transition | none by default | — | Instant navigation; a route-level skeleton loader (not a spinner overlay) shows while data loads |
| Toast in/out | 150ms in / 120ms out | ease-out | Slides from top-end corner, auto-dismiss 4s for success, manual-dismiss for errors |
| Progress bar fill (e.g. course progress) | 400ms | ease-out | The one place a slightly longer, satisfying animation is appropriate — it's reporting real progress |
| Test timer | no animation | — | Just a numeric countdown; never gamified with color pulsing until under 60 seconds, where it shifts to `warning-600` text, no flashing |

No confetti, no bounce/spring physics on UI chrome, no page-load "typewriter" text
reveals, no parallax. Framer Motion is used only for the modal/toast transitions
above if Tailwind transitions prove insufficient — not for anything else in v1.

## Loading states

- Use **skeleton loaders** matching the shape of the real content (a card skeleton
  for a card grid, a row skeleton for a table) — not a centered spinner replacing
  the whole page, except for full-page auth/redirect transitions.
- Buttons show an inline spinner + keep their label's width (no layout shift) while
  a mutation is in flight; label may change to a present-participle state ("Saving…")
  only where useful, otherwise stays as-is with the spinner as the only signal.

## Tone of voice (UI copy)

- Direct, factual, adult. Write for teachers and supervisors as professionals and
  for students as capable young adults — not as children being praised.
- No exclamation points in system messages. "Test submitted." not "Great job! Test
  submitted!" Encouraging copy is fine in genuinely student-facing progress
  moments, but stays understated: "You're on a 5-day streak." not "You're on
  🔥 FIRE! 5 days in a row!!"
- Errors state what happened and what to do: "Couldn't save your answer. Check your
  connection and try again." not "Oops! Something went wrong 😬".
- Confirmations for destructive actions are specific: "Delete Unit 3: Travel? This
  removes 6 lessons and 2 quizzes. This can't be undone." not a generic "Are you
  sure?"

## Focus & accessibility

- Every interactive element has a visible focus ring: 2px `brand-gold-500` outline,
  2px offset, on all surfaces (including inside the navy sidebar, where it becomes
  a light ring for contrast).
- Color is never the only signal for status — pair with an icon or text label
  (e.g. correct/incorrect answers get both a check/cross icon and the color).
- Minimum tap target 40x40px on mobile.
- All modals trap focus and close on `Escape`; all toasts are announced via
  `aria-live="polite"`.
