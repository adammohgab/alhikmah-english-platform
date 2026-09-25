# Forms & Inputs

`components/ui/`. All built to integrate directly with React Hook Form's
`register`/`Controller` pattern; all accept `label`, `error`, `helperText`, `required`
props consistently so any form composes them the same way.

## `Input`

Height 40px (`md`), `surface-0` background, 1px `line-200` border, `radius-md`,
`body` text. Focus: border → `brand-navy-500`, 2px `brand-gold-500` ring (per
accessibility rules). Error state: border → `danger-600`, helper text switches to
error message in `danger-600` with a small alert icon prefix. Disabled: `surface-
100` background, `ink-500` text, no border color change on focus (can't focus).

Variants via a leading/trailing icon slot (e.g. search input with a leading
magnifier) — no separate `SearchInput` component needed unless behavior (debounce,
clear button) diverges meaningfully.

## `Textarea`

Same visual language as `Input`, min-height 96px, resizable vertically only. Used
for writing-type quiz questions, assignment text submissions, feedback/comments.

## `Select`

Radix `Select` styled to match `Input` exactly at rest (same height/border/radius),
opening a `elevation-2` dropdown list (`surface-0`, `line-200` border, items with
`surface-50` hover, `radius-md`). Used for: grade/class filters, question type
picker in the test builder, role filter in manage users.

## `Checkbox` / `RadioGroup`

Square (checkbox) / circular (radio) 20px controls, `line-200` border unchecked,
`brand-navy-900` fill + white check/dot when checked. Used heavily in the
**quiz-taking UI** for multiple-choice/true-false — see
`05-pages/student/take-a-test.md` for the specific larger touch-friendly variant
used there (48px min height per option row, not the compact form-field version).

## `Toggle` (switch)

Used for binary settings (e.g. "Publish this test", "Allow retakes"). 40x22px
track, `line-200` off / `brand-navy-900` on, white thumb, 120ms transition.

## `FileUpload`

Dropzone-style control: dashed `line-200` border, `radius-md`, centered icon +
"Drag a file here or click to browse" (`body-sm`), used for assignment submission
attachments and lesson resource uploads (audio/video/PDF per the content model).
Shows uploaded file as a compact row (file-type icon + name + size + remove
button) once selected — not a giant thumbnail preview.

## `DatePicker` / `TimePicker`

Used for assignment due dates, test scheduling windows. Built on a Radix Popover +
a lightweight calendar grid, styled consistent with `Select`'s dropdown treatment.
No native `<input type="date">` reliance for cross-browser consistency, but native
input remains the underlying accessible fallback where feasible.

## `FormField` wrapper

A layout-only component (`label` + `required` asterisk + the input slot + helper/
error text) that every field above is composed inside, so label/error placement is
identical across every form in the product — this is what actually enforces the
"forms" rules in `component-guidelines.md` in code, not just in docs.
