import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";
import type { LibraryWord, Mastery } from "./rules";

/* ========================================
   Vocabulary data layer (STUDENT-SPEC ST-15; backend 05-API-CONTRACT section 3.5)

   My library    `library_words` table (own rows), with the source vocabulary item and its list
                 embedded for the CEFR level, the pronunciation text and the topic tags.
   From lessons  `practice_groups {tool:'vocabulary'}` for the units, `list_vocab_items {unit_id}`
                 for the words of one unit, `add_words_to_library` to copy them to the library.
   Reviews       `review_word {word_id, correct}` returns the new mastery and `next_review_at`.
   The generated `Database` type does not describe these yet, so calls use a narrow signature and
   zod, as the other student pages do.
   ======================================== */

const masterySchema = z.enum(["new", "learning", "mastered"]);

const libraryRow = z.object({
  id: z.string(),
  word: z.string(),
  part_of_speech: z.string().nullable(),
  meaning: z.string().nullable(),
  arabic_meaning: z.string().nullable(),
  example: z.string().nullable(),
  vocab_item_id: z.string().nullable(),
  mastery: masterySchema,
  starred: z.boolean(),
  next_review_at: z.string().nullable(),
  vocabulary_items: z
    .object({
      level: z.string().nullable(),
      pronunciation: z.string().nullable(),
      vocabulary_lists: z.object({ tags: z.array(z.string()).nullable() }).nullable(),
    })
    .nullable(),
});

const groupRow = z.object({
  unit_id: z.string(),
  title: z.string(),
  count: z.number().int().nonnegative(),
});

const vocabItemRow = z.object({
  id: z.string(),
  word: z.string(),
  part_of_speech: z.string().nullable(),
  pronunciation: z.string().nullable(),
  meaning: z.string().nullable(),
  arabic_meaning: z.string().nullable(),
  example: z.string().nullable(),
  level: z.string().nullable(),
});

const vocabPage = z.object({ items: z.array(vocabItemRow) });

const reviewResult = z.object({
  mastery: masterySchema,
  next_review_at: z.string().nullable(),
});

const addResult = z.object({
  added: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
});

export interface VocabGroup {
  unitId: string;
  title: string;
  count: number;
}

export interface LessonWord {
  id: string;
  word: string;
  partOfSpeech: string | null;
  pronunciation: string | null;
  meaning: string;
  arabicMeaning: string | null;
  example: string | null;
  level: string | null;
}

export interface ReviewOutcome {
  mastery: Mastery;
  nextReviewAt: string | null;
}

interface LooseResult {
  data: unknown;
  error: { message: string; code?: string } | null;
}

interface LooseQuery extends PromiseLike<LooseResult> {
  order: (column: string, options: { ascending: boolean }) => LooseQuery;
  eq: (column: string, value: unknown) => LooseQuery;
}

interface LooseClient {
  from: (table: string) => {
    select: (columns: string) => LooseQuery;
    update: (values: Record<string, unknown>) => LooseQuery;
  };
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<LooseResult>;
}

const client = (): LooseClient => supabase as unknown as LooseClient;

function fail(error: { message: string; code?: string }): never {
  throw new Error(normalizeApiError(error).message);
}

const LIBRARY_COLUMNS =
  "id, word, part_of_speech, meaning, arabic_meaning, example, vocab_item_id, mastery, starred, next_review_at, vocabulary_items(level, pronunciation, vocabulary_lists(tags))";

export async function fetchLibrary(): Promise<LibraryWord[]> {
  const result = await client()
    .from("library_words")
    .select(LIBRARY_COLUMNS)
    .order("word", { ascending: true });
  if (result.error) fail(result.error);
  return z
    .array(libraryRow)
    .parse(result.data)
    .map((row) => ({
      id: row.id,
      word: row.word,
      partOfSpeech: row.part_of_speech,
      pronunciation: row.vocabulary_items?.pronunciation ?? null,
      meaning: row.meaning ?? "",
      arabicMeaning: row.arabic_meaning,
      example: row.example,
      level: row.vocabulary_items?.level ?? null,
      tags: row.vocabulary_items?.vocabulary_lists?.tags ?? [],
      vocabItemId: row.vocab_item_id,
      mastery: row.mastery,
      starred: row.starred,
      nextReviewAt: row.next_review_at,
    }));
}

export async function fetchVocabGroups(): Promise<VocabGroup[]> {
  const result = await client().rpc("practice_groups", { tool: "vocabulary" });
  if (result.error) fail(result.error);
  return z
    .array(groupRow)
    .parse(result.data)
    .map((row) => ({ unitId: row.unit_id, title: row.title, count: row.count }));
}

export async function fetchGroupWords(unitId: string): Promise<LessonWord[]> {
  const result = await client().rpc("list_vocab_items", { unit_id: unitId, limit: 100 });
  if (result.error) fail(result.error);
  return vocabPage.parse(result.data).items.map((row) => ({
    id: row.id,
    word: row.word,
    partOfSpeech: row.part_of_speech,
    pronunciation: row.pronunciation,
    meaning: row.meaning ?? "",
    arabicMeaning: row.arabic_meaning,
    example: row.example,
    level: row.level,
  }));
}

/** Copies lesson words to the student's library. Words already there are skipped by the server. */
export async function addWordsToLibrary(
  words: readonly LessonWord[],
): Promise<{ added: number; skipped: number }> {
  const result = await client().rpc("add_words_to_library", {
    items: words.map((item) => ({
      word: item.word,
      part_of_speech: item.partOfSpeech,
      meaning: item.meaning,
      arabic_meaning: item.arabicMeaning,
      example: item.example,
      vocab_item_id: item.id,
    })),
    from: "lesson",
  });
  if (result.error) fail(result.error);
  return addResult.parse(result.data);
}

/** Saves one review. The server decides the new mastery and the next review date. */
export async function reviewWord(wordId: string, correct: boolean): Promise<ReviewOutcome> {
  const result = await client().rpc("review_word", { word_id: wordId, correct });
  if (result.error) fail(result.error);
  const parsed = reviewResult.safeParse(result.data);
  if (!parsed.success) throw new Error("Your answer was saved but the reply was unexpected.");
  return { mastery: parsed.data.mastery, nextReviewAt: parsed.data.next_review_at };
}

export async function setStarred(wordId: string, starred: boolean): Promise<void> {
  const result = await client().from("library_words").update({ starred }).eq("id", wordId);
  if (result.error) fail(result.error);
}
