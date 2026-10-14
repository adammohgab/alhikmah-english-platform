import { forwardRef, useState } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { User } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";
import { LevelRing } from "@/shared/components/ui/LevelRing";
import { WORLD_IDS, type WorldId } from "@/shared/hooks/useWorld";

/* ========================================
   Arcade Avatar (GLOBAL-STYLES-SPEC §6.2 "Avatar: circle", §10 "Avatar", §11 "Characters")

   One circle, three faces, chosen in this order:
     mascot    `mascot="pip"` (the AI Tutor) or `"nova"` (the helper): inline SVG stickers
     image     `src`, a student avatar or a teacher photo
     initials  from `name`, on a color taken from a world; with no `name`, a person glyph

   A broken or empty `src` falls back to the initials without any flash: the initials sit under
   the image, the image fades in only once it has loaded, and an error hides it.

   Every face has a solid 2px ink circular border. With `progress` the avatar is wrapped in a
   LevelRing, and that border is what separates the ring from the content. `status` adds an
   online, offline or away dot at the bottom right, shape-coded as well as colored.

   Fills read the live world variables, so the avatar follows the current world and morphs with
   it; `world` pins it. Initials without `world` take a world from a hash of the name, so a person
   always gets the same color.
   ======================================== */

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
export type AvatarMascot = "pip" | "nova";
export type AvatarStatus = "online" | "offline" | "away";

export interface AvatarProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /** `xs` 24px, `sm` 32px, `md` 44px, `lg` 64px, `xl` 96px. The ring adds to this. Default `md`. */
  size?: AvatarSize | undefined;
  /** Image URL. A broken or empty URL shows the initials. */
  src?: string | null | undefined;
  /** Person name. Source of the initials and the color, and the accessible name. */
  name?: string | undefined;
  /** Shows a mascot instead of an image or initials. */
  mascot?: AvatarMascot | undefined;
  /** Presence dot. */
  status?: AvatarStatus | undefined;
  /** Spoken status. Pass the translated word. Defaults to "Online", "Offline" or "Away". */
  statusLabel?: string | undefined;
  /** Level progress, 0 to 100. Wraps the avatar in a LevelRing. */
  progress?: number | undefined;
  /** Accessible name of the ring. Default "<name>, level progress". */
  progressLabel?: string | undefined;
  /** Pins the avatar to one world instead of the current one. */
  world?: WorldId | undefined;
}

interface SizeStyle {
  px: number;
  box: string;
  text: string;
  /** Initials shown: the smallest avatar has room for one letter. */
  letters: 1 | 2;
  icon: number;
  dot: number;
}

const SIZE_STYLES: Record<AvatarSize, SizeStyle> = {
  xs: { px: 24, box: "h-6 w-6", text: "text-[12px]", letters: 1, icon: 12, dot: 8 },
  sm: { px: 32, box: "h-8 w-8", text: "text-[12px]", letters: 2, icon: 16, dot: 10 },
  md: { px: 44, box: "h-11 w-11", text: "text-[15px]", letters: 2, icon: 22, dot: 12 },
  lg: { px: 64, box: "h-16 w-16", text: "text-[22px]", letters: 2, icon: 32, dot: 14 },
  xl: { px: 96, box: "h-24 w-24", text: "text-[32px]", letters: 2, icon: 48, dot: 18 },
};

const MASCOT_NAMES: Record<AvatarMascot, string> = { pip: "Pip", nova: "Nova" };
const STATUS_LABELS: Record<AvatarStatus, string> = {
  online: "Online",
  offline: "Offline",
  away: "Away",
};

/* Spec §3.3 semantic fills for online and away; offline is an empty (paper) dot. */
const STATUS_FILL: Record<AvatarStatus, string> = {
  online: "bg-[#1FBF7A]",
  away: "bg-[#FFB020]",
  offline: "bg-surface-0",
};

const FACE_BASE =
  "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full border-2 border-stroke font-heading font-bold leading-none text-stroke";

const FADE =
  "transition-opacity duration-200 motion-reduce:transition-none [[data-effects-tier=low]_&]:transition-none";

/* ---------- Initials ---------- */

