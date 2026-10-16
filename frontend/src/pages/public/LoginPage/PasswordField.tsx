import { forwardRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { FieldFooter, FieldFrame, FieldLabel } from "@/shared/components/ui/Input";
import { IconButton } from "@/shared/components/ui/IconButton";

/* ========================================
   PasswordField (SHARED-SPEC SH-02 item 4, the "PasswordField")

   A password input in the shared field frame, with
     - a show/hide button (a real button with `aria-pressed`, named "Show password" or
       "Hide password"), so a person can check what they typed;
     - a Caps Lock hint, read from the key events, shown while the field has focus;
     - `autoComplete` defaulting to "current-password", so password managers fill it.
   The shared `Input` cannot hold a button, because its icon slots are decorative, so this field
   builds the same anatomy from the exported field pieces (frame, label, footer).
   Spell-checking, auto-correction and auto-capitalization are off. Native validation is left
   to the form (`noValidate`); the field only reports `aria-required` and `aria-invalid`.
   Class strings live in constants so the Tailwind class sorter treats them as plain data.
   ======================================== */

const WRAPPER_CLASS = "flex w-full flex-col gap-1.5";
const FRAME_CLASS = "h-14";
const INPUT_CLASS =
  "peer h-full min-w-0 flex-1 bg-transparent font-body text-base font-medium text-inherit outline-none placeholder:text-muted/80 disabled:cursor-not-allowed";
const TOGGLE_ICON_CLASS = "h-5 w-5";

export interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  onBlur?: (() => void) | undefined;
  /** Error message under the field. Its presence puts the field in the invalid state. */
  error?: string | undefined;
  disabled?: boolean | undefined;
  name?: string | undefined;
  autoComplete?: string | undefined;
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField(
    {
      id,
      label,
      value,
      onValueChange,
      onBlur,
      error,
      disabled = false,
      name = "password",
      autoComplete = "current-password",
    },
    ref,
  ) {
    const [visible, setVisible] = useState(false);
    const [capsLock, setCapsLock] = useState(false);

    const helperId = `${id}-helper`;
    const errorId = `${id}-error`;
    const invalid = error !== undefined;
    const describedBy = invalid ? errorId : capsLock ? helperId : undefined;

    const readCapsLock = (event: KeyboardEvent<HTMLInputElement>) => {
      setCapsLock(event.getModifierState("CapsLock"));
    };

    return (
      <div className={WRAPPER_CLASS}>
        <FieldLabel htmlFor={id} required disabled={disabled}>
          {label}
        </FieldLabel>

        <FieldFrame invalid={invalid} disabled={disabled} className={FRAME_CLASS}>
          <input
            ref={ref}
            id={id}
            name={name}
            type={visible ? "text" : "password"}
            value={value}
            disabled={disabled}
            autoComplete={autoComplete}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-required="true"
            aria-invalid={invalid ? true : undefined}
            aria-describedby={describedBy}
            onChange={(event) => {
              onValueChange(event.target.value);
            }}
            onKeyDown={readCapsLock}
            onKeyUp={readCapsLock}
            onBlur={() => {
              setCapsLock(false);
              onBlur?.();
            }}
            className={INPUT_CLASS}
          />
          <IconButton
            variant="ghost"
            size="sm"
            sound={false}
            disabled={disabled}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            onClick={() => {
              setVisible((current) => !current);
            }}
          >
            {visible ? (
              <EyeOff aria-hidden="true" focusable="false" className={TOGGLE_ICON_CLASS} />
            ) : (
              <Eye aria-hidden="true" focusable="false" className={TOGGLE_ICON_CLASS} />
            )}
          </IconButton>
        </FieldFrame>

        <FieldFooter
          helperId={helperId}
          errorId={errorId}
          counterId={`${id}-count`}
          helperText={capsLock ? "Caps Lock is on." : undefined}
          errorMessage={error}
          showCount={false}
          count={0}
        />
      </div>
    );
  },
);
