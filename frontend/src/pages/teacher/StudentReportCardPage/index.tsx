import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
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
  PERIOD_LABELS,
  STUDENT_REPORT_KEY,
  fetchLetterhead,
  fetchStudentReport,
  type Letterhead,
  type PeriodPreset,
  type StudentReport,
} from "./api";

/* Student report card (TEACHER-SPEC TC-25, task TCH-CORE-16).
   Letterhead, summary, courses and assessment grades, grade distribution, skill breakdown,
   participation, strengths and areas to improve (editable), a teacher narrative to write before
   printing, and a signature line. Sections can be switched off. Print / Save as PDF uses an A4
   portrait print stylesheet. Level and rank are an optional section, off by default. */

const SECTIONS = [
  { id: "summary", label: "Summary", on: true },
  { id: "courses", label: "Courses", on: true },
  { id: "distribution", label: "Grade distribution", on: true },
  { id: "skills", label: "Skills", on: true },
  { id: "participation", label: "Participation", on: true },
  { id: "feedback", label: "Strengths and areas to improve", on: true },
  { id: "comment", label: "Teacher comment", on: true },
  { id: "gamification", label: "Level and rank", on: false },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

const INK = "#000";
const FILL = "var(--world-main,#ffb84d)";
const PANEL =
  "report-block rounded-[20px] border-2 border-stroke bg-surface-0 p-4 shadow-[2px_2px_0px_#000]";

const PRINT_CSS = `
@media print {
  @page { size: A4 portrait; margin: 14mm; @bottom-center { content: "Page " counter(page) " of " counter(pages); font-size: 9pt } }
  body * { visibility: hidden !important; }
  .report-print, .report-print * { visibility: visible !important; }
  .report-print { position: absolute; left: 0; top: 0; width: 100%; background: #fff !important; color: #000 !important; box-shadow: none !important; }
  .no-print { display: none !important; }
  .report-block { break-inside: avoid; page-break-inside: avoid; }
  .report-print tr { break-inside: avoid; }
}
`;

const pct = (value: number | null | undefined): string =>
  value == null ? "No data" : `${Math.round(value * 10) / 10}%`;
const plain = (value: number | string | null | undefined): string =>
  value == null ? "No data" : String(value);

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={PANEL}>
      <p className="text-[14px] text-muted">{label}</p>
      <p className="font-display text-[24px] leading-tight text-stroke">{value}</p>
    </div>
  );
}

interface CardProps {
  report: StudentReport;
  letterhead: Letterhead | undefined;
  period: PeriodPreset;
  shown: Record<SectionId, boolean>;
}

