import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/utils/cn";
import { Button } from "./Button";
import type { WorldId } from "@/shared/hooks/useWorld";

/* ========================================
   Arcade ErrorState (Feedback & Loading, GLOBAL-STYLES-SPEC §10 "Error state", §8 "Errors")
   The friendly failure placeholder: a warning sticker (a red alert triangle with zigzag
   sparks, the spec's zigzag sticker language), one plain-language error message and a retry
   button that calls `onRetry`. Never humiliating — a shrug, not a red flash (spec §8).

   It is a centered column that sizes to its setting, so it fits neatly inside a `Card`
   (`size="sm"`) or a full page (`size="lg"`). The sticker uses the semantic danger red;
   `world` pins the surrounding accents.

   Localization: `locale="ar"` switches the built-in fallback title, description and retry
   label to Arabic and renders the block right-to-left with `lang="ar" dir="rtl"` in the
   Amiri face. Custom `title` / `description` / `retryLabel` win over the fallbacks.
   ======================================== */

export type ErrorStateSize = "sm" | "md" | "lg";
export type ErrorStateLocale = "en" | "ar";

export interface ErrorStateProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children" | "title"
> {
  /** Heading. Default "Something went wrong". */
  title?: ReactNode | undefined;
  /** One plain-language sentence about what happened. Default "An unexpected error occurred. Your progress is safe." */
  description?: ReactNode | undefined;
  /** Label of the retry button. Default "Try again". */
  retryLabel?: string | undefined;
  /** Called when the retry button is pressed. */
  onRetry?: (() => void) | undefined;
  /** A fully custom action; replaces the default retry button when provided. */
  action?: ReactNode | undefined;
  /** Layout scale: fits a card (`sm`), a panel (`md`, default) or a full page (`lg`). */
  size?: ErrorStateSize | undefined;
  /** Switches the built-in fallbacks to Arabic (RTL). Default "en". */
  locale?: ErrorStateLocale | undefined;
  /** Pins the sticker to one world instead of the current one. */
  world?: WorldId | undefined;
}

const ILLUSTRATION_SIZE: Record<ErrorStateSize, number> = { sm: 72, md: 112, lg: 152 };

const TITLE_CLASS: Record<ErrorStateSize, string> = {
  sm: "text-[16px]",
  md: "text-[20px]",
  lg: "text-[24px]",
};

const DESCRIPTION_CLASS: Record<ErrorStateSize, string> = {
  sm: "text-[13px]",
  md: "text-[15px]",
  lg: "text-[16px]",
};

const PADDING_CLASS: Record<ErrorStateSize, string> = {
  sm: "px-4 py-6",
  md: "px-6 py-10",
  lg: "px-8 py-14",
};

/* ---- Fallback copy ---- */

const FALLBACK = {
  en: {
    title: "Something went wrong",
    description: "An unexpected error occurred. Your progress is safe.",
    retryLabel: "Try again",
  },
  ar: {
    title: "حدث خطأ ما",
    description: "حدث خطأ غير متوقع. تقدّمك في أمان.",
    retryLabel: "حاول مرة أخرى",
  },
} as const;

/* ---- Warning sticker ----
   A rounded red alert triangle with an exclamation mark and zigzag sparks, drawn with the
   arcade recipe: flat fills under 3px ink outlines with round joins. */

function WarningIllustration({ size }: { size: number }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      className="overflow-visible"
    >
      {/* Zigzag sparks */}
      <path
        d="M22 34 L30 42 L22 50"
        stroke="#1A1530"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M98 30 L90 38 L98 46"
        stroke="#1A1530"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 78 L26 82 L22 90"
        stroke="#1A1530"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M102 74 L94 78 L98 86"
        stroke="#1A1530"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Rounded alert triangle */}
      <path
        d="M60 24 C64 24 68 26 70 30 L92 72 C94 76 94 80 92 84 C90 88 86 90 82 90 L38 90 C34 90 30 88 28 84 C26 80 26 76 28 72 L50 30 C52 26 56 24 60 24 Z"
        fill="#F2566A"
        stroke="#1A1530"
        strokeWidth={3}
        strokeLinejoin="round"
      />
      {/* Exclamation mark */}
      <rect
        x={56}
        y={42}
        width={8}
        height={26}
        rx={4}
        fill="#FFFFFF"
        stroke="#1A1530"
        strokeWidth={2.5}
      />
      <circle cx={60} cy={78} r={5} fill="#FFFFFF" stroke="#1A1530" strokeWidth={2.5} />
    </svg>
  );
}

export function ErrorState({
  title,
  description,
  retryLabel,
  onRetry,
  action,
  size = "md",
  locale = "en",
  world,
  className,
  ...rest
}: ErrorStateProps) {
  const isArabic = locale === "ar";
  const fallback = FALLBACK[isArabic ? "ar" : "en"];
  const heading = title ?? fallback.title;
  const body = description ?? fallback.description;
  const label = retryLabel ?? fallback.retryLabel;

  return (
    <div
      {...rest}
      dir={isArabic ? "rtl" : undefined}
      lang={isArabic ? "ar" : undefined}
      data-world={world}
      className={cn(
        "flex flex-col items-center justify-center gap-1 text-center",
        PADDING_CLASS[size],
        isArabic && "font-arabic",
        className,
      )}
    >
      <WarningIllustration size={ILLUSTRATION_SIZE[size]} />
      <h3
        className={cn(
          "mt-4 font-heading font-semibold leading-tight text-stroke",
          TITLE_CLASS[size],
        )}
      >
        {heading}
      </h3>
      <p className={cn("max-w-sm leading-snug text-muted", DESCRIPTION_CLASS[size])}>{body}</p>
      {(action !== undefined && action !== null) || onRetry ? (
        <div className="mt-5">
          {action ?? (
            <Button onClick={onRetry} size={size === "sm" ? "sm" : "md"}>
              {label}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
