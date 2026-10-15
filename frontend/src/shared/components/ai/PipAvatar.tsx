import { cn } from "@/shared/lib/utils/cn";

/* Pip, the curious owl (AI Tutor / Copilot mascot). A small inline SVG that follows the active
   color world, so there is no image to load. Decorative: the message text carries the meaning.
   `thinking` raises the brows and gently pulses (motion-safe only). */

export interface PipAvatarProps {
  /** Pixel size of the square avatar. Default 40. */
  size?: number | undefined;
  thinking?: boolean | undefined;
  className?: string | undefined;
}

export function PipAvatar({ size = 40, thinking = false, className }: PipAvatarProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0 text-stroke", thinking && "motion-safe:animate-pulse", className)}
    >
      <path
        d="M8 14 L6 4 L15 9 M32 14 L34 4 L25 9"
        fill="var(--world-soft,#ffd93d)"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <ellipse
        cx="20"
        cy="23"
        rx="14"
        ry="14"
        fill="var(--world-main,#ffb84d)"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <ellipse cx="20" cy="29" rx="7" ry="6" fill="var(--world-soft,#ffd93d)" opacity="0.9" />
      <circle cx="14" cy="20" r="5" fill="#fff" stroke="currentColor" strokeWidth="2" />
      <circle cx="26" cy="20" r="5" fill="#fff" stroke="currentColor" strokeWidth="2" />
      <circle cx="14.8" cy={thinking ? 18.6 : 20.4} r="2" fill="currentColor" />
      <circle cx="26.8" cy={thinking ? 18.6 : 20.4} r="2" fill="currentColor" />
      <path
        d="M17.5 24.5 L20 28 L22.5 24.5 Z"
        fill="var(--world-deep,#e07a2e)"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
