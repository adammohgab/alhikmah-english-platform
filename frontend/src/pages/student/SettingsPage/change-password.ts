import { supabase } from "@/shared/api/supabase";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MESSAGES,
  allRulesMet,
  checkRules,
  saveNewPassword,
} from "@/pages/public/SetNewPasswordPage/set-password-logic";

/* Change password from Settings (ST-31, "Account"). No React in this file.

   Same policy as the set-new-password page (8+ characters, a number, a symbol, not the
   username), plus two rules that only make sense here: the current password must be right, and
   the new one must differ from it. The current password is checked by signing in again with the
   internal address `{username}@accounts.invalid` (04-AUTH-AND-ACCESS section 1), then the save
   itself is `saveNewPassword`, shared with the set-new-password page. */

export const CHANGE_MESSAGES = {
  currentRequired: "Enter your current password.",
  currentWrong: "That is not your current password.",
  sameAsCurrent: "Choose a password that is different from your current one.",
  tooLong: `Use ${PASSWORD_MAX_LENGTH} characters or fewer.`,
} as const;

export interface ChangePasswordValues {
  current: string;
  password: string;
  confirm: string;
}

export type ChangePasswordField = keyof ChangePasswordValues;
export type ChangePasswordErrors = Partial<Record<ChangePasswordField, string>>;

export function validateChangeField(
  field: ChangePasswordField,
  values: ChangePasswordValues,
  username: string,
): string | undefined {
  if (field === "current") {
    return values.current === "" ? CHANGE_MESSAGES.currentRequired : undefined;
  }
  if (field === "password") {
    if (values.password === "") return PASSWORD_MESSAGES.newRequired;
    if (values.password.length > PASSWORD_MAX_LENGTH) return CHANGE_MESSAGES.tooLong;
    if (!allRulesMet(checkRules(values.password, username))) return PASSWORD_MESSAGES.rulesNotMet;
    if (values.current !== "" && values.password === values.current) {
      return CHANGE_MESSAGES.sameAsCurrent;
    }
    return undefined;
  }
  if (values.confirm === "") return PASSWORD_MESSAGES.confirmRequired;
  return values.confirm === values.password ? undefined : PASSWORD_MESSAGES.mismatch;
}

export function validateChangeAll(
  values: ChangePasswordValues,
  username: string,
): ChangePasswordErrors {
  const errors: ChangePasswordErrors = {};
  for (const field of ["current", "password", "confirm"] as const) {
    const message = validateChangeField(field, values, username);
    if (message !== undefined) errors[field] = message;
  }
  return errors;
}

export type ChangeOutcome =
  | { kind: "changed" }
  | { kind: "wrong-current" }
  | { kind: "session-expired" }
  | { kind: "network" }
  | { kind: "rejected"; message: string }
  | { kind: "failed" };

const INTERNAL_EMAIL_DOMAIN = "accounts.invalid";

/** Checks the current password by signing in with it. A wrong password is "wrong-current". */
async function verifyCurrentPassword(
  username: string,
  password: string,
): Promise<"ok" | "wrong" | "network" | "failed"> {
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: `${username.trim().toLowerCase()}@${INTERNAL_EMAIL_DOMAIN}`,
      password,
    });
    if (!error) return "ok";
    if (error.code === "invalid_credentials" || error.status === 400) return "wrong";
    if (
      error.name === "AuthRetryableFetchError" ||
      error.status === 0 ||
      (error.status !== undefined && error.status >= 500)
    ) {
      return "network";
    }
    return "failed";
  } catch {
    return "network";
  }
}

export async function changePassword(
  username: string,
  values: ChangePasswordValues,
): Promise<ChangeOutcome> {
  const verified = await verifyCurrentPassword(username, values.current);
  if (verified === "wrong") return { kind: "wrong-current" };
  if (verified === "network") return { kind: "network" };
  if (verified === "failed") return { kind: "failed" };

  const saved = await saveNewPassword(values.password);
  return saved.kind === "saved" ? { kind: "changed" } : saved;
}
