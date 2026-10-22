import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Printer, Save } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/app/providers/auth-context";
import { Button } from "@/shared/components/ui/Button";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { Select } from "@/shared/components/ui/Select";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { useToast } from "@/shared/hooks/useToast";
import {
  PERIOD_LABELS,
  REPORTS_KEY,
  fetchClassChoices,
  fetchClassReport,
  saveClassReport,
  type ClassReport,
  type Period,
  type PeriodPreset,
} from "./api";
import { downloadCsv, reportToCsv } from "./csv";

/* Class report (TEACHER-SPEC TC-23, task TCH-CORE-15).
   Header, summary tiles, performance over time, score distribution, skill breakdown (with the
   CEFR band when the backend reports one), assessments table, students (top, needing support,
   roster) and teacher notes. Sections can be switched off before printing. Print / Save as PDF
   uses the browser print dialog with a dedicated print stylesheet; CSV downloads the data. */

const SECTIONS = [
  { id: "summary", label: "Summary" },
  { id: "trend", label: "Performance over time" },
  { id: "histogram", label: "Score distribution" },
  { id: "skills", label: "Skill breakdown" },
  { id: "assessments", label: "Assessments" },
  { id: "students", label: "Students" },
  { id: "notes", label: "Teacher notes" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

const PRINT_CSS = `
@media print {
  @page { size: A4 portrait; margin: 14mm; @bottom-center { content: "Al Hikmah English Platform  |  Page " counter(page) " of " counter(pages); font-size: 9pt } }
  body * { visibility: hidden !important; }
  .report-print, .report-print * { visibility: visible !important; }
  .report-print { position: absolute; left: 0; top: 0; width: 100%; background: #fff !important; color: #000 !important; box-shadow: none !important; }
  .no-print { display: none !important; }
  .report-block { break-inside: avoid; page-break-inside: avoid; }
  .report-print tr { break-inside: avoid; }
}
`;

const PANEL =
  "report-block rounded-[20px] border-2 border-stroke bg-surface-0 p-4 shadow-[2px_2px_0px_#000]";
const INK = "#000";
const FILL = "var(--world-main,#ffb84d)";

const percent = (value: number | null | undefined): string =>
  value === null || value === undefined ? "No data" : `${Math.round(value * 10) / 10}%`;

const signed = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "no change data";
  if (value === 0) return "no change";
  return `${value > 0 ? "up" : "down"} ${Math.abs(Math.round(value * 10) / 10)} points`;
};

function readPeriod(params: URLSearchParams): Period {
  const raw = params.get("period");
  const preset: PeriodPreset = raw === "last_30_days" || raw === "custom" ? raw : "term";
  return {
    preset,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  };
}

const periodText = (period: Period): string =>
  period.preset === "custom" && period.from && period.to
    ? `${period.from} to ${period.to}`
    : PERIOD_LABELS[period.preset];

function trendSummary(report: ClassReport): string {
  const points = report.trend.filter((point) => point.avg !== null && point.avg !== undefined);
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || first === last) return "Not enough weeks yet to describe a trend.";
  return `The class average went from ${percent(first.avg)} (${first.week}) to ${percent(last.avg)} (${last.week}).`;
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className={PANEL}>
      <p className="text-[14px] text-muted">{label}</p>
      <p className="font-display text-[28px] leading-tight text-stroke">{value}</p>
    </div>
  );
}

