import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/shared/components/ui/Button";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { Select } from "@/shared/components/ui/Select";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import {
  COMPARE_KEY,
  PERIOD_LABELS,
  SKILLS,
  fetchClassChoices,
  fetchCompare,
  type CompareClass,
  type PeriodPreset,
} from "./api";

/* Compare classes (TEACHER-SPEC TC-24, task TCH-CORE-16).
   Pick 2 to 4 classes and a period: one column per class with the same metrics in rows, a grouped
   bar chart of the five skills, a weekly average line per class, and a Highlights box. The
   selection lives in the URL (?classes=a,b&period=term) so a comparison can be reopened or
   shared. Print / Save as PDF uses the report print stylesheet. */

const MIN_CLASSES = 2;
const MAX_CLASSES = 4;
const INK = "#000";
const PANEL =
  "report-block rounded-[20px] border-2 border-stroke bg-surface-0 p-4 shadow-[2px_2px_0px_#000]";

/* Fills differ in lightness and lines in dash pattern, so classes stay apart in black and white. */
const FILLS = ["#ffb84d", "#8fd3ff", "#b9f19a", "#f6a6d7"] as const;
const DASHES = ["", "6 3", "2 3", "10 3 2 3"] as const;

const PRINT_CSS = `
@media print {
  @page { size: A4 landscape; margin: 12mm; @bottom-center { content: "Al Hikmah English Platform  |  Page " counter(page) " of " counter(pages); font-size: 9pt } }
  body * { visibility: hidden !important; }
  .report-print, .report-print * { visibility: visible !important; }
  .report-print { position: absolute; left: 0; top: 0; width: 100%; background: #fff !important; color: #000 !important; box-shadow: none !important; }
  .no-print { display: none !important; }
  .report-block { break-inside: avoid; page-break-inside: avoid; }
}
`;

const pct = (value: number | null | undefined): string =>
  value == null ? "No data" : `${Math.round(value * 10) / 10}%`;
const plain = (value: number | null | undefined): string =>
  value == null ? "No data" : String(Math.round(value * 10) / 10);

const METRICS: ReadonlyArray<{ label: string; read: (c: CompareClass) => string }> = [
  { label: "Students", read: (c) => plain(c.students) },
  { label: "Average score", read: (c) => pct(c.avg_score) },
  { label: "Completion rate", read: (c) => pct(c.completion_rate) },
  { label: "Active students", read: (c) => pct(c.active_pct) },
  { label: "Average streak (days)", read: (c) => plain(c.avg_streak) },
  { label: "Assignments on time", read: (c) => pct(c.on_time_pct) },
];

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Plain-language sentences about who leads and who trails, from the backend's numbers. */
function highlights(classes: CompareClass[]): string[] {
  const out: string[] = [];
  for (const skill of SKILLS) {
    const scored = classes.filter((c) => c.skills[skill] != null);
    if (scored.length < 2) continue;
    const best = scored.reduce((a, b) => ((b.skills[skill] ?? 0) > (a.skills[skill] ?? 0) ? b : a));
    const tied = scored.filter((c) => c.skills[skill] === best.skills[skill]).length > 1;
    if (!tied) out.push(`${best.name} leads in ${skill}.`);
  }
  const withCompletion = classes.filter((c) => c.completion_rate != null);
  if (withCompletion.length >= 2) {
    const low = withCompletion.reduce((a, b) =>
      (b.completion_rate ?? 0) < (a.completion_rate ?? 0) ? b : a,
    );
    out.push(`${low.name} has the lowest completion (${pct(low.completion_rate)}).`);
  }
  const withScore = classes.filter((c) => c.avg_score != null);
  if (withScore.length >= 2) {
    const top = withScore.reduce((a, b) => ((b.avg_score ?? 0) > (a.avg_score ?? 0) ? b : a));
    out.push(`${top.name} has the highest average score (${pct(top.avg_score)}).`);
  }
  return out;
}

