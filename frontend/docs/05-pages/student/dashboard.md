# Page: Student Dashboard (`/app/student/dashboard`)

Default/home route for the student role. Reference: reference plan "Screen 1: Student
Dashboard." Follows the student experience amendment (more air, gold does more work).

## Layout

1. **Greeting header** — `h1` "Welcome back, {firstName}" (serif). No subtitle needed;
   the stat row below carries the information.
2. **Stat row** — three `StatCard`s (`data-display.md`): Courses (count), Average
   score (%, tabular-nums), Study streak (days, numeral in `brand-gold-500` per the
   amendment). Equal-width, `space-6` gap, wraps to a stacked column under `md`.
3. **"Continue learning"** section (`h2` + one-line framing per the amendment) — a
   list of in-progress courses, each a row: course/unit title, `ProgressBar`
   (gold fill — this is the "active/current progress" context called out in
   `data-display.md`), percentage at the end. Clicking a row deep-links into that
   course's next incomplete lesson.
4. **Upcoming** — a compact list/banner of the next due quiz or assignment (date,
   title), primary `Button` "Start"/"Continue" if actionable today.
5. **Recent feedback** (optional, below the fold) — latest 2–3 teacher comments on
   graded work, each a small card with course name, a one-line excerpt, and a link to
   the full result.

## Data

`useDashboardSummary()` (React Query) — a single aggregate hook backing all of the
above so the page doesn't fire five separate queries; invalidated on test/assignment
submission per `state-and-data.md`'s narrowest-key rule.

## States

- **Loading:** route-level skeleton matching this exact layout (three stat blocks +
  two list-shaped blocks), not a spinner.
- **Empty (brand-new student, no courses assigned yet):** `EmptyState` — "No courses
  yet" / "Courses you're enrolled in will appear here." No CTA (enrollment is
  teacher/supervisor-driven, not self-serve).
- **Error:** inline `Banner` at the top of the content area, "Couldn't load your
  dashboard. Try again." + retry action — page-level read failure per `feedback.md`.
