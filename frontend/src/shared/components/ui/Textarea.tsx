import { forwardRef, useId, useLayoutEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactNode, Ref, TextareaHTMLAttributes } from "react";
import { cn } from "@/shared/lib/utils/cn";
import { FieldFooter, FieldFrame, FieldLabel, type FieldErrorLike } from "./Input";

/* ========================================
   Arcade Textarea (GLOBAL-STYLES-SPEC §10 "Input, textarea, select"; TASKS UIK-09)

   The multi-line twin of Input: same field frame (2px ink outline, radius 14, hard shadow,
   focus pop with a world-colored halo), same label / helper / error / counter row, same
   React Hook Form contract (`<Textarea {...register("bio")} error={errors.bio} />`).
   Vertical resize only, so the frame never breaks the layout.

   Accessibility: `aria-invalid` and `aria-describedby` (helper or error, plus counter, plus
   caller-provided ids) are always wired; the error message is a `role="alert"` region.
   ======================================== */

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Visible label above the field. Without one, pass `aria-label`. */
  label?: ReactNode;
  /** Hint shown under the field. Replaced by the error message while invalid. */
  helperText?: ReactNode;
  /** Error message (string) or a React Hook Form `FieldError`. Truthy message = invalid state. */
  error?: FieldErrorLike;
  /** Shows a character counter; `n/max` when `maxLength` is set. */
  showCount?: boolean | undefined;
  /** Classes for the outer wrapper (layout, width, margin). */
  className?: string | undefined;
  /** Classes for the native <textarea>. */
  textareaClassName?: string | undefined;
}

function assignRef<T>(ref: Ref<T> | undefined, node: T | null) {
  if (typeof ref === "function") ref(node);
  else if (ref) (ref as { current: T | null }).current = node;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    label,
    helperText,
    error,
    showCount = false,
    className,
    textareaClassName,
    id: idProp,
    value,
    defaultValue,
    disabled = false,
    required = false,
    maxLength,
    rows = 4,
    onChange,
    "aria-describedby": describedByProp,
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const counterId = `${id}-count`;

  const rawMessage = typeof error === "string" ? error : error ? error.message : undefined;
  const errorMessage = rawMessage !== undefined && rawMessage !== "" ? rawMessage : undefined;
  const invalid = errorMessage !== undefined;
  const hasHelper = helperText !== undefined && helperText !== null && helperText !== false;

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const setRefs = (node: HTMLTextAreaElement | null) => {
    textareaRef.current = node;
    assignRef(ref, node);
  };

  // Counter: exact when controlled; when uncontrolled it follows the DOM value (initial value,
  // typing, and programmatic changes picked up on the next render).
  const [domLength, setDomLength] = useState(() => String(value ?? defaultValue ?? "").length);
  useLayoutEffect(() => {
    if (!showCount || value !== undefined || textareaRef.current === null) return;
    const length = textareaRef.current.value.length;
    if (length !== domLength) setDomLength(length);
  }, [showCount, value, domLength]);
  const count = value !== undefined ? String(value).length : domLength;

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setDomLength(event.target.value.length);
    onChange?.(event);
  };

  const describedBy =
    [
      describedByProp,
      errorMessage !== undefined ? errorId : hasHelper ? helperId : undefined,
      showCount ? counterId : undefined,
    ]
      .filter((part) => part !== undefined && part !== "")
      .join(" ") || undefined;

  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)}>
      {label !== undefined && label !== null && (
        <FieldLabel htmlFor={id} required={required} disabled={disabled}>
          {label}
        </FieldLabel>
      )}

      <FieldFrame invalid={invalid} disabled={disabled} multiline className="py-2.5">
        <textarea
          {...rest}
          ref={setRefs}
          id={id}
          value={value}
          defaultValue={defaultValue}
          rows={rows}
          disabled={disabled}
          required={required}
          maxLength={maxLength}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={describedBy}
          onChange={handleChange}
          className={cn(
            "block min-h-[96px] min-w-0 flex-1 resize-y bg-transparent font-body text-base font-medium leading-6 text-inherit outline-none",
            "placeholder:text-muted/80 disabled:cursor-not-allowed disabled:resize-none",
            textareaClassName,
          )}
        />
      </FieldFrame>

      <FieldFooter
        helperId={helperId}
        errorId={errorId}
        counterId={counterId}
        helperText={helperText}
        errorMessage={errorMessage}
        showCount={showCount}
        count={count}
        maxLength={maxLength}
      />
    </div>
  );
});
