# Iconography & Imagery

## Icons

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

## Imagery

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

## Avatars

- Initials-based avatars by default (navy background, white initials, or gold for
  the current user's own avatar to distinguish it in comment/feedback threads) —
  not silhouette placeholder icons, not generated cartoon avatars.
- Real uploaded photos allowed where the school provides them, cropped to a circle,
  same size grid as initials avatars (24/32/40px sizes).