export default function CompareClassesPage() {
  const [params, setParams] = useSearchParams();
  const selected = useMemo(
    () => (params.get("classes") ?? "").split(",").filter(Boolean).slice(0, MAX_CLASSES),
    [params],
  );
  const rawPeriod = params.get("period");
  const period: PeriodPreset = rawPeriod === "last_30_days" ? "last_30_days" : "term";

  const choices = useQuery({ queryKey: [COMPARE_KEY, "classes"], queryFn: fetchClassChoices });
  const ready = selected.length >= MIN_CLASSES;
  const compare = useQuery({
    queryKey: [COMPARE_KEY, "result", selected, period],
    queryFn: () => fetchCompare(selected, period),
    enabled: ready,
  });

  const update = (classes: string[], nextPeriod: PeriodPreset) =>
    setParams(new URLSearchParams({ classes: classes.join(","), period: nextPeriod }), {
      replace: true,
    });

  const toggle = (id: string, on: boolean) =>
    update(on ? [...selected, id] : selected.filter((value) => value !== id), period);

  const grades = new Set(
    choices.data
      ?.filter((c) => selected.includes(c.class.id))
      .map((c) => c.class.grade_level ?? ""),
  );
  const differentGrades = grades.size > 1;

  const classes = compare.data?.classes ?? [];
  const skillData = SKILLS.map((skill) => ({
    skill: cap(skill),
    ...Object.fromEntries(classes.map((c) => [c.id, c.skills[skill] ?? 0])),
  }));
  const weeks = Array.from(new Set(classes.flatMap((c) => c.weekly.map((w) => w.week))));
  const weeklyData = weeks.map((week) => ({
    week,
    ...Object.fromEntries(
      classes.map((c) => [c.id, c.weekly.find((w) => w.week === week)?.avg ?? null]),
    ),
  }));
  const lines = ready && classes.length > 0 ? highlights(classes) : [];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4">
      <style>{PRINT_CSS}</style>

      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/teacher/reports"
          className="flex items-center gap-1 font-bold text-stroke underline"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          All reports
        </Link>
        <Button disabled={classes.length === 0} onClick={() => window.print()}>
          <Printer size={18} aria-hidden="true" />
          <span>Print / Save as PDF</span>
        </Button>
      </div>

      <section className="no-print flex flex-col gap-3" aria-label="Choose classes">
        <h1 className="font-display text-[28px] leading-tight text-stroke">Compare classes</h1>
        <div className="flex flex-col gap-1 text-[14px] text-stroke">
          <span id="compare-period">Period</span>
          <Select
            aria-labelledby="compare-period"
            value={period}
            onValueChange={(value) => update(selected, value as PeriodPreset)}
            options={(Object.keys(PERIOD_LABELS) as PeriodPreset[]).map((id) => ({
              value: id,
              label: PERIOD_LABELS[id],
            }))}
          />
        </div>
        {choices.isPending ? (
          <Skeleton shape="rect" className="h-16 w-full" />
        ) : choices.isError ? (
          <ErrorState
            size="sm"
            description="Your classes could not load."
            onRetry={() => void choices.refetch()}
          />
        ) : (
          <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
            <legend className="mb-1 text-[14px] text-stroke">
              Choose {MIN_CLASSES} to {MAX_CLASSES} classes
            </legend>
            {choices.data.map((choice) => {
              const on = selected.includes(choice.class.id);
              return (
                <label
                  key={choice.class.id}
                  className="flex items-center gap-2 text-[14px] text-stroke"
                >
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={!on && selected.length >= MAX_CLASSES}
                    onChange={(event) => toggle(choice.class.id, event.target.checked)}
                  />
                  {choice.class.name}
                </label>
              );
            })}
          </fieldset>
        )}
        {differentGrades && (
          <p className="w-fit rounded-full border-2 border-stroke bg-[var(--world-soft,#ffd93d)] px-3 text-[14px] font-bold text-stroke">
            Different grades
          </p>
        )}
      </section>

      {!ready ? (
        <EmptyState size="sm" title={`Choose at least ${MIN_CLASSES} classes to compare.`} />
      ) : compare.isPending ? (
        <Skeleton shape="rect" className="h-64 w-full" />
      ) : compare.isError ? (
        <ErrorState
          description="The comparison could not load. Check your connection and try again."
          onRetry={() => void compare.refetch()}
        />
      ) : classes.length === 0 ? (
        <EmptyState size="sm" title="No data for these classes in this period." />
      ) : (
        <article className="report-print flex flex-col gap-4">
          <header className="report-block border-b-2 border-stroke pb-3">
            <h2 className="font-display text-[24px] text-stroke">
              Class comparison: {classes.map((c) => c.name).join(", ")}
            </h2>
            <p className="text-[14px] text-stroke">
              Period: {PERIOD_LABELS[period]} | Generated{" "}
              {new Date().toLocaleDateString("en", { dateStyle: "long" })}
            </p>
          </header>

          <section className={`${PANEL} overflow-x-auto`} aria-label="Metrics by class">
            <table className="w-full min-w-[32rem] text-left text-[14px] text-stroke">
              <thead>
                <tr className="border-b-2 border-stroke">
                  <th className="py-1 pr-3">Metric</th>
                  {classes.map((c) => (
                    <th key={c.id} className="pr-3">
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRICS.map((metric) => (
                  <tr key={metric.label} className="border-b border-stroke/30">
                    <th scope="row" className="py-1 pr-3 font-normal">
                      {metric.label}
                    </th>
                    {classes.map((c) => (
                      <td key={c.id} className="pr-3">
                        {metric.read(c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className={PANEL} aria-label="Skills by class">
            <h2 className="font-display text-[20px] text-stroke">Skills by class</h2>
            <div className="h-72 w-full">
              <ResponsiveContainer>
                <BarChart data={skillData} margin={{ top: 16, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke="#999" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="skill" stroke={INK} tick={{ fill: INK, fontSize: 12 }} />
                  <YAxis domain={[0, 100]} stroke={INK} tick={{ fill: INK, fontSize: 12 }} />
                  <Legend />
                  {classes.map((c, index) => (
                    <Bar
                      key={c.id}
                      dataKey={c.id}
                      name={c.name}
                      fill={FILLS[index % FILLS.length]}
                      stroke={INK}
                      strokeWidth={2}
                      isAnimationActive={false}
                    >
                      <LabelList dataKey={c.id} position="top" fill={INK} fontSize={11} />
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className={PANEL} aria-label="Weekly average by class">
            <h2 className="font-display text-[20px] text-stroke">Weekly average score</h2>
            {weeklyData.length === 0 ? (
              <EmptyState size="sm" title="No weekly scores in this period." />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer>
                  <LineChart data={weeklyData} margin={{ top: 16, right: 16, bottom: 4, left: 0 }}>
                    <CartesianGrid stroke="#999" strokeDasharray="3 3" />
                    <XAxis dataKey="week" stroke={INK} tick={{ fill: INK, fontSize: 12 }} />
                    <YAxis domain={[0, 100]} stroke={INK} tick={{ fill: INK, fontSize: 12 }} />
                    <Legend />
                    {classes.map((c, index) => (
                      <Line
                        key={c.id}
                        dataKey={c.id}
                        name={c.name}
                        stroke={INK}
                        strokeWidth={2.5}
                        strokeDasharray={DASHES[index % DASHES.length]}
                        dot={{
                          r: 4,
                          fill: FILLS[index % FILLS.length],
                          stroke: INK,
                          strokeWidth: 2,
                        }}
                        isAnimationActive={false}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className={PANEL} aria-label="Highlights">
            <h2 className="font-display text-[20px] text-stroke">Highlights</h2>
            {lines.length === 0 ? (
              <p className="text-[14px] text-muted">
                Not enough data to point out differences yet.
              </p>
            ) : (
              <ul className="list-disc pl-5 text-[14px] text-stroke">
                {lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </section>
        </article>
      )}
    </main>
  );
}
