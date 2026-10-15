/* ========================================
   Question data model for QuestionRenderer (UIK-26)
   Mirrors the `questions` table payloads (backend/docs/02-DATA-MODEL-CORE.md §5):
   `prompt`, `options`, `answer`, `explanation`. The renderer is pure: it never fetches or saves.

   `answer` is the solution key. Students never receive it while attempting; the page passes it in
   (or a graded snapshot) only when it wants `showSolution`. Without it, `showSolution` shows no
   correct/incorrect marks, because there is nothing to compare against.

   Responses (`value` / `onChange`) use the same shape as the matching `answer`, so the page can
   send them to the backend unchanged.
   ======================================== */

export interface QuestionPrompt {
  text: string;
  /** Restricted rich text. Ignored by the renderer (plain text only, so nothing is injected). */
  html?: string | undefined;
}

/** An option, a matching side, a reorder item or a letter tile. */
export interface Choice {
  id: string;
  text: string;
}

interface QuestionBase {
  id: string;
  prompt: QuestionPrompt;
  /** Shown with the solution. */
  explanation?: string | undefined;
}

export interface MultipleChoiceQuestionData extends QuestionBase {
  type: "multiple_choice";
  options: Choice[];
  /** Several answers allowed (checkboxes). Defaults to `answer.correct.length > 1`. */
  multi?: boolean | undefined;
  answer?: { correct: string[] } | undefined;
}

export interface FillBlankQuestionData extends QuestionBase {
  type: "fill_blank";
  /** `prompt.text` holds `{{1}}`, `{{2}}`... markers, one per blank. */
  wordBank?: string[] | undefined;
  answer?: { blanks: string[][]; case_sensitive?: boolean | undefined } | undefined;
}

export interface MatchingQuestionData extends QuestionBase {
  type: "matching";
  options: { left: Choice[]; right: Choice[] };
  answer?: { pairs: Array<[string, string]> } | undefined;
}

export interface ReorderQuestionData extends QuestionBase {
  type: "reorder";
  /** Items in the order they are first shown (the server shuffles them). */
  options: { items: Choice[] };
  answer?: { order: string[] } | undefined;
}

export interface ShortAnswerQuestionData extends QuestionBase {
  type: "short_answer";
  minWords?: number | undefined;
  maxWords?: number | undefined;
  /** Optional auto-checkable answers. Without them the solution shows `sampleAnswer` ungraded. */
  answer?: { accepted: string[] } | undefined;
  sampleAnswer?: string | undefined;
}

export interface AudioSpellingQuestionData extends QuestionBase {
  type: "audio_spelling";
  /** Resolved audio URL (the page turns `audio_asset_id` into a URL; the renderer stays pure). */
  audioUrl?: string | undefined;
  /** Letter tiles, `text` is the letter. Include every letter of the word (plus any distractors). */
  options: { tiles: Choice[] };
  answer?: { word: string; accepted?: string[] | undefined } | undefined;
}

export type Question =
  | MultipleChoiceQuestionData
  | FillBlankQuestionData
  | MatchingQuestionData
  | ReorderQuestionData
  | ShortAnswerQuestionData
  | AudioSpellingQuestionData;

export type QuestionType = Question["type"];

export interface MultipleChoiceValue {
  selected: string[];
}
export interface FillBlankValue {
  /** One entry per blank, in marker order. */
  blanks: string[];
}
export interface MatchingValue {
  /** `[leftId, rightId]` pairs. */
  pairs: Array<[string, string]>;
}
export interface ReorderValue {
  /** Item ids in the student's order. */
  order: string[];
}
export interface ShortAnswerValue {
  text: string;
}
export interface AudioSpellingValue {
  /** Placed tile ids, in order. */
  tiles: string[];
}

export interface QuestionValueMap {
  multiple_choice: MultipleChoiceValue;
  fill_blank: FillBlankValue;
  matching: MatchingValue;
  reorder: ReorderValue;
  short_answer: ShortAnswerValue;
  audio_spelling: AudioSpellingValue;
}

export type QuestionValue = QuestionValueMap[QuestionType];
