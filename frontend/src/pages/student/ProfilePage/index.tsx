import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
<<<<<<< HEAD
import { Link } from "react-router-dom";
import { Flame, GraduationCap, Pencil, Star, Target, Trophy } from "lucide-react";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
=======
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
>>>>>>> 7b774a56829125da7626a5f705f17f62f540944d
import { Avatar } from "@/shared/components/ui/Avatar";
import { Button } from "@/shared/components/ui/Button";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { LevelRing } from "@/shared/components/ui/LevelRing";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { Tooltip } from "@/shared/components/ui/Tooltip";
<<<<<<< HEAD
import { useAuth } from "@/shared/hooks/useAuth";
import { useToast } from "@/shared/hooks/useToast";
import { ACHIEVEMENTS_KEY, pinBadges } from "../AchievementsPage/api";
import { BadgeArt } from "../AchievementsPage/BadgeArt";
import { buildAchievements, formatEarnedDate } from "../AchievementsPage/rules";
import { fetchProfile, levelProgress, PROFILE_KEY } from "./api";
import { PinnedBadgesDialog } from "./PinnedBadgesDialog";
=======
import {
  STUDENT_PROFILE_KEY,
  fetchStudentProfile,
  levelProgress,
  updatePinnedBadges,
  xpAtLevel,
} from "./api";
import type { ProfileBadge } from "./api";
import AvatarStudioModal from "./AvatarStudioModal";
>>>>>>> 7b774a56829125da7626a5f705f17f62f540944d

/* Student profile (ST-28): hero with level ring, stats grid and the pinned badges showcase.
   Every number is read from the student's own rows; the ring percentage is derived from the
   documented level curve for display only. */

<<<<<<< HEAD
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
=======
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
>>>>>>> 7b774a56829125da7626a5f705f17f62f540944d
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const studentId = user?.id;
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const query = useQuery({
<<<<<<< HEAD
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
=======
    queryKey: [STUDENT_PROFILE_KEY, studentId],
    queryFn: () => fetchStudentProfile(studentId!),
    enabled: Boolean(studentId),
  });

  const pinMutation = useMutation({
    mutationFn: (badgeIds: string[]) => updatePinnedBadges(studentId!, badgeIds),
>>>>>>> 7b774a56829125da7626a5f705f17f62f540944d
    onSuccess: () => {
      toast.show({ title: "Pinned badges updated", type: "success" });
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: [ACHIEVEMENTS_KEY, studentId] });
      void queryClient.invalidateQueries({ queryKey: [PROFILE_KEY, studentId] });
    },
    onError: (error: Error) =>
<<<<<<< HEAD
      toast.show({ title: "Could not update pins", description: error.message, type: "error" }),
=======
      toast.show({
        title: "Could not update pinned badges",
        description: error.message,
        type: "error",
      }),
>>>>>>> 7b774a56829125da7626a5f705f17f62f540944d
  });

  if (query.isError) {
    return (
<<<<<<< HEAD
      <main className="mx-auto w-full max-w-4xl p-4">
        <ErrorState
          description="Your profile could not load. Check your connection and try again."
=======
      <main className="mx-auto w-full max-w-5xl p-4">
        <ErrorState
          title="Your profile could not load"
          description="Your learning records could not be loaded. Check your connection and try again."
>>>>>>> 7b774a56829125da7626a5f705f17f62f540944d
          onRetry={() => void query.refetch()}
        />
      </main>
    );
  }

<<<<<<< HEAD
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
=======
  if (!profile) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4" aria-busy="true">
        <Skeleton shape="rect" className="h-48 w-full" label="Loading your profile" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} shape="rect" className="h-36 w-full" />
          ))}
        </div>
>>>>>>> 7b774a56829125da7626a5f705f17f62f540944d
      </main>
    );
  }

  const name = data.displayName ?? user?.fullName ?? data.username ?? "Student";
  const progress = levelProgress(data.totalXp, data.level);

  return (
<<<<<<< HEAD
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
=======
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
>>>>>>> 7b774a56829125da7626a5f705f17f62f540944d
          </div>

<<<<<<< HEAD
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
=======
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
>>>>>>> 7b774a56829125da7626a5f705f17f62f540944d
  );
}
