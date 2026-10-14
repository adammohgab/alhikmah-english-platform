import { forwardRef, useId, useLayoutEffect, useRef, useState } from "react";
import type { ChangeEvent, InputHTMLAttributes, KeyboardEvent, ReactNode, Ref } from "react";
import { X } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";

/* ========================================
   Arcade Input (GLOBAL-STYLES-SPEC §6.1, §10 "Input, textarea, select"; TASKS UIK-09)

   One native <input> inside a "field frame". The frame owns the look: solid 2px ink outline,
   radius 14, hard 2px offset shadow (white "sticker paper" fill, Figtree text).
   Focus "pops": the frame lifts 2px up-left, the shadow grows to 4px and a world-colored halo
   (`--world-main`) wraps the outline. Only `transform` is transitioned (spec §6.1: never animate
   box-shadow); the shadow itself switches instantly. Disabled = soft grey fill, dashed outline,
   no shadow. Error = danger outline, zigzag sticker, message below.

   Layout: label above (Figtree 700, sentence case), then
     [leftIcon] [input] [clear] [rightIcon] [error sticker]
   then one footer row: error message (or helper text) on the left, character counter on the right.

   React Hook Form: the ref is forwarded to the <input> and `name`, `onChange`, `onBlur` pass
   straight through, so `<Input {...register("email")} error={errors.email} />` works. `error`
   accepts a string or any `{ message?: string }` (RHF `FieldError`) so no mapping is needed.
   The component works controlled (`value`) or uncontrolled (`defaultValue` / `register`).

   Accessibility: `aria-invalid`, `aria-describedby` (helper or error, plus counter, plus any
   caller-provided ids) and a real <label htmlFor> are always wired. The error message is a
   `role="alert"` region. Without a visible `label`, pass `aria-label`.
   The clear button is hidden with CSS (`:placeholder-shown`), not React state, so it stays in
   sync when a form library changes the value programmatically (`reset`, `setValue`).
   ======================================== */

export type FieldSize = "sm" | "md" | "lg";

/** A message string, or any object with a `message` (React Hook Form `FieldError`). */
export type FieldErrorLike = string | { message?: string | undefined } | null | undefined | false;

function getErrorMessage(error: FieldErrorLike): string | undefined {
  if (error === undefined || error === null || error === false) return undefined;
  if (typeof error === "string") return error.length > 0 ? error : undefined;
  return error.message !== undefined && error.message.length > 0 ? error.message : undefined;
}

function assignRef<T>(ref: Ref<T> | undefined, node: T | null) {
  if (typeof ref === "function") ref(node);
  else if (ref) (ref as { current: T | null }).current = node;
}

/* ---------- Shared building blocks (also used by Textarea) ---------- */

/* 9-point jagged circle: the danger "zigzag sticker" (spec §3.3), same shape as Badge's glyph. */
const ZIGZAG_POINTS = (() => {
  const points: string[] = [];
  const spikes = 9;
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? 10.5 : 8.4;
    const angle = (Math.PI * i) / spikes - Math.PI / 2;
    points.push(
      `${(12 + radius * Math.cos(angle)).toFixed(2)},${(12 + radius * Math.sin(angle)).toFixed(2)}`,
    );
  }
  return points.join(" ");
})();

function ErrorSticker({ className }: { className?: string | undefined }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-5 w-5 shrink-0 text-danger-600", className)}
    >
      <polygon points={ZIGZAG_POINTS} />
      <path d="M12 7.5v5" />
      <path d="M12 16v.01" />
    </svg>
  );
}

export interface FieldFrameProps {
  invalid: boolean;
  disabled: boolean;
  /** Fully rounded ends instead of radius 14. */
  pill?: boolean | undefined;
  /** Top-align the content (textarea) instead of centering it. */
  multiline?: boolean | undefined;
  className?: string | undefined;
  children: ReactNode;
}

