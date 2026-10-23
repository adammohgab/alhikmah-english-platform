import { QueryClient } from "@tanstack/react-query";
import { normalizeApiError } from "@/shared/api/error-normalizer";

interface ExtractedErrorStatus {
  code?: string | undefined;
  status?: number | undefined;
}

function extractErrorCodeOrStatus(error: unknown): ExtractedErrorStatus {
  if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>;
    const rawCode = err.code;
    const code = typeof rawCode === "string" ? rawCode : undefined;

    const rawStatus = err.status;
    const rawStatusCode = err.statusCode;
    const status =
      typeof rawStatus === "number"
        ? rawStatus
        : typeof rawStatusCode === "number"
          ? rawStatusCode
          : undefined;

    return { code, status };
  }
  return { code: undefined, status: undefined };
}

/**
 * Determines whether a query/mutation should be retried.
 * Retries: 2 for network failures / server issues, 0 for 401/403/404 errors.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) {
    return false;
  }

  const { code, status } = extractErrorCodeOrStatus(error);

  if (
    status === 401 ||
    status === 403 ||
    status === 404 ||
    code === "401" ||
    code === "403" ||
    code === "404" ||
    code === "PGRST116" ||
    code === "PGRST301" ||
    code === "42501"
  ) {
    return false;
  }

  return true;
}

/**
 * Factory for creating a configured QueryClient with retry logic and error normalization.
 */
export function createQueryClient(options?: { onAuthError?: () => void }) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 2, // 2 minutes for standard data
        gcTime: 1000 * 60 * 10, // 10 minutes garbage collection
        retry: shouldRetryQuery,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
        onError: (error) => {
          const appError = normalizeApiError(error);
          if (
            appError.statusCode === 401 ||
            appError.code === "401" ||
            appError.code === "PGRST301"
          ) {
            options?.onAuthError?.();
          }
        },
      },
    },
  });
}
