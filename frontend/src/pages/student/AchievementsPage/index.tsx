import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/shared/hooks/useAuth";
import { useToast } from "@/shared/hooks/useToast";
import { Chip } from "@/shared/components/ui/Chip";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { ProgressBar } from "@/shared/components/ui/ProgressBar";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/Tabs";
import { ACHIEVEMENTS_KEY, fetchAchievements, pinBadges } from "./api";
import { BadgeDialog } from "./BadgeDialog";
import { BadgeTile } from "./BadgeTile";
import {
  GROUPS,
  STATUS_FILTERS,
  buildAchievements,
  filterBadges,
  pinnedAfterToggle,
} from "./rules";
import type { Badge, BadgeStatus, GroupId } from "./rules";

/* ========================================
   Achievements (STUDENT-SPEC ST-26, task STU-GAM-12)

   The badge gallery at /student/achievements: how many badges the student has earned, category
   tabs (Streaks, Learning, Quizzes, Special Events), a status filter, and a grid of badge tiles.
   Unlocked badges are in full color with their earn date; locked ones are a gray silhouette with
   a progress bar. A tile opens a dialog with the requirement, XP reward and, for unlocked
   badges, "Pin to Profile" (up to three).
   ======================================== */

type GroupFilter = GroupId | "all";

const TABS: readonly { id: GroupFilter; label: string }[] = [
  { id: "all", label: "All" },
  ...GROUPS,
];

export default function AchievementsPage() {
  const { user } = useAuth();
  const studentId = user?.id;
  const toast = useToast();
  const queryClient = useQueryClient();
  const [group, setGroup] = useState<GroupFilter>("all");
  const [status, setStatus] = useState<BadgeStatus | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: [ACHIEVEMENTS_KEY, studentId],
    queryFn: () => fetchAchievements(studentId as string),
    enabled: studentId !== undefined,
  });

  const gallery = useMemo(() => (query.data ? buildAchievements(query.data) : null), [query.data]);
  const open = gallery?.badges.find((badge) => badge.id === openId) ?? null;

  const pin = useMutation({
    mutationFn: (badge: Badge) => {
      const next = gallery ? pinnedAfterToggle(gallery.pinnedIds, badge) : null;
      if (!next) return Promise.reject(new Error("You can pin up to three badges."));
      return pinBadges(studentId as string, next).then(() => !badge.pinned);
    },
    onSuccess: (pinned, badge) => {
      toast.show({
        title: pinned ? `${badge.name} pinned to your profile` : `${badge.name} unpinned`,
        type: "success",
      });
      void queryClient.invalidateQueries({ queryKey: [ACHIEVEMENTS_KEY, studentId] });
    },
    onError: (error: Error) =>
      toast.show({ title: "Could not update pins", description: error.message, type: "error" }),
  });

  const visible = gallery ? filterBadges(gallery.badges, group, status) : [];

  const grid =
    visible.length === 0 ? (
      <EmptyState
        size="md"
        title="No badges here"
        description="No badges match these filters. Try another category or status."
        actionLabel="Show all badges"
        onAction={() => {
          setGroup("all");
          setStatus("all");
        }}
      />
    ) : (
      <ul
        aria-label="Badges"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      >
        {visible.map((badge) => (
          <BadgeTile key={badge.id} badge={badge} onOpen={(chosen) => setOpenId(chosen.id)} />
        ))}
      </ul>
    );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-[28px] font-bold leading-tight text-stroke">
          Achievements
        </h1>
        {gallery && (
          <div className="flex flex-col gap-1">
            <p className="text-base font-bold text-stroke" data-testid="earned-summary">
              {gallery.earnedCount} of {gallery.total} badges earned
            </p>
            <ProgressBar
              value={gallery.earnedCount}
              max={Math.max(gallery.total, 1)}
              label="Badges earned"
              valueText={`${gallery.earnedCount} of ${gallery.total}`}
            />
          </div>
        )}
      </header>

      {query.isError ? (
        <ErrorState
          description="Your badges could not load. Check your connection and try again."
          onRetry={() => void query.refetch()}
        />
      ) : !gallery ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
            <Skeleton
              key={n}
              shape="rect"
              className="h-40 w-full"
              label={n === 0 ? "Loading badges" : null}
            />
          ))}
        </div>
      ) : gallery.total === 0 ? (
        <EmptyState
          size="md"
          title="No badges yet"
          description="Badges will appear here once they are added."
        />
      ) : (
        <>
          <Tabs value={group} onValueChange={(value) => setGroup(value as GroupFilter)}>
            <TabsList aria-label="Badge categories">
              {TABS.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <div
              role="group"
              aria-label="Filter badges by status"
              className="mt-3 flex flex-wrap gap-2"
            >
              {STATUS_FILTERS.map((filter) => (
                <Chip
                  key={filter.id}
                  selected={status === filter.id}
                  onClick={() => setStatus(filter.id)}
                >
                  {filter.label}
                </Chip>
              ))}
            </div>
            {TABS.map((tab) => (
              <TabsContent key={tab.id} value={tab.id} className="mt-4">
                {grid}
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}

      <BadgeDialog
        badge={open}
        pinnedCount={gallery?.pinnedIds.length ?? 0}
        busy={pin.isPending}
        onTogglePin={(badge) => pin.mutate(badge)}
        onClose={() => setOpenId(null)}
      />
    </main>
  );
}
