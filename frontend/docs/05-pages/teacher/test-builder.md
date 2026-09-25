# Page: Test Builder (list: `/app/teacher/tests`, detail: `/app/teacher/tests/:testId/edit`)

Reference: reference plan "Screen 2: Teacher Test Builder."

## List view

`Table`: test title, unit/course, question count, status `Badge`
(Draft/Published/Closed), `ghost` row actions.

## Detail/edit view

- Header: title `Input`, duration (`TimePicker`/number input), question count (derived,
  read-only), "Auto-grade" indicator (informational — auto-grading is automatic for
  all types except `writing`).
- Question list, each row summarized (question text truncated, type `Badge`, points),
  "Edit"/"Delete"/reorder `ghost` actions, "Add question" primary button opens
  `QuestionEditor` in a `Modal size="lg"`.
- `QuestionEditor`: question text, type `Select` (multiple_choice / true_false /
  fill_blank / matching / listening / writing), options/answer config per type, points
  value, `SkillTag` multi-select, media attach for listening. Live `QuestionRenderer`
  preview pane side-by-side above `lg`, tabbed Edit/Preview below it — exactly as
  specified in `quiz-and-test-components.md`.
- Test-level settings: "Allow retakes" `Toggle`, scheduling window (`DatePicker` x2),
  "Publish this test" `Toggle`.
- "Preview as student" button opens the same `QuestionRenderer` flow in `preview` mode
  full-screen, guaranteeing builder and student views never visually diverge.

## Question Bank

`/app/teacher/question-bank` — a searchable/filterable (by skill, type, unit) `Table`
of all questions the teacher has authored, reusable across tests via an "Add to test"
action from either direction (bank → test, or test → pull from bank instead of
authoring new).
