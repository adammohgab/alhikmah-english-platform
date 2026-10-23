/* ========================================
   Quiz results rules (TEACHER-SPEC TC-18)
   Pure helpers: score histogram bins, item-analysis flags and ordering.
   ======================================== */

export const BIN_SIZE = 10;
/** A question answered correctly by fewer students than this is highlighted as low success. */
export const LOW_SUCCESS_PCT = 50;
const TOO_HARD_PCT = 30;
const TOO_EASY_PCT = 95;

export interface Bin {
  from: number;
  to: number;
  count: number;
  label: string;
}

/** Ten-point score bands from 0-9 up to 90-100 (100 belongs to the top band). */
export function histogramBins(scores: number[]): Bin[] {
  const bins: Bin[] = [];
  for (let from = 0; from < 100; from += BIN_SIZE) {
    const to = from + BIN_SIZE;
    bins.push({ from, to, count: 0, label: to === 100 ? `${from}-100` : `${from}-${to - 1}` });
  }
  for (const score of scores) {
    if (!Number.isFinite(score)) continue;
    const clamped = Math.min(100, Math.max(0, score));
    const index = Math.min(bins.length - 1, Math.floor(clamped / BIN_SIZE));
    bins[index].count += 1;
  }
  return bins;
}

export type ItemFlag = "too_hard" | "too_easy" | "low_success" | null;

export function itemFlag(percentCorrect: number): ItemFlag {
  if (percentCorrect < TOO_HARD_PCT) return "too_hard";
  if (percentCorrect < LOW_SUCCESS_PCT) return "low_success";
  if (percentCorrect > TOO_EASY_PCT) return "too_easy";
  return null;
}

export const FLAG_LABEL: Record<Exclude<ItemFlag, null>, string> = {
  too_hard: "Might be too hard",
  low_success: "Low success rate",
  too_easy: "Might be too easy",
};

export interface AnalysedItem {
  id: string;
  position: number;
  percentCorrect: number;
}

/** Hardest first; ties keep quiz order. Returns a new array. */
export function hardestFirst<T extends AnalysedItem>(items: T[]): T[] {
  return [...items].sort((a, b) => a.percentCorrect - b.percentCorrect || a.position - b.position);
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
