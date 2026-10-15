const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "in 2 hours", "in 35 minutes", or null once the time has passed. */
export function describeTimeUntil(target: Date, now: number): string | null {
  const diff = target.getTime() - now;
  if (diff <= 0) return null;
  if (diff < HOUR_MS) return RELATIVE.format(Math.max(1, Math.round(diff / MINUTE_MS)), "minute");
  if (diff < 2 * DAY_MS) return RELATIVE.format(Math.round(diff / HOUR_MS), "hour");
  return RELATIVE.format(Math.round(diff / DAY_MS), "day");
}
