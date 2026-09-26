# Design System

Combined system for typography, spacing/layout, motion/interaction, iconography/imagery,
and the student experience amendment. Colors live separately in `colors.md`.

- §1 Typography
- §2 Spacing, Layout & Elevation
- §3 Motion, Interaction & Tone
- §4 Iconography & Imagery
- §5 Student Experience Amendment

---

## 1. Typography

Type carries almost all of the visual hierarchy in this product. Two families, used
consistently and narrowly.

### Families

| Role | Family | Fallback stack | Where |
|---|---|---|---|
| Display / headings | **Source Serif 4** (or **Lora** as alternate) | `Georgia, 'Times New Roman', serif` | Page titles (h1/h2), the login/marketing split screen, report titles, certificates (future) |
| UI / body | **Inter** | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` | Everything else: nav, buttons, body text, table content, forms |
| Arabic | **IBM Plex Sans Arabic** for UI, **Noto Naskh Arabic** for serif headings | `Tahoma, sans-serif` | Loaded whenever `lang="ar"`; see i18n note below |

The serif is what keeps this from reading as a generic SaaS product — it's used
**only** for headings and titles, never for body copy, buttons, or table data. Mixing
serif headings with a clean grotesque body is the single biggest lever against the
"AI dashboard template" look.

### Scale

Using a 1.25 (major third) type scale, base 16px.

| Token | Size / Line height | Weight | Use |
|---|---|---|---|
| `display` | 40px / 48px | Serif, 600 | Marketing/login hero only |
| `h1` | 32px / 40px | Serif, 600 | Page title (one per page, e.g. "Class Overview") |
| `h2` | 24px / 32px | Serif, 600 | Section headings within a page |
| `h3` | 19px / 28px | Sans, 600 | Card titles, subsection headings |
| `body-lg` | 17px / 26px | Sans, 400 | Lesson reading text, long-form content |
| `body` | 15px / 22px | Sans, 400 | Default UI text |
| `body-sm` | 13px / 20px | Sans, 400 | Secondary text, table cells, captions |
| `label` | 12px / 16px | Sans, 600, uppercase, 0.03em tracking | Field labels, table column headers, tags |
| `mono` (rare) | 13px / 20px | `JetBrains Mono`, 400 | Only for literal codes (e.g. a class join code) |

### Rules

1. Never use the serif font below `h3`. Never bold-italicize the serif for emphasis —
   use color (`ink-700` vs `ink-900`) or weight within the sans family instead.
2. Body text max line length: ~72 characters for reading content (`body-lg` in the
   lesson page), enforced with a `max-w-prose`-equivalent container — not the full
   viewport width.
3. One `h1` per page. It matches the page name shown in the nav/breadcrumb, not a
   marketing tagline.
4. Numbers that matter (scores, percentages, counts in stat cards) use `font-variant-
   numeric: tabular-nums` so they don't jitter when they update, and are set in the
   sans family at a heavier weight (600–700), never the serif.
5. Arabic body copy uses a slightly larger base size (17px vs 15px) since Arabic
   scripts read smaller at equivalent pixel sizes — apply via the `lang="ar"`
   attribute selector, not a manual per-page override.

---

## 2. Spacing, Layout & Elevation

### Spacing scale

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

### Radius

| Token | Value | Use |
|---|---|---|
| `radius-sm` | 4px | Chips, badges, small buttons |
| `radius-md` | 8px | Cards, inputs, standard buttons |
| `radius-lg` | 12px | Modals, large containers |

Nothing in the product exceeds 12px radius. No pill buttons except for true
toggle/filter chips (`radius-full` is allowed only there).

### Elevation

Flat by default. Shadow is reserved for things that visually float above the page:

| Token | CSS | Use |
|---|---|---|
| `elevation-0` | none, 1px `line-200` border | Cards, panels — the default |
| `elevation-1` | `0 1px 2px rgba(15,29,69,0.06)` | Sticky headers, subtle separation on scroll |
| `elevation-2` | `0 8px 24px rgba(15,29,69,0.12)` | Dropdowns, popovers, tooltips |
| `elevation-3` | `0 16px 40px rgba(15,29,69,0.18)` | Modals, dialogs |

Cards never use `elevation-2`/`3` — that's reserved for true overlays. A card is a
bordered flat surface, not a floating one.

### Layout grid

- **Desktop (≥1280px):** 12-column grid, 24px gutters, max content width 1440px,
  centered. Page content area (right of sidebar) has 32px horizontal padding.
- **Tablet (768–1279px):** sidebar collapses to icon-only rail (64px) or an
  overlay drawer; content area uses 4-column grid internally where relevant.
- **Mobile (<768px):** single column. Sidebar becomes a bottom tab bar (student) or
  a slide-in drawer behind a top-bar menu button (teacher/supervisor — see
  `04-components/layout-shell.md`).

### App shell structure (all roles)

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

### Responsive breakpoints (Tailwind defaults, used as-is)

`sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`, `2xl: 1536px`.

### RTL

All spacing/layout uses Tailwind's logical-property utilities (`ps-4` not `pl-4`,
`me-2` not `mr-2`, `text-start` not `text-left`). The sidebar flips to the right in
Arabic via `dir="rtl"` on `<html>` — no per-page RTL overrides.

---

## 3. Motion, Interaction & Tone

### Motion principles

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

### Loading states

- Use **skeleton loaders** matching the shape of the real content (a card skeleton
  for a card grid, a row skeleton for a table) — not a centered spinner replacing
  the whole page, except for full-page auth/redirect transitions.
- Buttons show an inline spinner + keep their label's width (no layout shift) while
  a mutation is in flight; label may change to a present-participle state ("Saving…")
  only where useful, otherwise stays as-is with the spinner as the only signal.

### Tone of voice (UI copy)

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

### Focus & accessibility

- Every interactive element has a visible focus ring: 2px `brand-gold-500` outline,
  2px offset, on all surfaces (including inside the navy sidebar, where it becomes
  a light ring for contrast).
- Color is never the only signal for status — pair with an icon or text label
  (e.g. correct/incorrect answers get both a check/cross icon and the color).
- Minimum tap target 40x40px on mobile.
- All modals trap focus and close on `Escape`; all toasts are announced via
  `aria-live="polite"`.

---

## 4. Iconography & Imagery

### Icons

- **One library: Lucide React.** No mixing with Heroicons, Font Awesome, emoji, or
  custom one-off SVGs unless something is genuinely missing from Lucide — in which
  case a matching icon is custom-drawn at the same stroke weight, not sourced from a
  different style family.
- **Stroke width: 1.5px, size 20px** for inline/UI icons (nav, buttons, table row
  actions). 24px for section header icons. Never filled/solid icon variants —
  outline only, to match the restrained visual language.
- **Color:** icons inherit `ink-700` by default, `ink-500` when inactive/disabled,
  `brand-gold-500` only for an active nav state or a genuinely primary action icon.
  Never a rainbow of icon colors on one screen.
- **No icon-in-colored-circle on every card.** Reserved for specific, meaningful
  cases: role badges (Student/Teacher/Supervisor initials in `04-components/`), skill
  tags (Reading/Writing/etc. each get one quiet identifying mark, not a bright
  badge), and step indicators in onboarding/wizards.
- **Never decorative-only icons.** Every icon either labels an action, indicates
  status, or aids scanning in a data-dense list. If it's purely there to "add
  visual interest," remove it.

### Imagery

- **No stock photography of students/teachers.** It dates badly, rarely matches the
  real school, and pushes the product toward generic marketing-site territory.
- **No AI-generated illustration style** (the rounded-flat-character-with-oversized-
  head look). If a page genuinely needs an illustration (e.g. an empty state), use a
  simple geometric/line illustration in `ink-500`/`line-200` tones consistent with
  the icon set — or, preferably, solve it with typography and a single icon instead
  of commissioning an illustration.
- **The school crest/logo** (navy + gold, from the reference deck) is the only piece
  of "brand art" that appears prominently — on the login screen, the sidebar (small,
  top), and printable reports/certificates.
- **Empty states:** one centered icon (24–32px, `ink-300`), a short factual headline,
  one sentence of explanation, and — where relevant — one primary action. No
  illustration required. No jokes, no emoji, no exclamation points.
  - Example: "No courses yet" / "Courses you're enrolled in will appear here." /
    button: "Browse courses" (student) or "Create a course" (teacher).

### Avatars

- Initials-based avatars by default (navy background, white initials, or gold for
  the current user's own avatar to distinguish it in comment/feedback threads) —
  not silhouette placeholder icons, not generated cartoon avatars.
- Real uploaded photos allowed where the school provides them, cropped to a circle,
  same size grid as initials avatars (24/32/40px sizes).

---

## 5. Student Experience Amendment

This section sits on top of `colors.md` and §§ 1–3 above.
It does not replace them — it tunes how they're applied specifically on **student-role
screens** (dashboard, my courses, lesson page, take-a-test, my results, assignments,
games). Teacher and Supervisor screens stay exactly as documented elsewhere: dense,
neutral, institutional.

### Why this section exists

The base system was written to avoid "AI dashboard slop" — and that instinct is right,
but taken alone it can also drift toward "bank portal," which is the wrong feeling for
a 13–18 year old opening this after school. The goal on student screens is **confident
and energetic, not corporate** — closer to a well-designed language-learning app than a
teacher's admin panel. Still zero emoji, zero gradients-as-decoration, zero stock
illustration — the non-goals in `principles-and-non-goals.md` still fully apply. What
changes is proportion and warmth, not the palette or the rules.

### What's different on student screens

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
   card" from §4 above, because here it's wayfinding across six
   real categories, not decoration. Everywhere else (tags, table filters) the muted
   `SkillTag` treatment from `data-display.md` still applies unchanged.
5. **Motion gets one extra beat.** The `ProgressBar` fill (already 400ms ease-out) and
   a course-completion state may use a single soft scale/opacity settle (120ms) on
   student screens only — still no bounce, no confetti, no spring physics. Everything
   else in §3 above is unchanged, including the flat instant route
   transitions.
6. **Streaks and stats stay understated in language, bold in numeral.** The numeral
   itself can be large and in `brand-gold-500` (e.g. "5 days"); the surrounding copy
   stays exactly as toned in §3 above ("You're on a 5-day streak.").
   Boldness lives in type size and color, never in copy enthusiasm.

### What never changes, even here

- No emoji, anywhere, ever.
- No gradients as decoration (only in data viz where they encode magnitude).
- No mascot, no cartoon avatar, no AI-illustration-style artwork.
- No sound effects, no confetti, no badges shaped like game trophies (badges/
  leaderboards are explicitly post-v1 per the reference plan).
- Serif is still headings-only; body copy is still Inter.
- Radius scale still tops out at 12px.

### Quick gut-check

If a student screen still feels like it could be a teacher's grade report with the
colors turned up, add air and let gold and the skill colors do more work. If it starts
to feel like a mobile game's home screen, pull back — the line is "a really well-made
study app," not "a game."
