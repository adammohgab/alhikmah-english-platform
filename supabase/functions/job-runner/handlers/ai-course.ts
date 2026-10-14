/**
 * handlers/ai-course.ts
 *
 * BE-EDGE-12: `ai_course` background job handler for the job-runner Edge Function.
 *
 * Generates a complete curriculum draft (outline, units, lessons, vocabulary,
 * quizzes) from a teacher prompt, following the Teacher Course Wizard (TC-30)
 * input shape and AI-BEHAVIOR section 5.3 lesson/course quality rules.
 *
 * Four steps with live `job_steps` progress (07-AI-SYSTEM section 9):
 *   1. Course overview + unit outline .................... 25%
 *   2. Unit expansion (lessons + objectives) ............. 50%
 *   3. Lesson blocks + practice/quiz questions ........... 75%
 *   4. Assemble draft hierarchy, notify teacher ......... 100%
 *
 * Table mapping (actual migrations, NOT the idealized backend/docs superset —
 * vocabulary_lists/items, activities and quizzes tables do not exist yet):
 *   - outline/units/lessons  -> courses, units, lessons, lesson_blocks
 *   - vocabulary              -> `keywords` lesson_blocks ({items:[...]})
 *   - unit quizzes            -> assessments (kind='quiz', status='draft')
 *                                + questions + assessment_questions
 *   - activities toggle       -> lesson-level practice materializes as `check`
 *                                blocks (no activities table exists yet);
 *                                the toggle is recorded in result meta
 *   - unit objectives         -> structured prefix inside units.description
 *                                (units table has no objectives column)
 *   - teacher notification    -> notifications
 *
 * Transactional consistency: a single DB transaction cannot span four AI steps
 * in an Edge Function (each step up to ~100s; the runner may exit between
 * steps). Instead this handler is IDEMPOTENT and resumable:
 *   - intermediate artifacts + created ids accumulate in
 *     jobs.result_payload.partial across steps;
 *   - completed steps (by job_steps.status) are never re-run;
 *   - step 4 skips rows that already exist (matched by order_index / tracked ids);
 *   - on fatal failure, created artifacts are rolled back (course row delete
 *     cascades units/lessons/blocks; quiz assessments + questions deleted
 *     explicitly) before the job is marked failed.
 *
 * WIRING NOTE (for the BE-EDGE-11 owner — outside this task's file ownership):
 * job-runner/index.ts currently uses inline stub handlers and never imports
 * this module. To activate, add a side-effect import in index.ts:
 *     import "./handlers/ai-course.ts";
 * (which triggers the guarded self-registration below), and fix
 * handlers/registry.ts's `import { Job } from "../../index"` — that path
 * resolves to supabase/functions/index which does not exist; it must point at
 * ../index (the job-runner entry) or use a local type.
 */

import { defaultAIAdapter } from "../../_shared/ai/adapter";
import type { AIAdapter, CompletionRequest } from "../../_shared/ai/adapter";
import { preCheck, postCheck } from "../../_shared/ai/safety";
import { GRADE_CEFR_MAP } from "../../_shared/ai/prompts";

// -------------------------------------------------------------------
// Constants
// -------------------------------------------------------------------

/** Job kind this handler serves (matches jobs.kind check constraint). */
export const AI_COURSE_KIND = "ai_course";

/** Step definitions: index (1-based; 0 is the runner's "started" sentinel). */
export const AI_COURSE_STEPS = [
  { index: 1, name: "outline", progress: 25 },
  { index: 2, name: "expand_units", progress: 50 },
  { index: 3, name: "lesson_content", progress: 75 },
  { index: 4, name: "assemble", progress: 100 },
] as const;

/** Caps derived from TC-30 shape + AI-BEHAVIOR 5.3. */
export const MAX_UNITS = 8;
export const MAX_LESSONS_PER_UNIT = 8;
export const QUIZ_QUESTIONS_PER_UNIT = 10;
export const MIN_OBJECTIVES = 3;
export const MAX_OBJECTIVES = 6;
export const MIN_EXAMPLES = 3;
export const MAX_EXAMPLES = 6;
export const MIN_KEYWORDS = 6;
export const MAX_KEYWORDS = 10;
export const LESSON_CHECKS = 3;
export const MIN_BODY_WORDS = 150;
export const MAX_BODY_WORDS = 350;

/** Per-call model budget: stays under the ~100s per-step runner budget. */
export const AI_TIMEOUT_MS = 90_000;
/** Max parallel lesson-content generations (07-AI-SYSTEM section 9: 2). */
export const MAX_PARALLEL_LESSONS = 2;

/**
 * Question types allowed by migration 001's question_type enum.
 * `true_false`, `listening` and `writing` do not exist in the enum:
 * boolean questions are emitted as multiple_choice with True/False choices
 * (writing stays out of quizzes per TC-30 rules).
 */
export const QUIZ_QUESTION_TYPES = [
  "multiple_choice",
  "fill_blank",
  "matching",
  "short_answer",
  "drag_drop",
  "reorder",
  "audio_spelling",
] as const;

export type QuizQuestionType = (typeof QUIZ_QUESTION_TYPES)[number];

/** Preferred quiz mix: deterministic per-unit variety, writing-free. */
export const DEFAULT_QUIZ_MIX: QuizQuestionType[] = [
  "multiple_choice",
  "multiple_choice",
  "multiple_choice",
  "multiple_choice",
  "fill_blank",
  "fill_blank",
  "matching",
  "short_answer",
  "drag_drop",
  "reorder",
];

// -------------------------------------------------------------------
// Minimal Supabase client surface (structural; the runner injects a
// service-role client so RLS never blocks job writes).
// -------------------------------------------------------------------

export interface DbResult {
  data: any;
  error: { message: string } | null;
}

export interface DbQuery {
  eq(column: string, value: unknown): DbQuery;
  order(column: string, options?: { ascending?: boolean }): DbQuery;
  limit(count: number): DbQuery;
  single(): Promise<DbResult>;
  throwOnError(): DbQuery;
  then: PromiseLike<DbResult>["then"];
}

export interface DbTable {
  select(columns?: string): DbQuery;
  insert(rows: unknown): DbQuery;
  update(patch: Record<string, unknown>): DbQuery;
  delete(): DbQuery;
  upsert(rows: unknown, options?: Record<string, unknown>): DbQuery;
}

export interface SupaClient {
  from(table: string): DbTable;
}

export interface JobRecord {
  id: string;
  kind: string;
  status: string;
  initiator_id: string;
  input_params: Record<string, unknown>;
  result_payload?: Record<string, unknown> | null;
}

export interface HandlerResult {
  progress_percent: number;
  finishAfterStep: boolean;
  result_payload?: Record<string, unknown>;
}

// -------------------------------------------------------------------
// Wizard input (TC-30 steps 1-2 + approved outline from step 3)
// -------------------------------------------------------------------

export interface AiCourseParams {
  topic: string;
  sourceText?: string;
  extraNotes?: string;
  grade: number;
  category: string;
  numUnits: number;
  lessonsPerUnit: number;
  weeks?: number;
  skillsEmphasis?: string[];
  level?: string;
  tone?: string;
  includeActivities: boolean;
  includeQuiz: boolean;
  includeVocabulary: boolean;
  includeAudioScripts: boolean;
  approvedOutline?: {
    units: Array<{
      title: string;
      objectives?: string[];
      lessons?: Array<{ title: string; minutes?: number }>;
    }>;
  } | null;
}

