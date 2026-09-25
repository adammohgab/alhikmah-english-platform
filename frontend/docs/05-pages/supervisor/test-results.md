# Page: Test Results (`/app/supervisor/tests/results`)

School-wide test/quiz results, view-only.

## Layout

- Filter row: test/unit `Select`, class `Select`, grade `Select`.
- `Table`: test title, class, average score, completion rate, `ghost` "View breakdown"
  → `SkillBreakdownChart` + per-question difficulty view (which questions had the
  lowest correct-rate school-wide — useful signal for teachers, surfaced here for
  oversight).
