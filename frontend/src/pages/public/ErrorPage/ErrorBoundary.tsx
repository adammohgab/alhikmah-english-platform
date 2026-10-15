import { Component, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { useRouteError } from "react-router-dom";
import { ErrorFallback } from "./ErrorFallback";
import { createErrorId } from "./error-id";

/* ========================================
   ErrorBoundary + RouteErrorPage (SH-11, PUB-13)

   ErrorBoundary catches errors thrown while React renders, in lifecycle methods and in
   constructors of everything beneath it, and swaps the subtree for <ErrorFallback>. It does
   not catch errors in event handlers, async code or the boundary itself; those need their
   own handling (toasts / ErrorState) where they occur.

   "Try again" resets the boundary and renders the children again. If that attempt throws
   straight away, the fallback offers a full page reload instead.

   RouteErrorPage is the same screen for React Router's `errorElement` (wired by the router
   task): router errors are not thrown through a React boundary, they arrive via
   useRouteError().
   ======================================== */

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Called once per caught error, e.g. to forward it to a reporting service. */
  onError?: ((error: unknown, errorId: string, info: ErrorInfo) => void) | undefined;
  /** Called when the person presses "Try again", after the boundary has reset. */
  onReset?: (() => void) | undefined;
}

interface ErrorBoundaryState {
  error: unknown;
  hasError: boolean;
  errorId: string;
  /** True while the first render after a reset has not yet succeeded. */
  retrying: boolean;
}

const INITIAL_STATE: ErrorBoundaryState = {
  error: null,
  hasError: false,
  errorId: "",
  retrying: false,
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = INITIAL_STATE;

  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    return { error, hasError: true, errorId: createErrorId() };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    // Keep the crash visible to developers and to anyone collecting console output; the
    // Error ID ties it to the number the person was shown.
    console.error(`[${this.state.errorId}] Unhandled render error`, error, info.componentStack);
    this.props.onError?.(error, this.state.errorId, info);
  }

  override componentDidUpdate() {
    // The retry render was committed without throwing again: the app is stable, forget it.
    if (this.state.retrying && !this.state.hasError) {
      this.setState({ retrying: false });
    }
  }

  private readonly reset = () => {
    this.props.onReset?.();
    this.setState({ error: null, hasError: false, errorId: "", retrying: true });
  };

  override render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          errorId={this.state.errorId}
          onRetry={this.reset}
          retryFailed={this.state.retrying}
        />
      );
    }
    return this.props.children;
  }
}

/** Fallback for React Router's `errorElement`. Retrying reloads the page. */
export function RouteErrorPage() {
  const error = useRouteError();
  // Stable for the life of this screen: the element is mounted once per route error.
  const [errorId] = useState(() => createErrorId());
  return <ErrorFallback error={error} errorId={errorId} />;
}
