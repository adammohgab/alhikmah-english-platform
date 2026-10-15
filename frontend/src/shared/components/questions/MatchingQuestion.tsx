import { useId, useState, type KeyboardEvent } from "react";
import { cn } from "@/shared/lib/utils/cn";
import {
  Explanation,
  FOCUS_RING,
  isLocked,
  PromptText,
  VERDICT_STYLE,
  Verdict,
  type QuestionProps,
} from "./shared";
import type { Choice, MatchingQuestionData, MatchingValue } from "./types";

/* Connect pairs with the keyboard, mouse or touch: pick an item on the left, then its match on the
   right. Each connected pair shares a number badge on both sides (no lines to track, no color
   dependence). Delete / Backspace on a matched left item, or choosing a matched right item with
   nothing selected, removes the match. A polite live region announces every change. */

const ITEM =
  "relative flex min-h-[52px] w-full items-center gap-3 rounded-[16px] border-2 px-3 py-2 text-left text-[16px] font-semibold text-stroke transition-transform disabled:cursor-default";

type Pair = [string, string];

function Badge({ n }: { n: number }) {
  return (
    <span
      aria-hidden="true"
      className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-stroke bg-surface-0 text-[13px] font-bold"
    >
      {n}
    </span>
  );
}

export function MatchingQuestion({
  question,
  value,
  onChange,
  readOnly,
  showSolution,
  className,
}: QuestionProps<MatchingQuestionData, MatchingValue>) {
  const promptId = useId();
  const hintId = useId();
  const locked = isLocked({ readOnly, showSolution, onChange });
  const { left, right } = question.options;
  const pairs: Pair[] = value?.pairs ?? [];
  const [active, setActive] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const textOf = (list: Choice[], id: string) => list.find((c) => c.id === id)?.text ?? "";
  const rightOf = (leftId: string) => pairs.find(([l]) => l === leftId)?.[1];
  const leftOf = (rightId: string) => pairs.find(([, r]) => r === rightId)?.[0];
  const numberOf = (leftId: string) => left.findIndex((c) => c.id === leftId) + 1;
  const commit = (next: Pair[]) => onChange?.({ pairs: next });

  const pickLeft = (id: string) => {
    if (locked) return;
    if (active === id) {
      setActive(null);
      setMessage("Selection cancelled.");
      return;
    }
    setActive(id);
    setMessage(`${textOf(left, id)} selected. Now choose its match on the right.`);
  };

  const pickRight = (id: string) => {
    if (locked) return;
    if (active === null) {
      const partner = leftOf(id);
      if (partner === undefined) {
        setMessage("Select an item on the left first.");
        return;
      }
      commit(pairs.filter(([l]) => l !== partner));
      setMessage(`Match removed for ${textOf(left, partner)}.`);
      return;
    }
    commit([...pairs.filter(([l, r]) => l !== active && r !== id), [active, id]]);
    setMessage(`${textOf(left, active)} matched with ${textOf(right, id)}.`);
    setActive(null);
  };

  const onLeftKeyDown = (event: KeyboardEvent<HTMLButtonElement>, id: string) => {
    if (locked || (event.key !== "Delete" && event.key !== "Backspace")) return;
    if (rightOf(id) === undefined) return;
    event.preventDefault();
    commit(pairs.filter(([l]) => l !== id));
    setMessage(`Match removed for ${textOf(left, id)}.`);
  };

  const key = question.answer?.pairs;
  const grading = Boolean(showSolution) && key !== undefined;
  const expectedRight = (leftId: string) => key?.find(([l]) => l === leftId)?.[1];

  return (
    <div
      role="group"
      aria-labelledby={promptId}
      aria-describedby={hintId}
      className={cn("flex flex-col gap-4", className)}
    >
      <PromptText id={promptId} prompt={question.prompt} />
      {!locked && (
        <p id={hintId} className="text-[14px] text-muted">
          Select an item on the left, then its match on the right. Press Delete to remove a match.
        </p>
      )}
      <div className="grid grid-cols-2 gap-4">
        <ul aria-label="Items" className="flex flex-col gap-3">
          {left.map((item) => {
            const partner = rightOf(item.id);
            const isActive = active === item.id;
            const expected = expectedRight(item.id);
            const correct = grading && partner !== undefined && partner === expected;
            let tone = "border-stroke bg-surface-0 shadow-[0_3px_0_0_#000]";
            if (grading) {
              tone = cn(
                correct ? VERDICT_STYLE.correct : VERDICT_STYLE.wrong,
                "shadow-[0_3px_0_0_#000]",
              );
            } else if (isActive) {
              tone = "translate-y-[3px] border-stroke bg-[var(--world-main,#ffb84d)] shadow-none";
            } else if (partner !== undefined) {
              tone = "border-stroke bg-[var(--world-soft,#ffd93d)] shadow-[0_3px_0_0_#000]";
            }
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={locked}
                  aria-pressed={isActive}
                  onClick={() => pickLeft(item.id)}
                  onKeyDown={(event) => onLeftKeyDown(event, item.id)}
                  className={cn(ITEM, tone, FOCUS_RING)}
                >
                  {partner !== undefined && <Badge n={numberOf(item.id)} />}
                  <span className="flex-1">{item.text}</span>
                  {partner !== undefined && (
                    <span className="sr-only">Matched with {textOf(right, partner)}.</span>
                  )}
                  {grading && (
                    <Verdict correct={correct}>{correct ? "Correct" : "Incorrect"}</Verdict>
                  )}
                </button>
                {grading && !correct && expected !== undefined && (
                  <p className="mt-1 px-1 text-[14px] text-stroke">
                    Correct match: <strong>{textOf(right, expected)}</strong>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        <ul aria-label="Matches" className="flex flex-col gap-3">
          {right.map((item) => {
            const partner = leftOf(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => pickRight(item.id)}
                  className={cn(
                    ITEM,
                    partner !== undefined
                      ? "border-stroke bg-[var(--world-soft,#ffd93d)] shadow-[0_3px_0_0_#000]"
                      : "border-stroke bg-surface-0 shadow-[0_3px_0_0_#000]",
                    FOCUS_RING,
                  )}
                >
                  {partner !== undefined && <Badge n={numberOf(partner)} />}
                  <span className="flex-1">{item.text}</span>
                  {partner !== undefined && (
                    <span className="sr-only">Matched with {textOf(left, partner)}.</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <p role="status" className="sr-only">
        {message}
      </p>
      {showSolution && <Explanation text={question.explanation} />}
    </div>
  );
}