export function parseAiCourseParams(input: Record<string, unknown>): AiCourseParams {
  const str = (v: unknown, fallback = ""): string =>
    typeof v === "string" ? v.trim() : fallback;
  const num = (v: unknown, fallback: number): number => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const bool = (v: unknown, fallback: boolean): boolean =>
    typeof v === "boolean" ? v : fallback;

  const topic =
    str(input["topic"]) ||
    str(input["title"]) ||
    str(input["prompt"]) ||
    str(input["subject"]);
  if (!topic) {
    throw new AiCourseError(
      "validation_failed",
      "Teacher prompt is missing: provide `topic` (or `title`/`prompt`) in jobs.input_params."
    );
  }

  const grade = Math.round(num(input["grade"] ?? input["grade_level"], 8));
  if (grade < 7 || grade > 12) {
    throw new AiCourseError(
      "validation_failed",
      `Grade ${grade} is out of range: Al Hikmah courses target grades 7-12.`
    );
  }

  const clamp = (n: number, lo: number, hi: number): number =>
    Math.min(hi, Math.max(lo, Math.round(n)));

  return {
    topic,
    sourceText: str(input["source_text"] ?? input["syllabus"] ?? input["sourceText"]) || undefined,
    extraNotes:
      str(input["extra_notes"] ?? input["notes"] ?? input["extraNotes"]) || undefined,
    grade,
    category: str(input["category"], "custom"),
    numUnits: clamp(num(input["num_units"] ?? input["numUnits"], 4), 1, MAX_UNITS),
    lessonsPerUnit: clamp(
      num(input["lessons_per_unit"] ?? input["lessonsPerUnit"], 5),
      1,
      MAX_LESSONS_PER_UNIT
    ),
    weeks: num(input["weeks"], 0) > 0 ? Math.round(num(input["weeks"], 0)) : undefined,
    skillsEmphasis: Array.isArray(input["skills_emphasis"])
      ? (input["skills_emphasis"] as unknown[]).filter((s): s is string => typeof s === "string")
      : Array.isArray(input["skillsEmphasis"])
        ? (input["skillsEmphasis"] as unknown[]).filter((s): s is string => typeof s === "string")
        : undefined,
    level: str(input["level"], "at grade") || "at grade",
    tone: str(input["tone"], "friendly") || "friendly",
    includeActivities: bool(input["include_activities"] ?? input["includeActivities"], true),
    includeQuiz: bool(input["include_quiz"] ?? input["includeQuiz"], true),
    includeVocabulary: bool(
      input["include_vocabulary"] ?? input["includeVocabulary"],
      true
    ),
    includeAudioScripts: bool(
      input["include_audio_scripts"] ?? input["includeAudioScripts"],
      false
    ),
    approvedOutline:
      input["approved_outline"] != null
        ? (input["approved_outline"] as AiCourseParams["approvedOutline"])
        : null,
  };
}

// -------------------------------------------------------------------
// Planned structures (AI JSON contracts)
// -------------------------------------------------------------------

export interface PlannedLesson {
  title: string;
  minutes: number;
}

export interface PlannedUnit {
  title: string;
  objectives: string[];
  lessons: PlannedLesson[];
  quiz_topics: string[];
}

export interface CoursePlan {
  title: string;
  description: string;
  units: PlannedUnit[];
}

export interface ExpandedLesson {
  title: string;
  description: string;
  learning_goals: string[];
}

export interface UnitExpansion {
  unit_index: number;
  objectives: string[];
  lessons: ExpandedLesson[];
}

export interface LessonExample {
  sentence: string;
  note?: string;
}

export interface LessonVocab {
  word: string;
  part_of_speech?: string;
  meaning: string;
  arabic?: string;
  example?: string;
}

export interface LessonCheck {
  prompt: string;
  answer: string;
}

export interface LessonContent {
  lesson_index: number;
  intro: string;
  body: string;
  examples: LessonExample[];
  vocabulary: LessonVocab[];
  checks: LessonCheck[];
  audio_script?: string;
}

export interface GeneratedQuestion {
  type: QuizQuestionType;
  prompt: string;
  choices?: string[];
  correct_index?: number;
  accepted_answers?: string[];
  pairs?: Array<[string, string]>;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  skill: string;
}

export interface UnitQuiz {
  unit_index: number;
  questions: GeneratedQuestion[];
}

export interface LowConfidenceItem {
  path: string;
  reason: string;
}

export interface CourseCounts {
  units: number;
  lessons: number;
  blocks: number;
  vocabulary_items: number;
  questions: number;
  quizzes: number;
}

/** Accumulates across steps inside jobs.result_payload.partial. */
export interface PartialArtifacts {
  course_id?: string;
  unit_ids?: string[];
  lesson_ids?: string[];
  assessment_ids?: string[];
  question_ids?: string[];
  completed_lessons?: string[];
  low_confidence?: LowConfidenceItem[];
  plan?: CoursePlan;
  expansions?: UnitExpansion[];
  contents?: LessonContent[][];
  quizzes?: UnitQuiz[];
}

// -------------------------------------------------------------------
// Errors
// -------------------------------------------------------------------

export class AiCourseError extends Error {
  readonly code: string;
  readonly stepIndex?: number;
  constructor(code: string, message: string, stepIndex?: number) {
    super(message);
    this.name = "AiCourseError";
    this.code = code;
    this.stepIndex = stepIndex;
  }
}

// -------------------------------------------------------------------
// Pure helpers (exported for unit tests)
// -------------------------------------------------------------------

