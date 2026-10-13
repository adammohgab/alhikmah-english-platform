import { createContext, useContext } from "react";

export type ToastType = "info" | "success" | "warning" | "error" | "reward";

export interface ToastOptions {
  id?: string;
  title: string;
  description?: string;
  type?: ToastType;
  duration?: number;
}

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
  duration: number;
}

export interface ToastContextValue {
  show: (options: ToastOptions | string) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  toasts: ToastItem[];
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
