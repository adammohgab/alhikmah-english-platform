import { useEffect, useRef, useState } from "react";
import { getRoleHomePath } from "@/app/guards/guard-utils";
import { useAuth } from "@/app/providers/auth-context";
import { withBase } from "./error-id";

/* ========================================
   ErrorFallback: the SH-11 "Something went wrong" screen (SHARED-SPEC §5)

   Rendered by the error boundary, so it must keep working when the rest of the app is in a
   bad state. It therefore uses only plain elements and plain links: no router hooks, no
   Button (which needs SoundProvider), no toasts. `useAuth` is safe here, it falls back to a
   signed-out default when no provider is mounted.

   Production builds show the Error ID only. The error name, message and stack trace are
   shown in development builds (stack inside a collapsed <details>) because they can expose
   internals, table names or user data.
   ======================================== */

const PLATFORM_NAME = "Wordland";
const PAGE_TITLE = `Something went wrong | ${PLATFORM_NAME}`;

const BUTTON_BASE =
  "inline-flex h-12 items-center justify-center rounded-[14px] border-2 border-stroke px-6 font-heading text-[16px] font-semibold leading-none text-stroke shadow-retro-sm transition-transform duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-retro-md active:translate-x-0.5 active:translate-y-0.5 active:shadow-none motion-reduce:transition-none [[data-effects-tier=low]_&]:transition-none";
const BUTTON_PRIMARY = `${BUTTON_BASE} bg-[var(--world-main,#ffb84d)]`;
const BUTTON_SECONDARY = `${BUTTON_BASE} bg-surface-0`;

export interface ErrorFallbackProps {
  /** The caught error. Only its summary and stack are shown, and only in development. */
  error: unknown;
  /** Reference the person can quote to their school. */
  errorId: string;
  /** Resets the boundary and tries to render again. Without it the button reloads the page. */
  onRetry?: (() => void) | undefined;
  /** True once a retry already failed again; the button then reloads the whole page. */
  retryFailed?: boolean | undefined;
}

function Motif() {
  return (
    <svg
      viewBox="0 0 160 140"
      width={160}
      height={140}
      aria-hidden="true"
      focusable="false"
      className="overflow-visible"
    >
      <path
        d="M22 40 L32 50 L22 60 M140 34 L130 44 L140 54 M18 100 L28 104 L22 114 M144 96 L134 100 L140 110"
        fill="none"
        stroke="#1A1530"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M80 20 C86 20 90 23 93 28 L124 88 C127 94 127 98 124 103 C121 108 116 111 110 111 L50 111 C44 111 39 108 36 103 C33 98 33 94 36 88 L67 28 C70 23 74 20 80 20 Z"
        fill="#F2566A"
        stroke="#1A1530"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <rect
        x="75"
        y="45"
        width="10"
        height="34"
        rx="5"
        fill="#fff"
        stroke="#1A1530"
        strokeWidth="2.5"
      />
      <circle cx="80" cy="92" r="6" fill="#fff" stroke="#1A1530" strokeWidth="2.5" />
    </svg>
  );
}

function summarize(error: unknown): { summary: string; stack: string | null } {
  if (error instanceof Error) {
    return {
      summary: `${error.name}: ${error.message}`,
      stack: error.stack ?? null,
    };
  }
  if (typeof error === "string") return { summary: error, stack: null };
  try {
    return { summary: JSON.stringify(error) ?? String(error), stack: null };
  } catch {
    return { summary: "Unknown error", stack: null };
  }
}

export function ErrorFallback({
  error,
  errorId,
  onRetry,
  retryFailed = false,
}: ErrorFallbackProps) {
  const { isAuthenticated, user } = useAuth();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const resetTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const previous = document.title;
    document.title = PAGE_TITLE;
    return () => {
      document.title = previous;
    };
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(resetTimer.current);
    },
    [],
  );

  const signedIn = isAuthenticated && user !== null;
  const homeHref = withBase(signedIn ? getRoleHomePath(user.role) : "/");
  const homeLabel = signedIn ? "Go to my dashboard" : "Go to the home page";
  const reportHref = `${withBase("/help")}?errorId=${encodeURIComponent(errorId)}`;

  const reloadsPage = retryFailed || onRetry === undefined;
  const retryLabel = reloadsPage ? "Reload the page" : "Try again";

  const handleRetry = () => {
    if (reloadsPage) {
      window.location.reload();
      return;
    }
    onRetry();
  };

  const handleCopy = async () => {
    window.clearTimeout(resetTimer.current);
    try {
      await navigator.clipboard.writeText(errorId);
      setCopyState("copied");
    } catch {
      // Clipboard blocked (insecure context or permission): the ID is selectable text,
      // so tell the person to copy it by hand instead of failing silently.
      setCopyState("failed");
    }
    resetTimer.current = window.setTimeout(() => setCopyState("idle"), 3000);
  };

  const details = import.meta.env.DEV ? summarize(error) : null;

  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center bg-surface-100 px-6 py-16 text-center"
    >
      <Motif />
      <h1 className="mt-6 max-w-xl font-heading text-[32px] font-bold leading-tight text-stroke md:text-[44px]">
        Something went wrong.
      </h1>
      <p className="mt-3 max-w-md text-[16px] leading-snug text-muted">
        It is on our side. Your work is not lost if it was saved.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <button type="button" onClick={handleRetry} className={BUTTON_PRIMARY}>
          {retryLabel}
        </button>
        <a href={homeHref} className={BUTTON_SECONDARY}>
          {homeLabel}
        </a>
      </div>

      <div className="mt-8 flex max-w-md flex-col items-center gap-2 rounded-[16px] border-2 border-stroke bg-surface-0 px-5 py-4">
        <p className="text-[14px] text-muted">
          Error ID:{" "}
          <code className="select-all font-mono text-[15px] font-semibold text-stroke">
            {errorId}
          </code>
        </p>
        <p className="text-[13px] text-muted">
          Share this with your school if the problem continues.
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="rounded-[10px] border-2 border-stroke bg-surface-100 px-3 py-1.5 text-[13px] font-semibold text-stroke hover:bg-surface-200"
          >
            Copy Error ID
          </button>
          <a
            href={reportHref}
            className="rounded-[10px] border-2 border-stroke bg-surface-100 px-3 py-1.5 text-[13px] font-semibold text-stroke hover:bg-surface-200"
          >
            Report issue
          </a>
        </div>
        <p role="status" aria-live="polite" className="min-h-[18px] text-[13px] text-muted">
          {copyState === "copied" && "Error ID copied."}
          {copyState === "failed" && "Could not copy. Select the ID above and copy it by hand."}
        </p>
      </div>

      {details && (
        <details className="mt-6 w-full max-w-2xl rounded-[12px] border-2 border-dashed border-muted bg-surface-0 p-4 text-left">
          <summary className="cursor-pointer text-[14px] font-semibold text-stroke">
            Developer details (development builds only)
          </summary>
          <p className="mt-3 break-words font-mono text-[13px] text-stroke">{details.summary}</p>
          {details.stack && (
            <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-[12px] text-muted">
              {details.stack}
            </pre>
          )}
        </details>
      )}
    </main>
  );
}
