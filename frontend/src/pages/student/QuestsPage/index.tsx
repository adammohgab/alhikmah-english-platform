import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/shared/hooks/useToast";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { ProgressBar } from "@/shared/components/ui/ProgressBar";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { claimQuest, fetchQuests, type ClaimReward, type Quest, type QuestBoard } from "./api";
import { ChestDialog } from "./ChestDialog";
import { QuestCard } from "./QuestCard";

/* Daily quests and weekly goals (STUDENT-SPEC ST-24, ECONOMY-AND-GAMES sections 4.2 and 4.3).
    Three daily quests and up to three weekly goals, each with live progress and a Claim button
    that unlocks when the quest is completed. Claiming opens the chest ceremony with the XP and
    coins the server granted. */

const QUESTS_KEY = ["student", "quests"] as const;

function timeLeft(isoTimes: Array<string | null>, now: number): string | null {
  const times = isoTimes.filter((value): value is string => value !== null).map(Date.parse);
  if (times.length === 0) return null;
  const ms = Math.min(...times) - now;
  if (ms <= 0) return "soon";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours >= 48) return `${Math.floor(hours / 24)} days`;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export default function QuestsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [reward, setReward] = useState<ClaimReward | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const board = useQuery({
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
              daily: current.daily.map((q) => (q.id === quest.id ? { ...q, state: "claimed" } : q)),
              weekly: current.weekly.map((q) =>
                q.id === quest.id ? { ...q, state: "claimed" } : q,
              ),
            }
          : current,
      );
      setReward(granted);
      void queryClient.invalidateQueries({ queryKey: QUESTS_KEY });
    },
    onError: (error: Error) =>
      toast.show({ title: "Could not claim", description: error.message, type: "error" }),
  });

  const busyId = claim.isPending ? claim.variables?.id : undefined;
  const dailyClaimed = board.data?.daily.filter((quest) => quest.state === "claimed").length ?? 0;
  const dailyReset = board.data
    ? timeLeft(
        board.data.daily.map((q) => q.expiresAt),
        now,
      )
    : null;
  const weeklyReset = board.data
    ? timeLeft(
        board.data.weekly.map((q) => q.expiresAt),
        now,
      )
    : null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4">
      <header>
        <h1 className="font-display text-[28px] leading-tight text-stroke">Quests</h1>
        {dailyReset && <p className="text-[14px] text-muted">New daily quests in {dailyReset}.</p>}
      </header>

      {board.isPending ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((n) => (
            <Skeleton key={n} shape="rect" className="h-48 w-full" />
          ))}
        </div>
      ) : board.isError ? (
        <ErrorState
          description="Your quests could not load. Check your connection and try again."
          onRetry={() => void board.refetch()}
        />
      ) : (
        <>
          <section aria-labelledby="daily-heading" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="daily-heading" className="font-display text-[22px] text-stroke">
                Daily quests
              </h2>
              {board.data.daily.length > 0 && (
                <div className="w-48">
                  <ProgressBar
                    value={dailyClaimed}
                    max={board.data.daily.length}
                    label="Daily quests claimed"
                    valueText={`${dailyClaimed} of ${board.data.daily.length} claimed`}
                  />
                </div>
              )}
            </div>
            {board.data.daily.length === 0 ? (
              <EmptyState size="sm" title="No quests today. Check back tomorrow." />
            ) : (
              <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {board.data.daily.map((quest) => (
                  <QuestCard
                    key={quest.id}
                    quest={quest}
                    busy={busyId === quest.id}
                    onClaim={(chosen) => claim.mutate(chosen)}
                  />
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="weekly-heading" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="weekly-heading" className="font-display text-[22px] text-stroke">
                Weekly goals
              </h2>
              {weeklyReset && <p className="text-[14px] text-muted">Resets in {weeklyReset}.</p>}
            </div>
            {board.data.weekly.length === 0 ? (
              <EmptyState
                size="sm"
                title="No weekly goals yet. They appear at the start of the week."
              />
            ) : (
              <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {board.data.weekly.map((quest) => (
                  <QuestCard
                    key={quest.id}
                    quest={quest}
                    busy={busyId === quest.id}
                    onClaim={(chosen) => claim.mutate(chosen)}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <ChestDialog reward={reward} onClose={() => setReward(null)} />
    </main>
  );
}
