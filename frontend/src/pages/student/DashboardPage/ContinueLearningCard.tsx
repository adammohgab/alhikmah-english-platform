import type { ReactNode } from "react";
import { ArrowRight, BookOpen, PartyPopper } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { ProgressBar } from "@/shared/components/ui/ProgressBar";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { lessonPath, type ResumeTarget } from "./rules";
import type { ResumeResult } from "./api";

/* Continue Learning hero card (ST-01 section 1 "Resume strip", STU-CORE-01). One button opens
   the lesson the student left last, otherwise the next pending one, otherwise the first lesson
   of their course. First-time students see "Start your first lesson". */

export interface ContinueLearningCardProps {
  resume: ResumeResult | undefined;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}

const HEADING_ID = "continue-learning-heading";

const KIND_COPY: Record<ResumeTarget["kind"], { eyebrow: string; action: string }> = {
  resume: { eyebrow: "Pick up where you left off", action: "Resume" },
  next: { eyebrow: "Up next for you", action: "Continue" },
  start: { eyebrow: "Your first lesson", action: "Start your first lesson" },
};

function Shell({ children }: { children: ReactNode }) {
  return (
    <Card as="section" aria-labelledby={HEADING_ID}>
      <h2 id={HEADING_ID} className="font-heading text-[22px] font-bold text-stroke">
        Continue learning
      </h2>
      <div className="mt-3">{children}</div>
    </Card>
  );
}

export function ContinueLearningCard({
  resume,
  loading,
  failed,
  onRetry,
}: ContinueLearningCardProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <Shell>
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton shape="text" className="w-2/3" label="Loading your lesson…" />
          <Skeleton shape="rect" className="h-5 w-full" label={null} />
          <Skeleton shape="rect" className="h-12 w-40" label={null} />
        </div>
      </Shell>
    );
  }

  if (failed || resume === undefined) {
    return (
      <Shell>
        <ErrorState
          size="sm"
          description="Your lesson could not load. Check your connection and try again."
          onRetry={onRetry}
        />
      </Shell>
    );
  }

  const target = resume.target;

  if (target === null) {
    return (
      <Shell>
        <div className="flex flex-col items-start gap-3">
          <p className="flex items-center gap-2 text-[16px] font-medium text-stroke">
            {resume.hasCourses ? (
              <PartyPopper aria-hidden="true" size={20} strokeWidth={2.5} />
            ) : (
              <BookOpen aria-hidden="true" size={20} strokeWidth={2.5} />
            )}
            {resume.hasCourses
              ? "You finished every lesson. Browse your courses to review or explore more."
              : "No courses are assigned to you yet. Ask your teacher to add you to a class."}
          </p>
          {resume.hasCourses && (
            <Button
              variant="secondary"
              onClick={() => {
                void navigate("/student/courses");
              }}
            >
              View courses
            </Button>
          )}
        </div>
      </Shell>
    );
  }

  const copy = KIND_COPY[target.kind];

  return (
    <Shell>
      <div className="flex flex-col gap-4">
        <div className="min-w-0">
          <p className="font-body text-[13px] font-bold uppercase tracking-wide text-muted">
            {copy.eyebrow}
          </p>
          <p className="font-heading text-[20px] font-semibold leading-snug text-stroke [overflow-wrap:anywhere]">
            {target.lessonTitle}
          </p>
          <p className="text-[14px] text-muted [overflow-wrap:anywhere]">
            {target.courseTitle} · {target.unitTitle}
          </p>
        </div>

        <ProgressBar
          value={target.completedLessons}
          max={Math.max(1, target.totalLessons)}
          label={`${target.courseTitle} progress`}
          valueText={`${target.completedLessons} of ${target.totalLessons} lessons done`}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[14px] font-bold text-stroke">
            {target.completedLessons} of {target.totalLessons} lessons done
          </p>
          <Button
            size="lg"
            onClick={() => {
              void navigate(lessonPath(target));
            }}
          >
            <span>{copy.action}</span>
            <ArrowRight aria-hidden="true" size={18} strokeWidth={2.5} />
          </Button>
        </div>
      </div>
    </Shell>
  );
}
