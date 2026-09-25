# Page: Grade Submissions (`/app/teacher/submissions`)

## Layout

- Filter row: class `Select`, status filter chips (Pending/Graded/Late) — URL search
  params per `routing.md`.
- `Table`: student, assignment/test, submitted date, status `Badge`, `ghost` "Grade"
  action.
- Grading view (`Modal size="lg"` or dedicated panel): submission content
  (text/attached files) on one side, grading form on the other — points/grade `Input`,
  comment `Textarea`, "Save grade" primary button.
- Bulk action: row-selection checkboxes (per `data-display.md`'s `Table` spec) +
  a bulk "Mark as reviewed" for low-risk batch actions only — grading itself is never
  a bulk/optimistic action per `state-and-data.md`.

## States

- Saving a grade shows the inline button spinner pattern (label width unchanged) per
  `motion-and-interaction.md` — server-confirmed before the row updates to Graded.
