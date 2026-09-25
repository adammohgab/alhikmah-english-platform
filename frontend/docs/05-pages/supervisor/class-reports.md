# Page: Class Reports (`/app/supervisor/reports/classes`)

## Layout

- Filter row: class `Select`, grade `Select`, date range — all as URL search params
  (shareable/bookmarkable per `routing.md`).
- `ScoreTrendChart` for the selected class/grade over the date range.
- `SkillBreakdownChart` aggregated across the class, so supervisors see strength/weak
  spots by skill, not just an overall average.
- `Table` of students in the class: name, average score, trend, last active date,
  `ghost` "View student" action → a per-student results view (reuses `ResultSummaryCard`
  and `ScoreTrendChart` scoped to one student).
- "Export as PDF" action (reference plan: "Reports saved as PDF") — a `secondary`
  button that triggers a print-optimized render of the current filtered report.
