/* ========================================
   Grading screen scoring rules (TEACHER-SPEC TC-21)
   Pure functions: rubric level selection -> points, auto + writing totals, save payload,
   and inline-comment highlight segments. No React, no network.
   ======================================== */

export interface RubricLevel {
  label: string;
  points: number;
  description?: string | null | undefined;
}

export interface RubricCriterion {
  id: string;
  name: string;
  description?: string | null | undefined;
  levels: RubricLevel[];
}

export interface Rubric {
  id?: string | null | undefined;
  title: string;
  max_score: number;
  criteria: RubricCriterion[];
}

/** criterion id -> index of the chosen level inside that criterion's `levels`. */
export type RubricSelection = Record<string, number>;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Highest points reachable on one criterion. */
export function criterionMax(criterion: RubricCriterion): number {
  return criterion.levels.reduce((max, level) => Math.max(max, level.points), 0);
}

/** Highest points reachable on the whole rubric (sum of each criterion's top level). */
export function rubricMax(rubric: Rubric): number {
  return round2(rubric.criteria.reduce((sum, c) => sum + criterionMax(c), 0));
}

/** Raw points of the chosen levels. Criteria without a choice contribute nothing. */
export function rubricRawTotal(rubric: Rubric, selection: RubricSelection): number {
  let total = 0;
  for (const criterion of rubric.criteria) {
    const index = selection[criterion.id];
    if (index === undefined) continue;
    const level = criterion.levels[index];
    if (level) total += level.points;
  }
  return round2(total);
}

/** True once every criterion has a level chosen. */
export function rubricComplete(rubric: Rubric, selection: RubricSelection): boolean {
  return (
    rubric.criteria.length > 0 &&
    rubric.criteria.every((c) => {
      const index = selection[c.id];
      return index !== undefined && c.levels[index] !== undefined;
    })
  );
}

/**
 * Question score from the rubric. The rubric total is scaled onto the question's own maximum so
 * a 20-point rubric on a 10-point question still lands in range. Never exceeds `maxPoints`.
 */
export function scoreFromRubric(rubric: Rubric, selection: RubricSelection, maxPoints: number): number {
  const reachable = rubricMax(rubric);
  if (reachable <= 0 || maxPoints <= 0) return 0;
  const scaled = (rubricRawTotal(rubric, selection) / reachable) * maxPoints;
  return Math.min(maxPoints, round2(scaled));
}

/**
 * Turns an AI suggestion (criterion id -> awarded points) into a level selection by picking the
 * level whose points are closest to the suggestion. Unknown criteria are skipped.
 */
export function selectionFromPoints(
  rubric: Rubric,
  points: Record<string, number>,
): RubricSelection {
  const selection: RubricSelection = {};
  for (const criterion of rubric.criteria) {
    const awarded = points[criterion.id];
    if (awarded === undefined || criterion.levels.length === 0) continue;
    let best = 0;
    let bestGap = Number.POSITIVE_INFINITY;
    criterion.levels.forEach((level, index) => {
      const gap = Math.abs(level.points - awarded);
      if (gap < bestGap) {
        best = index;
        bestGap = gap;
      }
    });
    selection[criterion.id] = best;
  }
  return selection;
}

export interface QuestionScoreInput {
  questionId: string;
  isWriting: boolean;
  maxPoints: number;
  /** Server-computed score for auto-graded questions. */
  autoScore: number | null;
  /** Teacher score for writing questions (or an override on an auto question). */
  teacherScore: number | null;
}

/** Score that counts for one question: teacher decision first, then the auto score. */
export function effectiveScore(q: QuestionScoreInput): number | null {
  if (q.teacherScore !== null) return clamp(q.teacherScore, 0, q.maxPoints);
  if (!q.isWriting && q.autoScore !== null) return clamp(q.autoScore, 0, q.maxPoints);
  return null;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface Totals {
  auto: number;
  writing: number;
  final: number;
  max: number;
  /** Writing questions that still have no teacher decision. */
  undecided: string[];
}

export function computeTotals(questions: QuestionScoreInput[]): Totals {
  let auto = 0;
  let writing = 0;
  let max = 0;
  const undecided: string[] = [];
  for (const q of questions) {
    max += q.maxPoints;
    const score = effectiveScore(q);
    if (q.isWriting) {
      if (score === null) undecided.push(q.questionId);
      else writing += score;
    } else if (score !== null) {
      auto += score;
    }
  }
  return {
    auto: round2(auto),
    writing: round2(writing),
    final: round2(auto + writing),
    max: round2(max),
    undecided,
  };
}

export const VOICE_NOTE_PREFIX = "[voice-note:";

/** Appends the recorded voice note reference to the written feedback, once. */
export function composeFeedback(comment: string, voiceAssetId: string | null): string {
  const text = comment.trim();
  const base = text.split(VOICE_NOTE_PREFIX)[0]?.trim() ?? "";
  return voiceAssetId ? `${base}\n${VOICE_NOTE_PREFIX}${voiceAssetId}]`.trim() : base;
}

export interface SaveGradePayload {
  attempt_id: string;
  rubric_scores: Record<string, number>;
  feedback: string;
  final_score: number;
}

/**
 * Arguments for the `save_grade` RPC (migration 028): per-question scores keyed by question id,
 * the overall feedback and the final total. Returns an error string instead of a payload while
 * the grade is not ready to save.
 */
export function buildSavePayload(
  attemptId: string,
  questions: QuestionScoreInput[],
  overallComment: string,
  voiceAssetId: string | null,
): { ok: true; payload: SaveGradePayload } | { ok: false; reason: string } {
  const totals = computeTotals(questions);
  if (totals.undecided.length > 0) {
    const n = totals.undecided.length;
    return {
      ok: false,
      reason: `Score ${n === 1 ? "the remaining writing answer" : `${n} writing answers`} before saving.`,
    };
  }
  const rubricScores: Record<string, number> = {};
  for (const q of questions) {
    const score = effectiveScore(q);
    if (score !== null) rubricScores[q.questionId] = score;
  }
  return {
    ok: true,
    payload: {
      attempt_id: attemptId,
      rubric_scores: rubricScores,
      feedback: composeFeedback(overallComment, voiceAssetId),
      final_score: totals.final,
    },
  };
}

export interface InlineRange {
  id: string;
  start: number;
  end: number;
}

export interface TextSegment {
  text: string;
  /** Comment ids covering this segment (empty for plain text). */
  commentIds: string[];
}

/** Splits `text` at every comment boundary so highlights can be rendered as <mark> segments. */
export function splitHighlights(text: string, ranges: InlineRange[]): TextSegment[] {
  const valid = ranges.filter((r) => r.start >= 0 && r.end > r.start && r.start < text.length);
  if (valid.length === 0) return [{ text, commentIds: [] }];
  const cuts = new Set<number>([0, text.length]);
  for (const r of valid) {
    cuts.add(r.start);
    cuts.add(Math.min(r.end, text.length));
  }
  const points = [...cuts].sort((a, b) => a - b);
  const segments: TextSegment[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const from = points[i]!;
    const to = points[i + 1]!;
    if (to <= from) continue;
    segments.push({
      text: text.slice(from, to),
      commentIds: valid.filter((r) => r.start <= from && r.end >= to).map((r) => r.id),
    });
  }
  return segments;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}
