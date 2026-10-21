/* Pure rules for the announcements hub and composer (TEACHER-SPEC TC-26, TC-27):
   priorities, composer validation, read-rate maths and the restricted-HTML sanitizer used for
   every preview. The stored body is HTML produced by the editor; it is only ever rendered
   through `sanitizeAnnouncementHtml`. */

export const PRIORITIES = ["normal", "important", "urgent"] as const;
export type AnnouncementPriority = (typeof PRIORITIES)[number];

export const PRIORITY_LABEL: Record<AnnouncementPriority, string> = {
  normal: "Normal",
  important: "Important",
  urgent: "Urgent",
};

export const PRIORITY_WORLD: Record<AnnouncementPriority, "sky" | "amber" | "coral"> = {
  normal: "sky",
  important: "amber",
  urgent: "coral",
};

export function isPriority(value: string): value is AnnouncementPriority {
  return (PRIORITIES as readonly string[]).includes(value);
}

/** Mirrors the limits enforced by `publish_announcement` (migration 020). */
export const TITLE_MAX = 200;
export const BODY_MAX = 20000;

export interface ComposerValues {
  title: string;
  classId: string;
  bodyHtml: string;
  priority: AnnouncementPriority;
  /** `datetime-local` value, or "" for no expiry. */
  expiresAt: string;
}

export type ComposerErrors = Partial<Record<keyof ComposerValues, string>>;

export const EMPTY_COMPOSER: ComposerValues = {
  title: "",
  classId: "",
  bodyHtml: "",
  priority: "normal",
  expiresAt: "",
};

/** Text content of an HTML fragment, with no markup. Parsing is inert (no scripts run). */
export function plainText(html: string): string {
  return new DOMParser().parseFromString(html, "text/html").body.textContent?.trim() ?? "";
}

export function validateComposer(values: ComposerValues, now: number): ComposerErrors {
  const errors: ComposerErrors = {};
  const title = values.title.trim();
  if (title.length === 0) errors.title = "Add a title for the announcement.";
  else if (title.length > TITLE_MAX) errors.title = `Keep the title under ${TITLE_MAX} characters.`;

  if (!values.classId) errors.classId = "Choose the class that will receive it.";

  if (plainText(values.bodyHtml).length === 0) {
    errors.bodyHtml = "Write the message students will read.";
  } else if (values.bodyHtml.length > BODY_MAX) {
    errors.bodyHtml = `Shorten the message to ${BODY_MAX} characters, including formatting.`;
  }

  if (values.expiresAt) {
    const time = new Date(values.expiresAt).getTime();
    if (Number.isNaN(time)) errors.expiresAt = "Enter a valid expiry date and time.";
    else if (time <= now) errors.expiresAt = "The expiry must be in the future.";
  }
  return errors;
}

/** Converts a `datetime-local` value (local time) to an ISO timestamp, or null when empty. */
export function expiryToIso(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

/** Whole-number percentage of recipients who have read the announcement. */
export function readRate(read: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((read * 100) / total);
}

const WHEN = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export function formatWhen(iso: string): string {
  return WHEN.format(new Date(iso));
}

/* ---- Sanitizer -------------------------------------------------------------------------- */

/** Elements that may stay in a rendered announcement. Everything else is unwrapped to text. */
const ALLOWED_TAGS = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U", "UL", "OL", "LI", "A"]);
/** Elements removed together with their content. */
const DROPPED_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "TEMPLATE",
  "NOSCRIPT",
  "TEXTAREA",
  "SELECT",
  "BUTTON",
  "INPUT",
]);
const SAFE_HREF = /^(https?:|mailto:)/i;

/**
 * Keeps only basic formatting (bold, italic, underline, lists, links with http, https or
 * mailto). Attributes are dropped, links open in a new tab without a referrer.
 */
export function sanitizeAnnouncementHtml(html: string): string {
  const root = new DOMParser().parseFromString(html, "text/html").body;
  sanitizeChildren(root);
  return root.innerHTML;
}

function sanitizeChildren(parent: Element): void {
  for (const node of Array.from(parent.children)) {
    sanitizeChildren(node);

    if (DROPPED_TAGS.has(node.tagName)) {
      node.remove();
      continue;
    }

    const href = node.tagName === "A" ? (node.getAttribute("href") ?? "").trim() : "";
    const keep = ALLOWED_TAGS.has(node.tagName) && (node.tagName !== "A" || SAFE_HREF.test(href));
    if (!keep) {
      node.replaceWith(...Array.from(node.childNodes));
      continue;
    }

    for (const attribute of Array.from(node.attributes)) node.removeAttribute(attribute.name);
    if (href) {
      node.setAttribute("href", href);
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer nofollow");
    }
  }
}