/** First letter or digit of the first and last word. Works for any script, Arabic included. */
function getInitials(name: string, letters: 1 | 2): string {
  const marks = name
    .trim()
    .split(/\s+/)
    .map((word) => Array.from(word).find((char) => /[\p{L}\p{N}]/u.test(char)))
    .filter((mark): mark is string => mark !== undefined);
  const first = marks[0];
  const last = marks[marks.length - 1];
  if (first === undefined || last === undefined) return "";
  const text = letters === 1 || marks.length === 1 ? first : first + last;
  return text.toLocaleUpperCase();
}

/** Stable world for a name, so a person keeps the same color everywhere. */
function worldForName(name: string): WorldId {
  let hash = 5381;
  for (const char of name.trim().toLowerCase()) {
    hash = (hash * 33 + (char.codePointAt(0) ?? 0)) % 2147483647;
  }
  return WORLD_IDS[hash % WORLD_IDS.length] ?? "amber";
}

/* ---------- Mascots (original sticker art: chunky shapes, ink outline, flat fill) ---------- */

function starPoints(cx: number, cy: number, outer: number, inner: number, spikes: number): string {
  const points: string[] = [];
  for (let i = 0; i < spikes * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI * i) / spikes - Math.PI / 2;
    points.push(
      `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`,
    );
  }
  return points.join(" ");
}

const NOVA_POINTS = starPoints(32, 34, 27, 15, 5);

/** Pip, the AI Tutor: a small chip-headed helper with an antenna spark. */
function PipMascot() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 64 64"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-full w-full"
    >
      <g transform="translate(0 3)" strokeWidth="3" className="stroke-stroke">
        <path d="M32 11v7" fill="none" />
        <circle cx="32" cy="8.5" r="3.5" className="fill-[var(--world-pop,#2fd6a3)]" />
        <rect
          x="7"
          y="30"
          width="6"
          height="11"
          rx="3"
          className="fill-[var(--world-pop,#2fd6a3)]"
        />
        <rect
          x="51"
          y="30"
          width="6"
          height="11"
          rx="3"
          className="fill-[var(--world-pop,#2fd6a3)]"
        />
        <rect
          x="12"
          y="18"
          width="40"
          height="34"
          rx="14"
          className="fill-[var(--world-main,#ffb84d)]"
        />
        <rect
          x="18"
          y="26"
          width="28"
          height="19"
          rx="9"
          strokeWidth="2.5"
          className="fill-surface-0"
        />
        <circle cx="26" cy="35" r="3" strokeWidth="0" className="fill-stroke" />
        <circle cx="38" cy="35" r="3" strokeWidth="0" className="fill-stroke" />
        <circle cx="27" cy="34" r="1" strokeWidth="0" className="fill-surface-0" />
        <circle cx="39" cy="34" r="1" strokeWidth="0" className="fill-surface-0" />
        <path d="M28 40.5q4 3.5 8 0" fill="none" strokeWidth="2.5" />
      </g>
    </svg>
  );
}

/** Nova, the helper: a friendly five-point star. */
function NovaMascot() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 64 64"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-full w-full"
    >
      <g strokeWidth="3" className="stroke-stroke">
        <polygon points={NOVA_POINTS} className="fill-[var(--world-pop,#2fd6a3)]" />
        <circle
          cx="24"
          cy="40"
          r="2.6"
          strokeWidth="0"
          className="fill-[var(--world-main,#ffb84d)]"
        />
        <circle
          cx="40"
          cy="40"
          r="2.6"
          strokeWidth="0"
          className="fill-[var(--world-main,#ffb84d)]"
        />
        <circle cx="27" cy="35" r="2.6" strokeWidth="0" className="fill-stroke" />
        <circle cx="37" cy="35" r="2.6" strokeWidth="0" className="fill-stroke" />
        <path d="M29 40q3 3 6 0" fill="none" strokeWidth="2.5" />
      </g>
    </svg>
  );
}

/* ---------- Status dot ---------- */

