import { useNavigate } from "react-router-dom";
import { Badge } from "@/shared/components/ui/Badge";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { Chip } from "@/shared/components/ui/Chip";
import { ProgressBar } from "@/shared/components/ui/ProgressBar";
import {
  clampPct,
  formatScore,
  historyStatusOf,
  quizResultPath,
  type HistoryAttempt,
} from "./rules";

/* One past attempt (ST-07 History): quiz name, date, the earned grade as a number and a bar,
   a pass or not-passed tag, the attempt number and a "View result" action. */

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function dateLabel(iso: string | null): string {
  if (iso === null) return "Date unknown";
  const time = Date.parse(iso);
  return Number.isNaN(time) ? "Date unknown" : DATE_FORMAT.format(new Date(time));
}

export function HistoryRow({ attempt }: { attempt: HistoryAttempt }) {
  const navigate = useNavigate();
  const score = formatScore(attempt.scorePct);
  const status = historyStatusOf(attempt);
  const titleId = `attempt-${attempt.attemptId}-title`;

  return (
    <li>
      <Card as="article" aria-labelledby={titleId}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {attempt.course !== null && <Chip size="sm">{attempt.course}</Chip>}
              {status === "passed" && <Badge status="success">Passed</Badge>}
              {status === "not_passed" && <Badge status="danger">Not passed</Badge>}
              {status === "pending" && <Badge status="info">Awaiting score</Badge>}
            </div>
            <h3
              id={titleId}
              className="mt-2 font-heading text-[20px] font-semibold leading-snug text-stroke [overflow-wrap:anywhere]"
            >
              {attempt.title}
            </h3>
            <p className="text-[14px] text-muted">
              {[attempt.className, dateLabel(attempt.submittedAt), `Attempt ${attempt.attemptNo}`]
                .filter((part) => part !== null)
                .join(" · ")}
            </p>
          </div>

          <div className="flex w-full flex-col gap-1 md:w-56">
            <p className="font-heading text-[24px] font-bold tabular-nums text-stroke">
              {score ?? "No score yet"}
            </p>
            {score !== null && (
              <ProgressBar
                value={clampPct(attempt.scorePct)}
                max={100}
                label={`${attempt.title} score`}
                valueText={`${score} score`}
              />
            )}
          </div>

          <Button
            variant="secondary"
            onClick={() => {
              void navigate(quizResultPath(attempt.quizId, attempt.attemptId));
            }}
            aria-label={`View result: ${attempt.title}, attempt ${attempt.attemptNo}`}
          >
            View result
          </Button>
        </div>
      </Card>
    </li>
  );
}
