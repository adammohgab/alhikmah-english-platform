import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/utils/cn";
import { Button } from "./Button";
import type { WorldId } from "@/shared/hooks/useWorld";

/* ========================================
   Arcade EmptyState (Feedback & Loading, GLOBAL-STYLES-SPEC §10 "Empty state")
   The friendly placeholder for lists, tables and dashboards with nothing to show yet:
   an illustrated open-box sticker, one friendly sentence and one clear call to action —
   the spec's "a sticker illustration … one sentence, one button".

   It is a centered column that sizes to its setting, so it fits neatly inside a `Card`
   (`size="sm"`) or a full page (`size="lg"`). The sticker reads the live world variables
   and recolors with the theme; `world` pins it.

   Localization: `locale="ar"` switches the built-in fallback title, description and CTA to
   Arabic and renders the block right-to-left with `lang="ar" dir="rtl"` in the Amiri face.
   Custom `title` / `description` / `actionLabel` win over the fallbacks.
   ======================================== */

export type EmptyStateSize = "sm" | "md" | "lg";
export type EmptyStateLocale = "en" | "ar";

export interface EmptyStateProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children" | "title"
> {
  /** Heading. Default "Nothing here yet". */
  title?: ReactNode | undefined;
  /** One friendly sentence under the heading. Default "This space is waiting for its first item." */
  description?: ReactNode | undefined;
  /** Label of the call-to-action button. Default "Get started". */
  actionLabel?: string | undefined;
  /** Called when the call-to-action button is pressed. */
  onAction?: (() => void) | undefined;
  /** A fully custom CTA; replaces the default button when provided. */
  action?: ReactNode | undefined;
  /** Layout scale: fits a card (`sm`), a panel (`md`, default) or a full page (`lg`). */
  size?: EmptyStateSize | undefined;
  /** Switches the built-in fallbacks to Arabic (RTL). Default "en". */
  locale?: EmptyStateLocale | undefined;
  /** Pins the sticker to one world instead of the current one. */
  world?: WorldId | undefined;
}

const ILLUSTRATION_SIZE: Record<EmptyStateSize, number> = { sm: 72, md: 112, lg: 152 };

const TITLE_CLASS: Record<EmptyStateSize, string> = {
  sm: "text-[16px]",
  md: "text-[20px]",
  lg: "text-[24px]",
};

const DESCRIPTION_CLASS: Record<EmptyStateSize, string> = {
  sm: "text-[13px]",
  md: "text-[15px]",
  lg: "text-[16px]",
};

const PADDING_CLASS: Record<EmptyStateSize, string> = {
  sm: "px-4 py-6",
  md: "px-6 py-10",
  lg: "px-8 py-14",
};

/* ---- Fallback copy ---- */

const FALLBACK = {
  en: {
    title: "Nothing here yet",
    description: "This space is waiting for its first item.",
    actionLabel: "Get started",
  },
  ar: {
    title: "لا يوجد شيء هنا بعد",
    description: "هذه المساحة تنتظر أول عنصر.",
    actionLabel: "ابدأ الآن",
  },
} as const;

/* ---- Open box sticker ----
   An illustrated open cardboard box with a floating sparkle, drawn with the arcade recipe:
   flat fills in world colors under 3px ink outlines with round joins. */

function BoxIllustration({ size }: { size: number }) {
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
      {/* Floating sparkle */}
      <path
        d="M60 10 L64 24 L78 28 L64 32 L60 46 L56 32 L42 28 L56 24 Z"
        fill="var(--world-pop, #2fd6a3)"
        stroke="#1A1530"
        strokeWidth={3}
        strokeLinejoin="round"
      />
      {/* Open back flaps */}
      <path
        d="M32 58 L18 34 L44 44 Z"
        fill="var(--world-tint, #fff1e3)"
        stroke="#1A1530"
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <path
        d="M88 58 L102 34 L76 44 Z"
        fill="var(--world-tint, #fff1e3)"
        stroke="#1A1530"
        strokeWidth={3}
        strokeLinejoin="round"
      />
      {/* Box body */}
      <rect
        x={26}
        y={56}
        width={68}
        height={46}
        rx={6}
        fill="var(--world-main, #ffb84d)"
        stroke="#1A1530"
        strokeWidth={3}
      />
      {/* Dark opening */}
      <path
        d="M32 50 H88 L78 62 H42 Z"
        fill="var(--world-deep, #8f4300)"
        stroke="#1A1530"
        strokeWidth={3}
        strokeLinejoin="round"
      />
      {/* Tape stripe on the front */}
      <path
        d="M54 58 H66 V102 H54 Z"
        fill="var(--world-soft, #ffd3a6)"
        stroke="#1A1530"
        strokeWidth={3}
      />
    </svg>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  action,
  size = "md",
  locale = "en",
  world,
  className,
  ...rest
}: EmptyStateProps) {
  const isArabic = locale === "ar";
  const fallback = FALLBACK[isArabic ? "ar" : "en"];
  const heading = title ?? fallback.title;
  const body = description ?? fallback.description;
  const ctaLabel = actionLabel ?? fallback.actionLabel;

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
      <BoxIllustration size={ILLUSTRATION_SIZE[size]} />
      <h3
        className={cn(
          "mt-4 font-heading font-semibold leading-tight text-stroke",
          TITLE_CLASS[size],
        )}
      >
        {heading}
      </h3>
      <p className={cn("max-w-sm leading-snug text-muted", DESCRIPTION_CLASS[size])}>{body}</p>
      {(action !== undefined && action !== null) || onAction ? (
        <div className="mt-5">
          {action ?? (
            <Button onClick={onAction} size={size === "sm" ? "sm" : "md"}>
              {ctaLabel}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
