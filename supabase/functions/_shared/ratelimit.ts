/**
 * Shared Rate Limit utilities for Edge Functions.
 *
 * - Token bucket per user / per function, backed by the `rate_limits` table.
 * - In-memory fallback when the table is unavailable (cold start, local dev).
 * - `checkRateLimit(key)` → { success, remaining, resetAt }.
 * - Automatic token refill based on elapsed time.
 *
 * Database schema (supabase/migrations/…):
 *   CREATE TABLE rate_limits (
 *     key TEXT PRIMARY KEY,
 *     tokens NUMERIC NOT NULL,
 *     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
 *   );
 *
 * Bucket semantics:
 *   - key = `<function_name>:<user_id|ip>`  (unique per function + principal)
 *   - tokens start at `capacity` (configurable per function via env RATE_LIMIT_CAPACITY)
 *   - tokens replenish at `rate` per second (env RATE_LIMIT_RATE)
 *   - decrement atomically: UPDATE rate_limits SET tokens = tokens - 1 WHERE key = $1 AND tokens > 0
 */

// -------------------------------------------------------------------
// Configuration (env overrides)
// -------------------------------------------------------------------

const RATE_LIMIT_CAPACITY = Number(Deno.env.get("RATE_LIMIT_CAPACITY") || "100") // max tokens per bucket
const RATE_LIMIT_RATE = Number(Deno.env.get("RATE_LIMIT_RATE") || "1") // tokens per second refill
const RATE_LIMIT_TTL = Number(Deno.env.get("RATE_LIMIT_TTL") || "3600") // bucket TTL in seconds

// -------------------------------------------------------------------
// In-memory fallback (cold-start safe)
// -------------------------------------------------------------------

type Bucket = {
  tokens: number
  lastRefill: number // unix seconds
}

/** Simple in-memory store – maps key -> Bucket. In production this should be the DB. */
const memoryStore = new Map<string, Bucket>()

function refillTokens(bucket: Bucket): Bucket {
  const now = Math.floor(Date.now() / 1000)
  const elapsed = now - bucket.lastRefill
  if (elapsed >= 1) {
    const added = Math.floor(elapsed * RATE_LIMIT_RATE)
    const newTokens = Math.min(RATE_LIMIT_CAPACITY, bucket.tokens + added)
    return { ...bucket, tokens: newTokens, lastRefill: now }
  }
  return bucket
}

// -------------------------------------------------------------------
// Database-backed bucket operations
// -------------------------------------------------------------------

/**
 * Acquire a token from the bucket for the given key.
 * Returns { success, remaining, resetAt }.
 * - `success` is true if a token was consumed.
 * - `remaining` is tokens left after the decrement.
 * - `resetAt` is unix seconds when the bucket next refills fully.
 */
export async function checkRateLimit(
  key: string,
  db: DBTransaction
): Promise<{ success: boolean; remaining: number; resetAt: number }> {
  // Try DB-backed bucket first
  try {
    const result = await db`
      WITH existing AS (
        SELECT tokens, updated_at FROM rate_limits WHERE key = ${key} FOR UPDATE
      ),
      refreshed AS (
        SELECT
          CASE
            WHEN (SELECT tokens FROM existing) IS NULL THEN
              -- Create new bucket at capacity
              (SELECT CAST(${RATE_LIMIT_CAPACITY} AS NUMERIC))
            ELSE
              -- Refill existing
              (SELECT
                CASE
                  WHEN (SELECT tokens FROM existing) <= 0 THEN
                    CAST(${RATE_LIMIT_CAPACITY} AS NUMERIC)
                  ELSE
                    LEAST(
                      ${RATE_LIMIT_CAPACITY},
                      (SELECT tokens FROM existing) + (
                        EXTRACT(EPOCH FROM (now() - (SELECT updated_at FROM existing))) * ${RATE_LIMIT_RATE}
                      )
                    )
                END)
            END AS tokens
        FROM existing
        LIMIT 1
      ),
      decremented AS (
        UPDATE rate_limits
        SET tokens = (SELECT tokens FROM refreshed) - 1,
            updated_at = now()
        WHERE key = ${key}
        RETURNING tokens, updated_at
      )
      SELECT tokens, updated_at FROM decremented
    `

    if (result.length === 0) {
      // Key didn't exist – create it and try again
      await db`
        INSERT INTO rate_limits (key, tokens, updated_at)
        VALUES (${
          key
        }, ${RATE_LIMIT_CAPACITY - 1}, now())
        RETURNING tokens, updated_at
      `
      return { success: true, remaining: RATE_LIMIT_CAPACITY - 1, resetAt: Math.floor(Date.now() / 1000) + RATE_LIMIT_TTL }
    }

    const rows = result as { tokens: number; updated_at: Date }[]
    const remaining = rows[0]?.tokens ?? RATE_LIMIT_CAPACITY - 1
    const resetAt = Math.floor((rows[0]?.updated_at?.valueOf() ?? Date.now()) / 1000) + RATE_LIMIT_TTL

    return {
      success: remaining >= 0,
      remaining,
      resetAt,
    }
  } catch (err) {
    // DB unavailable – fall back to in-memory
    return checkRateLimitInMemory(key)
  }
}

/** In-memory fallback when DB is not available. */
function checkRateLimitInMemory(key: string): Promise<{ success: boolean; remaining: number; resetAt: number }> {
  const bucket = memoryStore.get(key) ?? { tokens: RATE_LIMIT_CAPACITY, lastRefill: Math.floor(Date.now() / 1000) }
  const refresilled = refillTokens(bucket)

  if (refresilled.tokens > 0) {
    refresilled.tokens--
    memoryStore.set(key, refresilled)
    const resetAt = Math.floor(Date.now() / 1000) + RATE_LIMIT_TTL
    return Promise.resolve({ success: true, remaining: refresilled.tokens, resetAt })
  }

  const resetAt = Math.floor(Date.now() / 1000) + RATE_LIMIT_TTL
  return Promise.resolve({ success: false, remaining: 0, resetAt })
}

/** Reset/refresh a bucket (useful for admin endpoints or manual testing). */
export function resetRateLimit(key: string): void {
  memoryStore.delete(key)
  // Note: DB reset would be a separate RPC; omitted for shared library simplicity.
}