export default function ClassReportPage() {
  const { classId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const period = readPeriod(params);
  const { user } = useAuth();
  const toast = useToast();
  const [shown, setShown] = useState<Record<SectionId, boolean>>(
    () =>
      Object.fromEntries(SECTIONS.map((section) => [section.id, true])) as Record<
        SectionId,
        boolean
      >,
  );
  const [notes, setNotes] = useState("");

  const report = useQuery({
    queryKey: [REPORTS_KEY, "class", classId, period],
    queryFn: () => fetchClassReport(classId, period),
    enabled: classId !== "",
  });
  const classes = useQuery({ queryKey: [REPORTS_KEY, "classes"], queryFn: fetchClassChoices });
  const info = classes.data?.find((choice) => choice.class.id === classId)?.class;
  const className = info?.name ?? "Class";
  const title = `Class report: ${className}`;
  const generated = useMemo(() => new Date().toLocaleDateString("en", { dateStyle: "long" }), []);

  const save = useMutation({
    mutationFn: () => saveClassReport(classId, period, notes),
    onSuccess: () => toast.show({ title: "Report saved to Recent reports", type: "success" }),
    onError: (error: Error) =>
      toast.show({ title: "Could not save the report", description: error.message, type: "error" }),
  });

  const setPeriod = (next: Period) => {
    const query = new URLSearchParams({ period: next.preset });
    if (next.preset === "custom") {
      if (next.from) query.set("from", next.from);
      if (next.to) query.set("to", next.to);
    }
    setParams(query, { replace: true });
  };

  const data = report.data;
  const supportIds = new Set(data?.support.map((person) => person.id));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
      <style>{PRINT_CSS}</style>

      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/teacher/reports"
          className="flex items-center gap-1 font-bold text-stroke underline"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          All reports
        </Link>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={!data}
            onClick={() =>
              data &&
              downloadCsv(`${className}-report.csv`, reportToCsv(title, periodText(period), data))
            }
          >
            <Download size={18} aria-hidden="true" />
            <span>Download CSV</span>
          </Button>
          <Button
            variant="secondary"
            disabled={!data}
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            <Save size={18} aria-hidden="true" />
            <span>Save report</span>
          </Button>
          <Button disabled={!data} onClick={() => window.print()}>
            <Printer size={18} aria-hidden="true" />
            <span>Print / Save as PDF</span>
          </Button>
        </div>
      </div>

      <section className="no-print flex flex-col gap-3" aria-label="Report controls">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1 text-[14px] text-stroke">
            <span id="period-label">Period</span>
            <Select
              aria-labelledby="period-label"
              value={period.preset}
              onValueChange={(value) => setPeriod({ ...period, preset: value as PeriodPreset })}
              options={(Object.keys(PERIOD_LABELS) as PeriodPreset[]).map((id) => ({
                value: id,
                label: PERIOD_LABELS[id],
              }))}
            />
          </div>
          {period.preset === "custom" && (
            <>
              <label className="flex flex-col gap-1 text-[14px] text-stroke">
                From
                <input
                  type="date"
                  value={period.from ?? ""}
                  onChange={(event) => setPeriod({ ...period, from: event.target.value })}
                  className="min-h-11 rounded-[12px] border-2 border-stroke bg-surface-0 px-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-[14px] text-stroke">
                To
                <input
                  type="date"
                  value={period.to ?? ""}
                  onChange={(event) => setPeriod({ ...period, to: event.target.value })}
                  className="min-h-11 rounded-[12px] border-2 border-stroke bg-surface-0 px-2"
                />
              </label>
            </>
          )}
        </div>
        <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
          <legend className="mb-1 text-[14px] text-stroke">Sections to include</legend>
          {SECTIONS.map((section) => (
            <label key={section.id} className="flex items-center gap-2 text-[14px] text-stroke">
              <input
                type="checkbox"
                checked={shown[section.id]}
                onChange={(event) =>
                  setShown((current) => ({ ...current, [section.id]: event.target.checked }))
                }
              />
              {section.label}
            </label>
          ))}
        </fieldset>
      </section>

      {report.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2" aria-busy="true">
          {[0, 1, 2, 3].map((n) => (
            <Skeleton key={n} shape="rect" className="h-40 w-full" />
          ))}
        </div>
      ) : report.isError || !data ? (
        <ErrorState
          description="The report could not load. Check your connection and try again."
          onRetry={() => void report.refetch()}
        />
      ) : (
        <article className="report-print flex flex-col gap-4">
          <header className="report-block border-b-2 border-stroke pb-3">
            <h1 className="font-display text-[28px] leading-tight text-stroke">{title}</h1>
            <p className="text-[14px] text-stroke">
              {info?.grade_level ? `Grade ${info.grade_level} | ` : ""}
              {user?.fullName ? `Teacher: ${user.fullName} | ` : ""}
              Period: {periodText(period)} | Generated {generated}
            </p>
          </header>

          {shown.summary && (
            <section aria-label="Summary" className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Tile label="Average score" value={percent(data.summary.avg_score)} />
              <Tile label="Completion rate" value={percent(data.summary.completion_rate)} />
              <Tile
                label="Active students"
                value={
                  data.summary.active_students == null
                    ? "No data"
                    : data.summary.total_students == null
                      ? String(data.summary.active_students)
                      : `${data.summary.active_students} of ${data.summary.total_students}`
                }
              />
              <Tile
                label="Assessments in period"
                value={
                  data.summary.assessments_count == null
                    ? "No data"
                    : String(data.summary.assessments_count)
                }
              />
            </section>
          )}

          {shown.trend && (
            <section className={PANEL} aria-label="Performance over time">
              <h2 className="font-display text-[20px] text-stroke">Performance over time</h2>
              {data.trend.length === 0 ? (
                <EmptyState size="sm" title="No scores in this period." />
              ) : (
                <>
                  <div className="h-56 w-full">
                    <ResponsiveContainer>
                      <LineChart
                        data={data.trend}
                        margin={{ top: 16, right: 16, bottom: 4, left: 0 }}
                      >
                        <CartesianGrid stroke="#999" strokeDasharray="3 3" />
                        <XAxis dataKey="week" stroke={INK} tick={{ fill: INK, fontSize: 12 }} />
                        <YAxis domain={[0, 100]} stroke={INK} tick={{ fill: INK, fontSize: 12 }} />
                        <Line
                          dataKey="avg"
                          stroke={INK}
                          strokeWidth={3}
                          dot={{ r: 5, fill: FILL, stroke: INK, strokeWidth: 2 }}
                          isAnimationActive={false}
                          connectNulls
                        >
                          <LabelList dataKey="avg" position="top" fill={INK} fontSize={12} />
                        </Line>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[14px] text-stroke">{trendSummary(data)}</p>
                </>
              )}
            </section>
          )}

          {shown.histogram && (
            <section className={PANEL} aria-label="Score distribution">
              <h2 className="font-display text-[20px] text-stroke">Score distribution</h2>
              {data.histogram.length === 0 ? (
                <EmptyState size="sm" title="No scores in this period." />
              ) : (
                <div className="h-56 w-full">
                  <ResponsiveContainer>
                    <BarChart
                      data={data.histogram}
                      margin={{ top: 16, right: 16, bottom: 4, left: 0 }}
                    >
                      <CartesianGrid stroke="#999" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="band" stroke={INK} tick={{ fill: INK, fontSize: 12 }} />
                      <YAxis
                        allowDecimals={false}
                        stroke={INK}
                        tick={{ fill: INK, fontSize: 12 }}
                      />
                      <Bar
                        dataKey="count"
                        fill={FILL}
                        stroke={INK}
                        strokeWidth={2}
                        isAnimationActive={false}
                      >
                        <LabelList dataKey="count" position="top" fill={INK} fontSize={12} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
          )}

          {shown.skills && (
            <section className={PANEL} aria-label="Skill breakdown">
              <h2 className="font-display text-[20px] text-stroke">Skills by CEFR competency</h2>
              {data.skills.length === 0 ? (
                <EmptyState size="sm" title="No skill data in this period." />
              ) : (
                <>
                  <div style={{ height: 48 * data.skills.length + 40 }} className="w-full">
                    <ResponsiveContainer>
                      <BarChart
                        data={data.skills.map((row) => ({ ...row, score: row.score ?? 0 }))}
                        layout="vertical"
                        margin={{ top: 4, right: 40, bottom: 4, left: 8 }}
                      >
                        <XAxis
                          type="number"
                          domain={[0, 100]}
                          stroke={INK}
                          tick={{ fill: INK, fontSize: 12 }}
                        />
                        <YAxis
                          type="category"
                          dataKey="skill"
                          width={96}
                          stroke={INK}
                          tick={{ fill: INK, fontSize: 13 }}
                        />
                        <Bar
                          dataKey="score"
                          fill={FILL}
                          stroke={INK}
                          strokeWidth={2}
                          isAnimationActive={false}
                        >
                          <LabelList dataKey="score" position="right" fill={INK} fontSize={12} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="mt-2 flex flex-col gap-1 text-[14px] text-stroke">
                    {data.skills.map((row) => (
                      <li key={row.skill}>
                        <strong>{row.skill}</strong>: {percent(row.score)}
                        {row.cefr ? `, CEFR ${row.cefr}` : ""}, {signed(row.change)} since the
                        previous period
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}

          {shown.assessments && (
            <section className={PANEL} aria-label="Assessments">
              <h2 className="font-display text-[20px] text-stroke">Assessments</h2>
              {data.assessments.length === 0 ? (
                <EmptyState size="sm" title="No assessments in this period." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[14px] text-stroke">
                    <thead>
                      <tr className="border-b-2 border-stroke">
                        <th className="py-1 pr-3">Assessment</th>
                        <th className="pr-3">Date</th>
                        <th className="pr-3">Submitted</th>
                        <th className="pr-3">Average</th>
                        <th className="pr-3">Highest</th>
                        <th>Lowest</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.assessments.map((row) => (
                        <tr key={row.id} className="border-b border-stroke/30">
                          <td className="py-1 pr-3">
                            {row.title}
                            {row.kind ? ` (${row.kind})` : ""}
                          </td>
                          <td className="pr-3">{row.date ?? "—"}</td>
                          <td className="pr-3">{row.submitted ?? "—"}</td>
                          <td className="pr-3">{percent(row.avg)}</td>
                          <td className="pr-3">{percent(row.highest)}</td>
                          <td>{percent(row.lowest)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {shown.students && (
            <section className="flex flex-col gap-4" aria-label="Students">
              <div className="grid gap-4 md:grid-cols-2">
                <div className={PANEL}>
                  <h2 className="font-display text-[20px] text-stroke">Top performers</h2>
                  {data.top.length === 0 ? (
                    <p className="text-[14px] text-muted">No data yet.</p>
                  ) : (
                    <ol className="list-decimal pl-5 text-[14px] text-stroke">
                      {data.top.slice(0, 5).map((person) => (
                        <li key={person.id}>
                          {person.name} ({percent(person.avg)})
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                <div className={PANEL}>
                  <h2 className="font-display text-[20px] text-stroke">Needs targeted support</h2>
                  {data.support.length === 0 ? (
                    <p className="text-[14px] text-muted">
                      No students need extra support right now.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1 text-[14px] text-stroke">
                      {data.support.slice(0, 5).map((person) => (
                        <li key={person.id}>
                          <strong>{person.name}</strong> ({percent(person.avg)})
                          {person.reason ? `: ${person.reason}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className={PANEL}>
                <h2 className="font-display text-[20px] text-stroke">Roster</h2>
                {data.roster.length === 0 ? (
                  <EmptyState size="sm" title="No students in this class." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[14px] text-stroke">
                      <thead>
                        <tr className="border-b-2 border-stroke">
                          <th className="py-1 pr-3">Student</th>
                          <th className="pr-3">Progress</th>
                          <th className="pr-3">Average</th>
                          <th>Support</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.roster.map((row) => (
                          <tr key={row.id} className="border-b border-stroke/30">
                            <td className="py-1 pr-3">{row.name}</td>
                            <td className="pr-3">{percent(row.progress)}</td>
                            <td className="pr-3">{percent(row.avg)}</td>
                            <td className={supportIds.has(row.id) ? "font-bold" : undefined}>
                              {supportIds.has(row.id) ? "Needs support" : ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {shown.notes && (
            <section className={PANEL} aria-label="Teacher notes">
              <h2 className="font-display text-[20px] text-stroke">Teacher notes</h2>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={5}
                aria-label="Teacher notes"
                placeholder="Add notes to include in the printed report…"
                className="mt-2 w-full resize-y rounded-[12px] border-2 border-stroke bg-surface-0 p-2 text-[14px] text-stroke"
              />
            </section>
          )}
        </article>
      )}
    </main>
  );
}
