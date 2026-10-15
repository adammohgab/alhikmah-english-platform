import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
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
import type { ReorderQuestionData, ReorderValue } from "./types";

/* Three ways to reorder, all producing the same `order`:
   - Keyboard (WAI-ARIA "sortable" pattern): focus a row, Space / Enter picks it up, ArrowUp /
     ArrowDown moves it, Space / Enter drops it, Escape cancels and restores the old order.
     Without a pick-up, ArrowUp / ArrowDown just move focus between rows.
   - Move up / move down buttons (touch and mouse, not in the tab order to keep Tab short).
   - Mouse drag and drop (HTML5). Every move is announced in a polite live region. */

function resolveOrder(order: string[] | undefined, ids: string[]): string[] {
  const valid = (order ?? []).filter((id, i, all) => ids.includes(id) && all.indexOf(id) === i);
  return [...valid, ...ids.filter((id) => !valid.includes(id))];
}

export function ReorderQuestion({
  question,
  value,
  onChange,
  readOnly,
  showSolution,
  className,
}: QuestionProps<ReorderQuestionData, ReorderValue>) {
  const promptId = useId();
  const hintId = useId();
  const locked = isLocked({ readOnly, showSolution, onChange });
  const items = question.options.items;
  const order = resolveOrder(
    value?.order,
    items.map((item) => item.id),
  );
  const textOf = (id: string) => items.find((item) => item.id === id)?.text ?? "";

  const [grabbed, setGrabbed] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const origin = useRef<string[]>([]);
  const rows = useRef(new Map<string, HTMLDivElement>());
  const pendingFocus = useRef<string | null>(null);

  // Moved rows can lose focus when the browser re-inserts them; give it back right after render.
  useLayoutEffect(() => {
    if (pendingFocus.current !== null) {
      rows.current.get(pendingFocus.current)?.focus();
      pendingFocus.current = null;
    }
  });

  const moveTo = (id: string, target: number) => {
    const from = order.indexOf(id);
    const to = Math.max(0, Math.min(order.length - 1, target));
    if (from < 0 || from === to || locked || !onChange) return;
    const next = order.filter((entry) => entry !== id);
    next.splice(to, 0, id);
    onChange({ order: next });
    pendingFocus.current = id;
    setMessage(`${textOf(id)} moved to position ${to + 1} of ${order.length}.`);
  };

  const onRowKeyDown = (event: KeyboardEvent<HTMLDivElement>, id: string) => {
    if (locked) return;
    const index = order.indexOf(id);
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (grabbed === id) {
        setGrabbed(null);
        setMessage(`${textOf(id)} dropped at position ${index + 1} of ${order.length}.`);
      } else {
        origin.current = order;
        setGrabbed(id);
        setMessage(
          `${textOf(id)} picked up, position ${index + 1} of ${order.length}. ` +
            "Use the arrow keys to move, Space to drop, Escape to cancel.",
        );
      }
    } else if (event.key === "Escape" && grabbed === id) {
      event.preventDefault();
      setGrabbed(null);
      onChange?.({ order: origin.current });
      pendingFocus.current = id;
      setMessage(`Move cancelled. ${textOf(id)} is back at its original position.`);
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const delta = event.key === "ArrowUp" ? -1 : 1;
      if (grabbed === id) moveTo(id, index + delta);
      else {
        const neighbour = order[index + delta];
        if (neighbour !== undefined) rows.current.get(neighbour)?.focus();
      }
    }
  };

  const onDrop = (event: DragEvent<HTMLLIElement>, targetId: string) => {
    event.preventDefault();
    if (dragging !== null) moveTo(dragging, order.indexOf(targetId));
    setDragging(null);
  };

  const key = question.answer?.order;
  const grading = Boolean(showSolution) && key !== undefined;
  const anyWrong = grading && order.some((id, i) => key[i] !== id);

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
          Drag the items, use the arrow buttons, or press Space on an item, move it with the arrow
          keys, then press Space again to drop it.
        </p>
      )}
      <ol className="flex flex-col gap-3">
        {order.map((id, index) => {
          const isGrabbed = grabbed === id;
          const correct = grading && key[index] === id;
          let tone = "border-stroke bg-surface-0 shadow-[0_3px_0_0_#000]";
          if (grading) {
            tone = cn(
              correct ? VERDICT_STYLE.correct : VERDICT_STYLE.wrong,
              "shadow-[0_3px_0_0_#000]",
            );
          } else if (isGrabbed) {
            tone = "translate-y-[3px] border-stroke bg-[var(--world-main,#ffb84d)] shadow-none";
          }
          return (
            <li
              key={id}
              draggable={!locked}
              onDragStart={(event) => {
                setDragging(id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", id);
              }}
              onDragOver={(event) => {
                if (dragging !== null) event.preventDefault();
              }}
              onDrop={(event) => onDrop(event, id)}
              onDragEnd={() => setDragging(null)}
              className={cn(
                "flex items-stretch gap-2 rounded-[16px] border-2 pr-2 transition-transform",
                tone,
                dragging === id && "opacity-60",
              )}
            >
              <div
                ref={(node) => {
                  if (node) rows.current.set(id, node);
                  else rows.current.delete(id);
                }}
                role="button"
                tabIndex={locked ? -1 : 0}
                aria-pressed={locked ? undefined : isGrabbed}
                aria-roledescription="sortable item"
                aria-describedby={locked ? undefined : hintId}
                onKeyDown={(event) => onRowKeyDown(event, id)}
                className={cn(
                  "flex min-h-[52px] flex-1 items-center gap-3 rounded-[14px] px-3 py-2 text-[16px] font-semibold text-stroke",
                  !locked && "cursor-grab",
                  FOCUS_RING,
                )}
              >
                {!locked && <GripVertical size={20} aria-hidden="true" className="shrink-0" />}
                <span
                  aria-hidden="true"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-stroke bg-surface-0 text-[13px] font-bold"
                >
                  {index + 1}
                </span>
                <span className="flex-1">{textOf(id)}</span>
                <span className="sr-only">
                  Position {index + 1} of {order.length}.
                </span>
                {grading && (
                  <Verdict correct={correct}>{correct ? "Correct" : "Incorrect"}</Verdict>
                )}
              </div>
              {!locked && (
                <div className="flex flex-col justify-center gap-1">
                  <button
                    type="button"
                    tabIndex={-1}
                    disabled={index === 0}
                    aria-label={`Move ${textOf(id)} up`}
                    onClick={() => moveTo(id, index - 1)}
                    className="grid h-7 w-7 place-items-center rounded-full border-2 border-stroke bg-surface-0 disabled:border-dashed disabled:text-muted"
                  >
                    <ChevronUp size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    disabled={index === order.length - 1}
                    aria-label={`Move ${textOf(id)} down`}
                    onClick={() => moveTo(id, index + 1)}
                    className="grid h-7 w-7 place-items-center rounded-full border-2 border-stroke bg-surface-0 disabled:border-dashed disabled:text-muted"
                  >
                    <ChevronDown size={16} aria-hidden="true" />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {anyWrong && (
        <div className="text-[15px] text-stroke">
          <p className="font-bold">Correct order:</p>
          <ol className="ml-5 list-decimal">
            {key.map((id) => (
              <li key={id}>{textOf(id)}</li>
            ))}
          </ol>
        </div>
      )}
      <p role="status" className="sr-only">
        {message}
      </p>
      {showSolution && <Explanation text={question.explanation} />}
    </div>
  );
}
