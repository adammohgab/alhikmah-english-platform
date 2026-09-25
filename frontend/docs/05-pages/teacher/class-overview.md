# Page: Class Overview (`/app/teacher/overview`)

Default/home route for the teacher role. Institutional density per
`principles-and-non-goals.md` rule 6 — this is a working screen, not a browsing one.

## Layout

- Stat row (`StatCard`s): active courses, pending submissions to grade, average class
  score, students needing attention (below a threshold — defined server-side).
- "Needs grading" table: student, assignment/test, submitted date, `ghost` "Grade" row
  action → grade-submissions page filtered to that item.
- "My classes" compact list: class name, student count, quick links to that class's
  course/test data.
- Recent announcements posted by this teacher (read-only preview, link to full
  announcements page).

## Data

`useTeacherOverviewSummary()`, one aggregate query per `state-and-data.md`'s
convention of one hooks file per domain.
