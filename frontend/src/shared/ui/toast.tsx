import * as React from "react";
import { cn } from "@/shared/lib/utils/cn";

/**
 * Toast types and their corresponding color themes from tokens.css worlds.
 */
type ToastType = "info" | "success" | "warning" | "error";

const toastTypeConfig: Record<ToastType, { bg: string; color: string }> = {
  info: { bg: "var(--world-sky-100)", color: "var(--ink)" },
  success: { bg: "var(--world-mint-100)", color: "var(--ink)" },
  warning: { bg: "var(--world-amber-100)", color: "var(--ink)" },
  error: { bg: "var(--world-rose-100)", color: "var(--ink)" },
};

/**
 * Individual toast content - duration is required (defaults to 5000ms).
 */
interface ToastContent {
  id: string;
  title: string;
  type: ToastType;
  duration: number;
}

/**
 * Toast provider manages toast state, stacking, and dismissal.
 * Accessible: aria-live="polite", dismissible with Escape key.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastContent[]>([]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const show = React.useCallback(
    (props: { title: string; type?: ToastType; duration?: number }) => {
      const id = Math.random().toString(36).substr(2, 9);
      const duration = props.duration ?? 5000;
      setToasts((prev) => [
        ...prev,
        { id, title: props.title, type: props.type ?? "info", duration },
      ]);
      return id;
    },
    [],
  );

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Auto-dismiss each toast after its duration
  React.useEffect(() => {
    toasts.forEach((t) => {
      const timer = setTimeout(() => dismiss(t.id), t.duration);
      return () => clearTimeout(timer);
    });
  }, [toasts, dismiss]);

  // Escape key to dismiss all visible toasts
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setToasts([]);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="relative" role="status" aria-live="polite" aria-atomic="true">
      {/* Stack toasts at top-right */}
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className={cn(
            "toast",
            "flex",
            "items-center",
            "gap-3",
            "p-4",
            "rounded-sm",
            "shadow-retro-md",
            "border-t",
            "border-2",
            "border-retro-sm",
            "bg-" + toastTypeConfig[toast.type].bg,
            "text-" + toastTypeConfig[toast.type].color,
            "font-body",
            "text-sm",
            "leading-relaxed",
            "transition-all",
            "duration-" + toast.duration,
          )}
        >
          <button
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss toast"
            className="rounded-sm transition-colors hover:bg-opacity-20"
          >
            ✕
          </button>
          <span>{toast.title}</span>
        </div>
      ))}

      {children}
    </div>
  );
}
