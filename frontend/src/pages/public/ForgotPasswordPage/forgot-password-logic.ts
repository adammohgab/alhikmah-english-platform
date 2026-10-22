import { supabase } from "@/shared/api/supabase";

/* Forgot password (SHARED-SPEC SH-03): field rules, the device rate limit and the submit call.
   The request goes to the public `request_password_reset` function (migration 040, which follows
   05-API-CONTRACT): it takes the username, full name, optional grade and class, optional note and
   a device key, returns `{ok: true}` and always the same response, and fails with `rate_limited`
   after the limits (3 per hour per device, 20 per hour per address). The page shows one success text whether or not the
   username exists, so nobody can learn which usernames are real. */

export interface ResetValues {
  username: string;
  fullName: string;
  gradeClass: string;
  note: string;
}

export type ResetField = keyof ResetValues;
export type ResetErrors = Partial<Record<ResetField, string>>;

export const EMPTY_RESET: ResetValues = { username: "", fullName: "", gradeClass: "", note: "" };

export const USERNAME_MAX = 64;
export const FULL_NAME_MIN = 2;
export const FULL_NAME_MAX = 80;
export const GRADE_CLASS_MAX = 32;
export const NOTE_MAX = 200;

export const RESET_MESSAGES = {
  rateLimited:
    "You have sent several requests. Please wait before trying again, or contact your school.",
  network: "We could not reach the server. Check your connection and try again.",
  failed: "We could not send your request. Try again, or contact your school.",
} as const;

const GRADE_CLASS_PATTERN = /^[\p{L}\p{N} ./-]+$/u;

export const RESET_FIELDS: readonly ResetField[] = ["username", "fullName", "gradeClass", "note"];

export function validateField(field: ResetField, values: ResetValues): string | undefined {
  switch (field) {
    case "username": {
      const username = values.username.trim();
      if (username === "") return "Enter your username.";
      if (username.length > USERNAME_MAX)
        return `Keep your username under ${USERNAME_MAX} characters.`;
      if (/\s/.test(username)) return "A username has no spaces.";
      return undefined;
    }
    case "fullName": {
      const name = values.fullName.trim();
      if (name === "") return "Enter your full name.";
      if (name.length < FULL_NAME_MIN)
        return `Your name needs at least ${FULL_NAME_MIN} characters.`;
      if (name.length > FULL_NAME_MAX) return `Keep your name under ${FULL_NAME_MAX} characters.`;
      return undefined;
    }
    case "gradeClass": {
      const gradeClass = values.gradeClass.trim();
      if (gradeClass === "") return undefined;
      if (gradeClass.length > GRADE_CLASS_MAX || !GRADE_CLASS_PATTERN.test(gradeClass)) {
        return `Use letters, numbers, spaces, / or - only (up to ${GRADE_CLASS_MAX}). For example 8B.`;
      }
      return undefined;
    }
    case "note":
      return values.note.trim().length > NOTE_MAX
        ? `Keep your note under ${NOTE_MAX} characters.`
        : undefined;
  }
}

export function validateReset(values: ResetValues): ResetErrors {
  const errors: ResetErrors = {};
  for (const field of RESET_FIELDS) {
    const message = validateField(field, values);
    if (message !== undefined) errors[field] = message;
  }
  return errors;
}

/* ---------- Device rate limit: at most 3 requests per hour from one device ---------- */

export const RATE_LIMIT_MAX = 3;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
export const RATE_LIMIT_STORAGE_KEY = "alhikmah:password-reset-requests";

function readTimestamps(now: number): number[] {
  try {
    const raw = window.localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value) && now - value < RATE_LIMIT_WINDOW_MS,
    );
  } catch {
    // Storage can be blocked or hold bad data. The server limit still applies.
    return [];
  }
}

/** True when this device already sent the allowed number of requests in the last hour. */
export function isDeviceRateLimited(now: number = Date.now()): boolean {
  return readTimestamps(now).length >= RATE_LIMIT_MAX;
}

export function recordDeviceRequest(now: number = Date.now()): void {
  try {
    const next = [...readTimestamps(now), now];
    window.localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Without storage the device limit cannot be kept. The server limit still applies.
  }
}

/* ---------- Submit ---------- */

export type ResetOutcome =
  | { kind: "sent" }
  | { kind: "rate-limited" }
  | { kind: "network" }
  | { kind: "failed" };

export const DEVICE_KEY_STORAGE_KEY = "alhikmah:device-key";

/**
 * A random id this browser keeps, so the server can count requests per device. The server hashes
 * it and never stores it as sent. Without storage a new id is made each time, and the address
 * limit on the server still applies.
 */
export function getDeviceKey(): string {
  const make = () =>
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  try {
    const stored = window.localStorage.getItem(DEVICE_KEY_STORAGE_KEY);
    if (stored !== null && stored !== "") return stored;
    const created = make();
    window.localStorage.setItem(DEVICE_KEY_STORAGE_KEY, created);
    return created;
  } catch {
    return make();
  }
}

/**
 * Sends the request. The server answers the same way for a real and an unknown username, so
 * "sent" never says whether the username exists. A `rate_limited` answer maps to its own outcome.
 */
export async function submitResetRequest(values: ResetValues): Promise<ResetOutcome> {
  if (isDeviceRateLimited()) return { kind: "rate-limited" };

  const gradeClass = values.gradeClass.trim();
  const note = values.note.trim();

  let result: Awaited<ReturnType<typeof supabase.rpc<"request_password_reset">>>;
  try {
    result = await supabase.rpc("request_password_reset", {
      p_username: values.username.trim().toLowerCase(),
      p_full_name: values.fullName.trim(),
      p_grade_class: gradeClass === "" ? null : gradeClass,
      p_note: note === "" ? null : note,
      p_device_key: getDeviceKey(),
    });
  } catch {
    return { kind: "network" };
  }

  if (result.error) {
    const message = result.error.message;
    if (message === "rate_limited") {
      recordDeviceRequest();
      return { kind: "rate-limited" };
    }
    if (/fetch|network/i.test(message)) return { kind: "network" };
    return { kind: "failed" };
  }

  recordDeviceRequest();
  return { kind: "sent" };
}
