import { z } from "zod";
import { getRoleHomePath } from "@/app/guards/guard-utils";
import { supabase } from "@/shared/api/supabase";
import type { UserRole } from "@/shared/types/database.types";

/* ========================================
   Sign-in logic for LoginPage (PUB-04, SHARED-SPEC SH-02, backend/docs/04-AUTH-AND-ACCESS)

   No React in this file, so the rules can be tested alone.

   Validation (Zod): the username is trimmed and lowercased, then must match the school rule
   `a-z 0-9 . _ -`, 3 to 32 characters (04-AUTH-AND-ACCESS section 1). The password needs at
   least 6 characters (PUB-04). Messages follow SH-02: "Enter your username." and
   "Enter your password."

   Sign-in: Supabase Auth stores every account under the internal address
   `{username}@accounts.invalid` (04-AUTH-AND-ACCESS section 1), so the username is turned into
   that address and passed to `signInWithPassword`. The address is never shown. The backend plan
   routes sign-in through an `auth-login` Edge Function for lockout counting; that function does
   not exist in the repo yet, so this page calls Auth directly, as PUB-04 asks. Replace
   `signInWithUsername` when the function ships, and the page needs no change.

   After a successful sign-in the page reads the profile and decides where the person goes:
     status locked, archived or disabled   sign out, then /account-not-active
     must change password                  /set-new-password (the session is kept)
     otherwise                             the "redirect" or "next" path when it belongs to the
                                           role area, else /student, /teacher or /admin
   Failures are classified, never described in detail: an unknown username and a wrong password
   give the same outcome (SH-02 and 10-SECURITY-PRIVACY, "No sign-in message ever reveals
   whether a username exists").
   ======================================== */

export const LOGIN_MESSAGES = {
  usernameRequired: "Enter your username.",
  usernameInvalid: "Enter a valid username. Use letters, numbers, dots, dashes or underscores.",
  passwordRequired: "Enter your password.",
  passwordShort: "Your password has at least 6 characters.",
  invalidCredentials: "Username or password is incorrect.",
  rateLimited:
    "Too many attempts. Wait a few minutes and try again, or ask your school to unlock your account.",
  network: "We could not reach the server. Check your connection and try again.",
  profile: "We could not load your account. Try again, or ask your school for help.",
  unexpected: "Something went wrong. Try again.",
} as const;

export const ACCOUNT_NOT_ACTIVE_PATH = "/account-not-active";
export const SET_NEW_PASSWORD_PATH = "/set-new-password";
export const REMEMBER_STORAGE_KEY = "alhikmah.auth.remember";

const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;
const INTERNAL_EMAIL_DOMAIN = "accounts.invalid";
const PASSWORD_MIN_LENGTH = 6;
const ROLES: readonly UserRole[] = ["student", "teacher", "admin"];
const BLOCKED_STATUSES: readonly string[] = ["locked", "archived", "disabled"];

/* ---------- Validation ---------- */

export interface LoginValues {
  username: string;
  password: string;
  remember: boolean;
}

export type LoginField = "username" | "password";
export type LoginErrors = Partial<Record<LoginField, string>>;

const loginSchema = z.object({
  username: z
    .string()
    .min(1, LOGIN_MESSAGES.usernameRequired)
    .regex(USERNAME_PATTERN, LOGIN_MESSAGES.usernameInvalid),
  password: z
    .string()
    .min(1, LOGIN_MESSAGES.passwordRequired)
    .min(PASSWORD_MIN_LENGTH, LOGIN_MESSAGES.passwordShort),
  remember: z.boolean(),
});

/** The username as the school stores it: trimmed and lowercase. */
export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export type LoginValidation =
  | { success: true; data: LoginValues }
  | { success: false; errors: LoginErrors };

/** Validates the whole form. The password is never trimmed, since spaces may be part of it. */
export function validateLogin(values: LoginValues): LoginValidation {
  const result = loginSchema.safeParse({
    username: normalizeUsername(values.username),
    password: values.password,
    remember: values.remember,
  });
  if (result.success) return { success: true, data: result.data };

  const errors: LoginErrors = {};
  for (const issue of result.error.issues) {
    const field: unknown = issue.path[0];
    if ((field === "username" || field === "password") && errors[field] === undefined) {
      errors[field] = issue.message;
    }
  }
  return { success: false, errors };
}

