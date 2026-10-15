import { AudioSpellingQuestion } from "./AudioSpellingQuestion";
import { FillBlankQuestion } from "./FillBlankQuestion";
import { MatchingQuestion } from "./MatchingQuestion";
import { MultipleChoiceQuestion } from "./MultipleChoiceQuestion";
import { ReorderQuestion } from "./ReorderQuestion";
import { ShortAnswerQuestion } from "./ShortAnswerQuestion";
import type { Question, QuestionValueMap } from "./types";

/* ========================================
   QuestionRenderer (UIK-26)
   Picks the right component from `question.type` and exposes one interface for all six:
     question      the question data (see types.ts, same shapes as the `questions` table)
     value         the student's response, shaped like the matching `answer` (undefined = untouched)
     onChange      called with the full next value; omit it for a read-only question
     readOnly      locks input
     showSolution  locks input and marks correct vs incorrect (needs `question.answer`)
   Pure: no fetching, no saving. The page decides when to send `value` to the backend.
   ======================================== */

/** Props are a union over the question types, so `value` and `onChange` match `question.type`. */
export type QuestionRendererProps = {
  [T in Question["type"]]: {
    question: Extract<Question, { type: T }>;
    value?: QuestionValueMap[T] | undefined;
    onChange?: ((value: QuestionValueMap[T]) => void) | undefined;
    readOnly?: boolean | undefined;
    showSolution?: boolean | undefined;
    className?: string | undefined;
  };
}[Question["type"]];

type PropsOf<T extends Question["type"]> = Extract<
  QuestionRendererProps,
  { question: { type: T } }
>;

export function QuestionRenderer(props: QuestionRendererProps) {
  switch (props.question.type) {
    case "multiple_choice":
      return <MultipleChoiceQuestion {...(props as PropsOf<"multiple_choice">)} />;
    case "fill_blank":
      return <FillBlankQuestion {...(props as PropsOf<"fill_blank">)} />;
    case "matching":
      return <MatchingQuestion {...(props as PropsOf<"matching">)} />;
    case "reorder":
      return <ReorderQuestion {...(props as PropsOf<"reorder">)} />;
    case "short_answer":
      return <ShortAnswerQuestion {...(props as PropsOf<"short_answer">)} />;
    case "audio_spelling":
      return <AudioSpellingQuestion {...(props as PropsOf<"audio_spelling">)} />;
    default:
      return null;
  }
}
