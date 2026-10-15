const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

/** "3 hours ago", "yesterday", "just now"; "Never" when the date is missing or invalid. */
export function formatLastActive(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "Never";
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "Never";
  const diff = time - now;
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return relative.format(Math.round(diff / ms), unit);
  }
  return "just now";
}

/** Distinct, sorted grade levels present in the loaded rows. */
export function gradeOptions(grades: ReadonlyArray<string | null | undefined>): string[] {
  const unique = new Set(grades.filter((grade): grade is string => Boolean(grade)));
  return [...unique].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}
