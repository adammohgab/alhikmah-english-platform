# Page: Take a Test (`/app/student/tests/:testId`)

Not a nav item — entered only from a course/lesson/dashboard link, per `routing.md`.
The full-screen, focused test-taking experience. Shares `QuestionRenderer` with the
teacher test builder's preview (`quiz-and-test-components.md`) in `answer` mode.

## Layout

- Minimal chrome: `TopBar` shows only the test title + `TestTimer` (top-end, or
  sticky in-header on mobile) — no sidebar distraction during a test (consider a
  reduced/hidden `Sidebar` state for this route).
- One question per screen (mobile) or a scrollable single-question focus area
  (desktop) rendered via `QuestionRenderer`.
- `QuestionNavigator` — grid of dots on desktop; collapses to "Question 4 of 10" +
  prev/next arrows on mobile, full grid behind a "Jump to question" tap.
- `TestSubmitBar` sticky at the bottom: progress summary + "Submit test" primary
  button.

## Session handling (critical)

- Answers buffer into `stores/testSessionStore.ts` (Zustand) as the student answers,
  **and** sync to the server periodically (not only at final submit) so a dropped
  connection or session expiry mid-test does not lose progress — per the safeguard
  called out in `auth-and-roles.md`.
- On session expiry mid-test: do not silently log out. Show a re-auth prompt
  (inline, not a full redirect) that restores the exact question/answer state after
  re-authentication.
- Final submission is server-confirmed before showing the result — no optimistic
  "submitted" state, per `state-and-data.md`'s correctness-over-snappiness rule.

## Submission flow

Clicking "Submit test" with unanswered questions triggers a `ConfirmDialog` (per
`feedback.md`) listing which question numbers are unanswered before final submit.
On success, redirect to the result view (`ResultSummaryCard`).

## Non-goals

No pausing/resuming across days unless the test config explicitly allows it (test
scheduling window is a teacher-set constraint, not a student control).
