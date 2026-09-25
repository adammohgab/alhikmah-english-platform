# Page: School Overview (`/app/supervisor/overview`)

Default/home route for the supervisor role. School-wide read visibility per
`auth-and-roles.md` permission table.

## Layout

- Stat row: total students, total teachers, school-wide average score, courses
  pending review (draft courses awaiting a supervisor glance — view-only, not an
  approval gate unless the school workflow requires one later).
- `ClassAverageBarChart` (per `data-display.md`): average score by class, bars in
  `brand-navy-500`, no highlighted bar unless a class is selected via the chart's own
  interaction.
- "Classes needing attention" table: class, average score, trend indicator
  (`success`/`danger` arrow, per `StatCard`'s trend spec), link into Class Reports
  filtered to that class.
