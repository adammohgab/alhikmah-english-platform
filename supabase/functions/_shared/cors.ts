/**
 * Shared CORS utilities for Edge Functions.
 *
 * - Allows configured origins (dev + production).
 * - Handles OPTIONS preflight requests.
 * - Provides a `setCorsHeaders(init)` helper for fetch responses.
 */

// Allowed origins per environment. Add/override via env: CORS_ALLOWED_ORIGINS="https://example.com,http://localhost:5173"
const envOrigins = Deno.env.get("CORS_ALLOWED_ORIGINS")
const defaultOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"]

const allowedOrigins: ReadonlyArray<string> = envOrigins
  ? envOrigins.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
  : defaultOrigins

export function originAllowed(origin: string | null): boolean {
  if (!origin) return true // allow when no origin (e.g., server-to-server)
  return allowedOrigins.some((allowed) => origin === allowed || origin.startsWith(allowed + "/"))
}

export function getCorsHeaders(origin: string | RequestInfo | null): HeadersInit {
  const allowedOrigin = originAllowed(typeof origin === "string" ? origin : null) ? (origin || "*") : ""
  return {
    "access-control-allow-origin": allowedOrigin,
    "access-control-allow-credentials": "true",
    "access-control-expose-headers": "x-request-id",
  }
}

export function corsMiddleware(req: Request, _allowed: ReadonlyArray<string> = allowedOrigins): Response | null {
  // Handle preflight OPTIONS
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("origin")
    if (!originAllowed(origin)) {
      return new Response("Forbidden", { status: 403 })
    }
    return new Response(null, {
      status: 204,
      headers: {
        ...getCorsHeaders(origin),
        "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "access-control-allow-headers": "authorization,content-type,x-api-key,x-request-id",
        "access-max-age": "86400",
      },
    })
  }

  // For non-preflight requests, return null (handler decides whether to add headers)
  return null
}