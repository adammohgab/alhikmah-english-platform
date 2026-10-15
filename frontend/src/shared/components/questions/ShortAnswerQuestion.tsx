import { useId } from "react";
import { cn } from "@/shared/lib/utils/cn";
import {
  Explanation,
  FOCUS_RING,
  isLocked,
  matchesAny,
  PromptText,
  VERDICT_STYLE,
  Verdict,
  type QuestionProps,
} from "./shared";
import type { ShortAnswerQuestionData, ShortAnswerValue } from "./types";

/* Freeform text area with a live word count (min / max words from the question). With
   `answer.accepted` the solution grades it; otherwise it shows the model answer ungraded. */

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

export function ShortAnswerQuestion({
  question,
  value,
  onChange,
  readOnly,
  showSolution,
  className,
}: QuestionProps<ShortAnswerQuestionData, ShortAnswerValue>) {
  const promptId = useId();
  const countId = useId();
  const locked = isLocked({ readOnly, showSolution, onChange });
  const text = value?.text ?? "";
  const words = countWords(text);
  const { minWords, maxWords } = question;
  const tooShort = minWords !== undefined && words < minWords;
  const tooLong = maxWords !== undefined && words > maxWords;
  const accepted = question.answer?.accepted;
  const graded = Boolean(showSolution) && accepted !== undefined && accepted.length > 0;
  const correct = graded && matchesAny(text, accepted);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <PromptText id={promptId} prompt={question.prompt} />
      <textarea
        value={text}
        readOnly={locked}
        rows={5}
        aria-labelledby={promptId}
        aria-describedby={countId}
        aria-invalid={graded && !correct ? true : undefined}
        spellCheck
        onChange={(event) => onChange?.({ text: event.target.value })}
        className={cn(
          "w-full resize-y rounded-[16px] border-2 bg-surface-0 px-4 py-3 font-body text-[17px] leading-relaxed text-stroke",
          graded
            ? correct
              ? VERDICT_STYLE.correct
              : VERDICT_STYLE.wrong
            : "border-stroke focus:bg-[var(--world-tint,#fff1e3)]",
          FOCUS_RING,
        )}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-[14px]">
        <span
          id={countId}
          className={cn("font-semibold", tooLong ? "text-danger-600" : "text-muted")}
        >
          {words}
          {maxWords !== undefined ? ` / ${maxWords}` : ""} words
          {!locked && tooShort ? ` (at least ${minWords})` : ""}
          {tooLong ? " (too long)" : ""}
        </span>
        {graded && <Verdict correct={correct}>{correct ? "Correct" : "Incorrect"}</Verdict>}
      </div>
      {showSolution && graded && !correct && accepted[0] !== undefined && (
        <p className="text-[15px] text-stroke">
          Correct answer: <strong>{accepted[0]}</strong>
        </p>
      )}
      {showSolution && !graded && question.sampleAnswer && (
        <p className="rounded-[12px] border-2 border-stroke bg-surface-200 px-4 py-3 text-[15px] text-stroke">
          <strong>Model answer: </strong>
          {question.sampleAnswer}
        </p>
      )}
      {showSolution && <Explanation text={question.explanation} />}
    </div>
  );
}
