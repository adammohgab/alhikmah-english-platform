export interface PostgrestLikeError {
  message: string;
  details?: string | null | undefined;
  hint?: string | null | undefined;
  code?: string | null | undefined;
  status?: number | null | undefined;
}

export interface AppError {
  code: string;
  message: string;
  details?: string | null | undefined;
  statusCode?: number | undefined;
}

const FRIENDLY_ERROR_MESSAGES: Record<string, string> = {
  PGRST116: "Requested record not found.",
  "42501": "You do not have permission to perform this action.",
  "23505": "A conflicting duplicate entry already exists.",
  "23503": "Referenced resource does not exist.",
  "401": "Session expired or unauthenticated. Please sign in again.",
  PGRST301: "Session expired or unauthenticated. Please sign in again.",
  invalid_jwt: "Session expired or unauthenticated. Please sign in again.",
  "403": "Access denied.",
  "404": "The requested resource could not be found.",
};

/**
 * Normalizes Supabase PostgREST errors, HTTP errors, and general unknown errors into a typed AppError.
 */
export function normalizeApiError(error: unknown): AppError {
  if (!error) {
    return {
      code: "UNKNOWN_ERROR",
      message: "An unexpected error occurred. Please try again.",
    };
  }

  // Supabase PostgREST or object error
  if (typeof error === "object" && error !== null) {
    const errObj = error as Record<string, unknown>;
    const rawCode = errObj["code"];
    const code = typeof rawCode === "string" ? rawCode : "POSTGREST_ERROR";

    const rawStatus = errObj["status"];
    const rawStatusCode = errObj["statusCode"];
    const statusCode =
      typeof rawStatus === "number"
        ? rawStatus
        : typeof rawStatusCode === "number"
          ? rawStatusCode
          : undefined;

    // Use mapped user-friendly message if available, otherwise raw message
    const rawMessage = errObj["message"];
    const message =
      FRIENDLY_ERROR_MESSAGES[code] ??
      (typeof rawMessage === "string" && rawMessage ? rawMessage : "A database error occurred.");

    const rawDetails = errObj["details"];
    const rawHint = errObj["hint"];
    const details =
      typeof rawDetails === "string"
        ? rawDetails
        : typeof rawHint === "string"
          ? rawHint
          : undefined;

    return {
      code,
      message,
      details,
      statusCode,
    };
  }

  // Standard JavaScript Error instance
  if (error instanceof Error) {
    return {
      code: error.name || "ERROR",
      message: error.message || "An unexpected error occurred.",
    };
  }

  if (typeof error === "string") {
    return {
      code: "UNKNOWN_ERROR",
      message: error,
    };
  }

  return {
    code: "UNKNOWN_ERROR",
    message: "An unexpected error occurred.",
  };
}

/**
 * Helper to determine if an error is an authentication error (401 or PGRST301 or invalid_jwt)
 */
export function isAuthError(error: unknown): boolean {
  if (!error) return false;
  if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>;
    const code = err["code"];
    const statusCode = err["statusCode"];
    const status = err["status"];
    return (
      code === "401" ||
      code === "PGRST301" ||
      code === "invalid_jwt" ||
      statusCode === 401 ||
      status === 401
    );
  }
  return false;
}
