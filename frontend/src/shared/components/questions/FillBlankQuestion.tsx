import { Fragment, useId } from "react";
import { cn } from "@/shared/lib/utils/cn";
import {
  Explanation,
  FOCUS_RING,
  isLocked,
  matchesAny,
  VERDICT_STYLE,
  Verdict,
  type QuestionProps,
} from "./shared";
import type { FillBlankQuestionData, FillBlankValue } from "./types";

/* Inline input slots inside the sentence. `prompt.text` marks each blank with {{1}}, {{2}}...
   An optional word bank offers tap-to-fill chips (fills the first empty blank). */

const MARKER = /(\{\{\d+\}\})/;
const MARKER_NUMBER = /^\{\{(\d+)\}\}$/;

export function FillBlankQuestion({
  question,
  value,
  onChange,
  readOnly,
  showSolution,
  className,
}: QuestionProps<FillBlankQuestionData, FillBlankValue>) {
  const promptId = useId();
  const locked = isLocked({ readOnly, showSolution, onChange });
  const parts = question.prompt.text.split(MARKER);
  const blankCount = parts.reduce((max, part) => {
    const match = MARKER_NUMBER.exec(part);
    return match?.[1] ? Math.max(max, Number(match[1])) : max;
  }, 0);
  const given = Array.from({ length: blankCount }, (_, i) => value?.blanks[i] ?? "");
  const key = question.answer;
  const caseSensitive = key?.case_sensitive ?? false;

  const setBlank = (index: number, text: string) => {
    if (locked || !onChange) return;
    onChange({ blanks: given.map((entry, i) => (i === index ? text : entry)) });
  };
  const fillFirstEmpty = (word: string) => {
    const index = given.findIndex((entry) => entry.trim() === "");
    if (index >= 0) setBlank(index, word);
  };

  const wrong: Array<{ number: number; answer: string }> = [];

  return (
    <div role="group" aria-labelledby={promptId} className={cn("flex flex-col gap-4", className)}>
      <p id={promptId} className="font-heading text-[20px] font-semibold leading-[2.6] text-stroke">
        {parts.map((part, i) => {
          const match = MARKER_NUMBER.exec(part);
          if (!match?.[1]) return <Fragment key={i}>{part}</Fragment>;
          const number = Number(match[1]);
          const index = number - 1;
          const text = given[index] ?? "";
          const accepted = key?.blanks[index];
          const graded = Boolean(showSolution) && accepted !== undefined;
          const correct = graded && matchesAny(text, accepted, caseSensitive);
          if (graded && !correct && accepted[0] !== undefined) {
            wrong.push({ number, answer: accepted[0] });
          }
          return (
            <span key={i} className="mx-1 inline-flex items-center gap-1 align-middle">
              <input
                type="text"
                value={text}
                readOnly={locked}
                aria-label={`Blank ${number}`}
                aria-invalid={graded && !correct ? true : undefined}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                onChange={(event) => setBlank(index, event.target.value)}
                style={{ width: `${Math.max(7, text.length + 2)}ch` }}
                className={cn(
                  "h-11 max-w-full rounded-[12px] border-2 bg-surface-0 px-3 text-center font-body text-[17px] font-semibold text-stroke",
                  graded
                    ? correct
                      ? VERDICT_STYLE.correct
                      : VERDICT_STYLE.wrong
                    : "border-stroke focus:bg-[var(--world-tint,#fff1e3)]",
                  FOCUS_RING,
                )}
              />
              {graded && (
                <Verdict correct={correct}>
                  <span className="sr-only">{correct ? "Correct" : "Incorrect"}</span>
                </Verdict>
              )}
            </span>
          );
        })}
      </p>

      {question.wordBank && question.wordBank.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Word bank">
          {question.wordBank.map((word, i) => (
            <button
              key={`${word}-${i}`}
              type="button"
              disabled={locked}
              onClick={() => fillFirstEmpty(word)}
              className={cn(
                "h-10 rounded-full border-2 border-stroke bg-[var(--world-soft,#ffd93d)] px-4 text-[15px] font-bold text-stroke disabled:border-dashed disabled:bg-surface-200 disabled:text-muted",
                FOCUS_RING,
              )}
            >
              {word}
            </button>
          ))}
        </div>
      )}

      {showSolution && wrong.length > 0 && (
        <ul className="flex flex-col gap-1 text-[15px] text-stroke">
          {wrong.map((item) => (
            <li key={item.number}>
              <Verdict correct={false}>Blank {item.number}</Verdict>{" "}
              <span>
                Correct answer: <strong>{item.answer}</strong>
              </span>
            </li>
          ))}
        </ul>
      )}
      {showSolution && <Explanation text={question.explanation} />}
    </div>
  );
}
