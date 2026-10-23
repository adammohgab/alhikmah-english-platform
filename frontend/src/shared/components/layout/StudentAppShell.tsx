import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode, RefObject } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  Bot,
  BookOpen,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  Gamepad2,
  LayoutDashboard,
  ListChecks,
  Settings,
  ShoppingBag,
  Target,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import gsap from "gsap";
import Lenis from "lenis";
import schoolLogo from "@/shared/assets/logo.png";
import { cn } from "@/shared/lib/utils/cn";
import { readStored, writeStored } from "@/shared/hooks/useWorld";
import { useEffectsTier } from "@/shared/hooks/useEffectsTier";
import { StudentBottomNav } from "./StudentBottomNav";
import { StudentTopBar, type StudentShellStats } from "./StudentTopBar";

/* ========================================
   Student app shell (STUDENT-SPEC §3 "Global shell"; TASKS UIK-23)

   Desktop (1200+)  264px sidebar, collapsible to a 72px icon rail (choice is remembered),
                    64px top bar, content centered at max 1280px.
   Tablet (768-1199) icon rail by default; the expand button opens the full menu as an overlay.
   Mobile (<768)    no sidebar: top bar with a hamburger (opens the same overlay menu), the
                    stats strip, and the 5-tab bottom bar.

   The scroll container is the area under the top bar (not the document). Lenis smooths it,
   driven from the GSAP ticker (GLOBAL-STYLES-SPEC §8.3), and is off under reduced motion.
   Pages render through <Outlet /> (or `children`) inside <main id="student-main">.

   Data: the shell is presentational. The student route owner passes `stats` (`my_stats` RPC)
   and the pending counts; nothing is faked here. It must be mounted inside the World, Theme,
   Effects and Sound providers (it uses Button/LevelIndicator-style world variables).
   ======================================== */

type StudentNavId =
  "dashboard" | "courses" | "quizzes" | "assignments" | "practice" | "ai-tutor" | "games" | "shop";

interface NavItem {
  id: StudentNavId;
  label: string;
  /** Landing route. */
  to: string;
  icon: LucideIcon;
  /** Active on these paths and everything beneath them. */
  prefixes: readonly string[];
  /** Match exactly (Dashboard must not match every /student/... route). */
  exact?: boolean;
}

interface NavGroup {
  label: string;
  items: readonly NavItem[];
}

/* Groups follow spec §3.1 (Home, Learn, Practice, Play, Rewards); items follow the task. */
const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: "Home",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        to: "/student",
        icon: LayoutDashboard,
        prefixes: ["/student"],
        exact: true,
      },
    ],
  },
  {
    label: "Learn",
    items: [
      {
        id: "courses",
        label: "Courses",
        to: "/student/courses",
        icon: BookOpen,
        prefixes: ["/student/courses"],
      },
      {
        id: "quizzes",
        label: "Quizzes",
        to: "/student/quizzes",
        icon: ListChecks,
        prefixes: ["/student/quizzes"],
      },
      {
        id: "assignments",
        label: "Assignments",
        to: "/student/assignments",
        icon: ClipboardList,
        prefixes: ["/student/assignments"],
      },
    ],
  },
  {
    label: "Practice",
    items: [
      {
        id: "practice",
        label: "Practice",
        to: "/student/practice/vocabulary",
        icon: Target,
        prefixes: ["/student/practice"],
      },
      {
        id: "ai-tutor",
        label: "AI Tutor",
        to: "/student/ai-tutor",
        icon: Bot,
        prefixes: ["/student/ai-tutor"],
      },
    ],
  },
  {
    label: "Play",
    items: [
      {
        id: "games",
        label: "Games",
        to: "/student/games",
        icon: Gamepad2,
        prefixes: ["/student/games"],
      },
    ],
  },
  {
    label: "Rewards",
    items: [
      {
        id: "shop",
        label: "Shop",
        to: "/student/shop",
        icon: ShoppingBag,
        prefixes: ["/student/shop"],
      },
    ],
  },
];

const ALL_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

/** Titles for student pages that are not in the sidebar (spec §5 sitemap). */
const EXTRA_TITLES: readonly { prefix: string; title: string }[] = [
  { prefix: "/student/quests", title: "Daily quests" },
  { prefix: "/student/leaderboard", title: "Leaderboard" },
  { prefix: "/student/achievements", title: "Achievements" },
  { prefix: "/student/profile", title: "Profile" },
  { prefix: "/student/certificates", title: "Certificates" },
  { prefix: "/student/notifications", title: "Notifications" },
  { prefix: "/student/settings", title: "Settings" },
];