function StatusDot({ status, diameter }: { status: AvatarStatus; diameter: number }) {
  // The dot's center sits on the circle edge at 45 degrees: 14.6% in from the corner.
  const offset = `calc(14.6% - ${diameter / 2}px)`;
  const style: CSSProperties = { width: diameter, height: diameter, right: offset, bottom: offset };
  // Too small for a mark inside; color and fill still differ.
  const showMark = diameter >= 12 && status !== "online";

  return (
    <span
      aria-hidden="true"
      data-status={status}
      style={style}
      className={cn(
        "pointer-events-none absolute flex items-center justify-center rounded-full border-2 border-stroke",
        STATUS_FILL[status],
      )}
    >
      {showMark && (
        <svg viewBox="0 0 10 10" className="h-full w-full" fill="none" strokeLinecap="round">
          {status === "away" ? (
            <path d="M5 2.6V5h2" strokeWidth="1.4" className="stroke-stroke" />
          ) : (
            <path d="M3 5h4" strokeWidth="1.4" className="stroke-stroke" />
          )}
        </svg>
      )}
    </span>
  );
}

/* ---------- Avatar ---------- */

export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(function Avatar(
  {
    size = "md",
    src,
    name,
    mascot,
    status,
    statusLabel,
    progress,
    progressLabel,
    world,
    className,
    ...rest
  },
  ref,
) {
  const sizeStyle = SIZE_STYLES[size];
  const [imageState, setImageState] = useState<{ src: string; ok: boolean } | null>(null);

  const trimmedName = name?.trim() ?? "";
  const imageSrc = typeof src === "string" && src.trim() !== "" ? src : undefined;
  const imageFailed = imageSrc !== undefined && imageState?.src === imageSrc && !imageState.ok;
  const imageLoaded = imageSrc !== undefined && imageState?.src === imageSrc && imageState.ok;
  // The image is shown unless a mascot is chosen or this exact URL already failed.
  const visibleImage = mascot === undefined && !imageFailed ? imageSrc : undefined;

  const initials = trimmedName === "" ? "" : getInitials(trimmedName, sizeStyle.letters);
  // A world is chosen from the name only when the caller did not pin one.
  const faceWorld = world ?? (trimmedName === "" ? undefined : worldForName(trimmedName));

  const personName = mascot === undefined ? trimmedName : trimmedName || MASCOT_NAMES[mascot];
  const statusText = status === undefined ? "" : (statusLabel ?? STATUS_LABELS[status]);
  const imageLabel = [personName, statusText].filter((part) => part !== "").join(", ");
  const ringLabel =
    progressLabel ?? (personName === "" ? undefined : `${personName}, level progress`);

  let content: ReactNode;
  if (mascot !== undefined) {
    content = mascot === "pip" ? <PipMascot /> : <NovaMascot />;
  } else {
    content = (
      <>
        {initials === "" ? (
          <User aria-hidden="true" size={sizeStyle.icon} strokeWidth={2.5} />
        ) : (
          !imageLoaded && <span aria-hidden="true">{initials}</span>
        )}
        {visibleImage !== undefined && (
          <img
            key={visibleImage}
            src={visibleImage}
            alt=""
            draggable={false}
            loading="lazy"
            decoding="async"
            onLoad={() => {
              setImageState({ src: visibleImage, ok: true });
            }}
            onError={() => {
              setImageState({ src: visibleImage, ok: false });
            }}
            className={cn(
              "absolute inset-0 h-full w-full object-cover",
              FADE,
              imageLoaded ? "opacity-100" : "opacity-0",
            )}
          />
        )}
      </>
    );
  }

  const face = (
    <span
      data-world={mascot === undefined ? faceWorld : undefined}
      className={cn(
        FACE_BASE,
        sizeStyle.box,
        sizeStyle.text,
        mascot === undefined ? "bg-[var(--world-main,#ffb84d)]" : "bg-[var(--world-tint,#fff1e3)]",
      )}
    >
      {content}
    </span>
  );

  const labelled = imageLabel !== "";
  const rootProps =
    progress === undefined
      ? {
          role: labelled ? "img" : undefined,
          "aria-label": labelled ? imageLabel : undefined,
          "aria-hidden": labelled ? undefined : true,
        }
      : {};

  return (
    <span
      ref={ref}
      {...rootProps}
      {...rest}
      data-world={world}
      className={cn("relative inline-flex shrink-0 align-middle", className)}
    >
      {progress === undefined ? (
        face
      ) : (
        <LevelRing value={progress} size={sizeStyle.px} label={ringLabel}>
          {face}
        </LevelRing>
      )}
      {status !== undefined && <StatusDot status={status} diameter={sizeStyle.dot} />}
      {progress !== undefined && statusText !== "" && <span className="sr-only">{statusText}</span>}
    </span>
  );
});
