import type {
  Choice,
  Question,
  QuestionPrompt,
  QuestionValue,
} from "@/shared/components/questions/types";
import type {
  AnswerMap,
  RendererSolveQuestion,
  SolveAnswer,
  SolveQuestion,
  WritingAnswer,
  WritingSolveQuestion,
} from "./types";

/* ========================================
   Assignment draft + question mapping (ST-13, API-CONTRACT 3.4)

   `start_assignment` returns QuestionForClient rows: a `key` instead of a database id, no answer key,
   and type-specific options in `meta`/`options`. This file turns that loose JSON into the exact
   shapes QuestionRenderer and the writing editor expect. It also reads drafts defensively so a
   draft saved by an older build (or a plain-text draft) still reopens with the student's work.
   ======================================== */

const WRITING_TYPES = new Set([
  "essay",
  "free_text",
  "freeform",
  "long_answer",
  "paragraph",
  "response",
  "short_answer",
  "writing",
]);

const TYPE_ALIASES: Record<string, Question["type"] | "writing"> = {
  "audio-spelling": "audio_spelling",
  audio: "audio_spelling",
  audio_spelling: "audio_spelling",
  essay: "writing",
  fill_blank: "fill_blank",
  fill_in_blank: "fill_blank",
  fill_in_the_blank: "fill_blank",
  fill_the_blank: "fill_blank",
  gap_fill: "fill_blank",
  long_answer: "writing",
  match: "matching",
  matching: "matching",
  mcq: "multiple_choice",
  multiple_choice: "multiple_choice",
  ordering: "reorder",
  paragraph: "writing",
  reorder: "reorder",
  reorder_items: "reorder",
  response: "writing",
  short_answer: "writing",
  spelling: "audio_spelling",
  writing: "writing",
};

type RawRecord = Record<string, unknown>;

function record(value: unknown): RawRecord | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  return value as RawRecord;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function firstText(...values: unknown[]): string | undefined {
  for (const value of values) {
    const found = text(value);
    if (found) return found;
  }
  return undefined;
}

function number(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    const found = number(value);
    if (found !== undefined) return found;
  }
  return undefined;
}

function firstBoolean(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    if (typeof value === "boolean") return value;
  }
  return undefined;
}

function normalizeType(value: string | undefined): Question["type"] | "writing" | undefined {
  if (!value) return undefined;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return TYPE_ALIASES[normalized] ?? (WRITING_TYPES.has(normalized) ? "writing" : undefined);
}

function choicesFrom(value: unknown, prefix: string): Choice[] {
  const source = record(value);
  const list = Array.isArray(value)
    ? value
    : array(source?.["items"]).length > 0
      ? array(source?.["items"])
      : array(source?.["choices"]);

  const choices: Choice[] = [];
  for (const [index, item] of list.entries()) {
    if (typeof item === "string") {
      const itemText = text(item);
      if (itemText) choices.push({ id: `${prefix}-${index + 1}`, text: itemText });
      continue;
    }

    const raw = record(item);
    if (!raw) continue;
    const choiceText = firstText(
      raw["text"],
      raw["label"],
      raw["value"],
      raw["name"],
      raw["meaning"],
    );
    if (!choiceText) continue;
    const id =
      firstText(raw["id"], raw["key"], raw["value"], raw["slug"]) ?? `${prefix}-${index + 1}`;
    choices.push({ id, text: choiceText });
  }
  return choices;
}

function promptFrom(raw: RawRecord, nested: RawRecord | undefined): QuestionPrompt {
  const value = raw["prompt"] ?? nested?.["prompt"];
  const prompt = record(value);
  const promptText =
    firstText(
      prompt?.["text"],
      prompt?.["content"],
      typeof value === "string" ? value : undefined,
      raw["prompt_text"],
      raw["promptText"],
      nested?.["prompt_text"],
      nested?.["promptText"],
      raw["question"],
      raw["text"],
    ) ?? "";
  const promptHtml = firstText(
    prompt?.["html"],
    prompt?.["rich_text"],
    prompt?.["richText"],
    raw["prompt_html"],
    raw["promptHtml"],
  );

  return {
    text: promptText,
    ...(promptHtml ? { html: promptHtml } : {}),
  };
}

