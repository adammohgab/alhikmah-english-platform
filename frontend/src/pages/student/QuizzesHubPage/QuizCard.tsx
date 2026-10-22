import { Clock, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/shared/components/ui/Badge";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { Chip } from "@/shared/components/ui/Chip";
import {
  attemptsLabel,
  closesLabel,
  formatScore,
  isUrgent,
  lockMessage,
  opensLabel,
  questionCountLabel,
  quizStartPath,
  quizState,
  timeLimitLabel,
  type AvailableQuiz,
} from "./rules";

/* One row of the Available and Upcoming tabs (ST-07): title, course chip, class, unit, question
   count, time limit, attempts used out of allowed, best score, and a Start button or the reason
   the quiz cannot be started. A quiz closing within 24 hours gets a pulsing "Due soon" tag and
   a highlighted outline. */

export interface QuizCardProps {
  quiz: AvailableQuiz;
  now: number;
}

type DisabledState = "upcoming" | "closed" | "exhausted";

const DISABLED_COPY: Record<DisabledState, { label: string; name: string }> = {
  upcoming: { label: "Not open yet", name: "not open yet" },
  closed: { label: "Closed", name: "closed" },
  exhausted: { label: "No attempts", name: "no attempts left" },
};

export function QuizCard({ quiz, now }: QuizCardProps) {
  const navigate = useNavigate();
  const state = quizState(quiz, now);
  const urgent = isUrgent(quiz, now);
  const best = formatScore(quiz.bestScorePct);
  const closes = closesLabel(quiz.dueAt, now);
  const titleId = `quiz-${quiz.id}-title`;

  return (
    <li>
      <div className={urgent ? "rounded-[24px] ring-4 ring-[#FFB020]/70" : undefined}>
        <Card as="article" aria-labelledby={titleId} data-urgent={urgent ? "true" : undefined}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {quiz.course !== null && <Chip size="sm">{quiz.course}</Chip>}
                {urgent && (
                  <span className="inline-flex items-center gap-1 rounded-full border-2 border-stroke bg-[#FFB020] px-2 py-0.5 text-[12px] font-bold text-stroke motion-safe:animate-pulse [[data-effects-tier=low]_&]:animate-none">
                    <Clock aria-hidden="true" size={12} strokeWidth={2.5} />
                    Due soon
                  </span>
                )}
                {best !== null && <Badge status="success">Best {best}</Badge>}
              </div>

              <h3
                id={titleId}
                className="mt-2 font-heading text-[20px] font-semibold leading-snug text-stroke [overflow-wrap:anywhere]"
              >
                {quiz.title}
              </h3>
              <p className="text-[14px] text-muted [overflow-wrap:anywhere]">
                {[quiz.className, quiz.unit].filter((part) => part !== null).join(" · ")}
              </p>

              <p className="mt-2 text-[14px] font-medium text-stroke">
                {[
                  questionCountLabel(quiz.questionCount),
                  timeLimitLabel(quiz.timeLimitMin),
                  attemptsLabel(quiz.attemptsUsed, quiz.attemptsAllowed),
                ].join(" · ")}
              </p>

              {state === "ready" && closes !== null && (
                <p
                  className={`mt-1 text-[14px] ${urgent ? "font-bold text-stroke" : "text-muted"}`}
                >
                  {closes}
                </p>
              )}
              {state === "upcoming" && (
                <p className="mt-1 flex items-center gap-1 text-[14px] font-bold text-stroke">
                  <Lock aria-hidden="true" size={14} strokeWidth={2.5} />
                  {[lockMessage(quiz.lock), opensLabel(quiz)]
                    .filter((part) => part !== null)
                    .join(" · ")}
                </p>
              )}
              {state === "exhausted" && (
                <p className="mt-1 text-[14px] font-bold text-stroke">
                  No attempts left. Ask your teacher.
                </p>
              )}
              {state === "closed" && (
                <p className="mt-1 text-[14px] font-bold text-stroke">This quiz is closed.</p>
              )}
            </div>

            <div className="shrink-0">
              {state === "ready" ? (
                <Button
                  size="lg"
                  onClick={() => {
                    void navigate(quizStartPath(quiz.id));
                  }}
                  aria-label={`Start quiz: ${quiz.title}`}
                >
                  Start quiz
                </Button>
              ) : (
                <Button
                  size="lg"
                  variant="secondary"
                  disabled
                  aria-label={`${quiz.title}: ${DISABLED_COPY[state].name}`}
                >
                  {DISABLED_COPY[state].label}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </li>
  );
}
