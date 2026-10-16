import { supabase } from "@/shared/api/supabase";

/* The Help page inquiry form: field rules and the submit call. */

export const INQUIRY_CATEGORIES = [
  { value: "sign-in", label: "I cannot sign in" },
  { value: "account", label: "My account or class" },
  { value: "course", label: "A course, lesson or quiz" },
  { value: "ai-tutor", label: "The AI Tutor" },
  { value: "problem", label: "Report a problem" },
  { value: "other", label: "Something else" },
] as const;

export type InquiryCategory = (typeof INQUIRY_CATEGORIES)[number]["value"];

export interface InquiryValues {
  name: string;
  studentRef: string;
  category: InquiryCategory | "";
  message: string;
}

export type InquiryField = keyof InquiryValues;
export type InquiryErrors = Partial<Record<InquiryField, string>>;

export const EMPTY_INQUIRY: InquiryValues = { name: "", studentRef: "", category: "", message: "" };

export const NAME_MAX = 80;
export const REF_MAX = 32;
export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 1000;

const REF_PATTERN = /^[\p{L}\p{N} ./-]+$/u;

export function validateField(field: InquiryField, values: InquiryValues): string | undefined {
  switch (field) {
    case "name": {
      const name = values.name.trim();
      if (name === "") return "Enter your name.";
      if (name.length < 2) return "Your name needs at least 2 characters.";
      return undefined;
    }
    case "studentRef": {
      const ref = values.studentRef.trim();
      if (ref === "") return undefined;
      if (ref.length > REF_MAX || !REF_PATTERN.test(ref)) {
        return `Use letters, numbers, spaces, / or - only (up to ${REF_MAX}). For example 8B or your student ID.`;
      }
      return undefined;
    }
    case "category":
      return values.category === "" ? "Choose what your message is about." : undefined;
    case "message": {
      const message = values.message.trim();
      if (message === "") return "Write your message.";
      if (message.length < MESSAGE_MIN) {
        return `Add a little more detail (at least ${MESSAGE_MIN} characters).`;
      }
      if (message.length > MESSAGE_MAX) return `Keep it under ${MESSAGE_MAX} characters.`;
      return undefined;
    }
  }
}

export const INQUIRY_FIELDS: readonly InquiryField[] = [
  "name",
  "studentRef",
  "category",
  "message",
];

export function validateInquiry(values: InquiryValues): InquiryErrors {
  const errors: InquiryErrors = {};
  for (const field of INQUIRY_FIELDS) {
    const message = validateField(field, values);
    if (message) errors[field] = message;
  }
  return errors;
}

/**
 * Sends the inquiry to the `submit_inquiry` Edge Function (a public, rate-limited function in
 * the style of `request_password_reset`). Throws when the function reports a failure or cannot
 * be reached, so the form can say so instead of pretending the message went out.
 */
export async function submitInquiry(values: InquiryValues): Promise<void> {
  const result = await supabase.functions.invoke("submit_inquiry", {
    body: {
      name: values.name.trim(),
      student_ref: values.studentRef.trim() === "" ? null : values.studentRef.trim(),
      category: values.category,
      message: values.message.trim(),
    },
  });
  if (result.error) throw result.error as Error;
}
