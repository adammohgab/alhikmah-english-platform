import type { Bin } from "./rules";

/* ========================================
   Class score distribution (TC-18). A dependency-free SVG column chart: students per
   ten-point band, with a dashed line where the pass mark falls. A hidden table carries the data.
   ======================================== */

const W = 560;
const H = 240;
const PAD = { top: 20, right: 16, bottom: 40, left: 36 };

export function ScoreHistogram({ bins, passMark }: { bins: Bin[]; passMark: number }) {
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const max = Math.max(1, ...bins.map((b) => b.count));
  const slot = innerW / bins.length;
  const barW = slot - 8;
  const y = (count: number) => PAD.top + innerH - (count / max) * innerH;
  const passX = PAD.left + (Math.min(100, Math.max(0, passMark)) / 100) * innerW;
  const total = bins.reduce((sum, b) => sum + b.count, 0);

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Score distribution of ${total} students. Pass mark ${passMark} percent.`}
        className="h-auto w-full"
      >
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={PAD.top + innerH}
          y2={PAD.top + innerH}
          stroke="#1A1530"
          strokeWidth={2}
        />
        {bins.map((bin, i) => {
          const x = PAD.left + i * slot + 4;
          const passed = bin.from >= passMark;
          return (
            <g key={bin.label}>
              {bin.count > 0 && (
                <>
                  <rect
                    x={x}
                    y={y(bin.count)}
                    width={barW}
                    height={PAD.top + innerH - y(bin.count)}
                    rx={4}
                    fill={passed ? "var(--world-pop, #2fd6a3)" : "var(--world-main, #ffb84d)"}
                    stroke="#1A1530"
                    strokeWidth={2}
                  />
                  <text
                    x={x + barW / 2}
                    y={y(bin.count) - 5}
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="700"
                    fill="#1A1530"
                  >
                    {bin.count}
                  </text>
                </>
              )}
              <text
                x={x + barW / 2}
                y={H - PAD.bottom + 16}
                textAnchor="middle"
                fontSize="10"
                fill="#4A4566"
              >
                {bin.label}
              </text>
            </g>
          );
        })}
        <line
          x1={passX}
          x2={passX}
          y1={PAD.top - 6}
          y2={PAD.top + innerH}
          stroke="#1A1530"
          strokeWidth={2}
          strokeDasharray="5 4"
        />
        <text x={passX + 4} y={PAD.top + 4} fontSize="11" fontWeight="700" fill="#1A1530">
          Pass {passMark}%
        </text>
      </svg>
      <table className="sr-only">
        <caption>Number of students per score band</caption>
        <thead>
          <tr>
            <th scope="col">Score band</th>
            <th scope="col">Students</th>
          </tr>
        </thead>
        <tbody>
          {bins.map((bin) => (
            <tr key={bin.label}>
              <td>{bin.label}</td>
              <td>{bin.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
