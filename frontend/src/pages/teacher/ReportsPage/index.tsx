import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/shared/components/ui/Button";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { Select } from "@/shared/components/ui/Select";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import {
  PERIOD_LABELS,
  REPORTS_KEY,
  fetchClassChoices,
  fetchRecentReports,
  type PeriodPreset,
  type RecentReport,
} from "./api";

/* Reports hub (TEACHER-SPEC TC-22, task TCH-CORE-15).
   Pick a class and a period, open its class report, or reopen a recent one. The compare-classes
   and student report card panels belong to TC-24 and TC-25 and are not part of this task. */

const PANEL = "rounded-[20px] border-2 border-stroke bg-surface-0 p-4 shadow-[2px_2px_0px_#000]";

function reportLink(report: RecentReport): string | null {
  const classId = report.params?.class_id;
  if (report.kind !== "class" || typeof classId !== "string") return null;
  const preset = report.params?.preset;
  const query = typeof preset === "string" ? `?period=${encodeURIComponent(preset)}` : "";
  return `/teacher/reports/class/${encodeURIComponent(classId)}${query}`;
}

export default function ReportsPage() {
  const navigate = useNavigate();
  const [classId, setClassId] = useState("");
  const [period, setPeriod] = useState<PeriodPreset>("term");

  const classes = useQuery({ queryKey: [REPORTS_KEY, "classes"], queryFn: fetchClassChoices });
  const recent = useQuery({ queryKey: [REPORTS_KEY, "recent"], queryFn: fetchRecentReports });

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4">
      <header>
        <h1 className="font-display text-[28px] leading-tight text-stroke">Reports</h1>
        <p className="text-[14px] text-muted">
          See how a class is doing and print or save the report.
        </p>
      </header>

      <section className={PANEL} aria-labelledby="class-report-heading">
        <h2 id="class-report-heading" className="font-display text-[22px] text-stroke">
          Class report
        </h2>
        <p className="mb-3 text-[14px] text-muted">
          Scores over time, skills, assessments and the students who need support.
        </p>
        {classes.isPending ? (
          <Skeleton shape="rect" className="h-12 w-full" />
        ) : classes.isError ? (
          <ErrorState
            size="sm"
            description="Your classes could not load."
            onRetry={() => void classes.refetch()}
          />
        ) : classes.data.length === 0 ? (
          <EmptyState size="sm" title="You have no classes yet." />
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1 text-[14px] text-stroke">
              <span id="class-label">Class</span>
              <Select
                aria-labelledby="class-label"
                placeholder="Choose a class"
                value={classId}
                onValueChange={setClassId}
                options={classes.data.map((choice) => ({
                  value: choice.class.id,
                  label: choice.class.name,
                }))}
              />
            </div>
            <div className="flex flex-col gap-1 text-[14px] text-stroke">
              <span id="period-label">Period</span>
              <Select
                aria-labelledby="period-label"
                value={period}
                onValueChange={(value) => setPeriod(value as PeriodPreset)}
                options={(Object.keys(PERIOD_LABELS) as PeriodPreset[]).map((id) => ({
                  value: id,
                  label: PERIOD_LABELS[id],
                }))}
              />
            </div>
            <Button
              disabled={classId === ""}
              onClick={() =>
                void navigate(
                  `/teacher/reports/class/${encodeURIComponent(classId)}?period=${period}`,
                )
              }
            >
              Create report
            </Button>
          </div>
        )}
      </section>

      <section className={PANEL} aria-labelledby="recent-heading">
        <h2 id="recent-heading" className="font-display mb-2 text-[22px] text-stroke">
          Recent reports
        </h2>
        {recent.isPending ? (
          <Skeleton shape="rect" className="h-20 w-full" />
        ) : recent.isError ? (
          <ErrorState
            size="sm"
            description="Recent reports could not load."
            onRetry={() => void recent.refetch()}
          />
        ) : recent.data.length === 0 ? (
          <EmptyState size="sm" title="No saved reports yet." />
        ) : (
          <ul className="flex flex-col">
            {recent.data.map((report) => {
              const to = reportLink(report);
              const when = new Date(report.created_at).toLocaleDateString("en", {
                dateStyle: "medium",
              });
              return (
                <li
                  key={report.id}
                  className="flex items-center justify-between gap-3 border-b border-stroke/30 py-2 text-[14px] text-stroke"
                >
                  <span className="min-w-0">
                    <strong>{report.title ?? "Class report"}</strong>
                    <span className="block text-muted">{when}</span>
                  </span>
                  {to && (
                    <Link to={to} className="font-bold underline">
                      Open again
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
