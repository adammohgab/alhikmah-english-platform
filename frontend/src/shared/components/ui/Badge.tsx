import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/utils/cn";
import type { WorldId } from "@/shared/hooks/useWorld";

/* ========================================
   Arcade Badge (GLOBAL-STYLES-SPEC §6.2 "Badge", §3.3 status, §10 "Chip and tag")

   One primitive, five shapes of use:
     count   a number in a pill ("3", "99+")              notifications, unread counts
     dot     a bare notification dot                       needs aria-label
     new     a starburst sticker ("New")                   new indicator
     status  a pill with a shape-coded glyph and a label   success / danger / warning / info
     label   a plain tag                                   default

   Every badge has a solid 2px ink outline, a pill (or burst) shape and ink text.
   Colors come from the live world variables, so a badge follows the current world;
   `world` pins it to one world (skill badges always use the skill's own world, spec §3.4).
   Text is Figtree 700, sentence case, never below 12px (spec §5.2).
   ======================================== */

export type BadgeStatus = "success" | "danger" | "warning" | "info";
export type BadgeSize = "sm" | "md";
/** World fill: `main` (saturated), `soft` (pastel) or `pop` (the contrasting accent). */
export type BadgeTone = "main" | "soft" | "pop";

interface BadgeBaseProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /** `sm` is 20px tall, `md` is 24px. Default `md`. */
  size?: BadgeSize | undefined;
  /** World fill for label, count and new badges. Defaults: label `soft`, count and new `pop`. */
  tone?: BadgeTone | undefined;
  /** Ink fill with light text and a light outline, for placing on dark ("Night") surfaces. */
  inverted?: boolean | undefined;
  /** Pins the badge to one world instead of the current one. */
  world?: WorldId | undefined;
  /** Number to show. Hidden at 0 unless `showZero`. */
  count?: number | undefined;
  /** Counts above this show as `max+`. Default 99. */
  max?: number | undefined;
  showZero?: boolean | undefined;
  /** Renders the starburst "new" sticker. `children` replaces the default text "New". */
  isNew?: boolean | undefined;
}

export type BadgeProps = BadgeBaseProps &
  (
    | {
        /** A bare dot. It has no text, so it must be named. */
        dot: true;
        "aria-label": string;
        status?: undefined;
        children?: undefined;
      }
    | {
        /** Shape-coded status tag. Always carries a text label: color is never the only signal. */
        status: BadgeStatus;
        children: ReactNode;
        dot?: false | undefined;
      }
    | { status?: undefined; children?: ReactNode; dot?: false | undefined }
  );

/* Fills read the live world variables (they morph with the theme); fallbacks match tokens.css. */
const TONE_FILL: Record<BadgeTone, string> = {
  main: "bg-[var(--world-main,#ffb84d)]",
  soft: "bg-[var(--world-soft,#ffd93d)]",
  pop: "bg-[var(--world-pop,#2fd6a3)]",
};

/* Spec §3.3 semantic fills (ink text 5.3:1 or better) and their tints, used when inverted. */
const STATUS_FILL: Record<BadgeStatus, string> = {
  success: "bg-[#1FBF7A]",
  danger: "bg-[#F2566A]",
  warning: "bg-[#FFB020]",
  info: "bg-[var(--world-main,#4db8ff)]",
};
const STATUS_TINT: Record<BadgeStatus, string> = {
  success: "text-[#E3F8EE]",
  danger: "text-[#FFE9EC]",
  warning: "text-[#FFF3D6]",
  info: "text-[#E8F6FF]",
};
const STATUS_GLYPH_ON_INK: Record<BadgeStatus, string> = {
  success: "text-[#1FBF7A]",
  danger: "text-[#F2566A]",
  warning: "text-[#FFB020]",
  info: "text-[#4DB8FF]",
};

const BURST_FILL: Record<BadgeTone, string> = {
  main: "fill-[var(--world-main,#ffb84d)]",
  soft: "fill-[var(--world-soft,#ffd93d)]",
  pop: "fill-[var(--world-pop,#2fd6a3)]",
};

const SIZE_STYLES: Record<BadgeSize, { pill: string; burst: string; dot: string }> = {
  sm: { pill: "h-5 min-w-[20px] px-1.5 text-[12px]", burst: "h-10 w-10", dot: "h-2.5 w-2.5" },
  md: { pill: "h-6 min-w-[24px] px-2 text-[13px]", burst: "h-12 w-12", dot: "h-3 w-3" },
};

const PILL_BASE =
  "inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full border-2 font-body font-bold leading-none tabular-nums";

/* Hard offset shadow, down and right (spec §6.1 shadow-xs). Static: never animated. */
const SHADOW = "shadow-[2px_2px_0_0_var(--stroke,#1a1530)]";

const LIGHT_PILL = "border-stroke text-stroke";
/* Text color is kept apart so a status can supply its own tint without a competing class. */
const INVERTED_PILL =
  "border-[color:var(--world-tint,#fff1e3)] bg-stroke shadow-[2px_2px_0_0_var(--world-main,#ffb84d)]";
const INVERTED_TEXT = "text-[color:var(--world-tint,#fff1e3)]";

/* ---------- Shape geometry ---------- */

function starPoints(cx: number, cy: number, outer: number, inner: number, spikes: number): string {
  const points: string[] = [];
  for (let i = 0; i < spikes * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI * i) / spikes - Math.PI / 2;
    const x = (cx + radius * Math.cos(angle)).toFixed(2);
    const y = (cy + radius * Math.sin(angle)).toFixed(2);
    points.push(`${x},${y}`);
  }
  return points.join(" ");
}

