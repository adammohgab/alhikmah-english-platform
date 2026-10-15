import { Link, useLocation } from "react-router-dom";
import { BookOpen, Gamepad2, Home, PenLine, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";

/* ========================================
   Student mobile bottom tab bar (STUDENT-SPEC §3.3; TASKS UIK-23)

   Under 768px there is no sidebar: five tabs, Home / Learn / Practice / Play / Rewards.
   Each tab owns a group of routes (spec §5 sitemap), so the tab stays highlighted on every
   page of its group, not only on its landing route. The active tab gets `aria-current="page"`,
   a world-colored pill behind the icon and a bold label: color is never the only signal
   (spec §2.9). Touch targets are 56px tall (spec minimum is 44px). The bar clears the iOS home
   indicator through `env(safe-area-inset-bottom)`.
   ======================================== */

type TabId = "home" | "learn" | "practice" | "play" | "rewards";

interface Tab {
  id: TabId;
  label: string;
  /** Landing route of the tab. */
  to: string;
  icon: LucideIcon;
  /** The tab is active on these paths and everything beneath them. */
  prefixes: readonly string[];
  /** Match the path exactly (Home must not match every /student/... route). */
  exact?: boolean;
}

const TABS: readonly Tab[] = [
  { id: "home", label: "Home", to: "/student", icon: Home, prefixes: ["/student"], exact: true },
  {
    id: "learn",
    label: "Learn",
    to: "/student/courses",
    icon: BookOpen,
    prefixes: ["/student/courses", "/student/assignments", "/student/quizzes"],
  },
  {
    id: "practice",
    label: "Practice",
    to: "/student/practice/vocabulary",
    icon: PenLine,
    prefixes: ["/student/practice", "/student/ai-tutor"],
  },
  {
    id: "play",
    label: "Play",
    to: "/student/games",
    icon: Gamepad2,
    prefixes: ["/student/games"],
  },
  {
    id: "rewards",
    label: "Rewards",
    to: "/student/quests",
    icon: Trophy,
    prefixes: ["/student/quests", "/student/leaderboard", "/student/achievements", "/student/shop"],
  },
];

function isTabActive(tab: Tab, pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return tab.prefixes.some((prefix) =>
    tab.exact === true ? path === prefix : path === prefix || path.startsWith(`${prefix}/`),
  );
}

export interface StudentBottomNavProps {
  /** Pending counts per tab (for example due assignments on Learn). Zero or missing shows nothing. */
  badges?: Partial<Record<TabId, number>> | undefined;
  className?: string | undefined;
}

export function StudentBottomNav({ badges, className }: StudentBottomNavProps) {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Main"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t-2 border-stroke bg-surface-0 pb-[env(safe-area-inset-bottom)] md:hidden",
        className,
      )}
    >
      <ul className="grid grid-cols-5">
        {TABS.map((tab) => {
          const active = isTabActive(tab, pathname);
          const count = badges?.[tab.id] ?? 0;
          const Icon = tab.icon;
          return (
            <li key={tab.id} className="min-w-0">
              <Link
                to={tab.to}
                aria-current={active ? "page" : undefined}
                className="group relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 py-1.5 font-body text-[12px] leading-none text-stroke"
              >
                <span
                  className={cn(
                    "relative grid h-8 w-12 place-items-center rounded-full border-2 transition-transform duration-[120ms] ease-out motion-reduce:transition-none",
                    active
                      ? "-translate-y-0.5 border-stroke bg-[var(--world-main,#ffb84d)] shadow-retro-sm"
                      : "border-transparent group-active:scale-95",
                  )}
                >
                  <Icon aria-hidden="true" size={22} strokeWidth={2.5} />
                  {count > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full border-2 border-stroke bg-danger-600 px-0.5 font-heading text-[10px] font-bold leading-none text-surface-0"
                    >
                      {count > 9 ? "9+" : count}
                    </span>
                  )}
                </span>
                <span className={cn("truncate", active ? "font-extrabold" : "font-semibold")}>
                  {tab.label}
                </span>
                {count > 0 && <span className="sr-only">, {count} pending</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
