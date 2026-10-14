import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/utils/cn";
import type { WorldId } from "@/shared/hooks/useWorld";

/* ========================================
   Squiggle (GLOBAL-STYLES-SPEC §5.3 "highlighter swash", §7 decoration kit, §8.3 "Draw")

   A hand-drawn mark that DRAWS itself under or around a key word: a wavy or zigzag underline,
   a loose circle, or a thick highlighter swash behind the text. One SVG path, drawn with
   `stroke-dashoffset` (the path is normalised with `pathLength="1"`, so the dash math is
   independent of its real length).

   Text flow: the word is an inline-block with the SVG absolutely positioned, so the mark takes
   no space (no layout shift), never pushes the surrounding text, ignores the pointer and
   leaves the text selectable. Keep it to a short, single-line phrase: the word does not wrap.

   Performance: the path is built in real pixels from the measured word, rebuilt only on
   resize, and drawn once, when it first scrolls into view. The draw transitions a single
   property on one small path and is the only animation here. It is not compositor-accelerated
   (spec §8.2 allows stroke-dashoffset for exactly this), so the path stays tiny.

   Motion is throttled in CSS, with no provider required: `prefers-reduced-motion: reduce` and
   the low effects tier (EffectsProvider sets data-effects-tier on <html>) both show the mark
   fully drawn at once, with no animation.
   ======================================== */

export type SquiggleVariant = "underline" | "wavy" | "zigzag" | "circle" | "highlight";
export type SquiggleTone = "main" | "soft" | "pop" | "deep";

export interface SquiggleProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /** The key word or short phrase to mark. */
  children: ReactNode;
  /** `highlight` is drawn behind the text; every other variant is drawn on top. Default `wavy`. */
  variant?: SquiggleVariant | undefined;
  /** World color of the mark. Defaults: `soft` for highlight, `pop` for the rest. */
  tone?: SquiggleTone | undefined;
  /** Pins the mark to one world instead of the current one. */
  world?: WorldId | undefined;
  /** Line width in px. Defaults to about 12% of the font size (the swash: 55% of the line). */
  thickness?: number | undefined;
  /** Draw time in ms (spec "slow" is 480, "epic" is 900). Default 480. */
  duration?: number | undefined;
  /** Wait before drawing, in ms. Default 0. */
  delay?: number | undefined;
  /** Start when scrolled into view (default) or right at mount. */
  drawOn?: "view" | "mount" | undefined;
}

/* Fills read the live world variables (they morph with the theme); fallbacks match tokens.css. */
const TONE_COLOR: Record<SquiggleTone, string> = {
  main: "var(--world-main, #ffb84d)",
  soft: "var(--world-soft, #ffd93d)",
  pop: "var(--world-pop, #2fd6a3)",
  deep: "var(--world-deep, #8f4300)",
};

/* Spec §8.2 "glide" (power3.out) as a CSS curve: fast start, long soft landing. */
const DRAW_EASE = "cubic-bezier(0.215, 0.61, 0.355, 1)";

/*
 * Reduced motion and the low tier: the mark is simply there, fully drawn. The transition is
 * cancelled too, or a tier or OS change while the page is open would still animate to 0.
 */
const INSTANT =
  "motion-reduce:![stroke-dashoffset:0] motion-reduce:!transition-none [[data-effects-tier=low]_&]:![stroke-dashoffset:0] [[data-effects-tier=low]_&]:!transition-none";

/* ---------- Path geometry ---------- */

interface Metrics {
  width: number;
  height: number;
  fontSize: number;
}

interface Mark {
  d: string;
  /** Position and size of the SVG relative to the word's box. */
  left: number;
  top: number;
  width: number;
  height: number;
  strokeWidth: number;
  behind: boolean;
}

