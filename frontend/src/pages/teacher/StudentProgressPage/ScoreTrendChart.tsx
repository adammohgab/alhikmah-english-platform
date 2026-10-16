import type { TrendPoint } from "./rules";

/* ========================================
   Score trajectory chart (TC-08). A dependency-free SVG line chart: scores 0-100 over the
   student's last assessments, oldest to newest. A hidden table gives screen readers the data.
   ======================================== */

const W = 560;
const H = 220;
const PAD = { top: 16, right: 20, bottom: 28, left: 40 };
const GRID = [0, 25, 50, 75, 100];

export function ScoreTrendChart({ points }: { points: TrendPoint[] }) {
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) =>
    PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (score: number) => PAD.top + innerH - (Math.min(100, Math.max(0, score)) / 100) * innerH;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.scorePct)}`).join(" ");
  const summary = points.map((p) => `${p.label} ${Math.round(p.scorePct)} percent`).join(", ");

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Score trajectory. ${summary}`}
        className="h-auto w-full"
      >
        {GRID.map((g) => (
          <g key={g}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(g)}
              y2={y(g)}
              stroke="var(--world-deep, #8f4300)"
              strokeOpacity={g === 0 ? 1 : 0.2}
              strokeWidth={g === 0 ? 2 : 1}
            />
            <text
              x={PAD.left - 8}
              y={y(g) + 4}
              textAnchor="end"
              fontSize="11"
              fill="currentColor"
              className="text-muted"
            >
              {g}
            </text>
          </g>
        ))}
        {points.length > 1 && (
          <path
            d={path}
            fill="none"
            stroke="#1A1530"
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {points.map((p, i) => (
          <circle
            key={`${p.label}-${i}`}
            cx={x(i)}
            cy={y(p.scorePct)}
            r={6}
            fill="var(--world-main, #ffb84d)"
            stroke="#1A1530"
            strokeWidth={2}
          >
            <title>{`${p.label}: ${Math.round(p.scorePct)}%`}</title>
          </circle>
        ))}
      </svg>
      <table className="sr-only">
        <caption>Scores of the last {points.length} assessments, oldest first</caption>
        <thead>
          <tr>
            <th scope="col">Assessment</th>
            <th scope="col">Score</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={`${p.label}-${i}`}>
              <td>{p.label}</td>
              <td>{Math.round(p.scorePct)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
