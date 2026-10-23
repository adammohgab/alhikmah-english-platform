import {
  useInfiniteQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
} from "@tanstack/react-query";
import { useAuth } from "@/app/providers/auth-context";
import { fetchQuizzes, type QuizPage } from "./api";

/* `my_quizzes` as two paged queries, one per contract tab. Both load when the hub opens so the
   tab labels can show counts. Refetching on window focus keeps attempts used and best scores
   current after the student comes back from a quiz. */

export const QUIZZES_KEY = "student-quizzes";

type PagedResult = UseInfiniteQueryResult<InfiniteData<QuizPage, string | undefined>>;

export function useAvailableQuizzes(): PagedResult {
  const userId = useAuth().user?.id ?? null;
  return useInfiniteQuery({
    queryKey: [QUIZZES_KEY, "available", userId],
    queryFn: ({ pageParam }) => fetchQuizzes("available", pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: userId !== null,
    refetchOnWindowFocus: true,
  });
}

export function useQuizHistory(): PagedResult {
  const userId = useAuth().user?.id ?? null;
  return useInfiniteQuery({
    queryKey: [QUIZZES_KEY, "history", userId],
    queryFn: ({ pageParam }) => fetchQuizzes("history", pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: userId !== null,
    refetchOnWindowFocus: true,
  });
}
