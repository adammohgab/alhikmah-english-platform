import { useId } from "react";
import { CheckCircle2, Gift, Sparkles, Users } from "lucide-react";
import { Avatar } from "@/shared/components/ui/Avatar";
import { Card } from "@/shared/components/ui/Card";

export interface ClassQuestContributor {
  id: string;
  name: string;
  /** Optional publicly displayable avatar image URL. */
  avatarUrl?: string | null | undefined;
  /** Amount this student has contributed to the class quest. */
  contribution: number;
}

export interface ClassQuestProgressProps {
  title: string;
  description: string;
  target: number;
  progress: number;
  /** Unit label, such as "pages", "words", or "lessons". */
  unit: string;
  /** Current student's contribution toward the shared goal. */
  personalContribution: number;
  contributors: ClassQuestContributor[];
  rewardTitle: string;
  rewardDescription?: string | undefined;
  /** Optional class label, for example "Class 9B". */
  className?: string | undefined;
  /** Maximum number of contributor avatars to show. Defaults to 4. */
  maxContributors?: number | undefined;
  /** Optional accessible label for the progress bar. */
  progressLabel?: string | undefined;
}

const numberFormat = new Intl.NumberFormat();

/**
 * Displays progress toward a teacher-created collective class quest.
 * All quest values are supplied by the caller so this component can use live
 * application data rather than embedding demo students or placeholder goals.
 */
export function ClassQuestProgress({
  title,
  description,
  target,
  progress,
  unit,
  personalContribution,
  contributors,
  rewardTitle,
  rewardDescription,
  className,
  maxContributors = 4,
  progressLabel,
}: ClassQuestProgressProps) {
  const titleId = useId();
  const safeTarget = Number.isFinite(target) ? Math.max(0, target) : 0;
  const safeProgress = Number.isFinite(progress) ? Math.max(0, progress) : 0;
  const safePersonalContribution = Number.isFinite(personalContribution)
    ? Math.max(0, personalContribution)
    : 0;
  const percentage =
    safeTarget > 0 ? Math.min(100, Math.round((safeProgress / safeTarget) * 100)) : 0;
  const isComplete = safeTarget > 0 && safeProgress >= safeTarget;
  const visibleContributors = [...contributors]
    .filter(
      (contributor) => Number.isFinite(contributor.contribution) && contributor.contribution > 0,
    )
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, Math.max(0, maxContributors));

  return (
    <Card
      as="section"
      aria-labelledby={titleId}
      className="relative overflow-hidden"
      padding="lg"
      tone="paper"
      radius="xl"
    >
      <div className="flex flex-col gap-5">
        <header className="flex items-start gap-3">
          <div
            aria-hidden="true"
            className="bg-world-soft flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-stroke text-stroke shadow-[2px_2px_0px_var(--color-stroke)]"
          >
            {isComplete ? <CheckCircle2 size={25} /> : <Users size={25} />}
          </div>
          <div className="min-w-0 flex-1">
            {className ? (
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">
                {className}
              </p>
            ) : null}
            <h2 id={titleId} className="font-heading text-xl font-bold text-stroke">
              {title}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
          </div>
          {isComplete ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border-2 border-stroke bg-[#B8F5D2] px-3 py-1 text-xs font-extrabold text-stroke">
              <Sparkles size={14} aria-hidden="true" />
              Complete!
            </span>
          ) : null}
        </header>

        <div>
          <div className="mb-2 flex items-end justify-between gap-3">
            <p className="text-sm font-bold text-stroke">
              {numberFormat.format(Math.min(safeProgress, safeTarget || safeProgress))}{" "}
              <span className="font-medium text-muted">
                of {numberFormat.format(safeTarget)} {unit}
              </span>
            </p>
            <p className="shrink-0 text-sm font-extrabold text-stroke">{percentage}%</p>
          </div>
          <div
            role="progressbar"
            aria-label={progressLabel ?? `${title} progress`}
            aria-valuemin={0}
            aria-valuemax={safeTarget}
            aria-valuenow={Math.min(safeProgress, safeTarget)}
            aria-valuetext={`${numberFormat.format(safeProgress)} of ${numberFormat.format(safeTarget)} ${unit}`}
            className="bg-surface-2 h-4 overflow-hidden rounded-full border-2 border-stroke"
          >
            <div
              className="bg-world-main h-full rounded-full border-r-2 border-stroke transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-sm">
            <span className="text-muted">Your contribution</span>
            <strong className="bg-world-soft rounded-lg border-2 border-stroke px-2 py-1 text-stroke">
              {numberFormat.format(safePersonalContribution)} {unit}
            </strong>
          </div>
        </div>

        {visibleContributors.length > 0 ? (
          <div className="border-t-2 border-dashed border-stroke/20 pt-4">
            <p className="mb-3 text-sm font-bold text-stroke">Top contributors</p>
            <ul className="flex flex-wrap gap-3">
              {visibleContributors.map((contributor) => (
                <li key={contributor.id} className="flex min-w-0 items-center gap-2">
                  <Avatar name={contributor.name} src={contributor.avatarUrl} size="sm" />
                  <span className="max-w-28 truncate text-sm font-semibold text-stroke">
                    {contributor.name}
                  </span>
                  <span className="text-xs font-bold text-muted">
                    {numberFormat.format(contributor.contribution)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div
          className={`flex items-start gap-3 rounded-2xl border-2 border-stroke p-4 shadow-[3px_3px_0px_var(--color-stroke)] ${
            isComplete ? "bg-[#B8F5D2]" : "bg-world-soft"
          }`}
          aria-live={isComplete ? "polite" : undefined}
        >
          <div className="mt-0.5 shrink-0 text-stroke" aria-hidden="true">
            {isComplete ? <Sparkles size={22} /> : <Gift size={22} />}
          </div>
          <div>
            <p className="font-heading font-bold text-stroke">
              {isComplete ? "Class quest complete!" : "Group reward"}
            </p>
            <p className="font-bold text-stroke">{rewardTitle}</p>
            {rewardDescription ? (
              <p className="mt-1 text-sm leading-relaxed text-stroke/80">{rewardDescription}</p>
            ) : null}
            {isComplete ? (
              <p className="mt-2 text-sm font-semibold text-stroke">
                Everyone can celebrate this shared achievement.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default ClassQuestProgress;
