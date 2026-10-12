/**
 * Shared Error utilities for Edge Functions.
 *
 * - Serializes exceptions into a consistent API error JSON envelope:
 *   { error: { code, message, details, requestId } }
 * - Provides `toResponse()` returning [status, body] tuple for Oak/Hono/connect.
 * - Error codes are stable and additive (see backend/docs/01-ARCHITECTURE.md:85-86).
 */

export type ErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "validation_failed"
  | "conflict"
  | "rate_limited"
  | "account_locked"
  | "account_inactive"
  | "must_change_password"
  | "maintenance"
  | "feature_disabled"
  | "limit_reached"
  | "safety_blocked"
  | "provider_error"
  | "timeout"
  | "read_only_session"
  | "assessment_locked"
  | "attempts_exhausted"
  | "window_closed"
  | "already_submitted"
  | "insufficient_coins"
  | "level_required"
  | "item_unavailable"
  | "cap_reached"
  | "stale_card"
  | "invalid_state"
  | "quota_exceeded"
  | "upload_rejected"

export interface AppErrorOptions {
  code: ErrorCode
  message: string
  /** Optional extra details (object serialized to JSON in the response). */
  details?: Record<string, unknown>
  /** Optional request ID – if not provided, one will be generated. */
  requestId?: string
  /** HTTP status code (default 400 for client errors, 401/403 for auth, 429 for rate limit). */
  status?: number
}

/**
 * AppError – base class for all Edge Function errors.
 * Maps to the standard envelope: { error: { code, message, details, requestId } }
 */
export class AppError extends Error {
  readonly code: ErrorCode
  readonly details: Record<string, unknown>
  readonly requestId: string
  readonly status: number

  constructor(opts: AppErrorOptions) {
    super(opts.message)
    this.code = opts.code
    this.details = opts.details || {}
    this.requestId = opts.requestId || cryptoRandomId()
    this.status = opts.status ?? 400

    // Maintain proper stack trace for Error instanceof checks
    this.name = "AppError"
  }

  /** Convert to the standard API error envelope [status, { error }]. */
  toResponse(): [number, Record<string, unknown>] {
    const body: Record<string, unknown> = {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        requestId: this.requestId,
      },
    }
    return [this.status, body]
  }
}

/** Generate a short alphanumeric request ID (8 chars). */
function cryptoRandomId(): string {
  const arr = new Uint32Array(2)
  crypto.getRandomValues(arr)
  return Array.from(arr, (v) => v.toString(36).padStart(2, "0")).join("").substring(0, 8)
}

/** Convenience constructors for common error scenarios. */

export function unauthenticated(message: string = "unauthenticated", overrides?: Partial<AppErrorOptions>): AppError {
  return new AppError({ code: "unauthenticated", message, status: 401, ...overrides })
}

export function forbidden(message: string = "forbidden", overrides?: Partial<AppErrorOptions>): AppError {
  return new AppError({ code: "forbidden", message, status: 403, ...overrides })
}

export function notFound(message: string = "not found", overrides?: Partial<AppErrorOptions>): AppError {
  return new AppError({ code: "not_found", message, status: 404, ...overrides })
}

export function rateLimited(message: string = "rate limited", overrides?: Partial<AppErrorOptions>): AppError {
  return new AppError({ code: "rate_limited", message, status: 429, ...overrides })
}

export function validationFailed(message: string = "validation failed", overrides?: Partial<AppErrorOptions>): AppError {
  return new AppError({ code: "validation_failed", message, status: 400, ...overrides })
}

export function conflict(message: string = "conflict", overrides?: Partial<AppErrorOptions>): AppError {
  return new AppError({ code: "conflict", message, status: 409, ...overrides })
}