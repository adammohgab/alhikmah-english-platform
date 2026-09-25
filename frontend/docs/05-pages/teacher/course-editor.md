# Page: Course Editor (list: `/app/teacher/courses`, detail: `/app/teacher/courses/:courseId/edit`)

## List view

`Table` of the teacher's own courses (per `auth-and-roles.md`, a teacher only edits
their own): title, grade/term, unit count, published/draft `Badge`, `ghost` row
actions (edit/duplicate/archive). Primary button "Create course" top-end.

## Detail/edit view

- Course metadata form at top (`FormField`-wrapped `Input`s/`Select`s): title, grade,
  term, description.
- Unit list below as an accordion (`UnitAccordion`, `components/domain/course/`) —
  each unit expands to its lessons; drag-to-reorder units/lessons (keyboard-accessible
  reorder controls as the fallback, not drag-only).
- "Add lesson" opens a lesson editor: title, rich text for the reading content, media
  attach (`FileUpload`, audio/video), resources attach.
- "Add quiz to this unit" links into the Test Builder pre-scoped to this unit.
- AI assist: an inline "Draft with AI" action on the lesson editor invokes
  `useGenerateQuestions`-style AI drafting (see `06-features/ai-tutor.md`) — output
  always lands in the editable form fields for teacher review, never auto-saved.

## States

- Draft courses show a persistent `Banner`: "This course is a draft — students can't
  see it yet," per `feedback.md`'s Banner spec.
- Publish is a distinct explicit action (`Toggle` or a "Publish" button), never
  implicit on save.
