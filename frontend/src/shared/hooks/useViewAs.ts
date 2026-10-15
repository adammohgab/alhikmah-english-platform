import { useCallback, useEffect, useState } from "react";
import type { ViewAsSession, ViewAsTargetRole } from "@/shared/components/layout/ViewAsBanner";

/* ========================================
   useViewAs  (ADM-22 — View-As simulation hook)

   Spec: ADMIN-SPEC §11.3 — "omnipresent colored banner with an exit action"
   Spec: backend/docs/04-AUTH-AND-ACCESS §5 — simulation is read-only.

   Design:
   • View-As session is stored in sessionStorage so it survives in-tab navigation
     (React Router transitions) but is automatically cleared when the admin closes
     or refreshes the tab.
   • Mutation safety: `isReadOnly` is `true` while a session is active. Components
     that write data should check this flag and abort / show an accessible error.
     The hook also provides `assertWritable()` — call it at the top of any write
     path: it throws a typed, user-facing error that can be caught and surfaced as
     a toast or inline error without touching real data.
   • No backend RLS is bypassed. The admin's own bearer token is still in effect;
     the view-as mechanism uses sessionStorage to show the target user's data as
     read-only in the UI.
   • Module-level listeners: multiple hook instances across the component tree stay
     in sync via a shared event bus (a custom event on the window object). This
     avoids needing a React context provider while remaining compatible with React
     StrictMode and concurrent features.
   ======================================== */

// -------------------------------------------------------
// Persistence key & cross-instance sync event
// -------------------------------------------------------

const SESSION_KEY = "alhikmah.viewas";
const SYNC_EVENT = "alhikmah:viewas:change";

// -------------------------------------------------------
// Serialised shape stored in sessionStorage
// -------------------------------------------------------

interface StoredViewAsSession {
  /** Target user's UUID (used for audit trails and data loading). */
  targetId: string;
  /** Display name shown in the banner. */
  targetName: string;
  /** Determines which portal the admin simulates. */
  targetRole: ViewAsTargetRole;
  /** ISO-8601 expiry returned by the view-as-start Edge function (optional). */
  expiresAt?: string | undefined;
  /** Opaque session id returned by the Edge function (for audit references). */
  sessionId?: string | undefined;
  /** Unix ms when the simulation was started (for local expiry enforcement). */
  startedAt: number;
}

// -------------------------------------------------------
// Low-level storage helpers (safe — sessionStorage may be blocked)
// -------------------------------------------------------

function readSession(): StoredViewAsSession | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const s = parsed as Record<string, unknown>;
    if (typeof s["targetId"] !== "string" || typeof s["targetName"] !== "string") return null;
    if (s["targetRole"] !== "student" && s["targetRole"] !== "teacher") return null;

    // Enforce expiry when the server-provided expiresAt has passed.
    if (typeof s["expiresAt"] === "string") {
      const expiry = new Date(s["expiresAt"]).getTime();
      if (Number.isFinite(expiry) && Date.now() > expiry) {
        clearSession();
        return null;
      }
    }

    return {
      targetId: s["targetId"] as string,
      targetName: s["targetName"] as string,
      targetRole: s["targetRole"] as ViewAsTargetRole,
      expiresAt: typeof s["expiresAt"] === "string" ? s["expiresAt"] : undefined,
      sessionId: typeof s["sessionId"] === "string" ? s["sessionId"] : undefined,
      startedAt: typeof s["startedAt"] === "number" ? (s["startedAt"] as number) : Date.now(),
    };
  } catch {
    // sessionStorage blocked or corrupt value — treat as no session.
    return null;
  }
}

function writeSession(session: StoredViewAsSession): void {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // sessionStorage blocked or quota exceeded — session won't survive navigation.
  }
}

function clearSession(): void {
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // sessionStorage blocked — no-op.
  }
}

/** Dispatches a cross-instance sync event so all hook instances update. */
function broadcastChange(): void {
  try {
    window.dispatchEvent(new CustomEvent(SYNC_EVENT));
  } catch {
    // CustomEvent not supported in very old environments — degraded gracefully.
  }
}

// -------------------------------------------------------
// Public hook return type
// -------------------------------------------------------

