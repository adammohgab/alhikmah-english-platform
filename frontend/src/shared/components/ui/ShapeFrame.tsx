import { forwardRef, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/utils/cn";

/* ========================================
   ShapeFrame (GLOBAL-STYLES-SPEC §6.2 shape vocabulary, §6.3 "ShapeFrame technique")

   clip-path removes outlines and shadows, so non-rectangular shapes are drawn as ONE inline SVG
   behind the content instead: a shadow layer (the same path, offset by the shadow token), then
   the fill layer with an ink stroke. The stroke is the outline, so it survives any edge shape.
   Four edges: wavy, scalloped (outward bumps), ticket (circular cut-outs down both sides) and
   stamp (a perforated edge on all four sides).

   The path is built in real pixels from the measured box, so bumps and notches keep their
   size at any width or height instead of stretching. It is rebuilt only when the box
   resizes, never during animation, and stays a few hundred bytes of arcs and curves.
   The frame is static, so there is nothing for reduced motion or the effects tier to throttle.
   The SVG is aria-hidden and ignores the pointer; children stay normal, selectable DOM.
   ======================================== */

export type ShapeFrameShape = "wavy" | "scalloped" | "ticket" | "stamp";
/** Spec §6.1 outline tokens: 1 is 2px, 2 is 3px (default), 3 is 4px. */
export type ShapeFrameStroke = 1 | 2 | 3;
/** Spec §6.1 hard shadow tokens: xs 2px, sm 3px, md 5px, lg 8px. */
export type ShapeFrameShadow = "none" | "xs" | "sm" | "md" | "lg";

export interface ShapeFrameProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  children?: ReactNode;
  /** Edge style. Default `scalloped`. */
  shape?: ShapeFrameShape | undefined;
  /** Size of one bump, wave or notch in px. Clamped to fit small boxes. Default 8. */
  edgeSize?: number | undefined;
  /** Outline token. Default 2 (3px). */
  stroke?: ShapeFrameStroke | undefined;
  /** Hard shadow token, down and to the right. Default `sm`. */
  shadow?: ShapeFrameShadow | undefined;
  /** Fill of the shape: any CSS color, e.g. `var(--world-soft)`. Default white paper. */
  fill?: string | undefined;
  /** Shadow color. Default ink; use the world `deep` on large tinted panels (spec §6.1). */
  shadowColor?: string | undefined;
  /**
   * Also clips the children to the shape (CSS clip-path). Off by default because a clip hides
   * the focus ring of focusable children near the edge; the content is already inset to stay
   * clear of the edge.
   */
  clipContent?: boolean | undefined;
}

const STROKE_PX: Record<ShapeFrameStroke, number> = { 1: 2, 2: 3, 3: 4 };
const SHADOW_PX: Record<ShapeFrameShadow, number> = { none: 0, xs: 2, sm: 3, md: 5, lg: 8 };

/* How far each edge style bulges past its baseline, as a fraction of the edge size. */
const OUTWARD_REACH: Record<ShapeFrameShape, number> = {
  wavy: 0.5,
  scalloped: 1,
  ticket: 0,
  stamp: 0,
};

/* ---------- Path geometry ---------- */

interface Point {
  x: number;
  y: number;
}

