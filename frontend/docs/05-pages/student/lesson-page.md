# Page: Lesson Page (`/app/student/courses/:courseId/lessons/:lessonId`)

## Layout

- Breadcrumb-free per `layout-shell.md` (TopBar page title only) — but a small
  in-page "Unit 3: Travel" label (`body-sm`, `ink-500`) sits above the `h1` lesson
  title so the student has unit context without a second nav row.
- Content column capped at `max-w-prose` per `typography.md` rule 2, `body-lg` for
  reading text.
- Media (audio/video) renders inline where it appears in the lesson content, using
  the same `AudioPlayer` control specified in `quiz-and-test-components.md` for
  listening questions (play/pause, scrub, 0.75x/1x speed, no waveform).
- Resources (PDFs, worksheets) list at the bottom as compact rows: file-type icon +
  name + size, per the `FileUpload` "uploaded file" row treatment in
  `forms-and-inputs.md` (read-only rows, no remove button here).
- Sticky bottom bar (or end of content on mobile): "Mark as complete" `Button
  variant="primary"` and a "Next lesson" `ghost` button once complete.
- AI Tutor toggle: `ghost` icon button, top-inline-end of the content column — opens
  `TutorChatPanel` per `06-features/ai-tutor.md`.

## States

- **Loading:** skeleton matching text-block + media placeholder shape.
- **Lesson has an associated quiz:** a `Banner`-free inline card at the end of the
  lesson content, "Unit 3 Quiz — 10 questions, 20 minutes" + `Button` "Start quiz" →
  `/app/student/tests/:testId`.
