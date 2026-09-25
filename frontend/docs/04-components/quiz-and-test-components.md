# Quiz & Test Components

`components/domain/test/`. These power both the student "Take a test" experience
and the teacher "Test builder" / preview, sharing a renderer where possible so the
two never visually diverge.

## `QuestionRenderer`

Takes a `Question` (type: `multiple_choice` | `true_false` | `fill_blank` |
`matching` | `listening` | `writing`) and renders the correct input UI. Read-only
`preview` mode (teacher building/reviewing) vs interactive `answer` mode (student
taking the test) are the same component with a prop flag — not two separate
implementations, to guarantee they never drift apart visually.

- **Multiple choice / True-false:** large tappable option rows (min 48px height,
  full width), radio control per `forms-and-inputs.md`'s larger variant, selected
  state gets a `brand-navy-500` border + `surface-50` fill (not just the radio dot
  changing — the whole row should read as selected at a glance).
- **Fill in the blank:** the question text renders inline with an `Input` sized to
  content sitting in place of the blank, not a separate input below the sentence.
- **Matching:** two aligned columns (source terms / targets), connect via select
  dropdowns per row on mobile (drag-to-connect is a nice-to-have for desktop,
  post-v1 if drag interactions add too much build time) rather than requiring
  precision drag on touch devices.
- **Listening:** an `AudioPlayer` control (play/pause, scrub bar, playback speed
  0.75x/1x — no waveform visualization needed) above the question, replay allowed
  unless the test config disables it.
- **Writing:** a `Textarea`, word count shown bottom-end (`body-sm`, `ink-500`),
  teacher-graded — shows "Graded manually by your teacher" status instead of an
  instant score.

## `TestTimer`

Fixed position (top-end of the test-taking view, or sticky within the header on
mobile), numeral countdown (`mono` or tabular-nums sans), `ink-900` normally,
switches to `warning-600` under 5 minutes and `danger-600` under 1 minute — text
color change only, no flashing/pulsing animation (see `motion-and-interaction.md`).

## `QuestionNavigator`

A compact grid of numbered dots/squares (one per question) letting the student jump
around; current question in `brand-navy-900` fill, answered in `success-100` fill +
`success-600` border, unanswered/flagged distinguishable via a small flag icon
toggle. Collapsible on mobile into a "Question 4 of 10" bar with prev/next arrows
as the primary interaction, navigator grid behind a "Jump to question" tap.

## `TestSubmitBar`

Sticky bottom bar during a test: progress summary ("8 of 10 answered") on the
start side, "Submit test" primary button on the end side. Submitting with
unanswered questions triggers a `ConfirmDialog` listing which are unanswered before
final submission.

## `QuestionEditor` (teacher, test builder)

Form matching each question type above but in edit mode: question text, options
(add/remove rows), correct-answer designation, points value, skill tag assignment
(`SkillTag` multi-select), optional media attach (for listening questions, reuses
`FileUpload`). Lives inside a `Modal size="lg"` with a live `QuestionRenderer`
preview pane on larger screens (side-by-side above `lg` breakpoint, tabbed
Edit/Preview below it).

## `ResultSummaryCard`

Post-submission/graded view: large score (`h1`-weight numeral, tabular-nums),
pass/fail or grade-band `Badge`, `SkillBreakdownChart` showing performance by
tagged skill, and a per-question review list (question text, student's answer vs
correct answer, using `success`/`danger` coloring — reuses `QuestionRenderer` in a
`review` mode that overlays correctness).
