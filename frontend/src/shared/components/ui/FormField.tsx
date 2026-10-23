import { cloneElement, isValidElement, useEffect, useId, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";
import { IconButton } from "./IconButton";
import { Tooltip } from "./Tooltip";
import type { FieldErrorLike } from "./Input";

/* ========================================
   Arcade FormField (Forms, GLOBAL-STYLES-SPEC §10 "Form controls")
   The unified wrapper for ANY control: it owns the label row, the required marker, the
   helper/error footer and the wiring, so custom compositions (control groups, third-party
   widgets, selects built from buttons) get the same anatomy as `Input` without reimplementing
   it. For plain text inputs prefer `Input` itself, which already integrates all of this.

   Association is automatic. Pass a single control element and FormField injects
     `id`, `aria-labelledby` (the label), `aria-describedby` (helper / error / counter, merged
     with any ids the control already had) and `aria-invalid` while there is an error.
   Pass a function instead to wire the props yourself:
     `<FormField label="…" hint="…">{(props) => <MyControl {...props} />}</FormField>`
   The wrapper stays lean: one column div, the label row, and one footer grid.

   Error messaging animates with the CSS `grid-template-rows: 0fr → 1fr` accordion, so the
   message slides into view without a layout jump (and slides back before unmounting). The
   error replaces the helper text while present (same rule as `Input`) and is a `role="alert"`
   region. The transition drops under reduced motion and on the low effects tier (§8.9).

   Extras: `charCount` renders an `n/max` counter announced with the field (danger when at
   the limit); `info` renders an info IconButton with an arcade Tooltip (which never steals
   focus from the field).
   ======================================== */

/** Props FormField hands to the wrapped control (function children) or injects (element). */
export interface FormFieldControlProps {
  id: string;
  "aria-labelledby": string;
  "aria-describedby": string | undefined;
  "aria-invalid": true | undefined;
}

export interface FormFieldProps {
  /** Field label. Rendered as a real <label> pointed at the control. */
  label: ReactNode;
  /** Marks the field required: a visible red asterisk plus "(required)" for screen readers. */
  required?: boolean | undefined;
  /** Helper text under the control. Replaced by the error message while invalid. */
  hint?: ReactNode | undefined;
  /** Error message (string) or a React Hook Form `FieldError`. Truthy message = invalid state. */
  error?: FieldErrorLike | undefined;
  /** Tooltip content for the info icon next to the label. */
  info?: ReactNode | undefined;
  /** Character counter; `max` turns it into `n/max` and colors it at the limit. */
  charCount?: { current: number; max?: number | undefined } | undefined;
  /** Fixed control id. Auto-generated (and injected into the control) when omitted. */
  id?: string | undefined;
  /**
   * The control: a single element (FormField injects the association props) or a function
   * receiving `FormFieldControlProps` to spread manually.
   */
  children: ReactNode | ((control: FormFieldControlProps) => ReactNode);
  /** Classes for the wrapper column. */
  className?: string | undefined;
}

/** Same resolver as `Input`: a message string, or any `{ message }` (RHF `FieldError`). */
function getErrorMessage(error: FieldErrorLike): string | undefined {
  if (error === undefined || error === null || error === false) return undefined;
  if (typeof error === "string") return error.length > 0 ? error : undefined;
  return error.message !== undefined && error.message.length > 0 ? error.message : undefined;
}

/** Keeps a collapsed accordion mounted briefly so the exit animation can play. */
function useExitGrace(active: boolean, graceMs: number): boolean {
  const [mounted, setMounted] = useState(active);
  useEffect(() => {
    if (active) {
      setMounted(true);
      return;
    }
    const timeout = window.setTimeout(() => setMounted(false), graceMs);
    return () => window.clearTimeout(timeout);
  }, [active, graceMs]);
  return mounted;
}

export function FormField({
  label,
  required = false,
  hint,
  error,
  info,
  charCount,
  id: idProp,
  children,
  className,
}: FormFieldProps) {
  const autoId = useId();
  const errorMessage = getErrorMessage(error);
  const invalid = errorMessage !== undefined;
  const hasHint = hint !== undefined && hint !== null && hint !== false;
  const footerMounted = invalid || hasHint || charCount !== undefined;

  const labelId = `${idProp ?? autoId}-label`;
  const hintId = `${idProp ?? autoId}-hint`;
  const errorId = `${idProp ?? autoId}-error`;
  const countId = `${idProp ?? autoId}-count`;

  const controlId = (() => {
    if (idProp !== undefined) return idProp;
    if (isValidElement(children)) {
      const childId = (children.props as { id?: unknown }).id;
      if (typeof childId === "string" && childId.length > 0) return childId;
    }
    return autoId;
  })();

  const describedBy =
    [
      invalid ? errorId : hasHint ? hintId : undefined,
      charCount !== undefined ? countId : undefined,
    ]
      .filter((part) => part !== undefined && part !== "")
      .join(" ") || undefined;

  const renderFooter = useExitGrace(footerMounted, 220);

  let control: ReactNode;
  if (typeof children === "function") {
    control = children({
      id: controlId,
      "aria-labelledby": labelId,
      "aria-describedby": describedBy,
      "aria-invalid": invalid ? true : undefined,
    });
  } else if (isValidElement(children)) {
    const childProps = children.props as Record<string, unknown>;
    const mergedDescribedBy =
      [
        typeof childProps["aria-describedby"] === "string"
          ? childProps["aria-describedby"]
          : undefined,
        describedBy,
      ]
        .filter((part) => part !== undefined && part !== "")
        .join(" ") || undefined;
    control = cloneElement(children as ReactElement<Record<string, unknown>>, {
      id: typeof childProps.id === "string" && childProps.id.length > 0 ? childProps.id : controlId,
      "aria-labelledby":
        typeof childProps["aria-labelledby"] === "string" ? childProps["aria-labelledby"] : labelId,
      "aria-describedby": mergedDescribedBy,
      ...(invalid && childProps["aria-invalid"] === undefined ? { "aria-invalid": true } : {}),
    });
  } else {
    control = children;
  }

  const count = charCount?.current;
  const max = charCount?.max;
  const atLimit = max !== undefined && count !== undefined && count >= max;

  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={controlId}
          className="font-body text-[13px] font-bold leading-tight text-stroke"
        >
          {label}
          {required && (
            <>
              <span aria-hidden="true" className="ml-0.5 text-danger-600">
                *
              </span>
              <span className="sr-only"> (required)</span>
            </>
          )}
        </label>
        {info !== undefined && info !== null && info !== false && (
          <Tooltip.Provider>
            <Tooltip>
              <Tooltip.Trigger asChild>
                <IconButton variant="ghost" size="sm" aria-label="More information">
                  <Info size={16} strokeWidth={2.5} aria-hidden="true" />
                </IconButton>
              </Tooltip.Trigger>
              <Tooltip.Content>
                {info}
                <Tooltip.Arrow />
              </Tooltip.Content>
            </Tooltip>
          </Tooltip.Provider>
        )}
      </div>

      {control}

      {renderFooter && (
        <div className="flex items-start justify-between gap-3">
          {/* The 0fr -> 1fr grid accordion slides the message in and back out with no jump. */}
          <div
            aria-hidden={!invalid && !hasHint}
            className="grid min-w-0 flex-1 transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none [[data-effects-tier=low]_&]:transition-none"
            style={{ gridTemplateRows: invalid || hasHint ? "1fr" : "0fr" }}
          >
            <div className="min-h-0 overflow-hidden">
              {invalid ? (
                <p
                  id={errorId}
                  role="alert"
                  className="font-body text-[13px] font-semibold text-danger-600"
                >
                  {errorMessage}
                </p>
              ) : hasHint ? (
                <p id={hintId} className="font-body text-[13px] font-medium text-muted">
                  {hint}
                </p>
              ) : null}
            </div>
          </div>
          {charCount !== undefined && (
            <p
              id={countId}
              className={cn(
                "ml-auto shrink-0 font-heading text-[13px] font-medium tabular-nums",
                atLimit ? "font-bold text-danger-600" : "text-muted",
              )}
            >
              {count}
              {max !== undefined && `/${max}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
