/* Pure rules for the class detail page: join link, tab ids and display formatting. */

export const CLASS_TABS = [
  { value: "overview", label: "Overview" },
  { value: "roster", label: "Roster & Students" },
  { value: "work", label: "Assigned Work" },
  { value: "rules", label: "Class Rules" },
  { value: "announcements", label: "Announcements" },
] as const;

export type ClassTab = (typeof CLASS_TABS)[number]["value"];

export function isClassTab(value: string | null): value is ClassTab {
  return CLASS_TABS.some((tab) => tab.value === value);
}

/** Link a student opens to join the class. Also what the QR code encodes. */
export function joinLink(origin: string, basePath: string, code: string): string {
  const base = `${origin}${basePath}`.replace(/\/+$/, "");
  return `${base}/join?code=${encodeURIComponent(code)}`;
}

/** Join codes read better in groups: ABC123 becomes ABC 123. */
export function formatJoinCode(code: string): string {
  const clean = code.replace(/\s+/g, "");
  return clean.length > 3 ? `${clean.slice(0, 3)} ${clean.slice(3)}` : clean;
}

export function percent(value: number | null | undefined): string {
  if (value == null) return "—";
  const scaled = value <= 1 ? value * 100 : value;
  return `${Math.round(scaled)}%`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
