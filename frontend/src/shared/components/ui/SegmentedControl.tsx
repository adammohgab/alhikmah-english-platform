import { forwardRef } from "react";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils/cn";
import { Tabs, TabsList, TabsTrigger, type TabsSize } from "./Tabs";

/* ========================================
   Arcade SegmentedControl (GLOBAL-STYLES-SPEC §10 "Selection", "Tabs")

   A compact one-of-many switch (view modes, ranges, units) with the same sliding pill as Tabs.
   It is built on Radix Tabs, so the keyboard model is the ARIA tabs pattern:
     Tab                    enters the control on the selected segment, the next Tab leaves it
     Arrow Left / Right     move focus to the previous or next segment and select it (wrap)
     Home / End             first and last segment
     Disabled segments are skipped. Arrow keys flip under `dir="rtl"` (read from `<html dir>`).
   There are no panels, so the segments have no `aria-controls`; the control reports its choice
   through `onValueChange` and the surrounding screen shows the result.

   Look: identical to Tabs (2px ink outline, hard 2px shadow, world `main` pill with a 2px ink
   outline behind the selected segment, ink labels on every state), in the compact `sm` size by
   default.

   Usage:
     <SegmentedControl
       aria-label="View"
       value={view}
       onValueChange={setView}
       options={[
         { value: "grid", label: "Grid" },
         { value: "list", label: "List" },
       ]}
     />
   With no `value` and no `defaultValue` the first enabled option starts selected.
   An icon-only option needs `ariaLabel`.
   ======================================== */

export interface SegmentedOption {
  /** Unique, non-empty value. */
  value: string;
  /** Visible label. May be omitted for an icon-only option (then set `ariaLabel`). */
  label?: ReactNode;
  /** Leading icon (Lucide, 16 px). Hidden from assistive tech by the caller or `aria-hidden`. */
  icon?: ReactNode;
  /** Accessible name when the segment has no text. */
  ariaLabel?: string | undefined;
  disabled?: boolean | undefined;
}

export interface SegmentedControlProps {
  options: readonly SegmentedOption[];
  /** Controlled selection. */
  value?: string | undefined;
  /** Initial selection when uncontrolled. Defaults to the first enabled option. */
  defaultValue?: string | undefined;
  onValueChange?: ((value: string) => void) | undefined;
  /** `md` is 40px tall, `sm` is 32px. Default `sm`. */
  size?: TabsSize | undefined;
  /** Stretches to the full width with equal segments. */
  fullWidth?: boolean | undefined;
  /** Accessible name of the control. Required unless `aria-labelledby` is set. */
  "aria-label"?: string | undefined;
  "aria-labelledby"?: string | undefined;
  /** Overrides the direction read from `<html dir>`. */
  dir?: "ltr" | "rtl" | undefined;
  className?: string | undefined;
}

export const SegmentedControl = forwardRef<HTMLDivElement, SegmentedControlProps>(
  function SegmentedControl(
    {
      options,
      value,
      defaultValue,
      onValueChange,
      size = "sm",
      fullWidth = false,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy,
      dir,
      className,
    },
    ref,
  ) {
    const firstEnabled = options.find((option) => option.disabled !== true)?.value;
    const selection =
      value !== undefined
        ? { value }
        : { defaultValue: defaultValue ?? firstEnabled ?? options[0]?.value ?? "" };

    return (
      <Tabs
        {...selection}
        {...(onValueChange ? { onValueChange } : null)}
        {...(dir ? { dir } : null)}
        className={cn(fullWidth ? "w-full" : "w-fit", className)}
      >
        <TabsList
          ref={ref}
          size={size}
          fullWidth={fullWidth}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
        >
          {options.map((option) => (
            <TabsTrigger
              key={option.value}
              value={option.value}
              panel={false}
              disabled={option.disabled === true}
              aria-label={option.ariaLabel}
            >
              {option.icon}
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    );
  },
);
