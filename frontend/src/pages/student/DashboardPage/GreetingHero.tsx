import { Coins } from "lucide-react";
import { Avatar } from "@/shared/components/ui/Avatar";
import { Card } from "@/shared/components/ui/Card";
import { LevelIndicator } from "@/shared/components/ui/LevelIndicator";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { StreakFlame } from "@/shared/components/gamification/StreakFlame";
import type { StudentStats } from "./useStudentStats";
import type { DailyXp } from "./api";

/* Greeting hero band (ST-01 section 1): "Good evening, {first name}", a one-line nudge, and the
   student's plate: avatar inside a ring that charts progress to the next level, the level badge
   with its rank title, the streak flame and the coin balance. */

const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

export interface GreetingHeroProps {
  greeting: string;
  firstName: string;
  fullName: string;
  avatarUrl: string | null;
  /** `undefined` while the stats load. */
  stats: StudentStats | undefined;
  statsFailed: boolean;
  dailyXp: DailyXp | undefined;
}

function nudgeFor(stats: StudentStats | undefined, dailyXp: DailyXp | undefined): string {
  if (dailyXp?.reached === true) {
    return "Daily goal reached. Every XP from now on is a bonus.";
  }
  if (dailyXp !== undefined && dailyXp.earned > 0) {
    return `${NUMBER_FORMAT.format(dailyXp.remaining)} XP to reach today's goal. Keep it up.`;
  }
  if (stats !== undefined && stats.streak > 0) {
    return `You are on a ${stats.streak}-day streak. Learn something today to keep it alive.`;
  }
  return "Ready when you are. One lesson is a great start.";
}

export function GreetingHero({
  greeting,
  firstName,
  fullName,
  avatarUrl,
  stats,
  statsFailed,
  dailyXp,
}: GreetingHeroProps) {
  const levelPercent = stats?.progress.percent ?? 0;

  return (
    <Card as="section" tone="tint" aria-labelledby="dashboard-greeting">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1
            id="dashboard-greeting"
            className="font-heading text-[28px] font-bold leading-tight text-stroke [overflow-wrap:anywhere] md:text-[34px]"
          >
            {greeting}, {firstName}
          </h1>
          <p className="mt-1 text-[16px] font-medium text-stroke/80">{nudgeFor(stats, dailyXp)}</p>
        </div>

        <div className="flex items-center gap-4">
          <Avatar
            size="xl"
            name={fullName}
            src={avatarUrl}
            progress={levelPercent}
            progressLabel={
              stats === undefined
                ? "Level progress"
                : stats.progress.isMaxLevel
                  ? `Level ${stats.level}, top level`
                  : `Level ${stats.level}, ${Math.round(levelPercent)} percent to level ${
                      stats.level + 1
                    }`
            }
          />

          {stats === undefined ? (
            statsFailed ? (
              <p role="alert" className="max-w-[12rem] text-[14px] font-bold text-stroke">
                Your level could not load.
              </p>
            ) : (
              <div className="flex flex-col gap-2" aria-busy="true">
                <Skeleton shape="rect" className="h-8 w-28" label="Loading your level…" />
                <Skeleton shape="rect" className="h-6 w-20" label={null} />
              </div>
            )
          ) : (
            <div className="flex flex-col items-start gap-2">
              <LevelIndicator level={stats.level} />
              <p className="font-heading text-[15px] font-semibold text-stroke">{stats.rank}</p>
              <div className="flex flex-wrap items-center gap-3">
                <StreakFlame
                  streakDays={stats.streak}
                  freezes={stats.freezes}
                  doneToday={dailyXp === undefined ? undefined : dailyXp.earned > 0}
                  size="sm"
                />
                <span
                  className="inline-flex items-center gap-1 font-heading text-[15px] font-semibold tabular-nums text-stroke"
                  role="group"
                  aria-label={`Coins: ${NUMBER_FORMAT.format(stats.coins)}`}
                >
                  <Coins
                    aria-hidden="true"
                    size={20}
                    strokeWidth={2.5}
                    className="fill-[#ffd93d] stroke-stroke"
                  />
                  <span aria-hidden="true">{NUMBER_FORMAT.format(stats.coins)}</span>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
