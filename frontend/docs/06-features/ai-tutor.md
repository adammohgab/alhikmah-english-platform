# Feature: AI Tutor (Gemini Integration)

Source: reference plan, "AI Tutor & Gemini Integration." Extended scope — additive to
the core platform, never a replacement for the course structure in `content-structure.md`.

## What it does

- Explains a lesson's content in simpler language, adapted to the student's `Grade`.
- Answers a student's question about the current lesson/unit.
- Gives extra practice examples on request, tagged with the relevant `SkillTag`.
- Grammar and vocabulary support, and translation (EN ↔ AR) for a selection of text.
- (Teacher-facing) drafts quiz questions / a full quiz skeleton from a lesson, always
  landing in the `QuestionEditor` (see `quiz-and-test-components.md`) for teacher
  review before publishing — AI never publishes a question directly.

## Where it lives in the frontend

`components/domain/ai-tutor/` (`TutorChatPanel`, `TutorMessageBubble`), state in
`stores/aiTutorStore.ts` (panel open/closed + the in-memory conversation buffer — this
is Zustand client-only state per `state-and-data.md`, not persisted server data), and
the network call goes through `lib/api/ai.ts` as a typed React Query **mutation**
(`useAskTutor()`, `useGenerateQuestions()`), never a raw `fetch`.

## Critical boundary: the frontend never touches Gemini directly

Per `tech-stack.md`: the frontend calls only our own backend endpoints
(`/api/ai/tutor`, `/api/ai/generate-questions`), which proxy to Gemini server-side.

- The Gemini API key is a server-side environment variable only. It is never present
  in client bundle code, `.env.local` (which is public-safe values only), screenshots,
  or committed to GitHub.
- Every AI request payload sent from the frontend includes the learning context
  (`grade`, `termId`, `unitId`, `lessonId`, relevant `SkillTag`s) so the backend can
  ground the Gemini call — the frontend's job is to assemble this context correctly,
  not to prompt-engineer Gemini itself.
- Responses render as plain text/markdown inside `TutorMessageBubble` — never raw HTML
  from the model (sanitize/escape before render).

## UI placement

- A tutor toggle lives in the lesson page (student role only) — a `ghost` icon button
  that opens `TutorChatPanel` as a right-side slide-in panel (desktop) or a full-height
  sheet (mobile), never a floating chat bubble over content per
  `iconography-and-imagery.md`'s "never decorative" rule — it's a labeled action, not
  a persistent widget.
- Panel open/close follows the Modal-adjacent motion timing in
  `motion-and-interaction.md` (160ms fade + translate).
- Loading state: a text-typing skeleton line (not a spinner) while waiting on a
  response, since responses can take a few seconds.

## States & errors

- Network/model failure surfaces as a `Toast` (per `feedback.md`) with the standard
  tone: "Couldn't reach the AI tutor. Try again in a moment." — never a raw API error.
- Rate limiting (if the backend enforces a per-student daily cap) shows as an inline
  message inside the panel, not a toast, since the student is actively looking at it:
  "You've reached today's AI tutor limit. It resets tomorrow."
- The tutor is explicitly **not** a substitute for teacher grading — writing
  submissions and graded work are never routed through this panel.

## Non-goals (v1)

- No voice input/output for the tutor (speaking features are explicitly future scope).
- No persistent cross-session conversation history in v1 — the buffer in
  `aiTutorStore.ts` resets on page reload; a persisted history is a later addition
  once retention/privacy handling for AI transcripts is decided.
