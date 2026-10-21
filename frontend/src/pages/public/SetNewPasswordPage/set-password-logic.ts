import { supabase } from "@/shared/api/supabase";

/* Set a new password (SHARED-SPEC SH-04, task PUB-06). No React in this file.

   Password policy (task text, which is stricter than the spec default on the symbol):
     - at least 8 characters
     - at least 1 number
     - at least 1 symbol
     - not equal to the username (SH-04 rules list)
   Strength meter: a password that breaks a rule is "Weak". A password that passes every rule is
   "Good", and "Strong" when it also has 12 or more characters and mixes upper and lower case.

   Saving: `supabase.auth.updateUser({ password })`, then the person's own profile row gets
   `must_change_password = false`. The backend plan routes this through an `auth-change-password`
   Edge Function (04-AUTH-AND-ACCESS section 3) that needs the temporary password; that function
   is not in the repo yet and this page does not hold the temporary password. Replace
   `saveNewPassword` when the function ships and the page needs no change.
   The profile update is read back (`select("id")`). A policy that blocks the write returns no
   rows and no error, and that must never look like success. */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

export const PASSWORD_MESSAGES = {
  newRequired: "Enter a new password.",
  confirmRequired: "Enter your new password again.",
  rulesNotMet: "Your password does not meet all the rules.",
  mismatch: "The two passwords do not match.",
  failed: "We could not save your password. Try again.",
  network: "We could not reach the server. Check your connection and try again.",
  expired: "Your session ended. Sign in again to set your password.",
} as const;

/* ---------- Rules ---------- */

export type PasswordRuleId = "length" | "number" | "symbol" | "username";

export interface PasswordRule {
  id: PasswordRuleId;
  label: string;
}

export const PASSWORD_RULES: readonly PasswordRule[] = [
  { id: "length", label: `At least ${PASSWORD_MIN_LENGTH} characters` },
  { id: "number", label: "At least 1 number" },
  { id: "symbol", label: "At least 1 symbol, like ! ? # or @" },
  { id: "username", label: "Not the same as your username" },
];

export type RuleResults = Record<PasswordRuleId, boolean>;

/** Anything that is not a letter, a number or a space counts as a symbol. */
const SYMBOL_PATTERN = /[^\p{L}\p{N}\s]/u;
const NUMBER_PATTERN = /\p{N}/u;

export function checkRules(password: string, username: string): RuleResults {
  const name = username.trim().toLowerCase();
  return {
    length: password.length >= PASSWORD_MIN_LENGTH,
    number: NUMBER_PATTERN.test(password),
    symbol: SYMBOL_PATTERN.test(password),
    // An empty password has not "passed" the username rule yet, so it stays unchecked.
    username: password.length > 0 && (name === "" || password.trim().toLowerCase() !== name),
  };
}

export function allRulesMet(results: RuleResults): boolean {
  return PASSWORD_RULES.every((rule) => results[rule.id]);
}

/* ---------- Strength ---------- */

export type StrengthLevel = "none" | "weak" | "good" | "strong";

export interface Strength {
  level: StrengthLevel;
  /** Share of the bar to fill, from 0 to 1. */
  fill: number;
  /** The word shown to the person. Empty when nothing is typed. */
  label: string;
}

const STRENGTH: Record<StrengthLevel, Strength> = {
  none: { level: "none", fill: 0, label: "" },
  weak: { level: "weak", fill: 1 / 3, label: "Weak" },
  good: { level: "good", fill: 2 / 3, label: "Good" },
  strong: { level: "strong", fill: 1, label: "Strong" },
};

export function measureStrength(password: string, username: string): Strength {
  if (password.length === 0) return STRENGTH.none;
  if (!allRulesMet(checkRules(password, username))) return STRENGTH.weak;
  const mixedCase = /\p{Ll}/u.test(password) && /\p{Lu}/u.test(password);
  return password.length >= 12 && mixedCase ? STRENGTH.strong : STRENGTH.good;
}

/* ---------- Validation ---------- */

export interface NewPasswordValues {
  password: string;
  confirm: string;
}

export type NewPasswordField = keyof NewPasswordValues;
export type NewPasswordErrors = Partial<Record<NewPasswordField, string>>;

export function validateField(
  field: NewPasswordField,
  values: NewPasswordValues,
  username: string,
): string | undefined {
  if (field === "password") {
    if (values.password === "") return PASSWORD_MESSAGES.newRequired;
    if (values.password.length > PASSWORD_MAX_LENGTH) {
      return `Use ${PASSWORD_MAX_LENGTH} characters or fewer.`;
    }
    return allRulesMet(checkRules(values.password, username))
      ? undefined
      : PASSWORD_MESSAGES.rulesNotMet;
  }
  if (values.confirm === "") return PASSWORD_MESSAGES.confirmRequired;
  return values.confirm === values.password ? undefined : PASSWORD_MESSAGES.mismatch;
}

export function validateAll(values: NewPasswordValues, username: string): NewPasswordErrors {
  const errors: NewPasswordErrors = {};
  const password = validateField("password", values, username);
  const confirm = validateField("confirm", values, username);
  if (password !== undefined) errors.password = password;
  if (confirm !== undefined) errors.confirm = confirm;
  return errors;
}

/* ---------- Save ---------- */

export type SaveOutcome =
  | { kind: "saved" }
  | { kind: "rejected"; message: string }
  | { kind: "session-expired" }
  | { kind: "network" }
  | { kind: "failed" };

interface AuthErrorLike {
  name?: string | undefined;
  status?: number | undefined;
  code?: string | undefined;
  message?: string | undefined;
}

function isNetworkError(error: AuthErrorLike): boolean {
  return (
    error.name === "AuthRetryableFetchError" ||
    error.status === 0 ||
    (error.status !== undefined && error.status >= 500) ||
    (error.status === undefined && /fetch|network/i.test(error.message ?? ""))
  );
}

/**
 * Changes the password of the signed-in account and clears its `must_change_password` flag.
 * The flag is cleared only after the password change worked. A retry after a failed flag update
 * sends the same password again, and Auth answers `same_password`, which counts as done.
 */
export async function saveNewPassword(userId: string, password: string): Promise<SaveOutcome> {
  try {
    const update = await supabase.auth.updateUser({ password });
    if (update.error) {
      const error: AuthErrorLike = update.error;
      if (error.code === "same_password") {
        // The password was already saved by an earlier try. Only the flag is left.
      } else if (error.status === 401 || error.code === "session_not_found") {
        return { kind: "session-expired" };
      } else if (error.code === "weak_password") {
        return { kind: "rejected", message: PASSWORD_MESSAGES.rulesNotMet };
      } else if (isNetworkError(error)) {
        return { kind: "network" };
      } else {
        return { kind: "failed" };
      }
    }

    const cleared = await supabase
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", userId)
      .select("id");
    if (cleared.error) {
      return isNetworkError(cleared.error as AuthErrorLike)
        ? { kind: "network" }
        : { kind: "failed" };
    }
    // No row back means a policy blocked the write: the flag is still set.
    if (cleared.data.length === 0) return { kind: "failed" };
    return { kind: "saved" };
  } catch {
    return { kind: "network" };
  }
}
