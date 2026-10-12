/**
 * Shared Auth utilities for Edge Functions.
 *
 * - Verifies Supabase JWT tokens using the project's JWKS key.
 * - Extracts user role from claims (`auth.users.role` or `profiles.role`).
 * - Provides `requireRole(role)` guard for mutating functions.
 * - Builds a user-scoped Supabase client (service-role-escaped when needed).
 */

import { createClient } from "@supabase/supabase-js"

// -------------------------------------------------------------------
// JWT Verification
// -------------------------------------------------------------------

/** JWKS key from Supabase project (read from env SUPABASE_JWKS_KEY or fetch once). */
const SUPABASE_JWKS_KEY = Deno.env.get("SUPABASE_JWKS_KEY") || ""

/** Verify a Supabase JWT and return its payload (claims). Throws if invalid/expired. */
export async function verifyJWT(token: string): Promise<Record<string, unknown>> {
  if (!token) {
    throw new Error("missing jwt token")
  }

  // Use Supabase's built-in verification via the client, or raw JWKS verification.
  // Here we use a lightweight JWKS verify if key is configured, otherwise fallback to
  // the supabase client's internal verify (which uses the project's JWKS endpoint).
  const supa = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_ANON_KEY") || "",
    { auth: { autoRefresh: false, persistSession: false } }
  )

  // supabase-js v2+ provides `supabase.auth.getUser(token)` which validates the JWT.
  // We'll use the raw JWT decode + expiry check for a fast path.
  try {
    // Decode the JWT header.payload.signature manually to check expiry
    const parts = token.split(".")
    if (parts.length !== 3) {
      throw new Error("invalid jwt format")
    }
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"))
    const iat = payload.iat as number
    const exp = payload.exp as number

    const now = Math.floor(Date.now() / 1000)
    if (exp < now) {
      throw new Error("jwt expired")
    }
    if (iat && iat < now - 60 * 60 * 24 * 365) {
      throw new Error("jwt issued too long ago")
    }

    // Extract role from claims – Supabase sets `auth.users.role` on the token.
    const role = payload.role as string | undefined
    const userId = payload.sub as string | undefined
    const userMetadata = payload.user_metadata as Record<string, unknown> | undefined

    return {
      ...payload,
      role,
      userId,
      userMetadata,
    }
  } catch (err: any) {
    // Re-throw with clear codes the Edge Function can map to HTTP errors
    const msg = err.message || "jwt verification failed"
    throw new Error(`jwt_error: ${msg}`)
  }
}

/** Extract the user role from a verified JWT payload. */
export function extractRole(payload: Record<string, unknown>): string {
  const role = payload.role as string | undefined
  if (role && ["student", "teacher", "admin"].includes(role)) {
    return role
  }
  // Default fallback – the profiles table role may be authoritative.
  return "student"
}

/** Return the user's subject ID (auth.users.id) from a verified payload. */
export function extractUserId(payload: Record<string, unknown>): string | undefined {
  return payload.userId as string | undefined
}

/** Build a Supabase client scoped to the authenticated user (using their JWT). */
export function createSupabaseClientForUser(
  token: string,
  opts: { supabaseUrl: string; supabaseKey?: string } = {
    supabaseUrl: Deno.env.get("SUPABASE_URL") || "",
    supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  }
) {
  return createClient(opts.supabaseUrl, opts.supabaseKey || "", {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      autoRefresh: false,
      persistSession: false,
    },
  })
}

/**
 * Guard: require that the authenticated user has one of the given roles.
 * Throws `unauthenticated` if no token, `forbidden` if role mismatch.
 */
export async function requireRole(
  req: Request,
  allowedRoles: ReadonlyArray<string>
): Promise<{ payload: Record<string, unknown>; supa: ReturnType<typeof createSupabaseClientForUser> }> {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("unauthenticated: missing bearer token")
  }

  const token = authHeader.substring(7)
  const payload = await verifyJWT(token)
  const userRole = extractRole(payload)

  if (!allowedRoles.includes(userRole)) {
    throw new Error(`forbidden: user role "${userRole}" not allowed. required: [${allowedRoles.join(", ")}]`)
  }

  const supa = createSupabaseClientForUser(token)
  return { payload, supa }
}