/* ---------- Redirect target ---------- */

/**
 * Accepts the "come back here" path only when it stays inside the signed-in role's area
 * (SHARED-SPEC section 6). Anything else, including other sites, returns null.
 */
export function resolveRedirect(raw: string | null, role: UserRole): string | null {
  if (raw === null) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  const area = `/${role}`;
  const inside =
    raw === area ||
    raw.startsWith(`${area}/`) ||
    raw.startsWith(`${area}?`) ||
    raw.startsWith(`${area}#`);
  return inside ? raw : null;
}

/* ---------- Remember me ---------- */

/**
 * Stores the "Keep me signed in" choice. The Supabase client (shared/api/supabase.ts) owns the
 * session storage; it can read this key to keep the session on this device only when the
 * person asked for it (04-AUTH-AND-ACCESS section 2, "Remember me").
 */
export function writeRememberPreference(remember: boolean): void {
  try {
    window.localStorage.setItem(REMEMBER_STORAGE_KEY, remember ? "1" : "0");
  } catch {
    // Storage can be blocked (private mode, policy). The sign-in itself is not affected.
  }
}

/* ---------- Sign-in ---------- */

export type SignInOutcome =
  | { kind: "success"; destination: string }
  | { kind: "must-change-password" }
  | { kind: "not-active" }
  | { kind: "invalid-credentials" }
  | { kind: "rate-limited" }
  | { kind: "network" }
  | { kind: "profile-error" };

interface AuthErrorLike {
  name?: string | undefined;
  status?: number | undefined;
  code?: string | undefined;
  message?: string | undefined;
}

type FailureKind = "invalid-credentials" | "rate-limited" | "network";

/** Maps a Supabase Auth error to a failure the person can act on, and nothing more. */
export function classifyAuthError(error: AuthErrorLike): FailureKind {
  const status = error.status;
  if (
    error.name === "AuthRetryableFetchError" ||
    status === 0 ||
    (status === undefined && /fetch|network/i.test(error.message ?? ""))
  ) {
    return "network";
  }
  if (status === 429 || error.code === "over_request_rate_limit") return "rate-limited";
  if (status !== undefined && status >= 500) return "network";
  // invalid_credentials, an unknown user and every other rejection look the same on purpose.
  return "invalid-credentials";
}

export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${INTERNAL_EMAIL_DOMAIN}`;
}

function isRole(value: unknown): value is UserRole {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Ends a session that must not be used. Local scope removes it even when offline. */
async function dropSession(): Promise<void> {
  await supabase.auth.signOut({ scope: "local" });
}

function requestSignIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

function requestProfile(userId: string) {
  return supabase
    .from("profiles")
    .select("role, status, must_change_password")
    .eq("id", userId)
    .maybeSingle();
}

/**
 * Signs in with a username and password, then reads the profile to pick the destination.
 * `redirectTo` is the raw "redirect" or "next" value from the address; it is checked here.
 */
export async function signInWithUsername(
  values: LoginValues,
  redirectTo: string | null,
): Promise<SignInOutcome> {
  let signIn: Awaited<ReturnType<typeof requestSignIn>>;
  try {
    signIn = await requestSignIn(usernameToEmail(values.username), values.password);
  } catch {
    return { kind: "network" };
  }

  if (signIn.error) return { kind: classifyAuthError(signIn.error) };

  let profile: Awaited<ReturnType<typeof requestProfile>>;
  try {
    profile = await requestProfile(signIn.data.user.id);
  } catch {
    await dropSession();
    return { kind: "network" };
  }

  if (profile.error || profile.data === null || !isRole(profile.data.role)) {
    await dropSession();
    return { kind: "profile-error" };
  }

  const { role, status, must_change_password: mustChangePassword } = profile.data;
  const accountStatus: string = status;

  if (BLOCKED_STATUSES.includes(accountStatus)) {
    await dropSession();
    return { kind: "not-active" };
  }

  writeRememberPreference(values.remember);

  if (mustChangePassword) return { kind: "must-change-password" };

  return {
    kind: "success",
    destination: resolveRedirect(redirectTo, role) ?? getRoleHomePath(role),
  };
}
