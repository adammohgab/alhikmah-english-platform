import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/auth-context";
import { ContinueLearningCard } from "./ContinueLearningCard";
import { DailyXpCard } from "./DailyXpCard";
import { GreetingHero } from "./GreetingHero";
import { fetchDailyXp, fetchDashboardProfile, fetchResume } from "./api";
import { firstNameOf, greetingFor, schoolHour } from "./rules";
import { useStudentStats } from "./useStudentStats";

/* Student Dashboard (STUDENT-SPEC ST-01, STU-CORE-01).
   Greeting hero with the level badge and avatar, the Continue Learning card that opens the
   right lesson, and the daily XP goal bar. Each block loads and fails on its own, so one slow
   or failed request never blanks the page. */

export default function DashboardPage() {
  const user = useAuth().user;
  const userId = user?.id ?? null;

  const stats = useStudentStats();

  const profile = useQuery({
    queryKey: ["student-dashboard", "profile", userId],
    queryFn: () => fetchDashboardProfile(userId ?? ""),
    enabled: userId !== null,
  });

  const dailyXp = useQuery({
    queryKey: ["student-dashboard", "daily-xp", userId],
    queryFn: () => fetchDailyXp(userId ?? ""),
    enabled: userId !== null,
    refetchOnWindowFocus: true,
  });

  const resume = useQuery({
    queryKey: ["student-dashboard", "resume", userId],
    queryFn: () => fetchResume(userId ?? ""),
    enabled: userId !== null,
    refetchOnWindowFocus: true,
  });

  const fullName = profile.data?.displayName ?? user?.fullName ?? "";
  const greeting = useMemo(() => greetingFor(schoolHour(new Date())), []);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4">
      <GreetingHero
        greeting={greeting}
        firstName={firstNameOf(fullName)}
        fullName={fullName}
        avatarUrl={profile.data?.avatarUrl ?? null}
        stats={stats.data}
        statsFailed={stats.isError}
        dailyXp={dailyXp.data}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ContinueLearningCard
          resume={resume.data}
          loading={resume.isPending && !resume.isError}
          failed={resume.isError}
          onRetry={() => void resume.refetch()}
        />
        <DailyXpCard
          dailyXp={dailyXp.data}
          loading={dailyXp.isPending && !dailyXp.isError}
          failed={dailyXp.isError}
          onRetry={() => void dailyXp.refetch()}
        />
      </div>
    </main>
  );
}
