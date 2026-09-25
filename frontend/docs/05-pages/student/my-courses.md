# Page: My Courses (`/app/student/courses`)

Grid of every course the student is enrolled in.

## Layout

- Filter row: `Select` for grade/term if the student spans more than one (usually not,
  but keep it for edge cases), a skill filter chip row (per `SkillTag` colors).
- Card grid (`CourseCard`, `components/domain/course/`): 3 columns desktop, 2 tablet, 1
  mobile. Each card: course title (`h3`), unit count, `ProgressBar` (navy fill —
  aggregate progress, not "current active," so navy per the one-meaning-per-context
  rule in `data-display.md`), a skill-color left-edge accent bar (per the student
  experience amendment) matching the course's dominant skill focus.
- Card is a full click target (`Card variant="interactive"`) → course detail / unit list.

## States

- **Empty:** `EmptyState`, "No courses yet" / "Courses you're enrolled in will appear
  here." per `iconography-and-imagery.md`'s exact copy example.
- **Loading:** `CardSkeleton` grid matching the layout.

## Data

`useCourses()` from `lib/api/courses.ts`, scoped server-side to the authenticated
student via RLS — the frontend does not filter "my courses" client-side from a
full list.
