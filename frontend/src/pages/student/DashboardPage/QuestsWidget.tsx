import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Coins, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { ProgressBar } from "@/shared/components/ui/ProgressBar";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { useToast } from "@/shared/hooks/useToast";
import { claimQuest, fetchQuests, type Quest, type QuestBoard } from "../QuestsPage/api";
import { STUDENT_STATS_KEY } from "./useStudentStats";

/* Daily quests widget (STUDENT-SPEC ST-01, STU-CORE-02).
   Today's three daily quests with live progress and a quick Claim button. It reads and claims
   through the Quests page's data layer under the same query key, so progress here and on the
   Quests page always show the same database values. A claim also refreshes the dashboard's XP
   bar, level and coins. */

const QUESTS_KEY = ["student", "quests"] as const;
const HEADING_ID = "quests-heading";
/** Pulls fresh counters while the dashboard stays open. */
const REFRESH_MS = 60_000;

function QuestRow({
  quest,
  busy,
  onClaim,
}: {
  quest: Quest;
  busy: boolean;
  onClaim: (quest: Quest) => void;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-[16px] border-2 border-stroke bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-heading text-[16px] font-semibold leading-snug text-stroke [overflow-wrap:anywhere]">
            {quest.title}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[13px] font-bold text-muted">
            <span className="inline-flex items-center gap-1">
              <Sparkles aria-hidden="true" size={13} strokeWidth={2.5} />+{quest.xp} XP
            </span>
            <span className="inline-flex items-center gap-1">
              <Coins aria-hidden="true" size={13} strokeWidth={2.5} />+{quest.coins} coins
            </span>
          </p>
        </div>

        {quest.state === "ready" && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => onClaim(quest)}
            aria-label={`Claim reward: ${quest.title}`}
          >
            {busy ? "Claiming…" : "Claim"}
          </Button>
        )}
        {quest.state === "claimed" && (
          <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-bold text-stroke">
            <Check aria-hidden="true" size={16} strokeWidth={3} />
            Claimed
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <ProgressBar
            value={quest.progress}
            max={quest.target}
            label={`${quest.title} progress`}
            valueText={`${quest.progress} of ${quest.target}`}
          />
        </div>
        <p className="shrink-0 text-[13px] font-bold tabular-nums text-stroke">
          {quest.progress}/{quest.target}
        </p>
      </div>
    </li>
  );
}

export function QuestsWidget() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const board = useQuery({
    queryKey: QUESTS_KEY,
    queryFn: fetchQuests,
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
      toast.show({
        type: "reward",
        title: "Reward claimed",
        description:
          `+${granted.xp} XP, +${granted.coins} coins` +
          (granted.freezeAwarded ? ", and a streak freeze" : ""),
      });
      void queryClient.invalidateQueries({ queryKey: QUESTS_KEY });
      void queryClient.invalidateQueries({ queryKey: [STUDENT_STATS_KEY] });
      void queryClient.invalidateQueries({ queryKey: ["student-dashboard", "daily-xp"] });
    },
    onError: (error: Error) =>
      toast.show({ title: "Could not claim", description: error.message, type: "error" }),
  });

  const daily = board.data?.daily ?? [];
  const claimed = daily.filter((quest) => quest.state === "claimed").length;
  const busyId = claim.isPending ? claim.variables?.id : undefined;

  return (
    <Card as="section" aria-labelledby={HEADING_ID}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={HEADING_ID} className="font-heading text-[22px] font-bold text-stroke">
          Daily quests
        </h2>
        {board.data !== undefined && daily.length > 0 && (
          <p className="text-[14px] font-bold text-muted">
            {claimed} of {daily.length} claimed
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {board.isPending ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton shape="rect" className="h-20 w-full" label="Loading quests…" />
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
          <EmptyState
            size="sm"
            title="No quests today"
            description="New daily quests appear each day."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {daily.map((quest) => (
              <QuestRow
                key={quest.id}
                quest={quest}
                busy={busyId === quest.id}
                onClaim={(target) => claim.mutate(target)}
              />
            ))}
          </ul>
        )}

        <Link
          to="/student/quests"
          className="self-start text-[14px] font-bold text-stroke underline underline-offset-2"
        >
          All quests
        </Link>
      </div>
    </Card>
  );
}