function normalize(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function isItemActive(item: NavItem, pathname: string): boolean {
  const path = normalize(pathname);
  return item.prefixes.some((prefix) =>
    item.exact === true ? path === prefix : path === prefix || path.startsWith(`${prefix}/`),
  );
}

function titleFor(pathname: string, fallback: string): string {
  const path = normalize(pathname);
  const item = ALL_ITEMS.find((candidate) => isItemActive(candidate, path));
  if (item) return item.label;
  const extra = EXTRA_TITLES.find(
    (candidate) => path === candidate.prefix || path.startsWith(`${candidate.prefix}/`),
  );
  return extra?.title ?? fallback;
}

const SIDEBAR_STORAGE_KEY = "alhikmah.student.sidebar";
const DESKTOP_QUERY = "(min-width: 1200px)";
const FOCUSABLE =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled])';

/* ---------- Lenis on the main scroll container ---------- */

function useMainLenis(
  wrapperRef: RefObject<HTMLDivElement | null>,
  contentRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const content = contentRef.current;
    if (!enabled || wrapper === null || content === null) return;

    const lenis = new Lenis({
      wrapper,
      content,
      duration: 1.1,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      wheelMultiplier: 1,
      syncTouch: false, // touch keeps native momentum scrolling (spec §8.3)
      autoRaf: false, // driven from the GSAP ticker below
    });
    lenisRef.current = lenis;

    const tick = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [enabled, wrapperRef, contentRef]);

  /** Route changes start at the top, without animating. */
  const scrollToTop = useCallback(() => {
    if (lenisRef.current !== null) lenisRef.current.scrollTo(0, { immediate: true });
    else if (wrapperRef.current !== null) wrapperRef.current.scrollTop = 0;
  }, [wrapperRef]);

  return scrollToTop;
}

/* ---------- Sidebar ---------- */

interface SidebarNavProps {
  /** `rail` follows the collapsed state and breakpoint; `overlay` always shows labels. */
  variant: "rail" | "overlay";
  collapsed: boolean;
  badges?: Partial<Record<StudentNavId, number>> | undefined;
  /** Called after a link is chosen (closes the overlay). */
  onNavigate?: (() => void) | undefined;
}

