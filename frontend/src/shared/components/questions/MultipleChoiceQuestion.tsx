import { useId } from "react";
import { Check } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";
import {
  Explanation,
  isLocked,
  PromptText,
  VERDICT_STYLE,
  Verdict,
  type QuestionProps,
} from "./shared";
import type { MultipleChoiceQuestionData, MultipleChoiceValue } from "./types";

/* Tactile selection cards. Native radio / checkbox inputs (visually hidden) carry the keyboard and
   screen reader behavior: arrow keys inside a radio group, Space to toggle a checkbox. The card
   itself shows selection with fill, a check mark and a pressed-in shadow, never color alone. */

const CARD =
  "relative flex min-h-[56px] items-center gap-3 rounded-[16px] border-2 border-stroke px-4 py-3 text-[17px] font-semibold text-stroke transition-transform";

export function MultipleChoiceQuestion({
  question,
  value,
  onChange,
  readOnly,
  showSolution,
  className,
}: QuestionProps<MultipleChoiceQuestionData, MultipleChoiceValue>) {
  const promptId = useId();
  const groupName = useId();
  const locked = isLocked({ readOnly, showSolution, onChange });
  const selected = value?.selected ?? [];
  const key = question.answer?.correct;
  const multi = question.multi ?? (key !== undefined && key.length > 1);
  const grading = Boolean(showSolution) && key !== undefined;

  const choose = (id: string) => {
    if (locked || !onChange) return;
    if (!multi) onChange({ selected: [id] });
    else {
      onChange({
        selected: selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id],
      });
    }
  };

  return (
    <div
      role={multi ? "group" : "radiogroup"}
      aria-labelledby={promptId}
      className={cn("flex flex-col gap-4", className)}
    >
      <PromptText id={promptId} prompt={question.prompt} />
      {multi && !locked && <p className="text-[14px] text-muted">Select all that apply.</p>}
      <div className="flex flex-col gap-3">
        {question.options.map((option) => {
          const isSelected = selected.includes(option.id);
          const isKey = key?.includes(option.id) ?? false;
          let tone = "bg-surface-0 shadow-[0_3px_0_0_#000]";
          if (grading) {
            if (isKey) tone = cn(VERDICT_STYLE.correct, "shadow-[0_3px_0_0_#000]");
            else if (isSelected) tone = cn(VERDICT_STYLE.wrong, "shadow-[0_3px_0_0_#000]");
          } else if (isSelected) {
            tone = "translate-y-[3px] bg-[var(--world-main,#ffb84d)] shadow-none";
          }
          return (
            <label key={option.id} className={cn("block", !locked && "cursor-pointer")}>
              <input
                type={multi ? "checkbox" : "radio"}
                name={groupName}
                className="peer sr-only"
                checked={isSelected}
                disabled={locked}
                onChange={() => choose(option.id)}
              />
              <span
                className={cn(
                  CARD,
                  tone,
                  "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-stroke",
                  !locked && !isSelected && "hover:bg-[var(--world-tint,#fff1e3)]",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid h-6 w-6 shrink-0 place-items-center border-2 border-stroke bg-surface-0",
                    multi ? "rounded-[6px]" : "rounded-full",
                  )}
                >
                  {isSelected && <Check size={16} strokeWidth={4} />}
                </span>
                <span className="flex-1">{option.text}</span>
                {grading && isKey && (
                  <Verdict correct>{isSelected ? "Correct" : "Correct answer"}</Verdict>
                )}
                {grading && !isKey && isSelected && <Verdict correct={false}>Incorrect</Verdict>}
              </span>
            </label>
          );
        })}
      </div>
      {showSolution && <Explanation text={question.explanation} />}
    </div>
  );
}
