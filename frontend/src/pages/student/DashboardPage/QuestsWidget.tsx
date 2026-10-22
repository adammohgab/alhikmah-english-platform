import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, Sparkles } from "lucide-react";
import { Button } from "@/shared/components/ui/Button";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { ProgressBar } from "@/shared/components/ui/ProgressBar";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { useToast } from "@/shared/hooks/useToast";
import { cn } from "@/shared/lib/utils/cn";
import { claimQuest, fetchQuests, type Quest, type QuestBoard } from "../QuestsPage/api";

/* Daily quests widget (STUDENT-SPEC ST-01 section 2, task STU-CORE-02).
   The three daily quests with live progress and a quick Claim button that unlocks when a quest
   is completed. It reads the same data, under the same query key, as the Quests page, so
   progress, claims and the chest meter stay in step between the two. */

const QUESTS_KEY = ["student", "quests"] as const;

export function QuestsWidget({ className }: { className?: string | undefined }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: QUESTS_KEY,
    queryFn: fetchQuests,
    refetchOnWindowFocus: true,
  });

  const claim = useMutation({
    mutationFn: (quest: Quest) => claimQuest(quest.id),
    onSuccess: (granted, quest) => {
      queryClient.setQueryData<QuestBoard>(QUESTS_KEY, (current) =>
        current
          ? {
              ...current,
              daily: current.daily.map((q) => (q.id === quest.id ? { ...q, state: "claimed" } : q)),
            }
          : current,
      );
      toast.show({
        title: `+${granted.xp} XP, +${granted.coins} coins`,
        description: granted.freezeAwarded ? "Bonus: you found a streak freeze!" : quest.title,
        type: "reward",
      });
      void queryClient.invalidateQueries({ queryKey: QUESTS_KEY });
    },
    onError: (error: Error) =>
      toast.show({ title: "Could not claim", description: error.message, type: "error" }),
  });

  const daily = query.data?.daily ?? [];
  const claimed = daily.filter((quest) => quest.state === "claimed").length;
  const busyId = claim.isPending ? claim.variables?.id : undefined;

  return (
    <section
      aria-labelledby="quests-widget-heading"
      className={cn(
        "rounded-[20px] border-2 border-stroke bg-surface-0 p-4 shadow-[2px_2px_0px_#000]",
        className,
      )}
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 id="quests-widget-heading" className="font-display text-[20px] text-stroke">
          Daily quests
        </h2>
        {daily.length > 0 && (
          <p className="text-[13px] font-bold text-stroke">
            {claimed} of {daily.length} claimed
          </p>
        )}
      </div>

      {query.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2].map((n) => (
            <Skeleton key={n} shape="rect" className="h-16 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState
          size="sm"
          description="Your quests could not load. Check your connection and try again."
          onRetry={() => void query.refetch()}
        />
      ) : daily.length === 0 ? (
        <EmptyState size="sm" title="No quests today. Check back tomorrow." />
      ) : (
        <ul className="flex flex-col gap-3">
          {daily.map((quest) => (
            <li key={quest.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 font-bold text-stroke [overflow-wrap:anywhere]">
                  {quest.title}
                </span>
                {quest.state === "claimed" ? (
                  <span className="shrink-0 text-[13px] font-bold text-stroke">Claimed</span>
                ) : (
                  <Button
                    size="sm"
                    sound="coin"
                    disabled={quest.state !== "ready"}
                    loading={busyId === quest.id}
                    onClick={() => claim.mutate(quest)}
                  >
                    Claim
                  </Button>
                )}
              </div>
              <ProgressBar
                value={quest.progress}
                max={quest.target}
                label={quest.title}
                valueText={`${quest.progress} of ${quest.target}`}
              />
              <p className="flex items-center gap-3 text-[13px] text-stroke">
                <span>
                  {quest.progress} / {quest.target}
                </span>
                <span className="flex items-center gap-1">
                  <Sparkles size={13} aria-hidden="true" />
                  {quest.xp} XP
                </span>
                <span className="flex items-center gap-1">
                  <Coins size={13} aria-hidden="true" />
                  {quest.coins}
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}

      <Link
        to="/student/quests"
        className="mt-3 inline-block text-[14px] font-bold text-stroke underline"
      >
        See all quests
      </Link>
    </section>
  );
}

export default QuestsWidget;
