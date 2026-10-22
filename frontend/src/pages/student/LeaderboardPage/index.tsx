import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock, Medal, Trophy } from "lucide-react";
import { useAuth } from "@/shared/hooks/useAuth";
import { Avatar } from "@/shared/components/ui/Avatar";
import { Chip } from "@/shared/components/ui/Chip";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { SegmentedControl } from "@/shared/components/ui/SegmentedControl";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { cn } from "@/shared/lib/utils/cn";
import {
  LEADERBOARD_CLASSES_KEY,
  LEADERBOARD_KEY,
  fetchLeaderboard,
  fetchMyClasses,
} from "./api";
import type { Timeframe } from "./api";
import { TIMEFRAMES, buildBoard, formatXp, ordinal } from "./rules";
import type { Board, BoardEntry } from "./rules";

/* ========================================
   Leaderboard (STUDENT-SPEC ST-25, task STU-GAM-11)

   /student/leaderboard: the class ranked by XP. Period tabs (This Week, This Month, All Time),
   a podium for the top three with gold, silver and bronze medals, the ranked list below
   (top 50 plus the student's own row, highlighted), and a bar pinned to the bottom that says
   where the student stands and how many XP it takes to climb one place.
   Privacy: names and avatars are shown exactly as the server returns them. When the school
   hides names, other students arrive as "Student N" and the page says so.
   ======================================== */

const PANEL = "rounded-[20px] border-2 border-stroke bg-surface-0 shadow-retro-sm";

/* Static class strings: Tailwind finds classes by scanning the text. */
const MEDALS = {
  1: { label: "Gold", fill: "bg-[#F6C33B]", height: "h-24", order: "order-2" },
  2: { label: "Silver", fill: "bg-[#C9D2DE]", height: "h-16", order: "order-1" },
  3: { label: "Bronze", fill: "bg-[#DB8C52]", height: "h-12", order: "order-3" },
} as const;

type PodiumRank = keyof typeof MEDALS;

function YouTag() {
  return (
    <span className="rounded-full border-2 border-stroke bg-world-amber-300 px-2 py-0.5 font-heading text-xs font-bold text-stroke">
      You
    </span>
  );
}

function PodiumCard({ entry, rank }: { entry: BoardEntry; rank: PodiumRank }) {
  const medal = MEDALS[rank];
  return (
    <li
      className={cn("flex min-w-0 flex-1 flex-col items-center gap-2", medal.order)}
      data-testid={`podium-${rank}`}
    >
      <span
        className={cn(
          "grid h-10 w-10 place-items-center rounded-full border-2 border-stroke shadow-retro-sm",
          medal.fill,
        )}
      >
        <Medal size={20} strokeWidth={2.5} className="text-stroke" aria-hidden="true" />
        <span className="sr-only">
          {ordinal(rank)} place, {medal.label.toLowerCase()} medal
        </span>
      </span>
      <Avatar
        size={rank === 1 ? "xl" : "lg"}
        src={entry.avatarUrl}
        name={entry.name}
        aria-hidden="true"
      />
      <div className="flex w-full min-w-0 flex-col items-center gap-0.5 text-center">
        <p className="w-full truncate font-heading text-base font-bold text-stroke">
          {entry.name}
        </p>
        {entry.isMe && <YouTag />}
        <p className="font-heading text-sm font-bold text-muted">{formatXp(entry.xp)}</p>
      </div>
      <div
        aria-hidden="true"
        className={cn(
          "flex w-full items-start justify-center rounded-t-[16px] border-2 border-stroke pt-2 shadow-retro-sm",
          medal.fill,
          medal.height,
        )}
      >
        <span className="font-heading text-3xl font-bold text-stroke">{rank}</span>
      </div>
    </li>
  );
}

function Podium({ entries }: { entries: BoardEntry[] }) {
  return (
    <ol
      aria-label="Top three"
      className="flex items-end justify-center gap-3 px-1 pt-2 sm:gap-6 sm:px-8"
    >
      {entries.map((entry) => (
        <PodiumCard key={entry.studentId} entry={entry} rank={entry.rank as PodiumRank} />
      ))}
    </ol>
  );
}

function RankRow({ entry }: { entry: BoardEntry }) {
  return (
    <li
      aria-current={entry.isMe ? "true" : undefined}
      data-testid={entry.isMe ? "my-row" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-[16px] border-2 border-stroke px-3 py-2",
        entry.isMe ? "bg-world-amber-100 shadow-retro-sm" : "bg-surface-0",
      )}
    >
      <span className="grid h-9 min-w-9 place-items-center rounded-full border-2 border-stroke bg-surface-100 px-1 font-heading text-base font-bold text-stroke">
        <span className="sr-only">Rank </span>
        {entry.rank}
      </span>
      <Avatar size="sm" src={entry.avatarUrl} name={entry.name} aria-hidden="true" />
      <p className="flex min-w-0 flex-1 items-center gap-2 font-heading text-base font-bold text-stroke">
        <span className="truncate">{entry.name}</span>
        {entry.isMe && <YouTag />}
      </p>
      {entry.badge?.iconUrl && (
        <img
          src={entry.badge.iconUrl}
          alt={entry.badge.name}
          title={entry.badge.name}
          className="h-7 w-7 shrink-0 object-contain"
        />
      )}
      <p className="shrink-0 font-heading text-base font-bold text-stroke">{formatXp(entry.xp)}</p>
    </li>
  );
}

