import { Sparkles } from "lucide-react";
import { Card } from "@/shared/components/ui/Card";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { XpBar } from "@/shared/components/ui/XpBar";
import type { DailyXp } from "./api";

/* Daily XP goal (STU-CORE-01). The bar fills in proportion to today's earnings against the
   target set by the student's daily goal (light, regular or serious). */

export interface DailyXpCardProps {
  dailyXp: DailyXp | undefined;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}

const HEADING_ID = "daily-xp-heading";
const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

const GOAL_LABEL = { light: "Light", regular: "Regular", serious: "Serious" } as const;

export function DailyXpCard({ dailyXp, loading, failed, onRetry }: DailyXpCardProps) {
  return (
    <Card as="section" aria-labelledby={HEADING_ID}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={HEADING_ID} className="font-heading text-[22px] font-bold text-stroke">
          Daily XP goal
        </h2>
        {dailyXp !== undefined && (
          <p className="text-[14px] font-bold text-muted">{GOAL_LABEL[dailyXp.goal]} goal</p>
        )}
      </div>

      <div className="mt-3">
        {loading ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton shape="rect" className="h-5 w-full" label="Loading today's XP…" />
            <Skeleton shape="text" className="w-1/2" label={null} />
          </div>
        ) : failed || dailyXp === undefined ? (
          <ErrorState
            size="sm"
            description="Today's XP could not load. Check your connection and try again."
            onRetry={onRetry}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <XpBar
              value={dailyXp.earned}
              max={dailyXp.target}
              label="Daily XP goal"
              valueText={`${NUMBER_FORMAT.format(dailyXp.earned)} of ${NUMBER_FORMAT.format(
                dailyXp.target,
              )} XP today`}
            />
            <p className="flex items-center gap-2 text-[14px] font-bold text-stroke">
              <Sparkles aria-hidden="true" size={16} strokeWidth={2.5} />
              {dailyXp.reached
                ? `Goal reached with ${NUMBER_FORMAT.format(dailyXp.earned)} XP today.`
                : `${NUMBER_FORMAT.format(dailyXp.remaining)} XP to go today.`}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
