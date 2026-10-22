import { REMEMBER_STORAGE_KEY } from "@/shared/api/remember";
import { supabase } from "@/shared/api/supabase";

/* Account not active (SHARED-SPEC SH-05, task PUB-07). No React in this file.

   The page explains why an account cannot be used and what to do next, in words that never
   reveal private system data: no username, no sign-in counts, no names of who locked or archived
   the account, and no dates. The reason comes from two places:
     1. the signed-in profile status, when someone is signed in with a blocked account
        (a person archived mid-session, or the route guard sending a blocked account here);
     2. the `reason` value in the address, set by the sign-in page, which ends the session before
        it sends the person here (`/account-not-active?reason=locked`).
   Anything else, including values nobody planned for, gets the general text from SH-05. */

export type InactiveReason = "pending" | "locked" | "archived" | "disabled" | "unknown";

export interface ReasonCopy {
  /** One sentence naming what happened. */
  summary: string;
  /** One sentence naming what to do next. */
  next: string;
}

export const REASON_COPY: Record<InactiveReason, ReasonCopy> = {
  pending: {
    summary: "Your account is not active yet.",
    next: "Your school will tell you when you can sign in. You can ask the school office if it takes long.",
  },
  locked: {
    summary: "Your account is locked.",
    next: "This can happen after too many wrong passwords. Your school can unlock it. Ask your teacher or the school office.",
  },
  archived: {
    summary: "Your account has been archived.",
    next: "Ask your school if you think this is a mistake.",
  },
  disabled: {
    summary: "Your account has been turned off.",
    next: "Ask your school if you think this is a mistake.",
  },
  unknown: {
    summary: "Your account has been archived or turned off.",
    next: "Ask your school if you think this is a mistake.",
  },
};

const KNOWN_REASONS: readonly InactiveReason[] = ["pending", "locked", "archived", "disabled"];

/** Reads the `reason` value from the address. Unknown or missing values give "unknown". */
export function parseReason(value: string | null | undefined): InactiveReason {
  if (value === null || value === undefined) return "unknown";
  const found = KNOWN_REASONS.find((reason) => reason === value.trim().toLowerCase());
  return found ?? "unknown";
}

/** True when a profile status means the account cannot be used. */
export function isBlockedStatus(status: string): boolean {
  return status !== "active";
}

/**
 * Ends the session on this device completely: the server session (when it can be reached), the
 * stored Supabase session, and the "keep me signed in" choice. Each step runs even when an earlier
 * one fails, because a person must always be able to leave this page with another account.
 */
export async function endSession(signOutEverywhere: () => Promise<void>): Promise<void> {
  try {
    await signOutEverywhere();
  } catch {
    // Offline or already signed out. The local sign-out below still removes the session.
  }
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Nothing left to remove, or storage is blocked. The page still moves on.
  }
  try {
    window.localStorage.removeItem(REMEMBER_STORAGE_KEY);
  } catch {
    // Storage can be blocked (private mode, policy). Nothing more to clear.
  }
}
