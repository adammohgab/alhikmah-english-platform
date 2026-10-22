import type { QuizBrief } from "./api";

/* Quiz start rules: pure helpers for the briefing text (STUDENT-SPEC ST-08). */

const TYPE_LABEL: Record<string, string> = {
  multiple_choice: "Multiple choice",
  true_false: "True or false",
  fill_blank: "Fill in the blank",
  fill_in_blank: "Fill in the blank",
  matching: "Matching",
  reorder: "Reorder",
  ordering: "Reorder",
  short_answer: "Short answer",
  audio_spelling: "Listening and spelling",
  listening: "Listening",
};

export function typeLabel(type: string): string {
  return TYPE_LABEL[type] ?? type.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export function attemptsText(brief: QuizBrief): string {
  if (brief.attemptsLeft === null) return "Unlimited";
  return brief.attemptsAllowed !== null
    ? `${brief.attemptsLeft} of ${brief.attemptsAllowed}`
    : String(brief.attemptsLeft);
}
