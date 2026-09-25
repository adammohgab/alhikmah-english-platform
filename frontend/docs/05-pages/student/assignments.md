# Page: Assignments (`/app/student/assignments`)

## Layout

- Tabs or filter chips: "Due", "Submitted", "Graded" (URL search param per
  `routing.md`'s shareable-state rule: `?status=due`).
- List/table of assignments: title, course, due date (`warning-600` text if due
  within 48h, `danger-600` if overdue — text/icon, never color alone), status `Badge`.
- Assignment detail (modal `size="md"` or its own view): instructions text, a
  `FileUpload` dropzone for attachments or a `Textarea` for text-submission
  assignments, "Submit" primary button.

## States

- Submitted-but-not-graded: `Badge variant="warning"`, submission is read-only, shows
  submitted file(s)/text with a "Submitted on {date}" note.
- Graded: `Badge variant="success"`, shows the grade + teacher comment inline, reusing
  the feedback-card treatment from the dashboard's "Recent feedback" section.
- Overdue with no submission: `Badge variant="danger"`, submission still allowed
  unless the teacher has closed it (closed state shows a disabled `FileUpload` +
  explanatory helper text, not a hidden control).
