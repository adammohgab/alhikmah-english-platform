/* Decorative stickers for the system pages, drawn with the arcade recipe: flat fills in
   world colors under 3px ink outlines with round joins. All aria-hidden: titles carry the
   meaning. */

const INK = "#1A1530";

interface MotifProps {
  size?: number;
}

export function OfflineMotif({ size = 160 }: MotifProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className="overflow-visible"
    >
      <circle
        cx="60"
        cy="60"
        r="50"
        fill="var(--world-tint,#fff1e3)"
        stroke={INK}
        strokeWidth="3"
      />
      <path
        d="M26 52 C46 34 74 34 94 52 M38 64 C52 52 68 52 82 64 M50 76 C56 71 64 71 70 76"
        fill="none"
        stroke={INK}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <circle cx="60" cy="88" r="5" fill={INK} />
      <path d="M26 98 L96 22" stroke={INK} strokeWidth="11" strokeLinecap="round" />
      <path d="M26 98 L96 22" stroke="#F2566A" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function MaintenanceMotif({ size = 160 }: MotifProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className="overflow-visible"
    >
      <g transform="translate(44 50)">
        <path
          d="M-6 -34 H6 L9 -26 L18 -30 L26 -22 L22 -13 L30 -9 V3 L22 7 L26 16 L18 24 L9 20 L6 28 H-6 L-9 20 L-18 24 L-26 16 L-22 7 L-30 3 V-9 L-22 -13 L-26 -22 L-18 -30 L-9 -26 Z"
          fill="var(--world-main,#ffb84d)"
          stroke={INK}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <circle cx="0" cy="-3" r="10" fill="#fff" stroke={INK} strokeWidth="3" />
      </g>
      <g transform="rotate(40 82 78)">
        <rect
          x="76"
          y="48"
          width="12"
          height="58"
          rx="6"
          fill="#4DB8FF"
          stroke={INK}
          strokeWidth="3"
        />
        <path
          d="M70 20 H94 V30 C94 40 88 46 82 46 C76 46 70 40 70 30 Z"
          fill="#4DB8FF"
          stroke={INK}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <rect
          x="79"
          y="16"
          width="6"
          height="18"
          fill="var(--world-tint,#fff1e3)"
          stroke={INK}
          strokeWidth="2.5"
        />
      </g>
    </svg>
  );
}

export function LockMotif({ size = 160 }: MotifProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className="overflow-visible"
    >
      <path
        d="M38 54 V40 C38 26 48 16 60 16 C72 16 82 26 82 40 V54"
        fill="none"
        stroke={INK}
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M38 54 V40 C38 26 48 16 60 16 C72 16 82 26 82 40 V54"
        fill="none"
        stroke="#fff"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <rect
        x="24"
        y="50"
        width="72"
        height="56"
        rx="12"
        fill="var(--world-main,#ffb84d)"
        stroke={INK}
        strokeWidth="3"
      />
      <circle cx="60" cy="74" r="8" fill={INK} />
      <path d="M60 78 V92" stroke={INK} strokeWidth="6" strokeLinecap="round" />
      <path
        d="M96 18 L104 26 L96 34 M14 70 L22 74 L16 82"
        fill="none"
        stroke={INK}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