/** Mounted per student and period, so the editable text starts from the backend's draft. */
function Card({ report, letterhead, period, shown }: CardProps) {
  const [strengths, setStrengths] = useState(report.strengths.join("\n"));
  const [improve, setImprove] = useState(report.improve.join("\n"));
  const [comment, setComment] = useState("");
  const generated = new Date().toLocaleDateString("en", { dateStyle: "long" });
  const student = report.student;

  return (
    <article className="report-print flex flex-col gap-4">
      <header className="report-block border-b-2 border-stroke pb-3">
        <p className="font-display text-[22px] text-stroke">
          {letterhead?.school_name ?? letterhead?.platform_name ?? "School report"}
        </p>
        <p className="text-[13px] text-stroke">
          {[letterhead?.location, letterhead?.contact_phone, letterhead?.contact_email]
            .filter(Boolean)
            .join(" | ")}
        </p>
        <h1 className="font-display mt-2 text-[26px] leading-tight text-stroke">
          Student report card{student ? `: ${student.name}` : ""}
        </h1>
        <p className="text-[14px] text-stroke">
          {[
            student?.student_code ? `ID ${student.student_code}` : null,
            student?.class_name,
            student?.grade_level ? `Grade ${student.grade_level}` : null,
            student?.teacher_name ? `Teacher: ${student.teacher_name}` : null,
            `Period: ${PERIOD_LABELS[period]}`,
            `Generated ${generated}`,
          ]
            .filter(Boolean)
            .join(" | ")}
        </p>
      </header>

      {shown.summary && (
        <section aria-label="Summary" className="grid grid-cols-3 gap-3">
          <Stat label="Average score" value={pct(report.summary.avg_score)} />
          <Stat label="Progress" value={pct(report.summary.progress)} />
          <Stat label="Active days" value={plain(report.summary.activity_days)} />
        </section>
      )}

      {shown.courses && (
        <section className={PANEL} aria-label="Courses">
          <h2 className="font-display text-[20px] text-stroke">Courses</h2>
          {report.courses.length === 0 ? (
            <EmptyState size="sm" title="No course data in this period." />
          ) : (
            <table className="w-full text-left text-[14px] text-stroke">
              <thead>
                <tr className="border-b-2 border-stroke">
                  <th className="py-1 pr-3">Course</th>
                  <th className="pr-3">Progress</th>
                  <th className="pr-3">Assessment grades</th>
                  <th>Overall</th>
                </tr>
              </thead>
              <tbody>
                {report.courses.map((course) => (
                  <tr
                    key={course.id ?? course.name}
                    className="border-b border-stroke/30 align-top"
                  >
                    <td className="py-1 pr-3">{course.name}</td>
                    <td className="pr-3">{pct(course.progress)}</td>
                    <td className="pr-3">
                      {course.assessments.length === 0
                        ? "None yet"
                        : course.assessments.map((a) => `${a.title}: ${pct(a.score)}`).join("; ")}
                    </td>
                    <td className="font-bold">{pct(course.overall)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {shown.distribution && (
        <section className={PANEL} aria-label="Grade distribution">
          <h2 className="font-display text-[20px] text-stroke">Grade distribution</h2>
          {report.grade_distribution.length === 0 ? (
            <p className="text-[14px] text-muted">No graded work in this period.</p>
          ) : (
            <div className="h-48 w-full">
              <ResponsiveContainer>
                <BarChart
                  data={report.grade_distribution}
                  margin={{ top: 16, right: 16, bottom: 4, left: 0 }}
                >
                  <CartesianGrid stroke="#999" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="band" stroke={INK} tick={{ fill: INK, fontSize: 12 }} />
                  <YAxis allowDecimals={false} stroke={INK} tick={{ fill: INK, fontSize: 12 }} />
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
        <section className={PANEL} aria-label="Skills">
          <h2 className="font-display text-[20px] text-stroke">Skills</h2>
          {report.skills.length === 0 ? (
            <p className="text-[14px] text-muted">No skill data in this period.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-[14px] text-stroke">
              {report.skills.map((row) => (
                <li key={row.skill}>
                  <div className="flex justify-between font-bold">
                    <span>{row.skill}</span>
                    <span>{pct(row.score)}</span>
                  </div>
                  <div className="h-3 w-full rounded-full border-2 border-stroke">
                    <div
                      className="h-full rounded-full bg-[var(--world-main,#ffb84d)]"
                      style={{ width: `${Math.max(0, Math.min(100, row.score ?? 0))}%` }}
                    />
                  </div>
                  {row.comment && <p className="text-muted">{row.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {shown.participation && (
        <section aria-label="Participation" className="grid grid-cols-2 gap-3">
          <Stat label="Lessons completed" value={plain(report.participation.lessons_completed)} />
          <Stat label="Best streak (days)" value={plain(report.participation.best_streak)} />
        </section>
      )}

      {shown.gamification && (
        <section aria-label="Level and rank" className="grid grid-cols-2 gap-3">
          <Stat label="Level" value={plain(report.participation.level)} />
          <Stat label="Rank" value={plain(report.participation.rank)} />
        </section>
      )}

      {shown.feedback && (
        <section className="grid gap-4 md:grid-cols-2" aria-label="Strengths and areas to improve">
          <div className={PANEL}>
            <label htmlFor="strengths" className="font-display text-[20px] text-stroke">
              Strengths
            </label>
            <textarea
              id="strengths"
              value={strengths}
              onChange={(event) => setStrengths(event.target.value)}
              rows={5}
              placeholder="One strength per line"
              className="mt-2 w-full resize-y rounded-[12px] border-2 border-stroke bg-surface-0 p-2 text-[14px] text-stroke"
            />
          </div>
          <div className={PANEL}>
            <label htmlFor="improve" className="font-display text-[20px] text-stroke">
              Areas to improve
            </label>
            <textarea
              id="improve"
              value={improve}
              onChange={(event) => setImprove(event.target.value)}
              rows={5}
              placeholder="One area per line"
              className="mt-2 w-full resize-y rounded-[12px] border-2 border-stroke bg-surface-0 p-2 text-[14px] text-stroke"
            />
          </div>
        </section>
      )}

      {shown.comment && (
        <section className={PANEL} aria-label="Teacher comment">
          <label htmlFor="comment" className="font-display text-[20px] text-stroke">
            Teacher comment
          </label>
          <textarea
            id="comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={6}
            placeholder="Write a personal summary for the student and family. It prints with the report."
            className="mt-2 w-full resize-y rounded-[12px] border-2 border-stroke bg-surface-0 p-2 text-[14px] text-stroke"
          />
        </section>
      )}

      <footer className="report-block mt-4 grid grid-cols-2 gap-8 text-[14px] text-stroke">
        <p className="border-t-2 border-stroke pt-1">Teacher signature</p>
        <p className="border-t-2 border-stroke pt-1">Parent or guardian signature</p>
      </footer>
    </article>
  );
}

export default function StudentReportCardPage() {
  const { studentId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const period: PeriodPreset = params.get("period") === "last_30_days" ? "last_30_days" : "term";
  const [shown, setShown] = useState<Record<SectionId, boolean>>(
    () => Object.fromEntries(SECTIONS.map((s) => [s.id, s.on])) as Record<SectionId, boolean>,
  );

  const report = useQuery({
    queryKey: [STUDENT_REPORT_KEY, studentId, period],
    queryFn: () => fetchStudentReport(studentId, period),
    enabled: studentId !== "",
  });
  const letterhead = useQuery({
    queryKey: [STUDENT_REPORT_KEY, "letterhead"],
    queryFn: fetchLetterhead,
  });

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4">
      <style>{PRINT_CSS}</style>

      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/teacher/reports"
          className="flex items-center gap-1 font-bold text-stroke underline"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          All reports
        </Link>
        <Button disabled={!report.data} onClick={() => window.print()}>
          <Printer size={18} aria-hidden="true" />
          <span>Print / Save as PDF</span>
        </Button>
      </div>

      <section className="no-print flex flex-col gap-3" aria-label="Report controls">
        <div className="flex flex-col gap-1 text-[14px] text-stroke">
          <span id="card-period">Period</span>
          <Select
            aria-labelledby="card-period"
            value={period}
            onValueChange={(value) =>
              setParams(new URLSearchParams({ period: value }), { replace: true })
            }
            options={(Object.keys(PERIOD_LABELS) as PeriodPreset[]).map((id) => ({
              value: id,
              label: PERIOD_LABELS[id],
            }))}
          />
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
        <div className="flex flex-col gap-4" aria-busy="true">
          {[0, 1, 2].map((n) => (
            <Skeleton key={n} shape="rect" className="h-40 w-full" />
          ))}
        </div>
      ) : report.isError ? (
        <ErrorState
          description="The report card could not load. Check your connection and try again."
          onRetry={() => void report.refetch()}
        />
      ) : (
        <Card
          key={`${studentId}-${period}`}
          report={report.data}
          letterhead={letterhead.data}
          period={period}
          shown={shown}
        />
      )}
    </main>
  );
}
