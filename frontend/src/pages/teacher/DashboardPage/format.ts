const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

/** "3 hours ago", "in 2 days", "just now". Returns "—" for a missing or invalid date. */
export function formatRelative(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "—";
  const diff = time - now;
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return relative.format(Math.round(diff / ms), unit);
  }
  return "just now";
}

export function greetingFor(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