function SidebarNav({ variant, collapsed, badges, onNavigate }: SidebarNavProps) {
  const { pathname } = useLocation();
  const compact = variant === "rail";
  /* Labels: always in the overlay; in the rail only on desktop and only when not collapsed. */
  const labelClass = compact ? (collapsed ? "hidden" : "hidden min-[1200px]:inline") : "inline";
  const headingClass = compact ? (collapsed ? "hidden" : "hidden min-[1200px]:block") : "block";

  return (
    <nav aria-label="Student" className="flex flex-col gap-3 px-3 py-3">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p
            className={cn(
              "px-3 pb-0.5 font-body text-[11px] font-extrabold uppercase tracking-wide text-muted",
              headingClass,
            )}
          >
            {group.label}
          </p>
          <ul className="flex flex-col gap-1">
            {group.items.map((item) => {
              const active = isItemActive(item, pathname);
              const count = badges?.[item.id] ?? 0;
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <Link
                    to={item.to}
                    aria-current={active ? "page" : undefined}
                    title={compact && collapsed ? item.label : undefined}
                    onClick={onNavigate}
                    className={cn(
                      "relative flex min-h-[44px] items-center gap-3 rounded-[12px] border-2 px-3 font-body text-[15px] text-stroke transition-transform duration-[120ms] ease-out motion-reduce:transition-none",
                      active
                        ? "border-stroke bg-[var(--world-tint,#fff1e3)] font-extrabold shadow-retro-sm before:absolute before:-left-[11px] before:bottom-2 before:top-2 before:w-1.5 before:rounded-full before:bg-[var(--world-main,#ffb84d)] before:content-['']"
                        : "border-transparent font-semibold hover:-translate-y-px hover:border-stroke hover:bg-surface-100",
                      compact && "justify-center min-[1200px]:justify-start",
                      compact && collapsed && "min-[1200px]:justify-center",
                    )}
                  >
                    <span className="relative grid shrink-0 place-items-center">
                      <Icon aria-hidden="true" size={22} strokeWidth={2.5} />
                      {count > 0 && (
                        <span
                          aria-hidden="true"
                          className={cn(
                            "absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-stroke bg-danger-600",
                            labelClass === "inline" ? "hidden" : "",
                            labelClass === "hidden min-[1200px]:inline"
                              ? "min-[1200px]:hidden"
                              : "",
                          )}
                        />
                      )}
                    </span>
                    <span className={cn("min-w-0 flex-1 truncate", labelClass)}>{item.label}</span>
                    {count > 0 && (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "ml-auto grid h-5 min-w-5 place-items-center rounded-full border-2 border-stroke bg-danger-600 px-1 font-heading text-[11px] font-bold leading-none text-surface-0",
                          labelClass,
                        )}
                      >
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                    {count > 0 && <span className="sr-only">, {count} pending</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarFooter({
  variant,
  collapsed,
  onToggleCollapsed,
  onNavigate,
}: {
  variant: "rail" | "overlay";
  collapsed: boolean;
  onToggleCollapsed?: (() => void) | undefined;
  onNavigate?: (() => void) | undefined;
}) {
  const { pathname } = useLocation();
  const compact = variant === "rail";
  const settingsActive = normalize(pathname).startsWith("/student/settings");
  const labelClass = compact ? (collapsed ? "hidden" : "hidden min-[1200px]:inline") : "inline";

  return (
    <div className="mt-auto flex flex-col gap-2 border-t-2 border-stroke px-3 py-3">
      <Link
        to="/student/settings"
        aria-current={settingsActive ? "page" : undefined}
        title={compact && collapsed ? "Settings" : undefined}
        onClick={onNavigate}
        className={cn(
          "flex min-h-[44px] items-center gap-3 rounded-[12px] border-2 px-3 font-body text-[15px] text-stroke",
          settingsActive
            ? "border-stroke bg-[var(--world-tint,#fff1e3)] font-extrabold shadow-retro-sm"
            : "border-transparent font-semibold hover:border-stroke hover:bg-surface-100",
          compact && "justify-center min-[1200px]:justify-start",
          compact && collapsed && "min-[1200px]:justify-center",
        )}
      >
        <Settings aria-hidden="true" size={22} strokeWidth={2.5} className="shrink-0" />
        <span className={cn("truncate", labelClass)}>Settings</span>
      </Link>

      {onToggleCollapsed !== undefined && (
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={collapsed}
          className="hidden min-h-[44px] items-center justify-center gap-3 rounded-[12px] border-2 border-transparent px-3 font-body text-[15px] font-semibold text-stroke hover:border-stroke hover:bg-surface-100 min-[1200px]:flex"
        >
          {collapsed ? (
            <ChevronsRight aria-hidden="true" size={22} strokeWidth={2.5} />
          ) : (
            <>
              <ChevronsLeft aria-hidden="true" size={22} strokeWidth={2.5} />
              <span className="flex-1 text-left">Collapse</span>
            </>
          )}
        </button>
      )}

      <img
        src={schoolLogo}
        alt="Al Hikmah Private School"
        width={40}
        height={40}
        className={cn("mx-auto h-10 w-auto object-contain", compact && collapsed && "h-8")}
      />
    </div>
  );
}

/* ---------- Navigation drawer (tablet expand and mobile hamburger) ---------- */

interface NavDrawerProps {
  id: string;
  open: boolean;
  onClose: () => void;
  badges?: Partial<Record<StudentNavId, number>> | undefined;
}

function NavDrawer({ id, open, onClose, badges }: NavDrawerProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  // Move focus in on open and give it back to whatever opened the drawer on close.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => {
      opener?.focus();
    };
  }, [open]);

  // The drawer only exists below the desktop breakpoint.
  useEffect(() => {
    if (!open) return;
    const query = window.matchMedia(DESKTOP_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) onClose();
    };
    query.addEventListener("change", onChange);
    return () => {
      query.removeEventListener("change", onChange);
    };
  }, [open, onClose]);

  if (!open) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (first === undefined || last === undefined) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 min-[1200px]:hidden">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close navigation menu"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-stroke/40"
      />
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={panelRef}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-lenis-prevent
        onKeyDown={onKeyDown}
        className="relative flex h-full w-[264px] max-w-[85vw] flex-col overflow-y-auto border-r-2 border-stroke bg-surface-0 shadow-retro-lg"
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b-2 border-stroke px-4">
          <p id={titleId} className="font-heading text-[20px] font-semibold text-stroke">
            Al Hikmah English
          </p>
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-full border-2 border-stroke bg-surface-0 text-stroke shadow-retro-sm"
          >
            <X aria-hidden="true" size={20} strokeWidth={2.5} />
          </button>
        </div>
        <SidebarNav variant="overlay" collapsed={false} badges={badges} onNavigate={onClose} />
        <SidebarFooter variant="overlay" collapsed={false} onNavigate={onClose} />
      </div>
    </div>
  );
}

/* ---------- Shell ---------- */

export interface StudentAppShellProps {
  /** Live stats from `my_stats`; `null` while loading. See StudentTopBar. */
  stats: StudentShellStats | null;
  /** Unread notification count for the bell. */
  unreadNotifications?: number | undefined;
  /** Pending counts on sidebar items (for example due assignments). */
  navBadges?: Partial<Record<StudentNavId, number>> | undefined;
  /** Pending counts on the mobile tabs. */
  tabBadges?:
    Partial<Record<"home" | "learn" | "practice" | "play" | "rewards", number>> | undefined;
  /** Title for pages that are not in the navigation. Default "Al Hikmah English". */
  fallbackTitle?: string | undefined;
  /** Page content. Defaults to the matched child route (`<Outlet />`). */
  children?: ReactNode;
}

export function StudentAppShell({
  stats,
  unreadNotifications,
  navBadges,
  tabBadges,
  fallbackTitle = "Al Hikmah English",
  children,
}: StudentAppShellProps) {
  const { pathname } = useLocation();
  const { prefersReducedMotion } = useEffectsTier();
  const drawerId = useId();

  const [collapsed, setCollapsed] = useState(() => readStored(SIDEBAR_STORAGE_KEY) === "collapsed");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const scrollToTop = useMainLenis(scrollRef, contentRef, !prefersReducedMotion);

  // New page: scroll to the top and close the drawer.
  useEffect(() => {
    scrollToTop();
    setDrawerOpen(false);
  }, [pathname, scrollToTop]);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      writeStored(SIDEBAR_STORAGE_KEY, next ? "collapsed" : "expanded");
      return next;
    });
  };

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-surface-50 font-body text-stroke">
      <a
        href="#student-main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("student-main")?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-full focus:border-2 focus:border-stroke focus:bg-surface-0 focus:px-4 focus:py-2 focus:font-bold focus:shadow-retro-sm"
      >
        Skip to content
      </a>

      <aside
        aria-label="Sidebar"
        className={cn(
          "hidden shrink-0 flex-col overflow-y-auto border-r-2 border-stroke bg-surface-0 md:flex",
          collapsed ? "w-[72px]" : "w-[72px] min-[1200px]:w-[264px]",
        )}
      >
        <div
          className={cn(
            "flex h-16 shrink-0 items-center gap-2 border-b-2 border-stroke px-3",
            collapsed
              ? "justify-center"
              : "justify-center min-[1200px]:justify-start min-[1200px]:px-5",
          )}
        >
          <button
            type="button"
            onClick={() => {
              setDrawerOpen(true);
            }}
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
            aria-controls={drawerId}
            className="grid h-11 w-11 place-items-center rounded-full border-2 border-stroke bg-[var(--world-main,#ffb84d)] font-heading text-[18px] font-bold text-stroke shadow-retro-sm min-[1200px]:hidden"
          >
            <span aria-hidden="true">AH</span>
          </button>
          <span
            className={cn(
              "truncate font-heading text-[22px] font-semibold text-stroke",
              collapsed ? "hidden" : "hidden min-[1200px]:inline",
            )}
          >
            Al Hikmah English
          </span>
          <span
            aria-hidden="true"
            className={cn(
              "hidden h-11 w-11 place-items-center rounded-full border-2 border-stroke bg-[var(--world-main,#ffb84d)] font-heading text-[18px] font-bold shadow-retro-sm",
              collapsed ? "min-[1200px]:grid" : "",
            )}
          >
            AH
          </span>
        </div>
        <SidebarNav variant="rail" collapsed={collapsed} badges={navBadges} />
        <SidebarFooter variant="rail" collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <StudentTopBar
          title={titleFor(pathname, fallbackTitle)}
          stats={stats}
          unreadNotifications={unreadNotifications}
          onOpenNav={() => {
            setDrawerOpen(true);
          }}
          navOpen={drawerOpen}
          navId={drawerId}
        />

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div ref={contentRef} className="pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
            <main
              id="student-main"
              tabIndex={-1}
              className="mx-auto w-full max-w-[1280px] px-4 py-6 outline-none md:px-6 min-[1200px]:px-8"
            >
              {children ?? <Outlet />}
            </main>
          </div>
        </div>
      </div>

      <StudentBottomNav badges={tabBadges} />
      <NavDrawer id={drawerId} open={drawerOpen} onClose={closeDrawer} badges={navBadges} />
    </div>
  );
}