/** The outlined, shadowed box that wraps the native control and its icons. */
export function FieldFrame({
  invalid,
  disabled,
  pill = false,
  multiline = false,
  className,
  children,
}: FieldFrameProps) {
  let state: string;
  if (disabled) {
    // Spec §10: disabled is a soft grey fill with a dashed outline and no shadow.
    state = "cursor-not-allowed border-dashed border-muted bg-surface-200 text-muted";
  } else {
    state = cn(
      "border-solid bg-surface-0 text-stroke shadow-retro-sm",
      "focus-within:-translate-x-0.5 focus-within:-translate-y-0.5 focus-within:shadow-retro-md",
      "focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-0",
      invalid
        ? "border-danger-600 focus-within:[outline-color:#b3261e]"
        : "border-stroke focus-within:[outline-color:var(--world-main,#ffb84d)]",
    );
  }

  return (
    <div
      className={cn(
        "relative flex w-full gap-2 border-2 font-body",
        "transition-transform duration-[120ms] ease-out motion-reduce:transition-none [[data-effects-tier=low]_&]:transition-none",
        multiline ? "items-start" : "items-center",
        pill ? "rounded-full px-4" : "rounded-[14px] px-3",
        state,
        className,
      )}
    >
      {children}
      {invalid && <ErrorSticker className={multiline ? "mt-2.5" : undefined} />}
    </div>
  );
}

export interface FieldLabelProps {
  htmlFor: string;
  required?: boolean | undefined;
  disabled?: boolean | undefined;
  children: ReactNode;
}

/** Field label: Figtree 700, 13px, sentence case, above the control (spec §4 "label"). */
export function FieldLabel({
  htmlFor,
  required = false,
  disabled = false,
  children,
}: FieldLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "font-body text-[13px] font-bold leading-tight",
        disabled ? "text-muted" : "text-stroke",
      )}
    >
      {children}
      {required && (
        <span aria-hidden="true" className="ml-0.5 text-danger-600">
          *
        </span>
      )}
    </label>
  );
}

export interface FieldFooterProps {
  helperId: string;
  errorId: string;
  counterId: string;
  helperText?: ReactNode;
  errorMessage?: string | undefined;
  /** Renders the counter when true. */
  showCount: boolean;
  count: number;
  maxLength?: number | undefined;
}

/** Message row under the control: error (replaces helper text) on the left, counter on the right. */
export function FieldFooter({
  helperId,
  errorId,
  counterId,
  helperText,
  errorMessage,
  showCount,
  count,
  maxLength,
}: FieldFooterProps) {
  const hasHelper = helperText !== undefined && helperText !== null && helperText !== false;
  if (errorMessage === undefined && !hasHelper && !showCount) return null;

  const atLimit = maxLength !== undefined && count >= maxLength;

  return (
    <div className="flex items-start justify-between gap-3">
      {errorMessage !== undefined ? (
        <p
          id={errorId}
          role="alert"
          className="font-body text-[13px] font-semibold text-danger-600"
        >
          {errorMessage}
        </p>
      ) : hasHelper ? (
        <p id={helperId} className="font-body text-[13px] font-medium text-muted">
          {helperText}
        </p>
      ) : (
        <span />
      )}
      {showCount && (
        <p
          id={counterId}
          className={cn(
            "ml-auto shrink-0 font-heading text-[13px] font-medium tabular-nums",
            atLimit ? "font-bold text-danger-600" : "text-muted",
          )}
        >
          {count}
          {maxLength !== undefined && `/${maxLength}`}
        </p>
      )}
    </div>
  );
}

/* ---------- Input ---------- */

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> {
  /** Visible label above the field. Without one, pass `aria-label`. */
  label?: ReactNode;
  /** Hint shown under the field. Replaced by the error message while invalid. */
  helperText?: ReactNode;
  /** Error message (string) or a React Hook Form `FieldError`. Truthy message = invalid state. */
  error?: FieldErrorLike;
  /** 36px, 44px or 56px tall. Default `md`. */
  size?: FieldSize | undefined;
  /** Icon slot before the text. Decorative: hidden from assistive tech. */
  leftIcon?: ReactNode;
  /** Icon slot after the text (and after the clear button). Decorative. */
  rightIcon?: ReactNode;
  /** Shows a clear (X) button while the field has a value. Works controlled and uncontrolled. */
  clearable?: boolean | undefined;
  /** Called after the clear button (or Escape, with `clearOnEscape`) emptied the field. */
  onClear?: (() => void) | undefined;
  /** Accessible name of the clear button. Default "Clear input". */
  clearLabel?: string | undefined;
  /** Escape empties a non-empty field (and does not bubble, so a parent dialog stays open). */
  clearOnEscape?: boolean | undefined;
  /** Shows a character counter; `n/max` when `maxLength` is set. */
  showCount?: boolean | undefined;
  /** Fully rounded ends (top-bar search style) instead of radius 14. */
  pill?: boolean | undefined;
  /** Classes for the outer wrapper (layout, width, margin). */
  className?: string | undefined;
  /** Classes for the native <input>. */
  inputClassName?: string | undefined;
}

