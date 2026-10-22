import { useId } from "react";
import { coverSpec, type CoverShape } from "./rules";

/* Generated cover artwork for a course card (ST-02: "generated pattern per course, not a stock
   photo"). The same seed always draws the same cover, in the colors of two of the six worlds,
   so every course is recognisable at a glance. Decorative only, hidden from assistive tech. */

export interface CourseCoverProps {
  seed: string;
  className?: string | undefined;
}

const TILE = 24;

function Tile({ shape, ink }: { shape: CoverShape; ink: string }) {
  switch (shape) {
    case "dots":
      return <circle cx={TILE / 2} cy={TILE / 2} r={4} fill={ink} />;
    case "stripes":
      return <rect x={0} y={9} width={TILE} height={6} fill={ink} />;
    case "zigzag":
      return (
        <path
          d={`M0 ${TILE - 4} L${TILE / 2} 4 L${TILE} ${TILE - 4}`}
          fill="none"
          stroke={ink}
          strokeWidth={4}
          strokeLinejoin="round"
        />
      );
    case "grid":
      return (
        <path d={`M${TILE / 2} 0 V${TILE} M0 ${TILE / 2} H${TILE}`} stroke={ink} strokeWidth={3} />
      );
    case "rings":
      return (
        <circle cx={TILE / 2} cy={TILE / 2} r={6} fill="none" stroke={ink} strokeWidth={3.5} />
      );
    case "triangles":
      return <path d={`M${TILE / 2} 4 L${TILE - 4} ${TILE - 4} L4 ${TILE - 4} Z`} fill={ink} />;
  }
}

export function CourseCover({ seed, className }: CourseCoverProps) {
  const { world, accent, shape } = coverSpec(seed);
  const patternId = useId();
  const tint = `var(--w-${world}-tint)`;
  const ink = `var(--w-${world}-main)`;
  const pop = `var(--w-${accent}-pop)`;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={className}
      viewBox="0 0 320 112"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern
          id={patternId}
          width={TILE}
          height={TILE}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-12)"
        >
          <Tile shape={shape} ink={ink} />
        </pattern>
      </defs>
      <rect width="320" height="112" fill={tint} />
      <rect width="320" height="112" fill={`url(#${patternId})`} />
      <circle cx="268" cy="30" r="34" fill={pop} stroke="#000" strokeWidth="2" />
      <circle cx="268" cy="30" r="14" fill={tint} stroke="#000" strokeWidth="2" />
    </svg>
  );
}
