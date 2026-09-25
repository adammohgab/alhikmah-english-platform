# Page: Course Review (`/app/supervisor/courses/review`)

View-only across all teachers' courses (`auth-and-roles.md`: supervisor has
"view-only, all" for courses/lessons).

## Layout

- `Table`: course title, teacher, grade/term, status `Badge`, `ghost` "View" action.
- Detail view reuses the Course Editor's read layout (`05-pages/teacher/course-editor.md`)
  but with every input rendered disabled/read-only — same component, a `readOnly` prop,
  never a separately built duplicate screen, per `component-guidelines.md`'s
  "no component reinvented per page" rule.
