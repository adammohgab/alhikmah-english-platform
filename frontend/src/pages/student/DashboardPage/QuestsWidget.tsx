import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Coins, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/app/providers/auth-context";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { ProgressBar } from "@/shared/components/ui/ProgressBar";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { useToast } from "@/shared/hooks/useToast";
import {
  claimQuest,
  fetchQuests,
  type ClaimReward,
  type Quest,
  type QuestBoard,
} from "../QuestsPage/api";
import { ChestDialog } from "../QuestsPage/ChestDialog";
import { STUDENT_STATS_KEY } from "./useStudentStats";

/* ========================================
   Daily quests preview (STUDENT-SPEC ST-01 section 2, STU-CORE-02)

   Today's three daily quests with a live progress meter, the reward, and a quick-claim button
   that unlocks when the quest is completed. The data is the same read as the Quests page
   (`fetchQuests`, which makes today's quests on demand and reads the student's own
   `quest_instances`) under the same query key, so the counters here and on the Quests page
   always show the same database values. The widget refetches on window focus and every
   minute, so progress made in a lesson or game shows up without a reload.
   Claiming opens the reward chest, then refreshes the XP, level and coin figures above.
   ======================================== */

/** Shared with the Quests page so both screens read one cache entry. */
const QUESTS_KEY = ["student", "quests"] as const;
const REFRESH_MS = 60_000;
const HEADING_ID = "quests-heading";

function QuestRow({
  quest,
  busy,
  onClaim,
}: {
  quest: Quest;
  busy: boolean;
  onClaim: (quest: Quest) => void;
}) {
  const claimed = quest.state === "claimed";
  const ready = quest.state === "ready";
  return (
    <li className="flex flex-col gap-2 rounded-[16px] border-2 border-stroke bg-surface-0 p-3">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-[16px] font-bold leading-tight text-stroke [overflow-wrap:anywhere]">
            {quest.title}
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-bold text-muted">
            <span>
              {quest.progress} / {quest.target}
            </span>
            <span className="flex items-center gap-1">
              <Sparkles aria-hidden="true" size={14} />
              {quest.xp} XP
            </span>
            <span className="flex items-center gap-1">
              <Coins aria-hidden="true" size={14} />
              {quest.coins} coins
            </span>
          </p>
        </div>
        {claimed ? (
          <Button variant="secondary" size="sm" disabled aria-label={`${quest.title}: claimed`}>
            <Check size={14} aria-hidden="true" />
            <span>Claimed</span>
          </Button>
        ) : (
          <Button
            size="sm"
            sound="coin"
            disabled={!ready}
            loading={busy}
            aria-label={ready ? `Claim reward for ${quest.title}` : `${quest.title}: keep going`}
            onClick={() => onClaim(quest)}
          >
            {ready ? "Claim" : "Keep going"}
          </Button>
        )}
      </div>
      <ProgressBar
        value={quest.progress}
        max={quest.target}
        label={quest.title}
        valueText={`${quest.progress} of ${quest.target}`}
      />
    </li>
  );
}

export function QuestsWidget() {
  const userId = useAuth().user?.id ?? null;
  const toast = useToast();
  const queryClient = useQueryClient();
  const [reward, setReward] = useState<ClaimReward | null>(null);

  const board = useQuery({
    queryKey: QUESTS_KEY,
    queryFn: fetchQuests,
    enabled: userId !== null,
    refetchOnWindowFocus: true,
    refetchInterval: REFRESH_MS,
  });

  const claim = useMutation({
    mutationFn: (quest: Quest) => claimQuest(quest.id),
    onSuccess: (granted, quest) => {
      queryClient.setQueryData<QuestBoard>(QUESTS_KEY, (current) =>
        current
          ? {
              daily: current.daily.map((q) => (q.id === quest.id ? { ...q, state: "claimed" } : q)),
              weekly: current.weekly.map((q) =>
                q.id === quest.id ? { ...q, state: "claimed" } : q,
              ),
            }
          : current,
      );
      setReward(granted);
      void queryClient.invalidateQueries({ queryKey: QUESTS_KEY });
      void queryClient.invalidateQueries({ queryKey: [STUDENT_STATS_KEY] });
      void queryClient.invalidateQueries({ queryKey: ["student-dashboard", "daily-xp"] });
    },
    onError: (error: Error) =>
      toast.show({ title: "Could not claim", description: error.message, type: "error" }),
  });

  const loading = board.isPending && !board.isError;
  const daily = board.data?.daily.slice(0, 3) ?? [];
  const claimed = daily.filter((quest) => quest.state === "claimed").length;
  const busyId = claim.isPending ? claim.variables?.id : undefined;

  return (
    <Card as="section" aria-labelledby={HEADING_ID}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={HEADING_ID} className="font-heading text-[22px] font-bold text-stroke">
          Daily quests
        </h2>
        <Link
          to="/student/quests"
          className="inline-flex items-center gap-1 text-[14px] font-bold text-stroke underline-offset-2 hover:underline"
        >
          See all
          <ArrowRight aria-hidden="true" size={14} strokeWidth={2.5} />
        </Link>
      </div>

      <div className="mt-3">
        {loading ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton shape="rect" className="h-20 w-full" label="Loading your quests…" />
            <Skeleton shape="rect" className="h-20 w-full" label={null} />
            <Skeleton shape="rect" className="h-20 w-full" label={null} />
          </div>
        ) : board.isError ? (
          <ErrorState
            size="sm"
            description="Your quests could not load. Check your connection and try again."
            onRetry={() => void board.refetch()}
          />
        ) : daily.length === 0 ? (
          <EmptyState size="sm" title="No quests today. Check back tomorrow." />
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-[14px] font-bold text-muted">
              {claimed} of {daily.length} claimed today
            </p>
            <ul className="flex flex-col gap-3">
              {daily.map((quest) => (
                <QuestRow
                  key={quest.id}
                  quest={quest}
                  busy={busyId === quest.id}
                  onClaim={(chosen) => claim.mutate(chosen)}
                />
              ))}
            </ul>
          </div>
        )}
      </div>

      <ChestDialog reward={reward} onClose={() => setReward(null)} />
    </Card>
  );
}