/** Number to at most one decimal, without a trailing ".0", to keep the path string short. */
function n(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/** Wavy and zigzag underlines and the plain underline live in a band under the baseline. */
function linearMark(variant: "underline" | "wavy" | "zigzag", m: Metrics, thickness: number): Mark {
  const band = Math.max(6, Math.round(m.fontSize * 0.4));
  const mid = band / 2;
  const amplitude = Math.max(0.5, Math.min(band * 0.28, mid - thickness / 2));
  const x0 = thickness / 2;
  const x1 = Math.max(x0 + 1, m.width - thickness / 2);
  const run = x1 - x0;

  let d: string;
  if (variant === "wavy") {
    const count = Math.max(2, Math.round(run / (band * 0.9)));
    const step = run / count;
    d = `M${n(x0)} ${n(mid)}`;
    for (let i = 0; i < count; i += 1) {
      const controlX = n(x0 + (i + 0.5) * step);
      const controlY = n(mid + (i % 2 === 0 ? -amplitude * 2 : amplitude * 2));
      d += `Q${controlX} ${controlY} ${n(x0 + (i + 1) * step)} ${n(mid)}`;
    }
  } else if (variant === "zigzag") {
    const count = Math.max(2, Math.round(run / (band * 0.7)));
    const step = run / count;
    d = `M${n(x0)} ${n(mid - amplitude)}`;
    for (let i = 1; i <= count; i += 1) {
      d += `L${n(x0 + i * step)} ${n(mid + (i % 2 === 1 ? amplitude : -amplitude))}`;
    }
  } else {
    // A loose, slightly bowed line, as if drawn by hand in one stroke.
    d =
      `M${n(x0)} ${n(mid + amplitude * 0.3)}` +
      `Q${n(x0 + run * 0.25)} ${n(mid - amplitude * 0.8)} ${n(x0 + run * 0.5)} ${n(mid)}` +
      `T${n(x1)} ${n(mid - amplitude * 0.3)}`;
  }

  return {
    d,
    left: 0,
    top: m.height - band * 0.6,
    width: m.width,
    height: band,
    strokeWidth: thickness,
    behind: false,
  };
}

/** A loose, slightly spiralling loop, a little more than one turn, around the whole word. */
function circleMark(m: Metrics, thickness: number): Mark {
  const pad = Math.round(m.fontSize * 0.3);
  const width = m.width + pad * 2;
  const height = m.height + pad * 2;
  const points = 30;
  // Largest radius factor is 1.07 * 1.025, so dividing by 1.12 keeps the stroke inside the SVG.
  const rx = (width / 2 - thickness) / 1.12;
  const ry = (height / 2 - thickness) / 1.12;

  const at = (k: number): [number, number] => {
    const angle = -Math.PI * 0.65 + (k / points) * Math.PI * 2 * 1.12;
    const scale = (1 + 0.07 * (k / points)) * (1 + 0.025 * Math.sin(angle * 3));
    return [width / 2 + rx * scale * Math.cos(angle), height / 2 + ry * scale * Math.sin(angle)];
  };

  const [startX, startY] = at(0);
  let d = `M${n(startX)} ${n(startY)}`;
  for (let k = 1; k < points; k += 1) {
    const [cx, cy] = at(k);
    const [nx, ny] = at(k + 1);
    d += `Q${n(cx)} ${n(cy)} ${n((cx + nx) / 2)} ${n((cy + ny) / 2)}`;
  }
  const [endX, endY] = at(points);
  d += `L${n(endX)} ${n(endY)}`;

  return { d, left: -pad, top: -pad, width, height, strokeWidth: thickness, behind: false };
}

/** One thick, round-capped stroke across the lower part of the word, behind the text. */
function highlightMark(m: Metrics, thickness: number): Mark {
  const padX = Math.round(m.fontSize * 0.15);
  const width = m.width + padX * 2;
  const y = m.height * 0.62;
  const x0 = thickness / 2;
  const x1 = Math.max(x0 + 1, width - thickness / 2);
  const run = x1 - x0;
  const d =
    `M${n(x0)} ${n(y + 1)}` +
    `Q${n(x0 + run * 0.3)} ${n(y - 3)} ${n(x0 + run * 0.55)} ${n(y + 1)}` +
    `T${n(x1)} ${n(y - 1)}`;
  return { d, left: -padX, top: 0, width, height: m.height, strokeWidth: thickness, behind: true };
}

function buildMark(
  variant: SquiggleVariant,
  m: Metrics,
  thickness: number | undefined,
): Mark | null {
  if (m.width <= 0 || m.height <= 0) return null;
  const line = thickness ?? Math.max(2, Math.round(m.fontSize * 0.12));
  if (variant === "circle") return circleMark(m, line);
  if (variant === "highlight") return highlightMark(m, thickness ?? Math.round(m.height * 0.55));
  return linearMark(variant, m, line);
}

/* ---------- Component ---------- */

export const Squiggle = forwardRef<HTMLSpanElement, SquiggleProps>(function Squiggle(
  {
    children,
    variant = "wavy",
    tone,
    world,
    thickness,
    duration = 480,
    delay = 0,
    drawOn = "view",
    className,
    ...rest
  },
  forwardedRef,
) {
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const [metrics, setMetrics] = useState<Metrics>({ width: 0, height: 0, fontSize: 0 });
  const [drawn, setDrawn] = useState(false);

  const setRefs = (node: HTMLSpanElement | null) => {
    rootRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  // Measure before paint, then follow the word. offsetWidth ignores ancestor transforms.
  useLayoutEffect(() => {
    const element = rootRef.current;
    if (!element) return;

    const measure = () => {
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      const fontSize = parseFloat(getComputedStyle(element).fontSize) || 16;
      setMetrics((previous) =>
        previous.width === width && previous.height === height && previous.fontSize === fontSize
          ? previous
          : { width, height, fontSize },
      );
    };
    measure();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  const mark = useMemo(() => buildMark(variant, metrics, thickness), [variant, metrics, thickness]);
  const ready = mark !== null;

  // Draw once: when first scrolled into view (or at mount). Two frames after the hidden path has
  // painted, so the browser sees a real change from "undrawn" to "drawn" and transitions it.
  useEffect(() => {
    const element = rootRef.current;
    if (drawn || !ready || !element) return;

    let first = 0;
    let second = 0;
    let observer: IntersectionObserver | undefined;
    const start = () => {
      first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => {
          setDrawn(true);
        });
      });
    };

    if (drawOn === "mount" || typeof IntersectionObserver === "undefined") {
      start();
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer?.disconnect();
            start();
          }
        },
        { threshold: 0.5 },
      );
      observer.observe(element);
    }

    return () => {
      observer?.disconnect();
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [drawn, ready, drawOn]);

  const color = TONE_COLOR[tone ?? (variant === "highlight" ? "soft" : "pop")];

  return (
    <span
      ref={setRefs}
      {...rest}
      data-world={world}
      className={cn("relative isolate inline-block whitespace-nowrap align-baseline", className)}
    >
      {children}
      {mark !== null && (
        <svg
          aria-hidden="true"
          focusable="false"
          width={mark.width}
          height={mark.height}
          viewBox={`0 0 ${mark.width} ${mark.height}`}
          className="pointer-events-none absolute overflow-visible"
          style={{
            left: mark.left,
            top: mark.top,
            zIndex: mark.behind ? -1 : undefined,
          }}
        >
          <path
            d={mark.d}
            pathLength={1}
            fill="none"
            strokeWidth={mark.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="1 1"
            className={INSTANT}
            style={{
              stroke: color,
              strokeDashoffset: drawn ? 0 : 1,
              transition: `stroke-dashoffset ${duration}ms ${DRAW_EASE} ${delay}ms`,
            }}
          />
        </svg>
      )}
    </span>
  );
});