const SIZE_STYLES: Record<FieldSize, { frame: string; text: string }> = {
  sm: { frame: "h-9", text: "text-sm" },
  md: { frame: "h-11", text: "text-base" },
  lg: { frame: "h-14", text: "text-base" },
};

const SLOT_BASE =
  "pointer-events-none inline-flex shrink-0 items-center text-stroke [&_svg]:h-5 [&_svg]:w-5 [&_svg]:stroke-[2.5]";

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    helperText,
    error,
    size = "md",
    leftIcon,
    rightIcon,
    clearable = false,
    onClear,
    clearLabel = "Clear input",
    clearOnEscape = false,
    showCount = false,
    pill = false,
    className,
    inputClassName,
    id: idProp,
    value,
    defaultValue,
    placeholder,
    disabled = false,
    readOnly = false,
    required = false,
    maxLength,
    onChange,
    onKeyDown,
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

  const errorMessage = getErrorMessage(error);
  const invalid = errorMessage !== undefined;
  const hasHelper = helperText !== undefined && helperText !== null && helperText !== false;

  const inputRef = useRef<HTMLInputElement | null>(null);
  const setRefs = (node: HTMLInputElement | null) => {
    inputRef.current = node;
    assignRef(ref, node);
  };

  // Counter: exact when controlled; when uncontrolled it follows the DOM value (initial value,
  // typing, the clear button, and programmatic changes picked up on the next render).
  const [domLength, setDomLength] = useState(() => String(value ?? defaultValue ?? "").length);
  useLayoutEffect(() => {
    if (!showCount || value !== undefined || inputRef.current === null) return;
    const length = inputRef.current.value.length;
    if (length !== domLength) setDomLength(length);
  }, [showCount, value, domLength]);
  const count = value !== undefined ? String(value).length : domLength;

  const canClear = clearable && !disabled && !readOnly;

  const clearField = () => {
    const el = inputRef.current;
    if (el === null) return;
    // The native setter + a bubbling `input` event makes React (and React Hook Form) see a real
    // change, for both controlled and uncontrolled fields.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(el, "");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.focus();
    onClear?.();
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDomLength(event.target.value.length);
    onChange?.(event);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (
      clearOnEscape &&
      canClear &&
      !event.defaultPrevented &&
      event.key === "Escape" &&
      event.currentTarget.value !== ""
    ) {
      event.preventDefault();
      event.stopPropagation();
      clearField();
    }
  };

  const describedBy =
    [
      describedByProp,
      errorMessage !== undefined ? errorId : hasHelper ? helperId : undefined,
      showCount ? counterId : undefined,
    ]
      .filter((part) => part !== undefined && part !== "")
      .join(" ") || undefined;

  const sizeStyle = SIZE_STYLES[size];

  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)}>
      {label !== undefined && label !== null && (
        <FieldLabel htmlFor={id} required={required} disabled={disabled}>
          {label}
        </FieldLabel>
      )}

      <FieldFrame invalid={invalid} disabled={disabled} pill={pill} className={sizeStyle.frame}>
        {leftIcon !== undefined && leftIcon !== null && (
          <span aria-hidden="true" className={SLOT_BASE}>
            {leftIcon}
          </span>
        )}

        <input
          {...rest}
          ref={setRefs}
          id={id}
          value={value}
          defaultValue={defaultValue}
          // A non-empty placeholder lets CSS `:placeholder-shown` know the field is empty.
          placeholder={placeholder ?? (canClear ? " " : undefined)}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          maxLength={maxLength}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={describedBy}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className={cn(
            "peer h-full min-w-0 flex-1 bg-transparent font-body font-medium text-inherit outline-none",
            "placeholder:text-muted/80 disabled:cursor-not-allowed",
            "[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
            sizeStyle.text,
            inputClassName,
          )}
        />

        {canClear && (
          <button
            type="button"
            aria-label={clearLabel}
            onClick={clearField}
            className={cn(
              "grid h-6 w-6 shrink-0 place-items-center rounded-full bg-transparent text-stroke",
              "hover:bg-[var(--world-soft,#ffd93d)] peer-placeholder-shown:hidden",
            )}
          >
            <X aria-hidden="true" size={16} strokeWidth={3} />
          </button>
        )}

        {rightIcon !== undefined && rightIcon !== null && (
          <span aria-hidden="true" className={SLOT_BASE}>
            {rightIcon}
          </span>
        )}
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