export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return slug || "course";
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Objectives live in units.description (no objectives column exists). */
export function renderUnitDescription(objectives: string[], description: string): string {
  const lines = objectives.map((o) => `- ${o.trim()}`).join("\n");
  return `OBJECTIVES:\n${lines}\n\n${description.trim()}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asNonEmptyString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

function flag(low: LowConfidenceItem[], path: string, reason: string): void {
  low.push({ path, reason });
}

export function validateCoursePlan(
  json: unknown,
  expectedUnits: number,
  expectedLessons: number
): { plan: CoursePlan; lowConfidence: LowConfidenceItem[] } {
  if (!isRecord(json)) throw new Error("outline must be a JSON object");
  const low: LowConfidenceItem[] = [];
  const title = asNonEmptyString(json["title"]);
  const description = asNonEmptyString(json["description"]);
  if (!title) throw new Error("outline.title is required");
  if (!description) throw new Error("outline.description is required");
  const rawUnits = json["units"];
  if (!Array.isArray(rawUnits) || rawUnits.length === 0) {
    throw new Error("outline.units must be a non-empty array");
  }
  if (rawUnits.length > MAX_UNITS) throw new Error(`outline has more than ${MAX_UNITS} units`);
  if (rawUnits.length !== expectedUnits) {
    flag(low, "units", `expected ${expectedUnits} units, got ${rawUnits.length}`);
  }
  const units: PlannedUnit[] = rawUnits.map((u, ui) => {
    if (!isRecord(u)) throw new Error(`units[${ui}] must be an object`);
    const uTitle = asNonEmptyString(u["title"]);
    if (!uTitle) throw new Error(`units[${ui}].title is required`);
    const objectives = Array.isArray(u["objectives"])
      ? u["objectives"].filter((o): o is string => asNonEmptyString(o) !== null).map((o) => (o as string).trim())
      : [];
    if (objectives.length < MIN_OBJECTIVES || objectives.length > MAX_OBJECTIVES) {
      flag(low, `units[${ui}].objectives`, `has ${objectives.length} objectives, want ${MIN_OBJECTIVES}-${MAX_OBJECTIVES}`);
    }
    const rawLessons = u["lessons"];
    if (!Array.isArray(rawLessons) || rawLessons.length === 0) {
      throw new Error(`units[${ui}].lessons must be a non-empty array`);
    }
    if (rawLessons.length > MAX_LESSONS_PER_UNIT) {
      throw new Error(`units[${ui}] has more than ${MAX_LESSONS_PER_UNIT} lessons`);
    }
    if (rawLessons.length !== expectedLessons) {
      flag(low, `units[${ui}].lessons`, `expected ${expectedLessons} lessons, got ${rawLessons.length}`);
    }
    const lessons: PlannedLesson[] = rawLessons.map((l, li) => {
      if (!isRecord(l)) throw new Error(`units[${ui}].lessons[${li}] must be an object`);
      const lTitle = asNonEmptyString(l["title"]);
      if (!lTitle) throw new Error(`units[${ui}].lessons[${li}].title is required`);
      const minutes = Number(l["minutes"]);
      return {
        title: lTitle,
        minutes: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 45,
      };
    });
    const quizTopics = Array.isArray(u["quiz_topics"])
      ? u["quiz_topics"].filter((t): t is string => asNonEmptyString(t) !== null).map((t) => (t as string).trim())
      : [];
    return { title: uTitle, objectives, lessons, quiz_topics: quizTopics };
  });
  return { plan: { title, description, units }, lowConfidence: low };
}

export function validateUnitExpansion(
  json: unknown,
  unitIndex: number,
  expectedLessons: number
): { expansion: UnitExpansion; lowConfidence: LowConfidenceItem[] } {
  if (!isRecord(json)) throw new Error(`expansion[${unitIndex}] must be a JSON object`);
  const low: LowConfidenceItem[] = [];
  const objectives = Array.isArray(json["objectives"])
    ? json["objectives"].filter((o): o is string => asNonEmptyString(o) !== null).map((o) => (o as string).trim())
    : [];
  if (objectives.length < MIN_OBJECTIVES || objectives.length > MAX_OBJECTIVES) {
    flag(low, `expansions[${unitIndex}].objectives`, `has ${objectives.length} objectives, want ${MIN_OBJECTIVES}-${MAX_OBJECTIVES}`);
  }
  const rawLessons = json["lessons"];
  if (!Array.isArray(rawLessons) || rawLessons.length === 0) {
    throw new Error(`expansions[${unitIndex}].lessons must be a non-empty array`);
  }
  if (rawLessons.length !== expectedLessons) {
    flag(low, `expansions[${unitIndex}].lessons`, `expected ${expectedLessons} lessons, got ${rawLessons.length}`);
  }
  const lessons: ExpandedLesson[] = rawLessons.map((l, li) => {
    if (!isRecord(l)) throw new Error(`expansions[${unitIndex}].lessons[${li}] must be an object`);
    const title = asNonEmptyString(l["title"]);
    const description = asNonEmptyString(l["description"]);
    if (!title) throw new Error(`expansions[${unitIndex}].lessons[${li}].title is required`);
    if (!description) throw new Error(`expansions[${unitIndex}].lessons[${li}].description is required`);
    const goals = Array.isArray(l["learning_goals"])
      ? l["learning_goals"].filter((g): g is string => asNonEmptyString(g) !== null).map((g) => (g as string).trim())
      : [];
    return { title, description, learning_goals: goals };
  });
  return { expansion: { unit_index: unitIndex, objectives, lessons }, lowConfidence: low };
}

export function validateLessonContent(
  json: unknown,
  unitIndex: number,
  lessonIndex: number
): { content: LessonContent; lowConfidence: LowConfidenceItem[] } {
  const path = `contents[${unitIndex}][${lessonIndex}]`;
  if (!isRecord(json)) throw new Error(`${path} must be a JSON object`);
  const low: LowConfidenceItem[] = [];
  const intro = asNonEmptyString(json["intro"]);
  const body = asNonEmptyString(json["body"]);
  if (!intro) throw new Error(`${path}.intro is required (2-3 sentences)`);
  if (!body) throw new Error(`${path}.body is required (150-350 words)`);
  const words = countWords(body);
  if (words < MIN_BODY_WORDS || words > MAX_BODY_WORDS) {
    flag(low, `${path}.body`, `body has ${words} words, want ${MIN_BODY_WORDS}-${MAX_BODY_WORDS}`);
  }
  const rawExamples = json["examples"];
  if (!Array.isArray(rawExamples) || rawExamples.length === 0) {
    throw new Error(`${path}.examples must be a non-empty array`);
  }
  if (rawExamples.length < MIN_EXAMPLES || rawExamples.length > MAX_EXAMPLES) {
    flag(low, `${path}.examples`, `has ${rawExamples.length} examples, want ${MIN_EXAMPLES}-${MAX_EXAMPLES}`);
  }
  const examples: LessonExample[] = rawExamples.map((e, i) => {
    if (!isRecord(e)) throw new Error(`${path}.examples[${i}] must be an object`);
    const sentence = asNonEmptyString(e["sentence"]);
    if (!sentence) throw new Error(`${path}.examples[${i}].sentence is required`);
    const note = asNonEmptyString(e["note"]);
    return note ? { sentence, note } : { sentence };
  });
  const rawVocab = json["vocabulary"];
  if (!Array.isArray(rawVocab) || rawVocab.length === 0) {
    throw new Error(`${path}.vocabulary must be a non-empty array`);
  }
  if (rawVocab.length < MIN_KEYWORDS || rawVocab.length > MAX_KEYWORDS) {
    flag(low, `${path}.vocabulary`, `has ${rawVocab.length} words, want ${MIN_KEYWORDS}-${MAX_KEYWORDS}`);
  }
  const vocabulary: LessonVocab[] = rawVocab.map((w, i) => {
    if (!isRecord(w)) throw new Error(`${path}.vocabulary[${i}] must be an object`);
    const word = asNonEmptyString(w["word"]);
    const meaning = asNonEmptyString(w["meaning"]);
    if (!word) throw new Error(`${path}.vocabulary[${i}].word is required`);
    if (!meaning) throw new Error(`${path}.vocabulary[${i}].meaning is required`);
    const item: LessonVocab = { word, meaning };
    const pos = asNonEmptyString(w["part_of_speech"]);
    const arabic = asNonEmptyString(w["arabic"]);
    const example = asNonEmptyString(w["example"]);
    if (pos) item.part_of_speech = pos;
    if (arabic) item.arabic = arabic;
    if (example) item.example = example;
    return item;
  });
  const rawChecks = json["checks"];
  if (!Array.isArray(rawChecks) || rawChecks.length === 0) {
    throw new Error(`${path}.checks must be a non-empty array`);
  }
  if (rawChecks.length !== LESSON_CHECKS) {
    flag(low, `${path}.checks`, `has ${rawChecks.length} checks, want ${LESSON_CHECKS}`);
  }
  const checks: LessonCheck[] = rawChecks.map((c, i) => {
    if (!isRecord(c)) throw new Error(`${path}.checks[${i}] must be an object`);
    const prompt = asNonEmptyString(c["prompt"]);
    const answer = asNonEmptyString(c["answer"]);
    if (!prompt) throw new Error(`${path}.checks[${i}].prompt is required`);
    if (!answer) throw new Error(`${path}.checks[${i}].answer is required`);
    return { prompt, answer };
  });
  const audioScript = asNonEmptyString(json["audio_script"]);
  return {
    content: {
      lesson_index: lessonIndex,
      intro,
      body,
      examples,
      vocabulary,
      checks,
      ...(audioScript ? { audio_script: audioScript } : {}),
    },
    lowConfidence: low,
  };
}

export function validateUnitQuiz(
  json: unknown,
  unitIndex: number,
  expectedCount: number
): { quiz: UnitQuiz; lowConfidence: LowConfidenceItem[] } {
  const path = `quizzes[${unitIndex}]`;
  if (!isRecord(json)) throw new Error(`${path} must be a JSON object`);
  const low: LowConfidenceItem[] = [];
  const rawQuestions = json["questions"];
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    throw new Error(`${path}.questions must be a non-empty array`);
  }
  if (rawQuestions.length !== expectedCount) {
    flag(low, path, `has ${rawQuestions.length} questions, want ${expectedCount}`);
  }
  const questions: GeneratedQuestion[] = rawQuestions.map((q, i) => {
    const qPath = `${path}.questions[${i}]`;
    if (!isRecord(q)) throw new Error(`${qPath} must be an object`);
    const type = asNonEmptyString(q["type"]);
    if (!type || !(QUIZ_QUESTION_TYPES as readonly string[]).includes(type)) {
      throw new Error(`${qPath}.type must be one of: ${QUIZ_QUESTION_TYPES.join(", ")}`);
    }
    const prompt = asNonEmptyString(q["prompt"]);
    if (!prompt) throw new Error(`${qPath}.prompt is required`);
    const explanation = asNonEmptyString(q["explanation"]);
    if (!explanation) throw new Error(`${qPath}.explanation is required (1-2 sentences)`);
    const rawDifficulty = asNonEmptyString(q["difficulty"]);
    if (rawDifficulty !== "easy" && rawDifficulty !== "medium" && rawDifficulty !== "hard") {
      throw new Error(`${qPath}.difficulty must be easy, medium or hard`);
    }
    const difficulty: "easy" | "medium" | "hard" = rawDifficulty;
    const skill = asNonEmptyString(q["skill"]) ?? "reading";
    const base = {
      type: type as QuizQuestionType,
      prompt,
      explanation,
      difficulty,
      skill,
    };
    if (type === "multiple_choice") {
      const choices = Array.isArray(q["choices"])
        ? q["choices"].filter((c): c is string => asNonEmptyString(c) !== null).map((c) => (c as string).trim())
        : [];
      if (choices.length < 2 || choices.length > 4) {
        throw new Error(`${qPath}.choices must have 2-4 options`);
      }
      const lowered = choices.map((c) => c.toLowerCase());
      if (new Set(lowered).size !== lowered.length) {
        throw new Error(`${qPath}.choices must not contain duplicates`);
      }
      const correctIndex = Number(q["correct_index"]);
      if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= choices.length) {
        throw new Error(`${qPath}.correct_index must point at exactly one choice`);
      }
      return { ...base, choices, correct_index: correctIndex };
    }
    if (type === "fill_blank") {
      if (!prompt.includes("{{1}}")) {
        throw new Error(`${qPath}.prompt must contain a {{1}} blank marker`);
      }
      const accepted = Array.isArray(q["accepted_answers"])
        ? q["accepted_answers"].filter((a): a is string => asNonEmptyString(a) !== null).map((a) => (a as string).trim())
        : [];
      if (accepted.length === 0) throw new Error(`${qPath}.accepted_answers must list accepted answers`);
      return { ...base, accepted_answers: accepted };
    }
    if (type === "matching") {
      const pairs = q["pairs"];
      if (!Array.isArray(pairs) || pairs.length < 2) {
        throw new Error(`${qPath}.pairs must list at least 2 pairs`);
      }
      const clean: Array<[string, string]> = pairs.map((p, pi) => {
        if (!Array.isArray(p) || asNonEmptyString(p[0]) === null || asNonEmptyString(p[1]) === null) {
          throw new Error(`${qPath}.pairs[${pi}] must be a [left, right] pair`);
        }
        return [(p[0] as string).trim(), (p[1] as string).trim()];
      });
      return { ...base, pairs: clean };
    }
    return base;
  });
  return { quiz: { unit_index: unitIndex, questions }, lowConfidence: low };
}

/** Map a generated question onto the real questions-table row shape. */
export function toQuestionRow(
  q: GeneratedQuestion,
  authorId: string,
  tags: string[]
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    author_id: authorId,
    question_type: q.type,
    prompt: q.prompt,
    explanation: q.explanation,
    points: 1,
    difficulty: q.difficulty,
    tags,
  };
  if (q.type === "multiple_choice" && q.choices && q.correct_index !== undefined) {
    const ids = q.choices.map((_, i) => `c${i + 1}`);
    row["options"] = {
      choices: q.choices.map((text, i) => ({ id: ids[i], text })),
    };
    row["correct_answer"] = { correct: [ids[q.correct_index]] };
  } else if (q.type === "fill_blank") {
    row["options"] = {};
    row["correct_answer"] = { blanks: [q.accepted_answers ?? []], case_sensitive: false };
  } else if (q.type === "matching" && q.pairs) {
    const left = q.pairs.map((p, i) => ({ id: `l${i + 1}`, text: p[0] }));
    const right = q.pairs.map((p, i) => ({ id: `r${i + 1}`, text: p[1] }));
    row["options"] = { left, right };
    row["correct_answer"] = {
      pairs: left.map((l, i) => [l.id, right[i]?.id]),
    };
  } else {
    row["options"] = {};
    row["correct_answer"] = { skill: q.skill };
  }
  return row;
}

// -------------------------------------------------------------------
// DB helpers
// -------------------------------------------------------------------

async function dbSingle(supa: SupaClient, table: string, id: string): Promise<any> {
  const res = await supa.from(table).select("*").eq("id", id).single();
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

async function insertReturning(
  supa: SupaClient,
  table: string,
  rows: unknown
): Promise<any[]> {
  const res: DbResult = await (supa.from(table).insert(rows) as unknown as DbQuery & {
    select(columns?: string): DbQuery;
  }).select("*");
  if (res.error) throw new Error(`${table} insert failed: ${res.error.message}`);
  const data = (res as unknown as { data: unknown }).data;
  if (Array.isArray(data)) return data;
  if (data !== null && data !== undefined) return [data];
  throw new Error(`${table} insert returned no rows`);
}

async function writeStep(
  supa: SupaClient,
  jobId: string,
  stepIndex: number,
  name: string,
  status: "running" | "completed" | "failed",
  progressPercent: number,
  log?: string
): Promise<void> {
  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
    job_id: jobId,
    step_index: stepIndex,
    name,
    status,
    progress_percent: progressPercent,
    ...(log ? { log } : {}),
    started_at: now,
    ...(status !== "running" ? { completed_at: now } : {}),
  };
  const res: DbResult = await supa
    .from("job_steps")
    .upsert(row, { onConflict: "job_id,step_index" });
  if (res.error) throw new Error(`job_steps write failed: ${res.error.message}`);
  // Row writes drive the Realtime `job:{job_id}` channel via Postgres Changes.
}

async function touchJob(
  supa: SupaClient,
  jobId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const res: DbResult = await supa.from("jobs").update(patch).eq("id", jobId);
  if (res.error) throw new Error(`jobs update failed: ${res.error.message}`);
}

async function readJob(supa: SupaClient, jobId: string): Promise<JobRecord> {
  const data = await dbSingle(supa, "jobs", jobId);
  return {
    id: data.id,
    kind: data.kind,
    status: data.status,
    initiator_id: data.initiator_id,
    input_params: (data.input_params ?? {}) as Record<string, unknown>,
    result_payload: (data.result_payload ?? null) as Record<string, unknown> | null,
  };
}

async function readCompletedSteps(supa: SupaClient, jobId: string): Promise<Set<number>> {
  const res: DbResult = await supa
    .from("job_steps")
    .select("step_index,status")
    .eq("job_id", jobId);
  if (res.error) throw new Error(`job_steps read failed: ${res.error.message}`);
  const done = new Set<number>();
  const rows = Array.isArray(res.data) ? res.data : [];
  for (const r of rows) {
    if (r && r.status === "completed" && typeof r.step_index === "number") {
      done.add(r.step_index);
    }
  }
  return done;
}

function readPartial(resultPayload: Record<string, unknown> | null | undefined): PartialArtifacts {
  const p = resultPayload?.["partial"];
  if (p !== null && typeof p === "object" && !Array.isArray(p)) {
    return p as PartialArtifacts;
  }
  return {};
}

async function writePartial(
  supa: SupaClient,
  jobId: string,
  partial: PartialArtifacts
): Promise<void> {
  const current = await readJob(supa, jobId);
  const payload = { ...(current.result_payload ?? {}), partial: { ...partial } };
  await touchJob(supa, jobId, { result_payload: payload });
}

async function ensureUniqueSlug(supa: SupaClient, base: string): Promise<string> {
  let candidate = slugify(base);
  for (let attempt = 0; attempt < 6; attempt++) {
    const res: DbResult = await supa.from("courses").select("id").eq("slug", candidate).limit(1);
    if (res.error) throw new Error(`slug lookup failed: ${res.error.message}`);
    const rows = Array.isArray(res.data) ? res.data : [];
    if (rows.length === 0) return candidate;
    const suffix =
      attempt < 4 ? `-${attempt + 2}` : `-${crypto.randomUUID().slice(0, 6)}`;
    candidate = `${slugify(base).slice(0, 52)}${suffix}`;
  }
  return `${slugify(base).slice(0, 52)}-${crypto.randomUUID().slice(0, 6)}`;
}

async function fetchUnitOrderMap(
  supa: SupaClient,
  courseId: string
): Promise<Map<number, { id: string; lessons: Map<number, { id: string; blockCount: number }> }>> {
  const map = new Map<
    number,
    { id: string; lessons: Map<number, { id: string; blockCount: number }> }
  >();
  const ures: DbResult = await supa
    .from("units")
    .select("id,order_index")
    .eq("course_id", courseId)
    .order("order_index", { ascending: true });
  if (ures.error) throw new Error(`units lookup failed: ${ures.error.message}`);
  const units = Array.isArray(ures.data) ? ures.data : [];
  for (const u of units) {
    const lessons = new Map<number, { id: string; blockCount: number }>();
    const lres: DbResult = await supa
      .from("lessons")
      .select("id,order_index")
      .eq("unit_id", u.id)
      .order("order_index", { ascending: true });
    if (lres.error) throw new Error(`lessons lookup failed: ${lres.error.message}`);
    const lrows = Array.isArray(lres.data) ? lres.data : [];
    for (const l of lrows) {
      const bres: DbResult = await supa
        .from("lesson_blocks")
        .select("id")
        .eq("lesson_id", l.id)
        .limit(1);
      if (bres.error) throw new Error(`lesson_blocks lookup failed: ${bres.error.message}`);
      const brows = Array.isArray(bres.data) ? bres.data : [];
      lessons.set(l.order_index, { id: l.id, blockCount: brows.length });
    }
    map.set(u.order_index, { id: u.id, lessons });
  }
  return map;
}

/** Rollback for the "transactional consistency" acceptance criterion. */
async function cleanupPartialArtifacts(
  supa: SupaClient,
  partial: PartialArtifacts
): Promise<void> {
  const warnings: string[] = [];
  try {
    for (const qid of partial.question_ids ?? []) {
      const res: DbResult = await supa.from("questions").delete().eq("id", qid);
      if (res.error) warnings.push(`question ${qid}: ${res.error.message}`);
    }
  } catch (err) {
    warnings.push(`questions cleanup: ${err instanceof Error ? err.message : err}`);
  }
  try {
    for (const aid of partial.assessment_ids ?? []) {
      const res: DbResult = await supa.from("assessments").delete().eq("id", aid);
      if (res.error) warnings.push(`assessment ${aid}: ${res.error.message}`);
    }
  } catch (err) {
    warnings.push(`assessments cleanup: ${err instanceof Error ? err.message : err}`);
  }
  try {
    if (partial.course_id) {
      const res: DbResult = await supa.from("courses").delete().eq("id", partial.course_id);
      if (res.error) warnings.push(`course ${partial.course_id}: ${res.error.message}`);
      // units/lessons/lesson_blocks cascade from courses + units + lessons.
    }
  } catch (err) {
    warnings.push(`course cleanup: ${err instanceof Error ? err.message : err}`);
  }
  if (warnings.length > 0) {
    console.warn(`[ai-course] rollback warnings: ${warnings.join("; ")}`);
  }
}

async function failJob(
  supa: SupaClient,
  jobId: string,
  stepIndex: number | undefined,
  stepName: string,
  code: string,
  message: string,
  partial: PartialArtifacts
): Promise<HandlerResult> {
  await cleanupPartialArtifacts(supa, partial);
  const now = new Date().toISOString();
  if (stepIndex !== undefined) {
    await writeStep(supa, jobId, stepIndex, stepName, "failed", 0, `${code}: ${message}`);
  }
  await touchJob(supa, jobId, {
    status: "failed",
    error_message: message,
    completed_at: now,
  });
  return { progress_percent: 0, finishAfterStep: true };
}

// -------------------------------------------------------------------
// AI calls (smart tier: course/curriculum generation per 07-AI-SYSTEM)
// -------------------------------------------------------------------

const COURSE_SYSTEM = `You are Nova, an expert English curriculum designer for Al Hikmah (Libyan secondary grades 7-12).
Generate classroom-ready, original English content at the requested level. Never copy textbooks.
Avoid stereotypes, sensitive topics and brand promotion. Output valid JSON only, matching the requested schema exactly.`;

function buildRequest(
  params: AiCourseParams,
  userContent: string,
  maxTokens: number
): CompletionRequest {
  return {
    tier: "smart",
    systemInstruction: COURSE_SYSTEM,
    messages: [{ role: "user", content: userContent }],
    temperature: 0.4,
    maxTokens,
    timeoutMs: AI_TIMEOUT_MS,
    metadata: { feature: "ai_course" },
  };
}

function describeShape(params: AiCourseParams): string {
  const skills = params.skillsEmphasis?.length ? params.skillsEmphasis.join(", ") : "balanced vocabulary, grammar, reading, writing, listening";
  return [
    `Grade: ${params.grade}`,
    `Category: ${params.category}`,
    `Units: ${params.numUnits}, lessons per unit: ${params.lessonsPerUnit}`,
    params.weeks ? `Total weeks: ${params.weeks}` : null,
    `Skills emphasis: ${skills}`,
    `Level: ${params.level}`,
    `Tone: ${params.tone}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** One repair retry: validation errors are fed back to the model once. */
async function generateStructuredWithRepair<T>(
  ai: AIAdapter,
  req: CompletionRequest,
  validator: (json: unknown) => T,
  label: string,
  stepIndex: number
): Promise<T> {
  const attempt = async (repairNote?: string): Promise<T> => {
    const fixed: CompletionRequest = repairNote
      ? {
          ...req,
          messages: [
            ...req.messages,
            { role: "user" as const, content: `Your previous output was invalid: ${repairNote}\nFix ONLY the reported problems and output valid JSON again.` },
          ],
        }
      : req;
    const res = await ai.generateStructured(fixed, validator);
    return res.data;
  };
  try {
    return await attempt();
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    try {
      return await attempt(detail);
    } catch (retryErr) {
      const retryDetail = retryErr instanceof Error ? retryErr.message : String(retryErr);
      throw new AiCourseError(
        "provider_error",
        `${label} failed after repair attempt: ${retryDetail} (first error: ${detail})`,
        stepIndex
      );
    }
  }
}

function cefrForGrade(grade: number): "A1" | "A2" | "B1" | "B2" {
  const mapped = GRADE_CEFR_MAP[grade];
  return mapped === "A1" || mapped === "A2" || mapped === "B1" || mapped === "B2"
    ? mapped
    : "B1";
}

/** Post-check generated prose before persisting (teacher-facing draft quality). */
function guardOutput(text: string, grade: number, label: string, stepIndex: number): void {
  const post = postCheck(text, cefrForGrade(grade), false);
  if (post.status === "blocked") {
    throw new AiCourseError("safety_blocked", `${label} failed safety review and was discarded.`, stepIndex);
  }
}

// -------------------------------------------------------------------
// Steps 1-3: generation (pure AI; results cached in result_payload.partial)
// -------------------------------------------------------------------

async function runOutlineStep(
  ai: AIAdapter,
  params: AiCourseParams,
  low: LowConfidenceItem[]
): Promise<CoursePlan> {
  if (params.approvedOutline && params.approvedOutline.units.length > 0) {
    // TC-30 step 3: teacher already reviewed the outline synchronously.
    const approved = params.approvedOutline.units.slice(0, MAX_UNITS);
    return {
      title: params.topic,
      description: `AI-generated course on ${params.topic} for Grade ${params.grade}.`,
      units: approved.map((u) => ({
        title: u.title,
        objectives: (u.objectives ?? []).map((o) => o.trim()).filter(Boolean),
        lessons: (u.lessons ?? []).slice(0, params.lessonsPerUnit).map((l) => ({
          title: l.title,
          minutes: l.minutes && l.minutes > 0 ? Math.round(l.minutes) : 45,
        })),
        quiz_topics: [],
      })),
    };
  }
  const userContent = [
    `Design a complete English course.`,
    describeShape(params),
    `Topic/source: ${params.topic}`,
    params.sourceText ? `Source material:\n${params.sourceText.slice(0, 4000)}` : null,
    params.extraNotes ? `Teacher notes: ${params.extraNotes}` : null,
    ``,
    `Return JSON: {"title": string, "description": string (2-3 sentences), "units": [{"title": string, "objectives": string[] (exactly ${MIN_OBJECTIVES}-${MAX_OBJECTIVES}, each starting "By the end you can..."), "lessons": [{"title": string, "minutes": number}] (exactly ${params.lessonsPerUnit} lessons), "quiz_topics": string[] (unit quiz themes)}]} (exactly ${params.numUnits} units).`,
  ]
    .filter((l) => l !== null)
    .join("\n");
  const validated = await generateStructuredWithRepair(
    ai,
    buildRequest(params, userContent, 3000),
    (json) => validateCoursePlan(json, params.numUnits, params.lessonsPerUnit),
    "course outline",
    1
  );
  low.push(...validated.lowConfidence);
  return validated.plan;
}

async function runExpandStep(
  ai: AIAdapter,
  params: AiCourseParams,
  plan: CoursePlan,
  low: LowConfidenceItem[]
): Promise<UnitExpansion[]> {
  const expansions: UnitExpansion[] = [];
  for (let ui = 0; ui < plan.units.length; ui++) {
    const unit = plan.units[ui]!;
    const lessonList = unit.lessons
      .map((l, li) => `${li + 1}. ${l.title} (${l.minutes} min)`)
      .join("\n");
    const userContent = [
      `Expand unit ${ui + 1} of the Grade ${params.grade} English course "${plan.title}".`,
      `Unit title: ${unit.title}`,
      `Lessons:\n${lessonList}`,
      params.extraNotes ? `Teacher notes: ${params.extraNotes}` : null,
      ``,
      `Return JSON: {"unit_index": ${ui}, "objectives": string[] (${MIN_OBJECTIVES}-${MAX_OBJECTIVES}, each starting "By the end you can..."), "lessons": [{"title": string (keep the given titles), "description": string (2-3 sentences), "learning_goals": string[] (2-3 measurable goals)}]}.`,
    ]
      .filter((l) => l !== null)
      .join("\n");
    const expansion = await generateStructuredWithRepair(
      ai,
      buildRequest(params, userContent, 2500),
      (json) => validateUnitExpansion(json, ui, unit.lessons.length),
      `unit ${ui + 1} expansion`,
      2
    );
    low.push(...expansion.lowConfidence);
    guardOutput(
      `${unit.title} ${expansion.expansion.objectives.join(" ")} ${expansion.expansion.lessons.map((l) => `${l.title} ${l.description}`).join(" ")}`,
      params.grade,
      `unit ${ui + 1} expansion`,
      2
    );
    expansions.push(expansion.expansion);
  }
  return expansions;
}

async function generateOneLesson(
  ai: AIAdapter,
  params: AiCourseParams,
  unitTitle: string,
  objectives: string[],
  lesson: ExpandedLesson,
  ui: number,
  li: number
): Promise<{ content: LessonContent; lowConfidence: LowConfidenceItem[] }> {
  const userContent = [
    `Write the full content for a Grade ${params.grade} English lesson (${params.level}, ${params.tone} tone).`,
    `Unit: ${unitTitle}`,
    `Lesson: ${lesson.title}`,
    `Description: ${lesson.description}`,
    `Learning goals: ${lesson.learning_goals.join("; ") || "see unit objectives"}`,
    `Unit objectives: ${objectives.join("; ")}`,
    params.extraNotes ? `Teacher notes: ${params.extraNotes}` : null,
    ``,
    `Return JSON: {"lesson_index": ${li},`,
    `"intro": string (2-3 sentences),`,
    `"body": string (plain text, ${MIN_BODY_WORDS}-${MAX_BODY_WORDS} words, at Grade ${params.grade} level; do NOT repeat examples used elsewhere),`,
    `"examples": [{"sentence": string, "note"?: string}] (${MIN_EXAMPLES}-${MAX_EXAMPLES}, target language in the sentences),`,
    `"vocabulary": [{"word": string, "part_of_speech"?: string, "meaning": string, "arabic"?: string, "example"?: string}] (${MIN_KEYWORDS}-${MAX_KEYWORDS}),`,
    `"checks": [{"prompt": string, "answer": string}] (exactly ${LESSON_CHECKS} check-yourself questions),`,
    params.includeAudioScripts ? `"audio_script": string (short listening script with transcript text),` : null,
    `}`,
  ]
    .filter((l) => l !== null)
    .join("\n");
  const validated = await generateStructuredWithRepair(
    ai,
    buildRequest(params, userContent, 3500),
    (json) => validateLessonContent(json, ui, li),
    `lesson "${lesson.title}"`,
    3
  );
  const content = validated.content;
  guardOutput(
    `${lesson.title} ${content.intro} ${content.body}`,
    params.grade,
    `lesson "${lesson.title}"`,
    3
  );
  return { content, lowConfidence: validated.lowConfidence };
}

async function runContentStep(
  ai: AIAdapter,
  params: AiCourseParams,
  plan: CoursePlan,
  expansions: UnitExpansion[],
  low: LowConfidenceItem[]
): Promise<{ contents: LessonContent[][]; quizzes: UnitQuiz[] }> {
  const contents: LessonContent[][] = [];
  for (let ui = 0; ui < plan.units.length; ui++) {
    const unit = plan.units[ui]!;
    const expansion = expansions[ui]!;
    const unitContents: LessonContent[] = new Array(expansion.lessons.length);
    for (let start = 0; start < expansion.lessons.length; start += MAX_PARALLEL_LESSONS) {
      const chunk = expansion.lessons
        .map((lesson, li) => ({ lesson, li }))
        .slice(start, start + MAX_PARALLEL_LESSONS);
      const results = await Promise.all(
        chunk.map(({ lesson, li }) =>
          generateOneLesson(ai, params, unit.title, expansion.objectives, lesson, ui, li)
        )
      );
      for (let k = 0; k < chunk.length; k++) {
        unitContents[chunk[k]!.li] = results[k]!.content;
        low.push(...results[k]!.lowConfidence);
      }
    }
    contents.push(unitContents);
  }

  const quizzes: UnitQuiz[] = [];
  if (params.includeQuiz) {
    for (let ui = 0; ui < plan.units.length; ui++) {
      const unit = plan.units[ui]!;
      const mix = DEFAULT_QUIZ_MIX.slice(0, QUIZ_QUESTIONS_PER_UNIT)
        .map((t, i) => `${i + 1}. ${t}`)
        .join("\n");
      const userContent = [
        `Write a ${QUIZ_QUESTIONS_PER_UNIT}-question unit quiz for Grade ${params.grade} English (${params.level}).`,
        `Unit: ${unit.title}`,
        `Objectives: ${expansions[ui]!.objectives.join("; ")}`,
        `Quiz themes: ${unit.quiz_topics.join(", ") || unit.title}`,
        ``,
        `Rules (AI-BEHAVIOR 5.2): multiple_choice has ONE clearly correct answer, 3-4 plausible distractors of similar length, no "all/none of the above", correct position randomized; true/false statements go in as multiple_choice with choices ["True","False"]; fill_blank prompts contain a {{1}} marker with all accepted answers listed; matching has 4-6 pairs; every question has a 1-2 sentence explanation; school-appropriate, no real private details.`,
        `Question types in order:\n${mix}`,
        ``,
        `Return JSON: {"unit_index": ${ui}, "questions": [{"type": one of the listed types, "prompt": string, "choices"?: string[] (multiple_choice only), "correct_index"?: number (multiple_choice only), "accepted_answers"?: string[] (fill_blank only), "pairs"?: [[left, right]] (matching only), "explanation": string, "difficulty": "easy"|"medium"|"hard", "skill": vocabulary|grammar|reading|writing|listening|translation}] (exactly ${QUIZ_QUESTIONS_PER_UNIT} questions)}.`,
      ].join("\n");
      const validatedQuiz = await generateStructuredWithRepair(
        ai,
        buildRequest(params, userContent, 4000),
        (json) => validateUnitQuiz(json, ui, QUIZ_QUESTIONS_PER_UNIT),
        `unit ${ui + 1} quiz`,
        3
      );
      const quiz = validatedQuiz.quiz;
      low.push(...validatedQuiz.lowConfidence);
      guardOutput(
        quiz.questions.map((q) => `${q.prompt} ${q.explanation}`).join(" "),
        params.grade,
        `unit ${ui + 1} quiz`,
        3
      );
      quizzes.push(quiz);
    }
  }
  return { contents, quizzes };
}

// -------------------------------------------------------------------
// Step 4: assemble (idempotent inserts; skips rows that already exist)
// -------------------------------------------------------------------

async function runAssembleStep(
  supa: SupaClient,
  job: JobRecord,
  params: AiCourseParams,
  plan: CoursePlan,
  expansions: UnitExpansion[],
  contents: LessonContent[][],
  quizzes: UnitQuiz[],
  partial: PartialArtifacts
): Promise<{ courseId: string; counts: CourseCounts }> {
  const authorId = job.initiator_id;

  // A stale course_id (row deleted externally after a crash) must not be
  // reused: verify the row exists before treating this as a resume.
  let courseId = partial.course_id;
  if (courseId) {
    try {
      await dbSingle(supa, "courses", courseId);
    } catch {
      courseId = undefined;
    }
  }
  // --- course row (always a fresh draft; resumes reuse the verified row) ---
  if (!courseId) {
    const slug = await ensureUniqueSlug(supa, plan.title);
    const rows = await insertReturning(supa, "courses", {
      author_id: authorId,
      title: plan.title,
      slug,
      description: plan.description,
      grade_level: String(params.grade),
      is_official: false,
      status: "draft",
    });
    courseId = rows[0].id as string;
    partial.course_id = courseId;
    partial.unit_ids = [];
    partial.lesson_ids = [];
    partial.assessment_ids = [];
    partial.question_ids = [];
    partial.completed_lessons = [];
    await writePartial(supa, job.id, partial);
  }
  const unitMap = await fetchUnitOrderMap(supa, courseId);

  const unitIds: string[] = partial.unit_ids ?? [];
  const lessonIds: string[] = partial.lesson_ids ?? [];

  for (let ui = 0; ui < plan.units.length; ui++) {
    const planned = plan.units[ui]!;
    const expansion = expansions[ui]!;
    let unitId = unitMap.get(ui)?.id;
    if (!unitId) {
      const rows = await insertReturning(supa, "units", {
        course_id: courseId,
        title: planned.title,
        description: renderUnitDescription(expansion.objectives, planned.title),
        order_index: ui,
      });
      unitId = rows[0].id as string;
      unitIds.push(unitId);
      unitMap.set(ui, { id: unitId, lessons: new Map() });
      partial.unit_ids = unitIds;
      await writePartial(supa, job.id, partial);
    }

    const unitEntry = unitMap.get(ui)!;
    for (let li = 0; li < expansion.lessons.length; li++) {
      const key = `${ui}:${li}`;
      const expanded = expansion.lessons[li]!;
      const content = contents[ui]?.[li];
      if (!content) {
        throw new AiCourseError(
          "invalid_state",
          `Missing generated content for unit ${ui + 1}, lesson ${li + 1}; re-run the job to regenerate it.`,
          4
        );
      }
      let lessonId = unitEntry.lessons.get(li)?.id;
      if (!lessonId) {
        const goals = expanded.learning_goals.length
          ? `\nGoals: ${expanded.learning_goals.join("; ")}`
          : "";
        const rows = await insertReturning(supa, "lessons", {
          unit_id: unitId,
          title: expanded.title,
          description: `${expanded.description}${goals}`,
          order_index: li,
        });
        lessonId = rows[0].id as string;
        lessonIds.push(lessonId);
        unitEntry.lessons.set(li, { id: lessonId, blockCount: 0 });
        partial.lesson_ids = lessonIds;
        await writePartial(supa, job.id, partial);
      }

      const lessonEntry = unitEntry.lessons.get(li)!;
      if (lessonEntry.blockCount === 0 && !(partial.completed_lessons ?? []).includes(key)) {
        const blocks: Array<{ lesson_id: string; block_type: string; content: unknown; order_index: number }> = [];
        let order = 0;
        blocks.push({
          lesson_id: lessonId,
          block_type: "text",
          content: { html: `<p>${escapeHtml(content.intro)}</p><p>${escapeHtml(content.body)}</p>` },
          order_index: order++,
        });
        for (const ex of content.examples) {
          blocks.push({
            lesson_id: lessonId,
            block_type: "example",
            content: { sentence: ex.sentence, ...(ex.note ? { note: ex.note } : {}) },
            order_index: order++,
          });
        }
        if (params.includeVocabulary) {
          blocks.push({
            lesson_id: lessonId,
            block_type: "keywords",
            content: {
              items: content.vocabulary.map((v) => ({
                word: v.word,
                pos: v.part_of_speech ?? "",
                meaning: v.meaning,
                arabic: v.arabic ?? "",
                example: v.example ?? "",
              })),
            },
            order_index: order++,
          });
        }
        blocks.push({
          lesson_id: lessonId,
          block_type: "check",
          content: {
            questions: content.checks.map((c) => ({ prompt: c.prompt, answer: c.answer })),
          },
          order_index: order++,
        });
        if (params.includeAudioScripts && content.audio_script) {
          blocks.push({
            lesson_id: lessonId,
            block_type: "audio",
            content: { transcript: content.audio_script },
            order_index: order++,
          });
        }
        await insertReturning(supa, "lesson_blocks", blocks);
        lessonEntry.blockCount = blocks.length;
        partial.completed_lessons = [...(partial.completed_lessons ?? []), key];
        await writePartial(supa, job.id, partial);
      }
    }
  }

  // --- unit quizzes (draft assessments; unassigned: class_id null) ---
  const assessmentIds: string[] = partial.assessment_ids ?? [];
  const questionIds: string[] = partial.question_ids ?? [];
  let questionCount = 0;
  let quizCount = 0;
  if (params.includeQuiz) {
    for (let ui = 0; ui < quizzes.length; ui++) {
      const quiz = quizzes[ui]!;
      if (assessmentIds[ui]) {
        quizCount++;
        questionCount += quiz.questions.length;
        continue;
      }
      const unit = plan.units[ui]!;
      const arows = await insertReturning(supa, "assessments", {
        author_id: authorId,
        title: `${unit.title} — Quiz`,
        description: `Auto-generated unit quiz for "${unit.title}". Review before assigning to a class.`,
        kind: "quiz",
        status: "draft",
      });
      const assessmentId = arows[0].id as string;
      const tagBase = `${slugify(unit.title)}-u${ui + 1}`;
      const links: Array<{ assessment_id: string; question_id: string; order_index: number }> = [];
      for (let qi = 0; qi < quiz.questions.length; qi++) {
        const q = quiz.questions[qi]!;
        const qrows = await insertReturning(
          supa,
          "questions",
          toQuestionRow(q, authorId, [tagBase, `grade-${params.grade}`, q.skill, "ai-generated"])
        );
        const questionId = qrows[0].id as string;
        questionIds.push(questionId);
        links.push({ assessment_id: assessmentId, question_id: questionId, order_index: qi });
      }
      await insertReturning(supa, "assessment_questions", links);
      assessmentIds[ui] = assessmentId;
      partial.assessment_ids = assessmentIds;
      partial.question_ids = questionIds;
      await writePartial(supa, job.id, partial);
      quizCount++;
      questionCount += quiz.questions.length;
    }
  }

  const lessonTotal = expansions.reduce((n, e) => n + e.lessons.length, 0);
  // Block layout per lesson is deterministic (1 text + N examples +
  // 1 keywords when vocabulary is on + 1 check + optional audio), so final
  // counts are exact without extra recount queries — including resumed runs.
  const blocksPerLesson = (c: LessonContent): number =>
    2 +
    c.examples.length +
    (params.includeVocabulary ? 1 : 0) +
    (params.includeAudioScripts && c.audio_script ? 1 : 0);
  const counts: CourseCounts = {
    units: plan.units.length,
    lessons: lessonTotal,
    blocks: contents.reduce(
      (n, unitContents) => n + unitContents.reduce((m, c) => m + blocksPerLesson(c), 0),
      0
    ),
    vocabulary_items: params.includeVocabulary
      ? contents.reduce(
          (n, unitContents) =>
            n + unitContents.reduce((m, c) => m + c.vocabulary.length, 0),
          0
        )
      : 0,
    questions: questionCount,
    quizzes: quizCount,
  };
  return { courseId, counts };
}

// -------------------------------------------------------------------
// Main handler
// -------------------------------------------------------------------

export async function handleAiCourse(
  job: JobRecord,
  supa: SupaClient,
  ai: AIAdapter = defaultAIAdapter
): Promise<HandlerResult> {
  if (job.kind !== AI_COURSE_KIND) {
    throw new AiCourseError(
      "validation_failed",
      `handleAiCourse cannot process kind="${job.kind}".`
    );
  }

  const fresh = await readJob(supa, job.id);
  if (fresh.status === "completed") {
    return {
      progress_percent: 100,
      finishAfterStep: true,
      result_payload: fresh.result_payload ?? {},
    };
  }
  if (fresh.status === "cancelled") {
    return { progress_percent: 0, finishAfterStep: true };
  }
  const current: JobRecord = { ...job, ...fresh };
  let partial = readPartial(current.result_payload);

  const stepOf = (index: number) => AI_COURSE_STEPS.find((s) => s.index === index)!;
  const ensureRunning = async (index: number, message: string): Promise<void> => {
    const status = (await readJob(supa, current.id)).status;
    if (status === "cancelled") {
      throw new AiCourseError("cancelled", "Job was cancelled by the requester.", index);
    }
    const step = stepOf(index);
    await writeStep(supa, current.id, index, step.name, "running", step.progress, message);
  };

  try {
    const params = parseAiCourseParams(current.input_params);

    // Safety: teacher prompt pre-check (injection / blocklist). Blocked input
    // fails fast with no model call; nothing is persisted, so no rollback needed.
    const pre = preCheck(`${params.topic}\n${params.sourceText ?? ""}\n${params.extraNotes ?? ""}`);
    if (pre.status === "blocked" || pre.status === "redirect") {
      const now = new Date().toISOString();
      await touchJob(supa, current.id, {
        status: "failed",
        error_message: "The course request could not be processed. Please rephrase the topic and try again.",
        completed_at: now,
      });
      return { progress_percent: 0, finishAfterStep: true };
    }

    await touchJob(supa, current.id, { started_at: new Date().toISOString() });
    const done = await readCompletedSteps(supa, current.id);
    // Low-confidence flags accumulate in partial so retried/resumed runs keep
    // the full review list for the teacher (07-AI-SYSTEM section 9).
    const low: LowConfidenceItem[] = [...(partial.low_confidence ?? [])];

    // --- Step 1: outline (25%) ---
    let plan = partial.plan;
    if (!done.has(1) || !plan) {
      await ensureRunning(1, `Generating course outline for "${params.topic}"`);
      plan = await runOutlineStep(ai, params, low);
      partial = { ...readPartial((await readJob(supa, current.id)).result_payload), plan, low_confidence: [...low] };
      await writePartial(supa, current.id, partial);
      await writeStep(supa, current.id, 1, stepOf(1).name, "completed", 25, `${plan.units.length} units outlined`);
    }

    // --- Step 2: expansion (50%) ---
    let expansions = partial.expansions;
    if (!done.has(2) || !expansions || expansions.length !== plan.units.length) {
      await ensureRunning(2, "Expanding units with lessons and objectives");
      expansions = await runExpandStep(ai, params, plan, low);
      partial = { ...readPartial((await readJob(supa, current.id)).result_payload), plan, expansions, low_confidence: [...low] };
      await writePartial(supa, current.id, partial);
      await writeStep(supa, current.id, 2, stepOf(2).name, "completed", 50, `${expansions.length} units expanded`);
    }

    // --- Step 3: lesson content + quizzes (75%) ---
    let contents = partial.contents;
    let unitQuizzes = partial.quizzes;
    const contentsComplete =
      contents &&
      contents.length === plan.units.length &&
      contents.every((unitContents, ui) => unitContents.length === expansions[ui]!.lessons.length);
    const quizzesComplete =
      !params.includeQuiz ||
      (unitQuizzes && unitQuizzes.length === plan.units.length);
    if (!done.has(3) || !contentsComplete || !quizzesComplete) {
      await ensureRunning(3, "Generating lesson blocks and practice questions");
      const generated = await runContentStep(ai, params, plan, expansions, low);
      contents = generated.contents;
      unitQuizzes = generated.quizzes;
      partial = {
        ...readPartial((await readJob(supa, current.id)).result_payload),
        plan,
        expansions,
        contents,
        quizzes: unitQuizzes,
        low_confidence: [...low],
      };
      await writePartial(supa, current.id, partial);
      await writeStep(supa, current.id, 3, stepOf(3).name, "completed", 75, "Lesson content generated");
    }

    // --- Step 4: assemble (100%) ---
    await ensureRunning(4, "Assembling draft course");
    partial = readPartial((await readJob(supa, current.id)).result_payload);
    const { courseId, counts } = await runAssembleStep(
      supa,
      current,
      params,
      partial.plan ?? plan,
      partial.expansions ?? expansions,
      partial.contents ?? contents!,
      partial.quizzes ?? unitQuizzes ?? [],
      partial
    );
    await writeStep(
      supa,
      current.id,
      4,
      stepOf(4).name,
      "completed",
      100,
      `Draft course assembled (${counts.units} units, ${counts.lessons} lessons)`
    );

    const resultPayload = {
      course_id: courseId,
      counts,
      low_confidence_items: low,
      meta: {
        grade: params.grade,
        category: params.category,
        tone: params.tone,
        level: params.level,
        include_activities: params.includeActivities,
        include_quiz: params.includeQuiz,
        include_vocabulary: params.includeVocabulary,
        include_audio_scripts: params.includeAudioScripts,
      },
    };
    const now = new Date().toISOString();
    await touchJob(supa, current.id, {
      status: "completed",
      result_payload: resultPayload,
      completed_at: now,
    });

    // Notify the teacher author (best-effort: never fails a completed job).
    try {
      await insertReturning(supa, "notifications", {
        user_id: current.initiator_id,
        kind: "ai_course_completed",
        title: "Your AI course draft is ready",
        body: `"${plan.title}" was generated with ${counts.units} units and ${counts.lessons} lessons. Review it before publishing.`,
        payload: { course_id: courseId, job_id: current.id },
        link: `/teacher/courses/${courseId}`,
        priority: "normal",
      });
    } catch (notifyErr) {
      console.warn(
        `[ai-course] completion notification failed: ${notifyErr instanceof Error ? notifyErr.message : notifyErr}`
      );
    }

    return { progress_percent: 100, finishAfterStep: true, result_payload: resultPayload };
  } catch (err) {
    if (err instanceof AiCourseError && err.code === "cancelled") {
      return { progress_percent: 0, finishAfterStep: true };
    }
    const code = err instanceof AiCourseError ? err.code : "provider_error";
    const stepIndex = err instanceof AiCourseError ? err.stepIndex : undefined;
    const stepName = stepIndex !== undefined ? stepOf(stepIndex).name : "assemble";
    const message = err instanceof Error ? err.message : "Course generation failed.";
    console.warn(`[ai-course] job ${current.id} failed at step "${stepName}": ${message}`);
    return await failJob(supa, current.id, stepIndex, stepName, code, message, partial);
  }
}

// -------------------------------------------------------------------
// Self-registration (guarded: the runner may also wire this explicitly).
// -------------------------------------------------------------------

void (async () => {
  try {
    const registry = await import("./registry");
    const register = (registry as { registerHandler?: unknown }).registerHandler;
    if (typeof register === "function") {
      (register as (kind: string, handler: typeof handleAiCourse) => void)(
        AI_COURSE_KIND,
        handleAiCourse
      );
    }
  } catch (err) {
    console.warn(
      `[ai-course] self-registration skipped (wire handleAiCourse in job-runner/index.ts): ${
        err instanceof Error ? err.message : err
      }`
    );
  }
})();
