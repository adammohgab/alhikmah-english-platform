# Page: My Results (`/app/student/results`)

## Layout

- Filter row: `Select` for course/unit, date range via `DatePicker`.
- List of past assessments, each row: title, date, `Badge` (Graded/Pending — writing
  questions show "Graded manually by your teacher" per
  `quiz-and-test-components.md`), score (tabular-nums), skill breakdown preview.
- `ScoreTrendChart` (Recharts, per `data-display.md`) above the list: score over time
  across all tests, `brand-navy-500` line, `brand-gold-500` dot on the latest point.
- Clicking a row opens `ResultSummaryCard` in full (large score, `SkillBreakdownChart`,
  per-question review list with correct/incorrect coloring).

## States

- **Empty:** `EmptyState`, "No results yet" / "Your test and quiz results will appear
  here."
- Pending manually-graded writing work shows a `warning`-toned `Badge`, not `danger` —
  it's not wrong, just not yet graded.
