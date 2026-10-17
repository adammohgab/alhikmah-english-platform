/* ========================================
   Live quiz monitor rules (task TCH-CORE-20)
   Pure helpers: connection status from last activity, elapsed and remaining time on the server
   clock, status counts and grid ordering.
   ======================================== */

export const ACTIVE_WITHIN_MS = 30_000;
export const IDLE_WITHIN_MS = 120_000;
export const EXTEND_MINUTES = 5;

export type ConnectionStatus = "active" | "idle" | "offline";
export type AttemptStatus = "not_started" | "in_progress" | "submitted";

/** Green = active, yellow = idle, grey = offline (or never seen). */
export function connectionStatus(lastSeenAt: string | null, nowMs: number): ConnectionStatus {
  if (!lastSeenAt) return "offline";
  const seen = new Date(lastSeenAt).getTime();
  if (Number.isNaN(seen)) return "offline";
  const gap = nowMs - seen;
  if (gap <= ACTIVE_WITHIN_MS) return "active";
  if (gap <= IDLE_WITHIN_MS) return "idle";
  return "offline";
}

/**
 * Corrects the browser clock so countdowns agree with the server: the offset between the server
 * time in the last snapshot and the browser time when that snapshot arrived.
 */
export function clockOffsetMs(serverTime: string, receivedAtMs: number): number {
  const server = new Date(serverTime).getTime();
  return Number.isNaN(server) ? 0 : server - receivedAtMs;
}

const at = (iso: string | null) => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
};

/** Seconds spent so far; frozen at the submit time for finished attempts. */
export function elapsedSeconds(
  startedAt: string | null,
  submittedAt: string | null,
  nowMs: number,
): number | null {
  const start = at(startedAt);
  if (start === null) return null;
  const end = at(submittedAt) ?? nowMs;
  return Math.max(0, Math.floor((end - start) / 1000));
}

/** Seconds left until the deadline (never below zero); null without a deadline. */
export function remainingSeconds(deadlineAt: string | null, nowMs: number): number | null {
  const deadline = at(deadlineAt);
  return deadline === null ? null : Math.max(0, Math.floor((deadline - nowMs) / 1000));
}

export function formatClock(seconds: number | null): string {
  if (seconds === null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export interface Counts {
  inProgress: number;
  submitted: number;
  notStarted: number;
  idleOrOffline: number;
}

export function countStatuses(
  rows: { status: AttemptStatus; lastSeenAt: string | null }[],
  nowMs: number,
): Counts {
  const counts: Counts = { inProgress: 0, submitted: 0, notStarted: 0, idleOrOffline: 0 };
  for (const row of rows) {
    if (row.status === "submitted") counts.submitted += 1;
    else if (row.status === "not_started") counts.notStarted += 1;
    else {
      counts.inProgress += 1;
      if (connectionStatus(row.lastSeenAt, nowMs) !== "active") counts.idleOrOffline += 1;
    }
  }
  return counts;
}

const ORDER: Record<AttemptStatus, number> = { in_progress: 0, not_started: 1, submitted: 2 };

/** Students who are taking the test first, then waiting, then done; names A-Z inside each group. */
export function sortForGrid<T extends { status: AttemptStatus; name: string }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name),
  );
}
