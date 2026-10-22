/* ========================================
   Vocabulary rules (STUDENT-SPEC ST-15; backend 06-BUSINESS-LOGIC "Mastery (review_word)")

   Pure helpers for the page: filtering, session building and the three rating buttons.
   The server owns mastery. A review only reports right or wrong (`review_word {word_id,
   correct}`); the server then moves new to learning to mastered and sets `next_review_at`.
   Nothing here computes mastery or intervals.
   ======================================== */

export type Mastery = "new" | "learning" | "mastered";

export interface LibraryWord {
  id: string;
  word: string;
  partOfSpeech: string | null;
  /** Pronunciation text, for example "/ˈlɜːnɪŋ/". */
  pronunciation: string | null;
  meaning: string;
  arabicMeaning: string | null;
  example: string | null;
  /** CEFR level of the source vocabulary item (A1 to C2); null for a word the student typed in. */
  level: string | null;
  /** Topic tags of the vocabulary list the word came from. */
  tags: string[];
  vocabItemId: string | null;
  mastery: Mastery;
  starred: boolean;
  nextReviewAt: string | null;
}

export type Rating = "need_practice" | "almost" | "mastered";

export interface RatingOption {
  id: Rating;
  label: string;
  /** Keyboard shortcut shown on the button. */
  key: "1" | "2" | "3";
  /** What is sent to `review_word`. */
  correct: boolean;
}

/* `review_word` accepts one boolean, so "Almost Got It" and "Mastered" both count as a correct
   review. Only the server decides when a word becomes mastered (3 correct reviews on at least
   2 different days). */
export const RATINGS: readonly RatingOption[] = [
  { id: "need_practice", label: "Need Practice", key: "1", correct: false },
  { id: "almost", label: "Almost Got It", key: "2", correct: true },
  { id: "mastered", label: "Mastered", key: "3", correct: true },
];

export const MASTERY_FILTERS = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "learning", label: "Learning" },
  { value: "mastered", label: "Mastered" },
  { value: "starred", label: "Starred" },
] as const;

export type MasteryFilter = (typeof MASTERY_FILTERS)[number]["value"];

export const MASTERY_LABEL: Record<Mastery, string> = {
  new: "New",
  learning: "Learning",
  mastered: "Mastered",
};

/** Largest practice set in one go. */
export const SESSION_SIZE = 20;

export interface WordFilters {
  search: string;
  mastery: MasteryFilter;
  /** Topic tag, or null for every topic. */
  topic: string | null;
}

export function isDue(word: LibraryWord, now: number): boolean {
  if (word.mastery === "new" || word.nextReviewAt === null) return true;
  return Date.parse(word.nextReviewAt) <= now;
}

export function filterWords(words: readonly LibraryWord[], filters: WordFilters): LibraryWord[] {
  const query = filters.search.trim().toLowerCase();
  return words.filter((word) => {
    if (
      filters.mastery === "starred"
        ? !word.starred
        : filters.mastery !== "all" && word.mastery !== filters.mastery
    ) {
      return false;
    }
    if (filters.topic !== null && !word.tags.includes(filters.topic)) return false;
    if (query === "") return true;
    return (
      word.word.toLowerCase().includes(query) ||
      word.meaning.toLowerCase().includes(query) ||
      (word.arabicMeaning ?? "").includes(query)
    );
  });
}

/** Distinct topic tags, sorted, for the topic filter. */
export function topicsOf(words: readonly LibraryWord[]): string[] {
  return [...new Set(words.flatMap((word) => word.tags))].sort((a, b) => a.localeCompare(b));
}

export function countByMastery(words: readonly LibraryWord[]): Record<Mastery, number> {
  const counts: Record<Mastery, number> = { new: 0, learning: 0, mastered: 0 };
  for (const word of words) counts[word.mastery] += 1;
  return counts;
}

/** Words to practice: the ones due for review first (oldest due first, new words after them),
    then the rest, at most `limit`. */
export function buildSession(
  words: readonly LibraryWord[],
  now: number,
  limit: number = SESSION_SIZE,
): LibraryWord[] {
  const due = words.filter((word) => isDue(word, now)).sort((a, b) => dueTime(a) - dueTime(b));
  const rest = words.filter((word) => !isDue(word, now));
  return [...due, ...rest].slice(0, limit);
}

function dueTime(word: LibraryWord): number {
  return word.nextReviewAt === null ? Number.NEGATIVE_INFINITY : Date.parse(word.nextReviewAt);
}

/* ---- Session state ---- */

export interface SessionState {
  queue: LibraryWord[];
  index: number;
  /** Words already repeated once after "Need Practice". */
  repeated: string[];
  tally: Record<Rating, number>;
}

export function startSession(words: readonly LibraryWord[]): SessionState {
  return {
    queue: [...words],
    index: 0,
    repeated: [],
    tally: { need_practice: 0, almost: 0, mastered: 0 },
  };
}

export function isFinished(state: SessionState): boolean {
  return state.index >= state.queue.length;
}

/** Moves to the next card. A "Need Practice" card comes back once at the end of the set. */
export function rate(state: SessionState, rating: Rating): SessionState {
  const current = state.queue[state.index];
  if (current === undefined) return state;
  const again = rating === "need_practice" && !state.repeated.includes(current.id);
  return {
    queue: again ? [...state.queue, current] : state.queue,
    index: state.index + 1,
    repeated: again ? [...state.repeated, current.id] : state.repeated,
    tally: { ...state.tally, [rating]: state.tally[rating] + 1 },
  };
}