/** Number to at most one decimal, without a trailing ".0", to keep the path string short. */
function n(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/**
 * A side of the frame, walked clockwise from `from` to `to`. `at(s, t)` is the point `s` px
 * along the side and `t` px outward from it (negative is inward). Corners are walked in the
 * order top-left, top-right, bottom-right, bottom-left, so for a direction (dx, dy) the outward
 * normal is (dy, -dx).
 */
function makeSide(from: Point, to: Point) {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const dx = (to.x - from.x) / length;
  const dy = (to.y - from.y) / length;
  const at = (s: number, t: number): string =>
    `${n(from.x + dx * s + dy * t)} ${n(from.y + dy * s - dx * t)}`;
  return { length, at, end: at(length, 0) };
}

type Side = ReturnType<typeof makeSide>;

/** Wave: quadratic bumps that alternate outward and inward; peak height is `amplitude`. */
function wavySide(side: Side, edge: number): string {
  const amplitude = edge / 2;
  const count = Math.max(2, Math.round(side.length / (edge * 1.5)));
  const step = side.length / count;
  let commands = "";
  for (let i = 0; i < count; i += 1) {
    const control = side.at((i + 0.5) * step, i % 2 === 0 ? amplitude * 2 : -amplitude * 2);
    commands += `Q${control} ${side.at((i + 1) * step, 0)}`;
  }
  return commands;
}

/** Scallops: semicircles bulging outward. Radius never exceeds `edge`, so they stay in the box. */
function scallopSide(side: Side, edge: number): string {
  const count = Math.max(1, Math.ceil(side.length / (edge * 2)));
  const radius = side.length / count / 2;
  let commands = "";
  for (let i = 1; i <= count; i += 1) {
    commands += `A${n(radius)} ${n(radius)} 0 0 1 ${side.at(i * radius * 2, 0)}`;
  }
  return commands;
}

/** Notches: semicircular bites into the shape, evenly spaced with a margin at each corner. */
function notchSide(side: Side, radius: number, pitch: number): string {
  const margin = radius * 1.6;
  const room = side.length - margin * 2;
  const count = Math.max(0, Math.floor(room / pitch));
  if (count === 0) return `L${side.end}`;
  const spacing = room / count;
  let commands = "";
  for (let i = 0; i < count; i += 1) {
    const centre = margin + (i + 0.5) * spacing;
    const biteStart = side.at(centre - radius, 0);
    const biteEnd = side.at(centre + radius, 0);
    commands += `L${biteStart}A${n(radius)} ${n(radius)} 0 0 0 ${biteEnd}`;
  }
  return `${commands}L${side.end}`;
}

/** The closed path for a `width` x `height` box whose outline stroke is `stroke` px wide. */
// eslint-disable-next-line react-refresh/only-export-components -- Exported pure geometry helper for ShapeFrame.
export function buildShapePath(
  shape: ShapeFrameShape,
  width: number,
  height: number,
  edgeSize: number,
  stroke: number,
): string {
  if (width <= 0 || height <= 0) return "";
  const edge = Math.max(2, Math.min(edgeSize, width / 6, height / 6));
  const half = stroke / 2;

  // Bumps reach outward from the baseline; notches only cut inward.
  const inset = half + OUTWARD_REACH[shape] * edge;
  const left = inset;
  const top = inset;
  const right = width - inset;
  const bottom = height - inset;

  const corners: Point[] = [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];

  let path = `M${n(left)} ${n(top)}`;
  for (let i = 0; i < 4; i += 1) {
    const from = corners[i];
    const to = corners[(i + 1) % 4];
    if (from === undefined || to === undefined) continue;
    const side = makeSide(from, to);
    const horizontal = i % 2 === 0;
    if (shape === "wavy") path += wavySide(side, edge);
    else if (shape === "scalloped") path += scallopSide(side, edge);
    else if (shape === "stamp") path += notchSide(side, edge * 0.5, edge * 2);
    else path += horizontal ? `L${side.end}` : notchSide(side, edge, edge * 3.2);
  }
  return `${path}Z`;
}

/* How far the content must stay from the box edge so it never sits on a bump or notch. */
function contentInset(shape: ShapeFrameShape, edgeSize: number, stroke: number): number {
  const edge = Math.max(2, edgeSize);
  const depth = shape === "stamp" ? edge * 0.5 : edge;
  return Math.ceil(stroke + depth + 4);
}

/* ---------- Component ---------- */

export const ShapeFrame = forwardRef<HTMLDivElement, ShapeFrameProps>(function ShapeFrame(
  {
    children,
    shape = "scalloped",
    edgeSize = 8,
    stroke = 2,
    shadow = "sm",
    fill = "var(--surface, #ffffff)",
    shadowColor = "var(--stroke, #1a1530)",
    clipContent = false,
    className,
    ...rest
  },
  forwardedRef,
) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });

  const setRefs = (node: HTMLDivElement | null) => {
    rootRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  // Measure before paint, then follow the box. offsetWidth ignores ancestor transforms.
  useLayoutEffect(() => {
    const element = rootRef.current;
    if (!element) return;

    const measure = () => {
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      setBox((previous) =>
        previous.width === width && previous.height === height ? previous : { width, height },
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

  const strokePx = STROKE_PX[stroke];
  const shadowPx = SHADOW_PX[shadow];

  const path = useMemo(
    () => buildShapePath(shape, box.width, box.height, edgeSize, strokePx),
    [shape, box.width, box.height, edgeSize, strokePx],
  );

  const padding = contentInset(shape, edgeSize, strokePx);

  return (
    <div ref={setRefs} {...rest} className={cn("relative", className)}>
      {path !== "" && (
        <svg
          aria-hidden="true"
          focusable="false"
          width={box.width}
          height={box.height}
          viewBox={`0 0 ${box.width} ${box.height}`}
          className="pointer-events-none absolute left-0 top-0 overflow-visible"
        >
          {shadowPx > 0 && (
            <path
              d={path}
              transform={`translate(${shadowPx} ${shadowPx})`}
              fill={shadowColor}
              stroke={shadowColor}
              strokeWidth={strokePx}
              strokeLinejoin="round"
            />
          )}
          <path
            d={path}
            fill={fill}
            stroke="var(--stroke, #1a1530)"
            strokeWidth={strokePx}
            strokeLinejoin="round"
          />
        </svg>
      )}
      <div
        className="relative"
        style={{ padding, clipPath: clipContent && path !== "" ? `path("${path}")` : undefined }}
      >
        {children}
      </div>
    </div>
  );
});