export interface ViewAsState {
  /** While set, the simulation is active. Pass directly to `<ViewAsBanner session={…}>`. */
  session: ViewAsSession | null;
  /** Full metadata including the target's UUID, session id, and expiry. */
  meta: StoredViewAsSession | null;
  /**
   * `true` while a simulation is active. Use this as a guard in mutation paths:
   *   ```ts
   *   const { isReadOnly } = useViewAs();
   *   if (isReadOnly) { show({ type: "error", title: "Read-only simulation" }); return; }
   *   ```
   */
  isReadOnly: boolean;
  /**
   * Throws a `ViewAsReadOnlyError` when a simulation is active. Call this at the
   * top of any async mutation before performing any write. Catching it and showing
   * a toast is the idiomatic pattern.
   */
  assertWritable: () => void;
  /**
   * Activates a simulation session for the given target user.  Must be called
   * after the `view-as-start` Edge function resolves successfully.
   *
   * @param targetId    UUID of the simulated account.
   * @param targetName  Display name shown in the banner.
   * @param targetRole  "student" | "teacher" — determines the portal skin.
   * @param expiresAt   Optional ISO-8601 string from the Edge function response.
   * @param sessionId   Optional opaque id from the Edge function response.
   */
  startViewAs: (params: {
    targetId: string;
    targetName: string;
    targetRole: ViewAsTargetRole;
    expiresAt?: string | undefined;
    sessionId?: string | undefined;
  }) => void;
  /**
   * Ends the simulation and restores the administrator interface. Pass this as
   * `onExit` to `<ViewAsBanner>`. Safe to call when no session is active (no-op).
   */
  exitViewAs: () => void;
  /** `true` while exitViewAs is in the middle of its synchronous teardown. */
  isExiting: boolean;
}

// -------------------------------------------------------
// Error type for read-only guard
// -------------------------------------------------------

export class ViewAsReadOnlyError extends Error {
  readonly code = "VIEW_AS_READ_ONLY" as const;

  constructor() {
    super(
      "This action is not available in simulation mode. Exit the View-As session to make changes.",
    );
    this.name = "ViewAsReadOnlyError";
  }
}

// -------------------------------------------------------
// Hook
// -------------------------------------------------------

/**
 * `useViewAs` — admin View-As simulation mode hook (ADM-22).
 *
 * Manages the full lifecycle of a read-only simulation session:
 * persisting it across in-tab navigation, keeping multiple hook instances in
 * sync, enforcing expiry, and providing a safe mutation interceptor.
 *
 * ### Quick-start
 * ```tsx
 * // In the shell / layout:
 * const { session, exitViewAs, isExiting } = useViewAs();
 * // …
 * {session && <ViewAsBanner session={session} onExit={exitViewAs} exiting={isExiting} />}
 *
 * // In any component that writes data:
 * const { assertWritable } = useViewAs();
 * async function handleSave() {
 *   try {
 *     assertWritable(); // throws ViewAsReadOnlyError if in simulation
 *     await saveData(…);
 *   } catch (err) {
 *     if (err instanceof ViewAsReadOnlyError) {
 *       show({ type: "error", title: "Simulation mode", description: err.message });
 *       return;
 *     }
 *     show({ type: "error", title: "Save failed", description: toErrorMessage(err) });
 *   }
 * }
 *
 * // In UserDetailPage after startViewAsSession resolves:
 * const { startViewAs } = useViewAs();
 * // …
 * startViewAs({
 *   targetId: account.id,
 *   targetName: account.display_name,
 *   targetRole: account.role === "teacher" ? "teacher" : "student",
 *   expiresAt: viewAsResponse.expires_at,
 *   sessionId: viewAsResponse.session_id,
 * });
 * ```
 */
export function useViewAs(): ViewAsState {
  // Initialise from sessionStorage on first render (handles page refreshes).
  const [stored, setStored] = useState<StoredViewAsSession | null>(() => readSession());
  const [isExiting, setIsExiting] = useState(false);

  // Subscribe to cross-instance sync events (e.g. admin opens a second panel
  // in the same tab and starts / exits a session there).
  useEffect(() => {
    function onSync() {
      setStored(readSession());
    }
    window.addEventListener(SYNC_EVENT, onSync);
    return () => {
      window.removeEventListener(SYNC_EVENT, onSync);
    };
  }, []);

  const startViewAs = useCallback(
    (params: {
      targetId: string;
      targetName: string;
      targetRole: ViewAsTargetRole;
      expiresAt?: string | undefined;
      sessionId?: string | undefined;
    }) => {
      const newSession: StoredViewAsSession = {
        targetId: params.targetId,
        targetName: params.targetName,
        targetRole: params.targetRole,
        expiresAt: params.expiresAt,
        sessionId: params.sessionId,
        startedAt: Date.now(),
      };
      writeSession(newSession);
      setStored(newSession);
      broadcastChange();
    },
    [],
  );

  const exitViewAs = useCallback(() => {
    setIsExiting(true);
    clearSession();
    setStored(null);
    broadcastChange();
    // Reset the exiting flag on the next tick so callers that read it synchronously
    // after calling exitViewAs see the right transition state.
    setTimeout(() => {
      setIsExiting(false);
    }, 0);
  }, []);

  const assertWritable = useCallback(() => {
    if (stored !== null) {
      throw new ViewAsReadOnlyError();
    }
  }, [stored]);

  // Map the stored session to the shape expected by <ViewAsBanner>.
  const session: ViewAsSession | null =
    stored !== null
      ? { targetName: stored.targetName, targetRole: stored.targetRole }
      : null;

  return {
    session,
    meta: stored,
    isReadOnly: stored !== null,
    assertWritable,
    startViewAs,
    exitViewAs,
    isExiting,
  };
}