function buildRendererQuestion(
  type: Question["type"],
  id: string,
  prompt: QuestionPrompt,
  raw: RawRecord,
  nested: RawRecord | undefined,
  meta: RawRecord,
): Question | undefined {
  const options = raw["options"] ?? nested?.["options"];
  const optionsRecord = record(options);
  const wordBankSource =
    raw["word_bank"] ??
    raw["wordBank"] ??
    nested?.["word_bank"] ??
    meta["word_bank"] ??
    meta["wordBank"];
  const wordBank = array(wordBankSource)
    .map((item) => text(item))
    .filter((item): item is string => Boolean(item));

  switch (type) {
    case "multiple_choice": {
      const choices = choicesFrom(
        optionsRecord?.["choices"] ?? optionsRecord?.["items"] ?? options,
        `${id}-option`,
      );
      const multi = firstBoolean(
        raw["multi"],
        nested?.["multi"],
        meta["multi"],
        optionsRecord?.["multi"],
      );
      return {
        id,
        type,
        prompt,
        options: choices,
        ...(multi !== undefined ? { multi } : {}),
      };
    }
    case "fill_blank":
      return {
        id,
        type,
        prompt,
        ...(wordBank.length > 0 ? { wordBank } : {}),
      };
    case "matching":
      return {
        id,
        type,
        prompt,
        options: {
          left: choicesFrom(optionsRecord?.["left"] ?? raw["left"] ?? meta["left"], `${id}-left`),
          right: choicesFrom(
            optionsRecord?.["right"] ?? raw["right"] ?? meta["right"],
            `${id}-right`,
          ),
        },
      };
    case "reorder": {
      const items = choicesFrom(
        optionsRecord?.["items"] ?? options ?? raw["items"] ?? meta["items"],
        `${id}-item`,
      );
      return {
        id,
        type,
        prompt,
        options: { items },
      };
    }
    case "audio_spelling": {
      const tiles = choicesFrom(
        optionsRecord?.["tiles"] ??
          optionsRecord?.["choices"] ??
          raw["tiles"] ??
          options ??
          meta["tiles"],
        `${id}-tile`,
      );
      const audioUrl = firstText(
        raw["audio_url"],
        raw["audioUrl"],
        nested?.["audio_url"],
        nested?.["audioUrl"],
        record(raw["audio"])?.["url"],
        record(nested?.["audio"])?.["url"],
        record(meta["audio"])?.["url"],
      );
      return {
        id,
        type,
        prompt,
        options: { tiles },
        ...(audioUrl ? { audioUrl } : {}),
      };
    }
    case "short_answer": {
      const minWords = firstNumber(
        raw["min_words"],
        raw["minWords"],
        nested?.["min_words"],
        meta["min_words"],
        meta["minWords"],
      );
      const maxWords = firstNumber(
        raw["max_words"],
        raw["maxWords"],
        nested?.["max_words"],
        meta["max_words"],
        meta["maxWords"],
      );
      return {
        id,
        type,
        prompt,
        ...(minWords !== undefined ? { minWords } : {}),
        ...(maxWords !== undefined ? { maxWords } : {}),
      };
    }
    default:
      return undefined;
  }
}

export interface NormalizeQuestionsResult {
  questions: SolveQuestion[];
  ignoredCount: number;
}

export function normalizeQuestions(
  source: unknown,
  fallbackWordTarget?: { min?: number | undefined; max?: number | undefined },
): NormalizeQuestionsResult {
  const questions: SolveQuestion[] = [];
  const seenIds = new Set<string>();
  let ignoredCount = 0;

  for (const [index, item] of array(source).entries()) {
    const raw = record(item);
    if (!raw) {
      ignoredCount += 1;
      continue;
    }

    const nested = record(raw["question"]);
    const meta = record(raw["meta"] ?? nested?.["meta"]) ?? {};
    const rawType = firstText(
      raw["type"],
      raw["question_type"],
      raw["questionType"],
      nested?.["type"],
      nested?.["question_type"],
      meta["type"],
    );
    const type = normalizeType(rawType);
    if (!type) {
      ignoredCount += 1;
      continue;
    }

    const baseId =
      firstText(raw["key"], raw["id"], raw["question_id"], raw["questionId"], nested?.["id"]) ??
      `question-${index + 1}`;
    let id = baseId;
    let duplicate = 1;
    while (seenIds.has(id)) {
      duplicate += 1;
      id = `${baseId}-${duplicate}`;
    }
    seenIds.add(id);

    const prompt = promptFrom(raw, nested);
    const points = firstNumber(
      raw["points"],
      raw["points_override"],
      raw["pointsOverride"],
      nested?.["points"],
      meta["points"],
    );

    if (type === "writing") {
      const minWords =
        firstNumber(
          raw["min_words"],
          raw["minWords"],
          nested?.["min_words"],
          nested?.["minWords"],
          meta["min_words"],
          meta["minWords"],
        ) ?? fallbackWordTarget?.min;
      const maxWords =
        firstNumber(
          raw["max_words"],
          raw["maxWords"],
          nested?.["max_words"],
          nested?.["maxWords"],
          meta["max_words"],
          meta["maxWords"],
        ) ?? fallbackWordTarget?.max;

      const writingQuestion: WritingSolveQuestion = {
        kind: "writing",
        id,
        type,
        prompt,
        sourceType: rawType ?? "writing",
        ...(points !== undefined ? { points } : {}),
        ...(minWords !== undefined ? { minWords } : {}),
        ...(maxWords !== undefined ? { maxWords } : {}),
      };
      questions.push(writingQuestion);
      continue;
    }

    const question = buildRendererQuestion(type, id, prompt, raw, nested, meta);
    if (!question) {
      ignoredCount += 1;
      continue;
    }

    const rendererQuestion: RendererSolveQuestion = {
      kind: "renderer",
      id,
      question,
      ...(points !== undefined ? { points } : {}),
    };
    questions.push(rendererQuestion);
  }

  return { questions, ignoredCount };
}

