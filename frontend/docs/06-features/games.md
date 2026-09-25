# Feature: Educational Games

Source: reference plan, "Educational Games." Extended scope, student-role only.
Every game is tied to real curriculum content (a specific unit, lesson, or skill) —
never generic filler content, per `project-overview.md`.

## The seven games (v1 list from the reference plan)

| Game | Mechanic | Skill(s) | Content source |
|---|---|---|---|
| Vocabulary Match | Match a word to its meaning | Vocabulary | Unit vocabulary list |
| Word Builder | Assemble letters into a correct word | Vocabulary, Spelling | Unit vocabulary list |
| Grammar Challenge | Choose/build the correct sentence form | Grammar | Unit grammar rules |
| Reading Challenge | Short text + timed comprehension questions | Reading | Lesson reading text |
| Sentence Builder | Drag/arrange words into a correct sentence | Grammar, Writing | Unit grammar rules |
| Spelling | Type the word correctly from a prompt | Vocabulary | Selected lesson's word list |
| Timed Quiz | Fast multiple-choice round with a running score | Any (mixed) | Selected unit or skill |

## Where it lives in the frontend

`components/domain/games/` (`GameCard` for the picker grid, one component per game,
e.g. `VocabularyMatchBoard`), routed under a dedicated `features/student/games/`
module (not in the v1 route map yet — add as `/app/student/games` and
`/app/student/games/:gameId` when this phase starts, guarded by `RoleGuard
roles={['student']}` like every other student route).

## Data flow

- A game is always entered **from context** — a "Practice this" action on a unit or
  lesson page, or from a dedicated Games hub filtered by grade/unit/skill. A game is
  never launched with placeholder/lorem content.
- Game content (word lists, sentences, grammar rules) is derived from the existing
  `Unit`/`Lesson`/`Activity` shapes in `content-structure.md` — games do not introduce
  a second authoring path. If a teacher adds vocabulary to a unit, it becomes
  available to Vocabulary Match/Word Builder/Spelling automatically.
- Game session state (current round, score-in-progress, time remaining) is Zustand,
  client-only, per `state-and-data.md` — it is not server truth until the round ends.
- On completion, the result posts once via a React Query mutation
  (`useSubmitGameResult()`), server-confirmed (not optimistic — same rule as test
  submission), and appears in the student's activity/progress data alongside quiz
  results, tagged by skill.

## Visual & interaction rules

Games follow the **student experience amendment** (see
`02-design-system/student-experience-amendment.md`), not a separate game-y visual
language: flat cards, `radius-md`, the existing type scale, `brand-gold-500` used for
the active/correct state and the end-of-round score. No mascots, no sound effects, no
confetti, no leaderboard (leaderboards are explicitly post-v1). A game should look
like it belongs to the same product as the dashboard, just interactive.

- Correct/incorrect feedback: color + icon together (never color alone), per the
  accessibility rule in `motion-and-interaction.md`.
- Timed games (Reading Challenge, Timed Quiz) reuse the `TestTimer` numeral-only
  countdown treatment from `quiz-and-test-components.md` — same warning/danger color
  steps, no flashing.
- End-of-round summary reuses `ResultSummaryCard`'s visual language (large tabular-nums
  score, skill breakdown) rather than inventing a new "game over" screen.

## Non-goals (v1)

- No multiplayer/real-time competitive modes.
- No badges or unlockable cosmetics (post-v1, tracked alongside badges/leaderboards
  in the reference plan).
- No offline play — games assume the same connectivity baseline as the rest of the app.
