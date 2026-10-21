import { z } from "zod";

const missedItemSchema = z.object({
  prompt: z.string().trim().min(1).max(500),
  correctAnswer: z.string().trim().min(1).max(300),
});

export const gameResultInputSchema = z
  .object({
    score: z.number().finite().int().min(0).max(3_600_000),
    accuracy: z.number().finite().min(0).max(100).optional(),
    durationSeconds: z.number().finite().int().min(1).max(3600).default(60),
    correctAnswers: z.number().finite().int().min(0).optional(),
    totalQuestions: z.number().finite().int().min(0).optional(),
    bestCombo: z.number().finite().int().min(0).optional(),
    gameName: z.string().trim().min(1).max(100).optional(),
    missedItems: z.array(missedItemSchema).max(100).optional(),
  })
  .superRefine((result, context) => {
    if (result.score > result.durationSeconds * 1000) {
      context.addIssue({
        code: "custom",
        message: "The score is outside the valid range for this round.",
        path: ["score"],
      });
    }
    if (
      result.correctAnswers !== undefined &&
      result.totalQuestions !== undefined &&
      (result.correctAnswers > result.totalQuestions || result.totalQuestions === 0)
    ) {
      context.addIssue({
        code: "custom",
        message: "The answer totals are invalid.",
        path: ["correctAnswers"],
      });
    }
  })
  .transform((result) => ({
    ...result,
    accuracy:
      result.accuracy ??
      (result.totalQuestions && result.correctAnswers !== undefined
        ? (result.correctAnswers / result.totalQuestions) * 100
        : 0),
  }));

export type GameResultInput = z.infer<typeof gameResultInputSchema>;

export function formatGameName(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toLocaleUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

export function mergeResultState(stored: unknown, locationState: unknown): unknown {
  const storedRecord =
    typeof stored === "object" && stored !== null && !Array.isArray(stored) ? stored : {};
  const locationRecord =
    typeof locationState === "object" && locationState !== null && !Array.isArray(locationState)
      ? locationState
      : {};
  return { ...storedRecord, ...locationRecord };
}
