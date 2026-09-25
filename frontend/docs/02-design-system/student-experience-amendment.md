# Student Experience Amendment

This file sits on top of `colors.md`, `typography.md`, and `motion-and-interaction.md`.
It does not replace them — it tunes how they're applied specifically on **student-role
screens** (dashboard, my courses, lesson page, take-a-test, my results, assignments,
games). Teacher and Supervisor screens stay exactly as documented elsewhere: dense,
neutral, institutional.

## Why this file exists

The base system was written to avoid "AI dashboard slop" — and that instinct is right,
but taken alone it can also drift toward "bank portal," which is the wrong feeling for
a 13–18 year old opening this after school. The goal on student screens is **confident
and energetic, not corporate** — closer to a well-designed language-learning app than a
teacher's admin panel. Still zero emoji, zero gradients-as-decoration, zero stock
illustration — the non-goals in `principles-and-non-goals.md` still fully apply. What
changes is proportion and warmth, not the palette or the rules.

## What's different on student screens

1. **Gold works harder here.** The ~10% gold ceiling in `colors.md` still holds
   platform-wide, but on student screens gold is allowed to be the dominant accent for
   progress and achievement moments specifically: streak counters, the active lesson
   progress ring, a finished-course state, a "personal best" score badge. Teacher/
   supervisor screens keep gold rare and purely functional (CTA + active nav only).
2. **Cards get a little more air.** `space-6` (24px) padding by default on student
   dashboard/course cards rather than the denser `space-4` used in teacher tables — this
   is a browsing surface, not a data-entry surface.
3. **h2/h3 section headers are allowed a short, human framing line underneath**
   (`body-sm`, `ink-500`) — e.g. "Continue learning" / "Pick up where you left off." One
   line, factual, never exclamation-marked, never a pun. This is the one place copy is
   allowed to sound like it's talking to a person instead of reporting a system state.
4. **Course/skill identity color.** Each of the six skills (`SkillTag` mapping in
   `content/skills.ts`) gets a slightly more saturated, distinct hue *only* when used as
   a large course-card left-edge accent (4px bar) or a big icon-in-circle on the "My
   Courses" grid — the one deliberate exception to "no icon-in-colored-circle on every
   card" from `iconography-and-imagery.md`, because here it's wayfinding across six
   real categories, not decoration. Everywhere else (tags, table filters) the muted
   `SkillTag` treatment from `data-display.md` still applies unchanged.
5. **Motion gets one extra beat.** The `ProgressBar` fill (already 400ms ease-out) and
   a course-completion state may use a single soft scale/opacity settle (120ms) on
   student screens only — still no bounce, no confetti, no spring physics. Everything
   else in `motion-and-interaction.md` is unchanged, including the flat instant route
   transitions.
6. **Streaks and stats stay understated in language, bold in numeral.** The numeral
   itself can be large and in `brand-gold-500` (e.g. "5 days"); the surrounding copy
   stays exactly as toned in `motion-and-interaction.md` ("You're on a 5-day streak.").
   Boldness lives in type size and color, never in copy enthusiasm.

## What never changes, even here

- No emoji, anywhere, ever.
- No gradients as decoration (only in data viz where they encode magnitude).
- No mascot, no cartoon avatar, no AI-illustration-style artwork.
- No sound effects, no confetti, no badges shaped like game trophies (badges/
  leaderboards are explicitly post-v1 per the reference plan).
- Serif is still headings-only; body copy is still Inter.
- Radius scale still tops out at 12px.

## Quick gut-check

If a student screen still feels like it could be a teacher's grade report with the
colors turned up, add air and let gold and the skill colors do more work. If it starts
to feel like a mobile game's home screen, pull back — the line is "a really well-made
study app," not "a game."
