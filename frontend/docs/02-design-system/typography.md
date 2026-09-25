# Typography

Type carries almost all of the visual hierarchy in this product. Two families, used
consistently and narrowly.

## Families

| Role | Family | Fallback stack | Where |
|---|---|---|---|
| Display / headings | **Source Serif 4** (or **Lora** as alternate) | `Georgia, 'Times New Roman', serif` | Page titles (h1/h2), the login/marketing split screen, report titles, certificates (future) |
| UI / body | **Inter** | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` | Everything else: nav, buttons, body text, table content, forms |
| Arabic | **IBM Plex Sans Arabic** for UI, **Noto Naskh Arabic** for serif headings | `Tahoma, sans-serif` | Loaded whenever `lang="ar"`; see i18n note below |

The serif is what keeps this from reading as a generic SaaS product — it's used
**only** for headings and titles, never for body copy, buttons, or table data. Mixing
serif headings with a clean grotesque body is the single biggest lever against the
"AI dashboard template" look.

## Scale

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

## Rules

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
