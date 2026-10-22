import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  BookOpenCheck,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  Flame,
  PencilLine,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useAuth } from "@/shared/hooks/useAuth";
import { useToast } from "@/shared/hooks/useToast";
import { Avatar } from "@/shared/components/ui/Avatar";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { Dialog } from "@/shared/components/ui/Dialog";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { LevelRing } from "@/shared/components/ui/LevelRing";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { Tooltip } from "@/shared/components/ui/Tooltip";
import {
  STUDENT_PROFILE_KEY,
  fetchStudentProfile,
  levelProgress,
  updatePinnedBadges,
  xpAtLevel,
} from "./api";
import type { ProfileBadge } from "./api";
import AvatarStudioModal from "./AvatarStudioModal";

const numberFormat = new Intl.NumberFormat("en-US");

function StatCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <Card
      className="flex min-h-36 flex-col gap-3 p-4"
      data-testid={`stat-${label.toLowerCase().replaceAll(" ", "-")}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground text-sm font-bold">{label}</span>
        <span
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-stroke bg-[var(--world-tint,#fff8db)] text-stroke"
        >
          {icon}
        </span>
      </div>
      <p className="font-heading text-3xl font-bold leading-none text-stroke">{value}</p>
      <p className="text-muted-foreground text-sm">{detail}</p>
    </Card>
  );
}

function BadgeSticker({ badge }: { badge: ProfileBadge }) {
  return (
    <Tooltip>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          aria-label={`${badge.name}: ${badge.description}`}
          className="group flex min-h-32 min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-stroke bg-white p-3 text-center shadow-[3px_3px_0px_#1A1530] transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stroke focus-visible:ring-offset-2 motion-reduce:transition-none"
        >
          {badge.iconUrl ? (
            <img src={badge.iconUrl} alt="" loading="lazy" className="h-12 w-12 object-contain" />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-stroke bg-[#FFF1C2]"
            >
              <Award size={26} />
            </span>
          )}
          <span className="line-clamp-2 text-sm font-bold">{badge.name}</span>
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content side="top">
        <p className="font-bold">{badge.name}</p>
        <p>{badge.description}</p>
        {badge.earnedAt && (
          <p className="mt-1 text-xs">Earned {new Date(badge.earnedAt).toLocaleDateString()}</p>
        )}
        <Tooltip.Arrow />
      </Tooltip.Content>
    </Tooltip>
  );
}

function PinnedBadgesDialog({
  open,
  onOpenChange,
  badges,
  pinnedIds,
  onSave,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  badges: ProfileBadge[];
  pinnedIds: string[];
  onSave: (ids: string[]) => void;
  busy: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(pinnedIds);
  const [error, setError] = useState<string | null>(null);

  // Keep selections in sync when the modal opens after a successful refresh.
  const earnedIds = useMemo(() => badges.map((badge) => badge.id), [badges]);
  const pinnedKey = pinnedIds.join("|");
  const stablePinnedIds = useMemo(() => (pinnedKey ? pinnedKey.split("|") : []), [pinnedKey]);
  useEffect(() => {
    if (open) setSelected(stablePinnedIds);
  }, [open, stablePinnedIds]);
  const toggle = (id: string) => {
    setError(null);
    setSelected((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id);
      if (current.length >= 3) {
        setError("Choose up to three badges. Remove one before adding another.");
        return current;
      }
      return [...current, id];
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setSelected(pinnedIds);
        setError(null);
        onOpenChange(next);
      }}
      title="Change pinned badges"
      description="Choose up to three earned badges to show on your profile."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={() => onSave(selected.filter((id) => earnedIds.includes(id)))}
            loading={busy}
          >
            Save badges ({selected.length}/3)
          </Button>
        </>
      }
    >
      {badges.length === 0 ? (
        <EmptyState
          size="sm"
          title="No earned badges yet"
          description="Earn a badge while learning, then come back to pin it here."
        />
      ) : (
        <ul
          aria-label="Earned badges to pin"
          className="grid max-h-[50vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3"
        >
          {badges.map((badge) => {
            const checked = selected.includes(badge.id);
            return (
              <li key={badge.id}>
                <button
                  type="button"
                  aria-pressed={checked}
                  onClick={() => toggle(badge.id)}
                  className={`flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 p-3 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${checked ? "border-stroke bg-[var(--world-soft,#ffea94)] shadow-[3px_3px_0px_#1A1530]" : "border-stroke/40 bg-white"}`}
                >
                  {badge.iconUrl ? (
                    <img src={badge.iconUrl} alt="" className="h-10 w-10 object-contain" />
                  ) : (
                    <Award aria-hidden="true" size={28} />
                  )}
                  <span className="text-sm font-bold">{badge.name}</span>
                  <span className="text-xs">{checked ? "Pinned" : "Tap to pin"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-[#B3162D]">
          {error}
        </p>
      )}
    </Dialog>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const studentId = user?.id;
  const toast = useToast();
  const queryClient = useQueryClient();
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);

  const query = useQuery({
    queryKey: [STUDENT_PROFILE_KEY, studentId],
    queryFn: () => fetchStudentProfile(studentId!),
    enabled: Boolean(studentId),
  });

  const pinMutation = useMutation({
    mutationFn: (badgeIds: string[]) => updatePinnedBadges(studentId!, badgeIds),
    onSuccess: () => {
      setPinDialogOpen(false);
      toast.show({ title: "Pinned badges updated", type: "success" });
      void queryClient.invalidateQueries({ queryKey: [STUDENT_PROFILE_KEY, studentId] });
    },
    onError: (error: Error) =>
      toast.show({
        title: "Could not update pinned badges",
        description: error.message,
        type: "error",
      }),
  });

  const profile = query.data;
  const pinnedBadges = profile?.badges.filter((badge) => badge.pinned).slice(0, 3) ?? [];

  if (query.isError) {
    return (
      <main className="mx-auto w-full max-w-5xl p-4">
        <ErrorState
          title="Your profile could not load"
          description="Your learning records could not be loaded. Check your connection and try again."
          onRetry={() => void query.refetch()}
        />
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4" aria-busy="true">
        <Skeleton shape="rect" className="h-48 w-full" label="Loading your profile" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} shape="rect" className="h-36 w-full" />
          ))}
        </div>
      </main>
    );
  }

  const progress = levelProgress(profile.totalXp, profile.currentLevel);
  const gradeLabel = profile.gradeLevel ? `Grade ${profile.gradeLevel}` : "Grade not assigned";
  const pinnedIds = pinnedBadges.map((badge) => badge.id);

  return (
    <main data-world="amber" className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-2">
        <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-[var(--world-deep,#6e5200)]">
          <Sparkles size={16} aria-hidden="true" /> Your learning space
        </p>
        <h1 className="font-heading text-3xl font-bold leading-tight text-stroke sm:text-4xl">
          My profile
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm sm:text-base">
          Your progress, proud moments, and the learning milestones you have earned.
        </p>
      </header>

      <section
        aria-labelledby="profile-hero-title"
        className="relative overflow-hidden rounded-3xl border-2 border-stroke bg-[var(--world-tint,#fff8db)] p-5 shadow-[4px_4px_0px_#1A1530] sm:p-7"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-4 -top-8 rotate-12 text-[100px] text-[var(--world-soft,#ffea94)]"
        >
          ✦
        </div>
        <div className="relative flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
          <LevelRing
            value={progress}
            size={112}
            strokeWidth={7}
            world="amber"
            label="Level progress"
            valueText={
              profile.currentLevel >= 60
                ? "Maximum level reached"
                : `${Math.round(progress)} percent toward level ${profile.currentLevel + 1}`
            }
          >
            <Avatar size="xl" src={profile.avatarUrl} name={profile.displayName} world="amber" />
          </LevelRing>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border-2 border-stroke bg-white px-3 py-1 text-sm font-bold">
              <Trophy size={16} aria-hidden="true" /> Level {profile.currentLevel}
            </div>
            <h2
              id="profile-hero-title"
              className="break-words font-heading text-2xl font-bold text-stroke sm:text-3xl"
            >
              {profile.displayName}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">@{profile.username}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              <span className="inline-flex items-center gap-2 rounded-full border-2 border-stroke bg-white px-3 py-1.5 text-sm font-semibold">
                <BookOpenCheck size={16} aria-hidden="true" />
                {gradeLabel}
              </span>
              {profile.className && (
                <span className="inline-flex items-center gap-2 rounded-full border-2 border-stroke bg-white px-3 py-1.5 text-sm font-semibold">
                  <CalendarDays size={16} aria-hidden="true" />
                  {profile.className}
                </span>
              )}
              <span className="inline-flex items-center gap-2 rounded-full border-2 border-stroke bg-white px-3 py-1.5 text-sm font-semibold">
                <Flame size={16} aria-hidden="true" />
                {profile.currentStreak} day streak
              </span>
            </div>
            <div className="mt-4 flex justify-center sm:justify-start">
              <Button onClick={() => setAvatarDialogOpen(true)}>
                <PencilLine size={17} aria-hidden="true" /> Edit avatar
              </Button>
            </div>
          </div>
          <div className="w-full max-w-xs rounded-2xl border-2 border-stroke bg-white p-4 sm:w-44">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>LEVEL PROGRESS</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full border-2 border-stroke bg-[#F3E8C7]">
              <div
                className="h-full rounded-full bg-[var(--world-main,#ffd23f)] transition-[width] motion-reduce:transition-none"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              {profile.currentLevel >= 60
                ? "Max level reached"
                : `${numberFormat.format(Math.max(0, xpAtLevel(profile.currentLevel + 1) - profile.totalXp))} XP to the next level`}
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="lifetime-stats-title" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="lifetime-stats-title" className="font-heading text-2xl font-bold text-stroke">
              Your lifetime stats
            </h2>
            <p className="text-muted-foreground text-sm">
              A snapshot of your learning journey so far.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border-2 border-stroke bg-white px-3 py-1 text-xs font-bold">
            <ChartNoAxesColumnIncreasing size={15} aria-hidden="true" /> All-time progress
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total XP"
            value={numberFormat.format(profile.totalXp)}
            detail="Experience earned"
            icon={<Sparkles size={21} />}
          />
          <StatCard
            label="Lessons Completed"
            value={numberFormat.format(profile.lessonsCompleted)}
            detail="Lessons finished"
            icon={<BookOpenCheck size={21} />}
          />
          <StatCard
            label="Quiz Average"
            value={profile.quizAverage === null ? "—" : `${Math.round(profile.quizAverage)}%`}
            detail={
              profile.quizAverage === null
                ? "Complete a quiz to see your average"
                : "Average of counted quiz results"
            }
            icon={<ChartNoAxesColumnIncreasing size={21} />}
          />
          <StatCard
            label="Longest Streak"
            value={numberFormat.format(profile.longestStreak)}
            detail="Consecutive learning days"
            icon={<Flame size={21} />}
          />
        </div>
      </section>

      <section aria-labelledby="pinned-badges-title" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="pinned-badges-title" className="font-heading text-2xl font-bold text-stroke">
              Pinned badges
            </h2>
            <p className="text-muted-foreground text-sm">
              Show off up to three achievements you are proud of.
            </p>
          </div>
          <Button variant="secondary" onClick={() => setPinDialogOpen(true)}>
            <PencilLine size={17} aria-hidden="true" /> Change pinned badges
          </Button>
        </div>
        {pinnedBadges.length ? (
          <Tooltip.Provider>
            <ul aria-label="Pinned badges" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {pinnedBadges.map((badge) => (
                <li key={badge.id}>
                  <BadgeSticker badge={badge} />
                </li>
              ))}
            </ul>
          </Tooltip.Provider>
        ) : (
          <Card className="p-1">
            <EmptyState
              size="sm"
              title="Your showcase is ready"
              description="Pin up to three earned badges to make this space yours."
              actionLabel="Choose pinned badges"
              onAction={() => setPinDialogOpen(true)}
            />
          </Card>
        )}
      </section>

      <PinnedBadgesDialog
        open={pinDialogOpen}
        onOpenChange={setPinDialogOpen}
        badges={profile.badges}
        pinnedIds={pinnedIds}
        busy={pinMutation.isPending}
        onSave={(ids) => pinMutation.mutate(ids)}
      />
      <AvatarStudioModal
        open={avatarDialogOpen}
        onOpenChange={setAvatarDialogOpen}
        currentLevel={profile.currentLevel}
        avatarUrl={profile.avatarUrl}
        onSaved={() =>
          void queryClient.invalidateQueries({ queryKey: [STUDENT_PROFILE_KEY, studentId] })
        }
      />
    </main>
  );
}