/* 12-point starburst (spec §6.2 "burst": badges, "new", XP gains). */
const BURST_POINTS = starPoints(24, 24, 22, 17.5, 12);
/* Small jagged circle for the danger glyph (spec §3.3: danger is a zigzag sticker). */
const ZIGZAG_POINTS = starPoints(12, 12, 10.5, 8.4, 9);

/** Status glyphs differ by silhouette, not color: circle, zigzag, triangle, speech bubble. */
function StatusGlyph({
  status,
  className,
}: {
  status: BadgeStatus;
  className?: string | undefined;
}) {
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
      className={cn("h-3.5 w-3.5 shrink-0", className)}
    >
      {status === "success" && (
        <>
          <circle cx="12" cy="12" r="9.5" />
          <path d="M7.5 12.5l3 3 6-6.5" />
        </>
      )}
      {status === "danger" && (
        <>
          <polygon points={ZIGZAG_POINTS} />
          <path d="M12 7.5v5" />
          <path d="M12 16v.01" />
        </>
      )}
      {status === "warning" && (
        <>
          <path d="M12 3.5L22 20.5H2z" />
          <path d="M12 9.5v5" />
          <path d="M12 17.5v.01" />
        </>
      )}
      {status === "info" && (
        <>
          <path d="M4 4h16a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5h-7l-4.5 4v-4H4a1.5 1.5 0 0 1-1.5-1.5v-10A1.5 1.5 0 0 1 4 4z" />
          <path d="M12 8v.01" />
          <path d="M12 11.5v3.5" />
        </>
      )}
    </svg>
  );
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  {
    size = "md",
    tone,
    inverted = false,
    world,
    count,
    max = 99,
    showZero = false,
    isNew = false,
    dot,
    status,
    className,
    children,
    role,
    ...rest
  },
  ref,
) {
  const sizeStyle = SIZE_STYLES[size];
  const ariaLabel = rest["aria-label"];
  // aria-label is only allowed on an element with a role, so a named badge reads as an image.
  const resolvedRole = role ?? (ariaLabel === undefined ? undefined : "img");
  // Info is the Reading world (spec §3.3); every other badge follows `world` or the page.
  const dataWorld = status === "info" ? "sky" : world;

  /* ---- dot ---- */
  if (dot === true) {
    return (
      <span
        ref={ref}
        {...rest}
        role={resolvedRole}
        data-world={dataWorld}
        className={cn(
          "inline-block shrink-0 rounded-full border-2",
          sizeStyle.dot,
          inverted ? "border-surface-0" : "border-stroke",
          TONE_FILL[tone ?? "pop"],
          className,
        )}
      />
    );
  }

  /* ---- new: starburst sticker ---- */
  if (isNew) {
    return (
      <span
        ref={ref}
        {...rest}
        role={resolvedRole}
        data-world={dataWorld}
        className={cn(
          "relative inline-flex shrink-0 -rotate-6 items-center justify-center font-body text-[12px] font-bold leading-none text-stroke",
          size === "md" && "text-[13px]",
          sizeStyle.burst,
          className,
        )}
      >
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 48 48"
          className="absolute inset-0 h-full w-full overflow-visible"
        >
          <polygon points={BURST_POINTS} transform="translate(2 2)" fill="var(--stroke, #1a1530)" />
          <polygon
            points={BURST_POINTS}
            strokeWidth="2.5"
            strokeLinejoin="round"
            className={cn(
              inverted ? "stroke-[color:var(--world-tint,#fff1e3)]" : "stroke-stroke",
              inverted ? BURST_FILL.main : BURST_FILL[tone ?? "pop"],
            )}
          />
        </svg>
        <span className="relative">{children ?? "New"}</span>
      </span>
    );
  }

  /* ---- count ---- */
  if (count !== undefined) {
    const whole = Math.trunc(count);
    if (whole <= 0 && !showZero) return null;
    const text = whole > max ? `${max}+` : String(Math.max(0, whole));
    return (
      <span
        ref={ref}
        {...rest}
        role={resolvedRole}
        data-world={dataWorld}
        className={cn(
          PILL_BASE,
          sizeStyle.pill,
          inverted
            ? cn(INVERTED_PILL, INVERTED_TEXT)
            : cn(LIGHT_PILL, TONE_FILL[tone ?? "pop"], SHADOW),
          className,
        )}
      >
        {text}
      </span>
    );
  }

  /* ---- status tag ---- */
  if (status !== undefined) {
    return (
      <span
        ref={ref}
        {...rest}
        role={resolvedRole}
        data-world={dataWorld}
        className={cn(
          PILL_BASE,
          sizeStyle.pill,
          "pl-1.5",
          inverted
            ? cn(INVERTED_PILL, STATUS_TINT[status])
            : cn(LIGHT_PILL, STATUS_FILL[status], SHADOW),
          className,
        )}
      >
        <StatusGlyph
          status={status}
          className={inverted ? STATUS_GLYPH_ON_INK[status] : undefined}
        />
        {children}
      </span>
    );
  }

  /* ---- label ---- */
  return (
    <span
      ref={ref}
      {...rest}
      role={resolvedRole}
      data-world={dataWorld}
      className={cn(
        PILL_BASE,
        sizeStyle.pill,
        inverted
          ? cn(INVERTED_PILL, INVERTED_TEXT)
          : cn(LIGHT_PILL, TONE_FILL[tone ?? "soft"], SHADOW),
        className,
      )}
    >
      {children}
    </span>
  );
});
