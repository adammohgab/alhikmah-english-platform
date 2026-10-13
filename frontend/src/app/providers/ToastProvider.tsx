import * as React from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";
import {
  ToastContext,
  type ToastContextValue,
  type ToastItem,
  type ToastOptions,
  type ToastType,
} from "./toast-context";

const typeConfig: Record<
  ToastType,
  {
    bgClass: string;
    borderClass: string;
    icon: LucideIcon;
    label: string;
  }
> = {
  info: {
    bgClass: "bg-world-sky-100",
    borderClass: "border-stroke",
    icon: Info,
    label: "Info",
  },
  success: {
    bgClass: "bg-world-mint-100",
    borderClass: "border-stroke",
    icon: CheckCircle2,
    label: "Success",
  },
  warning: {
    bgClass: "bg-world-amber-100",
    borderClass: "border-stroke",
    icon: AlertTriangle,
    label: "Warning",
  },
  error: {
    bgClass: "bg-world-rose-100",
    borderClass: "border-stroke",
    icon: AlertCircle,
    label: "Error",
  },
  reward: {
    bgClass: "bg-world-coral-100",
    borderClass: "border-stroke",
    icon: Sparkles,
    label: "Reward",
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = React.useCallback(() => {
    setToasts([]);
  }, []);

  const show = React.useCallback((options: ToastOptions | string) => {
    const parsed: ToastOptions = typeof options === "string" ? { title: options } : options;
    const id = parsed.id ?? Math.random().toString(36).substring(2, 11);
    const duration = parsed.duration ?? 5000;
    const newItem: ToastItem = {
      id,
      title: parsed.title,
      ...(parsed.description ? { description: parsed.description } : {}),
      type: parsed.type ?? "info",
      duration,
    };

    setToasts((prev) => [...prev, newItem]);
    return id;
  }, []);

  // Keyboard shortcut: Escape dismisses all visible toasts
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dismissAll();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dismissAll]);

  const value = React.useMemo<ToastContextValue>(
    () => ({ show, dismiss, dismissAll, toasts }),
    [show, dismiss, dismissAll, toasts],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast viewport container: bottom-center on mobile, top-right on desktop */}
      <div
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        className={cn(
          "pointer-events-none fixed z-50 flex w-full max-w-sm flex-col gap-3 p-4",
          "bottom-4 left-1/2 -translate-x-1/2 sm:bottom-auto sm:left-auto sm:right-4 sm:top-4 sm:translate-x-0",
        )}
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export interface ToastCardProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

export function ToastCard({ toast, onDismiss }: ToastCardProps) {
  const cfg = typeConfig[toast.type];
  const IconComponent = cfg.icon;

  React.useEffect(() => {
    if (toast.duration <= 0) return;
    const timer = window.setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      role={toast.type === "error" ? "alert" : "status"}
      aria-atomic="true"
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-lg p-3.5",
        "border-2 border-stroke text-stroke shadow-retro-md",
        "animate-in fade-in slide-in-from-top-2 font-body text-sm transition-all duration-200",
        cfg.bgClass,
      )}
    >
      <div className="mt-0.5 shrink-0" aria-hidden="true">
        <IconComponent className="h-5 w-5 stroke-[2.25]" />
      </div>

      <div className="flex-1">
        <h4 className="font-heading text-sm font-semibold leading-tight text-stroke">
          {toast.title}
        </h4>
        {toast.description && (
          <p className="mt-1 font-body text-xs leading-snug text-muted">{toast.description}</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss toast"
        className={cn(
          "shrink-0 rounded p-1 text-stroke transition-transform hover:scale-110 active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stroke",
        )}
      >
        <X className="h-4 w-4 stroke-[2.5]" />
      </button>
    </div>
  );
}