function rankMessage(board: Board): string {
  const { me, above, xpToPass, leadOver } = board;
  if (!me) return "";
  if (above && xpToPass !== null) return `${formatXp(xpToPass)} to pass ${above.name}`;
  if (leadOver !== null && leadOver > 0) return `You lead by ${formatXp(leadOver)}`;
  return board.total > 1 ? "You share the lead" : "You are the only one on this board";
}

function MyRankBar({ board }: { board: Board }) {
  const { me } = board;
  if (!me) return null;
  return (
    <section
      aria-label="Your position"
      data-testid="my-rank-bar"
      className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.5rem)] z-30 flex items-center gap-3 rounded-[20px] border-2 border-stroke bg-world-amber-300 px-4 py-3 shadow-retro-md md:bottom-4"
    >
      <span className="grid h-12 min-w-12 place-items-center rounded-full border-2 border-stroke bg-surface-0 px-2 font-heading text-xl font-bold text-stroke">
        {me.rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-heading text-lg font-bold text-stroke">
          You are {ordinal(me.rank)} with {formatXp(me.xp)}
        </p>
        <p className="text-sm font-bold text-stroke" data-testid="rank-message">
          {rankMessage(board)}
        </p>
      </div>
      <Trophy size={28} strokeWidth={2.5} className="shrink-0 text-stroke" aria-hidden="true" />
    </section>
  );
}

function LoadingBoard() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <Skeleton className="h-60 w-full rounded-[24px]" label="Loading the leaderboard" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full rounded-[16px]" label={null} />
        ))}
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const studentId = user?.id;
  const [timeframe, setTimeframe] = useState<Timeframe>("week");
  const [chosenClassId, setChosenClassId] = useState<string | null>(null);

  const classesQuery = useQuery({
    queryKey: [LEADERBOARD_CLASSES_KEY, studentId],
    queryFn: () => fetchMyClasses(studentId as string),
    enabled: studentId !== undefined,
  });

  const classes = classesQuery.data;
  const activeClass = classes?.find((item) => item.id === chosenClassId) ?? classes?.[0] ?? null;
  const classId = activeClass?.id;

  const boardQuery = useQuery({
    queryKey: [LEADERBOARD_KEY, classId, timeframe],
    queryFn: () => fetchLeaderboard(classId as string, timeframe),
    enabled: classId !== undefined,
  });

  const board = useMemo(
    () =>
      boardQuery.data && studentId !== undefined ? buildBoard(boardQuery.data, studentId) : null,
    [boardQuery.data, studentId],
  );

  const failed = classesQuery.isError || boardQuery.isError;
  const retry = () => {
    if (classesQuery.isError) void classesQuery.refetch();
    if (boardQuery.isError) void boardQuery.refetch();
  };

  let body: ReactNode;
  if (failed) {
    body = (
      <ErrorState
        size="lg"
        title="The leaderboard could not load"
        description="We could not load the rankings. Check your connection and try again."
        onRetry={retry}
      />
    );
  } else if (classes && classes.length === 0) {
    body = (
      <EmptyState
        size="lg"
        title="You are not in a class yet"
        description="Your teacher will add you to a class. Then your class ranking shows up here."
      />
    );
  } else if (!board) {
    body = <LoadingBoard />;
  } else if (board.total === 0) {
    body = (
      <EmptyState
        size="lg"
        title="No one is on this board yet"
        description="Earn some XP and you will be the first one here."
      />
    );
  } else {
    body = (
      <>
        {board.namesHidden && (
          <p className="flex items-center gap-2 rounded-[12px] border-2 border-stroke bg-surface-100 px-3 py-2 text-sm font-bold text-stroke">
            <Lock size={16} strokeWidth={2.5} aria-hidden="true" />
            Names are hidden on this board. You can only see your own.
          </p>
        )}
        <div className={cn(PANEL, "px-3 pb-0 pt-4 sm:px-6")}>
          <Podium entries={board.podium} />
        </div>
        {board.rows.length > 0 && (
          <ol aria-label="Ranking" className="flex flex-col gap-2">
            {board.rows.map((entry) => (
              <RankRow key={entry.studentId} entry={entry} />
            ))}
          </ol>
        )}
        <MyRankBar board={board} />
      </>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-4xl font-bold text-stroke">Leaderboard</h1>
        <p className="text-base font-semibold text-muted">
          {activeClass
            ? `See how your XP stacks up in ${activeClass.name}.`
            : "See how your XP stacks up in your class."}
        </p>
      </header>

      {classes && classes.length > 1 && (
        <div role="group" aria-label="Choose a class" className="flex flex-wrap gap-2">
          {classes.map((item) => (
            <Chip
              key={item.id}
              selected={item.id === activeClass?.id}
              onClick={() => setChosenClassId(item.id)}
            >
              {item.name}
            </Chip>
          ))}
        </div>
      )}

      <SegmentedControl
        aria-label="Time period"
        size="md"
        fullWidth
        value={timeframe}
        onValueChange={(value) => setTimeframe(value as Timeframe)}
        options={TIMEFRAMES}
      />

      {body}
    </div>
  );
}
