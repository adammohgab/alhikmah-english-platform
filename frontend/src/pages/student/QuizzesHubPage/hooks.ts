import {
  useInfiniteQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
} from "@tanstack/react-query";
import { useAuth } from "@/app/providers/auth-context";
import { fetchAvailableQuizzes, fetchQuizHistory, type QuizPage } from "./api";
import type { AvailableQuiz, HistoryAttempt } from "./rules";

/* `my_quizzes` as two paged queries, one per contract tab. Both load when the hub opens so the
   tab labels can show counts. Refetching on window focus keeps attempts used and best scores
   current after the student comes back from a quiz. */

export const QUIZZES_KEY = "student-quizzes";

type PagedResult<T> = UseInfiniteQueryResult<InfiniteData<QuizPage<T>, string | null>>;

export function useAvailableQuizzes(): PagedResult<AvailableQuiz> {
  const userId = useAuth().user?.id ?? null;
  return useInfiniteQuery({
    queryKey: [QUIZZES_KEY, "available", userId],
    queryFn: ({ pageParam }) => fetchAvailableQuizzes(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: userId !== null,
    refetchOnWindowFocus: true,
  });
}

export function useQuizHistory(): PagedResult<HistoryAttempt> {
  const userId = useAuth().user?.id ?? null;
  return useInfiniteQuery({
    queryKey: [QUIZZES_KEY, "history", userId],
    queryFn: ({ pageParam }) => fetchQuizHistory(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: userId !== null,
    refetchOnWindowFocus: true,
  });
}
