# Color System

Derived from the school's own brand (navy + gold crest, seen in the reference deck).
The palette is deliberately narrow. Every color below has a defined job — nothing is
added "because it looks nice" on a given screen.

## Brand

| Token | Hex | Use |
|---|---|---|
| `brand-navy-900` | `#0F1D45` | Primary brand color. Sidebar background, headers on dark sections, primary text on light surfaces where extra weight is needed |
| `brand-navy-700` | `#16255C` | Hover/pressed state of navy elements, secondary dark surface |
| `brand-navy-500` | `#25397E` | Links, secondary interactive elements on light backgrounds |
| `brand-gold-500` | `#D4A02B` | The single accent color. Primary CTAs, active nav indicator, key stat highlights, badges of achievement. Used sparingly — if more than ~10% of a screen is gold, pull it back. |
| `brand-gold-600` | `#B9891E` | Hover/pressed state of gold elements |

## Neutrals (the workhorse palette)

| Token | Hex | Use |
|---|---|---|
| `ink-900` | `#12151C` | Primary body text |
| `ink-700` | `#3A3F4B` | Secondary text, labels |
| `ink-500` | `#6B7280` | Tertiary text, placeholder, disabled text |
| `ink-300` | `#A6ACB8` | Borders on dark surfaces, disabled icons |
| `line-200` | `#E2E5EA` | Default border/divider color |
| `line-100` | `#EEF0F3` | Subtle divider, table row separators |
| `surface-0` | `#FFFFFF` | Card and page surface |
| `surface-50` | `#F7F8FA` | App background (behind cards) |
| `surface-100` | `#EEF1F6` | Subtle fill (input backgrounds, hover on list rows) |

## Semantic (status only — never decorative)

| Token | Hex | Use |
|---|---|---|
| `success-600` | `#1F7A4D` | Correct answers, passed status, positive trend |
| `success-100` | `#E4F3EA` | Success background fill (badges, banners) |
| `warning-600` | `#A66A0A` | Due soon, needs attention, partial score |
| `warning-100` | `#FBF1DD` | Warning background fill |
| `danger-600` | `#B3261E` | Incorrect answers, overdue, failed, destructive actions |
| `danger-100` | `#FBE9E8` | Danger background fill |
| `info-600` | `#1E5FA8` | Informational callouts (rare — prefer neutral where possible) |
| `info-100` | `#E6F0FB` | Info background fill |

## Rules

1. **One accent rule:** `brand-gold` is the only non-neutral, non-semantic color
   allowed for emphasis. Do not introduce a second accent (no teal, no purple) for
   variety.
2. **Semantic colors mean one thing.** `danger` = wrong/overdue/destructive only. It
   is never used decoratively (e.g. never a red icon just because red "pops").
3. **Dark surfaces are navy, not black.** Sidebar, modals-on-dark (rare), and the
   marketing/login split-screen use `brand-navy-900`, never `#000000`.
4. **No gradients** except in chart fills where a gradient encodes magnitude (e.g.
   a heat strip in a report). Buttons, cards, and headers are flat.
5. **Charts** use `brand-navy-500`, `brand-gold-500`, and neutrals for multi-series
   data, with `success`/`danger` reserved for pass/fail or correct/incorrect
   breakdowns specifically.
6. **Dark mode:** not in v1 scope. If added later, tokens above map to a `dark:`
   variant set defined at that time — do not improvise dark values now.

## Tailwind config mapping

```js
// tailwind.config.ts (excerpt)
colors: {
  navy: { 900: '#0F1D45', 700: '#16255C', 500: '#25397E' },
  gold: { 600: '#B9891E', 500: '#D4A02B' },
  ink:  { 900: '#12151C', 700: '#3A3F4B', 500: '#6B7280', 300: '#A6ACB8' },
  line: { 200: '#E2E5EA', 100: '#EEF0F3' },
  surface: { 0: '#FFFFFF', 50: '#F7F8FA', 100: '#EEF1F6' },
  success: { 600: '#1F7A4D', 100: '#E4F3EA' },
  warning: { 600: '#A66A0A', 100: '#FBF1DD' },
  danger:  { 600: '#B3261E', 100: '#FBE9E8' },
  info:    { 600: '#1E5FA8', 100: '#E6F0FB' },
}
```
