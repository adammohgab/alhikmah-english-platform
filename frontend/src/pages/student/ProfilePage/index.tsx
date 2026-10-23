import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Flame, GraduationCap, Pencil, Star, Target, Trophy } from "lucide-react";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import { Avatar } from "@/shared/components/ui/Avatar";
import { Button } from "@/shared/components/ui/Button";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { LevelRing } from "@/shared/components/ui/LevelRing";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { Tooltip } from "@/shared/components/ui/Tooltip";
import { useAuth } from "@/shared/hooks/useAuth";
import { useToast } from "@/shared/hooks/useToast";
import { ACHIEVEMENTS_KEY, pinBadges } from "../AchievementsPage/api";
import { BadgeArt } from "../AchievementsPage/BadgeArt";
import { buildAchievements, formatEarnedDate } from "../AchievementsPage/rules";
import { fetchProfile, levelProgress, PROFILE_KEY } from "./api";
import { PinnedBadgesDialog } from "./PinnedBadgesDialog";

/* Student profile (ST-28): hero with level ring, stats grid and the pinned badges showcase.
   Every number is read from the student's own rows; the ring percentage is derived from the
   documented level curve for display only. */

interface StatCardProps {
  icon: ComponentType<LucideProps>;
  label: string;
  value: string;
  tone: string;
}

function StatCard({ icon: Icon, label, value, tone }: StatCardProps) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border-2 border-stroke bg-surface-0 p-4 shadow-sm">
      <span
        aria-hidden="true"
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-stroke ${tone}`}
      >
        <Icon size={22} strokeWidth={2.5} />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-muted">{label}</p>
        <p className="font-heading text-2xl font-bold leading-tight text-stroke">{value}</p>
      </div>
    </li>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const studentId = user?.id;
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const query = useQuery({
    queryKey: [PROFILE_KEY, studentId],
    queryFn: () => fetchProfile(studentId!),
    enabled: studentId !== undefined,
  });

  const data = query.data;
  const gallery = useMemo(() => (data ? buildAchievements(data.achievements) : null), [data]);
  const earned = useMemo(
    () => (gallery ? gallery.badges.filter((badge) => badge.status === "earned") : []),
    [gallery],
  );
  const pinned = useMemo(
    () =>
      gallery
        ? gallery.pinnedIds
            .map((id) => gallery.badges.find((badge) => badge.id === id))
            .filter((badge) => badge !== undefined)
        : [],
    [gallery],
  );

  const save = useMutation({
    mutationFn: (ids: string[]) => pinBadges(studentId!, ids),
    onSuccess: () => {
      toast.show({ title: "Pinned badges updated", type: "success" });
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: [ACHIEVEMENTS_KEY, studentId] });
      void queryClient.invalidateQueries({ queryKey: [PROFILE_KEY, studentId] });
    },
    onError: (error: Error) =>
      toast.show({ title: "Could not update pins", description: error.message, type: "error" }),
  });

  if (query.isError) {
    return (
      <main className="mx-auto w-full max-w-4xl p-4">
        <ErrorState
          description="Your profile could not load. Check your connection and try again."
          onRetry={() => void query.refetch()}
        />
      </main>
    );
  }

  if (!data || !gallery) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4" aria-busy="true">
        <Skeleton shape="rect" className="h-40 w-full" label="Loading profile" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((n) => (
            <Skeleton key={n} shape="rect" className="h-24 w-full" label={null} />
          ))}
        </div>
        <Skeleton shape="rect" className="h-48 w-full" label={null} />
      </main>
    );
  }

  const name = data.displayName ?? user?.fullName ?? data.username ?? "Student";
  const progress = levelProgress(data.totalXp, data.level);

  return (
    <Tooltip.Provider>
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4">
        <section
          aria-label="Profile"
          className="flex flex-col items-center gap-4 rounded-3xl border-2 border-stroke bg-surface-0 p-6 text-center shadow-md sm:flex-row sm:text-left"
        >
          <LevelRing
            value={progress}
            size={96}
            label="Level progress"
            valueText={`Level ${data.level}, ${progress} percent to the next level`}
          >
            <Avatar size="xl" src={data.avatarUrl} name={name} />
          </LevelRing>
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="font-heading text-[28px] font-bold leading-tight text-stroke">{name}</h1>
            {data.username && <p className="text-sm text-muted">@{data.username}</p>}
            <p className="text-base font-semibold text-stroke">
              Level {data.level}
              {data.gradeLevel ? ` · Grade ${data.gradeLevel}` : ""}
              {data.className ? ` · ${data.className}` : ""}
            </p>
          </div>
        </section>

        <ul aria-label="Stats" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={Star}
            label="Total XP"
            value={data.totalXp.toLocaleString()}
            tone="bg-world-amber-300"
          />
          <StatCard
            icon={GraduationCap}
            label="Lessons completed"
            value={data.lessonsCompleted.toLocaleString()}
            tone="bg-world-sky-300"
          />
          <StatCard
            icon={Target}
            label="Quiz average"
            value={
              data.quizAverage === null ? "No quizzes yet" : `${Math.round(data.quizAverage)}%`
            }
            tone="bg-world-violet-300"
          />
          <StatCard
            icon={Flame}
            label="Longest streak"
            value={`${data.longestStreak} ${data.longestStreak === 1 ? "day" : "days"}`}
            tone="bg-world-coral-600"
          />
        </ul>

        <section
          aria-labelledby="pinned-heading"
          className="flex flex-col gap-3 rounded-3xl border-2 border-stroke bg-surface-0 p-4 shadow-md"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="pinned-heading" className="font-heading text-xl font-bold text-stroke">
              Pinned badges
            </h2>
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              <Pencil size={16} aria-hidden="true" />
              Change Pinned Badges
            </Button>
          </div>

          {pinned.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Trophy size={32} aria-hidden="true" className="text-muted" />
              <p className="text-sm text-muted">
                {earned.length === 0
                  ? "No badges earned yet. Finish a lesson to get your first one."
                  : "Pin up to three badges to show them off."}
              </p>
              <Link to="/student/achievements" className="text-sm font-bold underline">
                See all achievements
              </Link>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {pinned.map((badge) => (
                <li key={badge.id}>
                  <Tooltip>
                    <Tooltip.Trigger asChild>
                      <button
                        type="button"
                        className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-stroke bg-surface-100 p-4 text-center"
                      >
                        <BadgeArt badge={badge} size="lg" />
                        <span className="text-base font-bold text-stroke">{badge.name}</span>
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Content>
                      <p className="font-bold">{badge.name}</p>
                      <p>{badge.description}</p>
                      {badge.earnedAt && <p>Earned {formatEarnedDate(badge.earnedAt)}</p>}
                      <Tooltip.Arrow />
                    </Tooltip.Content>
                  </Tooltip>
                </li>
              ))}
            </ul>
          )}
        </section>

        <PinnedBadgesDialog
          open={editing}
          onOpenChange={setEditing}
          earned={earned}
          initial={gallery.pinnedIds}
          saving={save.isPending}
          onSave={(ids) => save.mutate(ids)}
        />
      </main>
    </Tooltip.Provider>
  );
}