/* ---------- Writing text helpers ---------- */

export function countWords(value: string): number {
  const trimmed = value.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/u).length;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Converts legacy plain-text drafts into paragraphs the Tiptap schema can parse. */
export function plainTextToHtml(value: string): string {
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return "";

  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => {
      const lines = paragraph.split("\n").map((line) => escapeHtml(line));
      return `<p>${lines.join("<br>")}</p>`;
    })
    .join("");
}

/** Text used for word counts and the read-only fallback, never for rendering as HTML. */
export function htmlToText(value: string): string {
  const withBreaks = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|h[1-6]|li|blockquote)>/gi, "\n");

  if (typeof document !== "undefined") {
    const container = document.createElement("div");
    container.innerHTML = withBreaks;
    return (container.textContent ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  return withBreaks
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createWritingAnswer(value: string, html?: string): WritingAnswer {
  const normalized = value.replace(/\r\n?/g, "\n");
  return {
    html: html?.trim() ? html : plainTextToHtml(normalized),
    text: normalized,
    wordCount: countWords(normalized),
    characterCount: normalized.length,
  };
}

export function writingAnswerFromHtml(html: string, text?: string): WritingAnswer {
  return createWritingAnswer(text ?? htmlToText(html), html);
}

/* ---------- Draft hydration ---------- */

function rowsToAnswers(rows: unknown[]): RawRecord {
  const answers: RawRecord = {};
  for (const item of rows) {
    const row = record(item);
    if (!row) continue;
    const id = firstText(row["question_id"], row["questionId"], row["key"], row["id"]);
    if (!id) continue;
    answers[id] = row["answer"] ?? row["value"] ?? row["response"] ?? row;
  }
  return answers;
}

function extractDraftSource(draft: unknown): RawRecord {
  if (Array.isArray(draft)) return rowsToAnswers(draft);
  const root = record(draft);
  if (!root) return {};

  for (const key of ["answers", "responses"]) {
    const value = root[key];
    if (Array.isArray(value)) return rowsToAnswers(value);
    const nested = record(value);
    if (nested) return nested;
  }

  const nestedDraft = root["draft"];
  if (nestedDraft !== undefined && nestedDraft !== draft) {
    const nested = extractDraftSource(nestedDraft);
    if (Object.keys(nested).length > 0) return nested;
  }

  const data = root["data"];
  if (data !== undefined && data !== draft) {
    const nested = extractDraftSource(data);
    if (Object.keys(nested).length > 0) return nested;
  }

  return root;
}

function hydrateWriting(raw: unknown): WritingAnswer | undefined {
  if (typeof raw === "string") {
    const looksLikeHtml = /<\/?[a-z][^>]*>/i.test(raw);
    return looksLikeHtml ? writingAnswerFromHtml(raw) : createWritingAnswer(raw);
  }

  const value = record(raw);
  if (!value) return undefined;

  const nested = record(value["answer"]);
  if (nested && nested !== value) {
    const answer = hydrateWriting(nested);
    if (answer) return answer;
  }

  const html = firstText(
    value["html"],
    value["content"],
    value["rich_text"],
    value["richText"],
    value["body"],
  );
  const plain = firstText(value["text"], value["plain_text"], value["plainText"], value["value"]);

  if (html) return writingAnswerFromHtml(html, plain);
  if (plain) return createWritingAnswer(plain);
  return undefined;
}

function stringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((item) => text(item)).filter((item): item is string => item !== undefined);
}

function hydrateRenderer(question: Question, raw: unknown): QuestionValue | undefined {
  if (typeof raw === "string") {
    if (question.type === "multiple_choice") return { selected: [raw] };
    if (question.type === "fill_blank") return { blanks: [raw] };
    if (question.type === "audio_spelling") return { tiles: [raw] };
    return undefined;
  }

  const value = record(raw);
  if (!value) return undefined;
  const nestedAnswer = record(value["answer"]);
  const source = nestedAnswer ?? value;

  switch (question.type) {
    case "multiple_choice": {
      const selected = stringList(source["selected"] ?? source["value"] ?? raw);
      return selected ? { selected } : undefined;
    }
    case "fill_blank": {
      const blanks = stringList(source["blanks"] ?? source["value"] ?? raw);
      return blanks ? { blanks } : undefined;
    }
    case "matching": {
      const pairs: Array<[string, string]> = [];
      for (const pair of array(source["pairs"] ?? raw)) {
        if (!Array.isArray(pair)) continue;
        const left = text(pair[0]);
        const right = text(pair[1]);
        if (left && right) pairs.push([left, right]);
      }
      return { pairs };
    }
    case "reorder": {
      const order = stringList(source["order"] ?? source["value"] ?? raw);
      return order ? { order } : undefined;
    }
    case "short_answer": {
      const answerText = firstText(source["text"], source["value"]);
      return answerText ? { text: answerText } : undefined;
    }
    case "audio_spelling": {
      const tiles = stringList(source["tiles"] ?? source["value"] ?? raw);
      return tiles ? { tiles } : undefined;
    }
    default:
      return undefined;
  }
}

function hydrateAnswer(question: SolveQuestion, raw: unknown): SolveAnswer | undefined {
  if (raw === undefined || raw === null) return undefined;
  return question.kind === "writing"
    ? hydrateWriting(raw)
    : hydrateRenderer(question.question, raw);
}

export function hydrateAnswers(questions: SolveQuestion[], draft: unknown): AnswerMap {
  const source = extractDraftSource(draft);
  const answers: AnswerMap = {};

  for (const question of questions) {
    const answer = hydrateAnswer(question, source[question.id]);
    if (answer) answers[question.id] = answer;
  }

  return answers;
}

/* ---------- Serialization + progress ---------- */

export function isWritingAnswer(value: unknown): value is WritingAnswer {
  const raw = record(value);
  return (
    raw !== undefined &&
    typeof raw["html"] === "string" &&
    typeof raw["text"] === "string" &&
    typeof raw["wordCount"] === "number" &&
    typeof raw["characterCount"] === "number"
  );
}

/** Writing answers are stored with word counts for the teacher grading queue. */
export function serializeAnswers(answers: AnswerMap): Record<string, unknown> {
  const serialized: Record<string, unknown> = {};

  for (const [id, answer] of Object.entries(answers)) {
    serialized[id] = isWritingAnswer(answer)
      ? {
          html: answer.html,
          text: answer.text,
          word_count: answer.wordCount,
          character_count: answer.characterCount,
        }
      : answer;
  }

  return serialized;
}

export function isAnswerEmpty(question: SolveQuestion, answer: SolveAnswer | undefined): boolean {
  if (!answer) return true;
  if (question.kind === "writing") {
    return isWritingAnswer(answer) ? answer.text.trim() === "" : true;
  }

  const value = record(answer);
  if (!value) return true;

  switch (question.question.type) {
    case "multiple_choice":
      return stringList(value["selected"])?.length === 0 || !value["selected"];
    case "fill_blank":
      return (
        !Array.isArray(value["blanks"]) ||
        value["blanks"].every((blank) => typeof blank === "string" && blank.trim() === "")
      );
    case "matching":
      return !Array.isArray(value["pairs"]) || value["pairs"].length === 0;
    case "reorder":
      return !Array.isArray(value["order"]) || value["order"].length === 0;
    case "short_answer":
      return typeof value["text"] !== "string" || value["text"].trim() === "";
    case "audio_spelling":
      return !Array.isArray(value["tiles"]) || value["tiles"].length === 0;
    default:
      return true;
  }
}

export function countAnswered(questions: SolveQuestion[], answers: AnswerMap): number {
  return questions.reduce(
    (total, question) => total + (isAnswerEmpty(question, answers[question.id]) ? 0 : 1),
    0,
  );
}

export function totalPoints(questions: SolveQuestion[]): number {
  return questions.reduce((total, question) => total + (question.points ?? 0), 0);
}
