import type { ReactNode } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";
import type { QuestionPrompt } from "./types";

/* Helpers shared by the question components (pure, no state, no I/O). */

/** The unified interface every question component exposes. */
export interface QuestionProps<TQuestion, TValue> {
  question: TQuestion;
  value?: TValue | undefined;
  /** Called with the full next value. Without it the question is read-only. */
  onChange?: ((value: TValue) => void) | undefined;
  readOnly?: boolean | undefined;
  /** Locks the question and marks correct vs incorrect answers (needs `question.answer`). */
  showSolution?: boolean | undefined;
  className?: string | undefined;
}

/** Interaction is off for read-only, solution review, or when nothing listens to changes. */
export function isLocked(props: {
  readOnly?: boolean | undefined;
  showSolution?: boolean | undefined;
  onChange?: unknown;
}): boolean {
  return Boolean(props.readOnly) || Boolean(props.showSolution) || props.onChange === undefined;
}

/** Trim, collapse spaces, Unicode-normalize, case-insensitive unless asked (backend scoring rule). */
export function normalizeText(text: string, caseSensitive = false): string {
  const normalized = text.normalize("NFC").trim().replace(/\s+/g, " ");
  return caseSensitive ? normalized : normalized.toLowerCase();
}

export function matchesAny(
  input: string,
  accepted: readonly string[],
  caseSensitive = false,
): boolean {
  const target = normalizeText(input, caseSensitive);
  return accepted.some((entry) => normalizeText(entry, caseSensitive) === target);
}

export const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke";

/** Verdict fills. Always paired with an icon and a word, never color alone. */
export const VERDICT_STYLE = {
  correct: "border-success-600 bg-success-100",
  wrong: "border-danger-600 bg-danger-100",
} as const;

export function PromptText({ id, prompt }: { id: string; prompt: QuestionPrompt }) {
  return (
    <p id={id} className="font-heading text-[20px] font-semibold leading-snug text-stroke">
      {prompt.text}
    </p>
  );
}

export function Verdict({ correct, children }: { correct: boolean; children: ReactNode }) {
  const Icon = correct ? Check : X;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[13px] font-bold",
        correct ? "text-success-600" : "text-danger-600",
      )}
    >
      <Icon size={16} strokeWidth={3} aria-hidden="true" />
      {children}
    </span>
  );
}

export function Explanation({ text }: { text: string | undefined }) {
  if (!text) return null;
  return (
    <p className="rounded-[12px] border-2 border-stroke bg-surface-200 px-4 py-3 text-[15px] leading-snug text-stroke">
      <strong>Why: </strong>
      {text}
    </p>
  );
}
