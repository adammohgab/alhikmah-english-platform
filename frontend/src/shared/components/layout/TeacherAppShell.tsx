import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  ChevronsLeft,
  ChevronsRight,
  ClipboardCheck,
  ClipboardList,
  Database,
  Ellipsis,
  GraduationCap,
  Home,
  LayoutDashboard,
  ListChecks,
  Settings,
  Sparkles,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import schoolLogo from "@/shared/assets/logo.png";
import { cn } from "@/shared/lib/utils/cn";
import { readStored, writeStored } from "@/shared/hooks/useWorld";
import { TeacherTopBar, type TeacherShellClass } from "./TeacherTopBar";

/* ========================================
   Teacher app shell (TEACHER-SPEC §3 "Global shell"; TASKS UIK-24)

   Desktop (1200+)  264px sidebar, collapsible to a 72px icon rail (remembered), 64px top bar,
                    content centered at max 1440px (wider than the student side: tables).
   Tablet (768-1199) icon rail; the "AH" button opens the full menu as an overlay.
   Mobile (<768)    no sidebar: top bar with a hamburger, class strip, bottom tab bar
                    (Home, Classes, Grading, Reports, More) and a floating "Ask AI" button.

   Focused mode (spec §3.4): on the grading screen (/teacher/grading/<id>), or when the `focused`
   prop says so (builders), the sidebar and the bottom bar are removed to give the work the whole
   screen. The slim header keeps a "back" link, the class context and Ask AI; the menu stays one
   tap away in the navigation drawer, so the teacher is never trapped.

   Class switcher: the selection persists across pages for the browser session (sessionStorage),
   unless the parent controls it with `selectedClassId`. Ask AI / Ctrl+Cmd+J toggles the Copilot
   panel (420px on desktop, full-screen sheet below 1200px); the panel's content is the `copilot`
   slot, owned by the AI Copilot task.

   Data: the shell is presentational. The teacher route owner passes `classes`, the waiting
   `pendingSubmissions` count and `unreadNotifications`; nothing is fetched or faked here.
   ======================================== */

type TeacherNavId =
  | "dashboard"
  | "classes"
  | "students"
  | "courses"
  | "assignments"
  | "quizzes"
  | "question-bank"
  | "grading"
  | "reports"
  | "copilot";

interface LinkItem {
  kind: "link";
  id: Exclude<TeacherNavId, "copilot">;
  label: string;
  to: string;
  icon: LucideIcon;
  /** Active on these paths and everything beneath them. */
  prefixes: readonly string[];
  /** Match exactly (Dashboard must not match every /teacher/... route). */
  exact?: boolean;
}

/** The Copilot entry toggles the panel; it has no route of its own (spec §4.11). */
interface CopilotItem {
  kind: "copilot";
  id: "copilot";
  label: string;
  icon: LucideIcon;
}

type NavItem = LinkItem | CopilotItem;

interface NavGroup {
  label: string;
  items: readonly NavItem[];
}

/* Groups follow spec §3.1 (Teach, Assess, Insights); items follow the task. */
const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: "Home",
    items: [
      {
        kind: "link",
        id: "dashboard",
        label: "Dashboard",
        to: "/teacher",
        icon: LayoutDashboard,
        prefixes: ["/teacher"],
        exact: true,
      },
    ],
  },
  {
    label: "Teach",
    items: [
      {
        kind: "link",
        id: "classes",
        label: "Classes",
        to: "/teacher/classes",
        icon: UsersRound,
        prefixes: ["/teacher/classes"],
      },
      {
        kind: "link",
        id: "students",
        label: "Students",
        to: "/teacher/students",
        icon: GraduationCap,
        prefixes: ["/teacher/students"],
      },
      {
        kind: "link",
        id: "courses",
        label: "Courses",
        to: "/teacher/courses",
        icon: BookOpen,
        prefixes: ["/teacher/courses"],
      },
    ],
  },
  {
    label: "Assess",
    items: [
      {
        kind: "link",
        id: "assignments",
        label: "Assignments",
        to: "/teacher/assignments",
        icon: ClipboardList,
        prefixes: ["/teacher/assignments"],
      },
      {
        kind: "link",
        id: "quizzes",
        label: "Quizzes",
        to: "/teacher/quizzes",
        icon: ListChecks,
        prefixes: ["/teacher/quizzes"],
      },
      {
        kind: "link",
        id: "question-bank",
        label: "Question Bank",
        to: "/teacher/question-bank",
        icon: Database,
        prefixes: ["/teacher/question-bank"],
      },
      {
        kind: "link",
        id: "grading",
        label: "Grading",
        to: "/teacher/grading",
        icon: ClipboardCheck,
        prefixes: ["/teacher/grading"],
      },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        kind: "link",
        id: "reports",
        label: "Reports",
        to: "/teacher/reports",
        icon: BarChart3,
        prefixes: ["/teacher/reports"],
      },
    ],
  },
  {
    label: "AI",
    items: [{ kind: "copilot", id: "copilot", label: "Copilot", icon: Sparkles }],
  },
];

const LINK_ITEMS: readonly LinkItem[] = NAV_GROUPS.flatMap((group) =>
  group.items.filter((item): item is LinkItem => item.kind === "link"),
);

/** Titles for teacher pages that are not in the sidebar (spec §5 sitemap). */
const EXTRA_TITLES: readonly { prefix: string; title: string }[] = [
  { prefix: "/teacher/announcements", title: "Announcements" },
  { prefix: "/teacher/notifications", title: "Notifications" },
  { prefix: "/teacher/settings", title: "Settings" },
  { prefix: "/teacher/planner", title: "Planner" },
  { prefix: "/teacher/support-plans", title: "Support plans" },
];

function normalize(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function matches(path: string, prefixes: readonly string[], exact: boolean): boolean {
  return prefixes.some((prefix) =>
    exact ? path === prefix : path === prefix || path.startsWith(`${prefix}/`),
  );
}

function isLinkActive(item: LinkItem, pathname: string): boolean {
  return matches(normalize(pathname), item.prefixes, item.exact === true);
}

function titleFor(pathname: string, fallback: string): string {
  const path = normalize(pathname);
  const item = LINK_ITEMS.find((candidate) => isLinkActive(candidate, path));
  if (item) return item.label;
  const extra = EXTRA_TITLES.find((candidate) => matches(path, [candidate.prefix], false));
  return extra?.title ?? fallback;
}

/** The grading screen (TC-21): /teacher/grading/<submissionId>. */
function isGradingScreen(pathname: string): boolean {
  return /^\/teacher\/grading\/[^/]+/.test(normalize(pathname));
}

const SIDEBAR_STORAGE_KEY = "alhikmah.teacher.sidebar";
const CLASS_STORAGE_KEY = "alhikmah.teacher.class";
const DESKTOP_QUERY = "(min-width: 1200px)";
const FOCUSABLE =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])';

function formatCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}

/** The class choice lives for the browser session; blocked storage just means it is not kept. */
function readStoredClass(): string | null {
  try {
    return window.sessionStorage.getItem(CLASS_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredClass(classId: string | null): void {
  try {
    if (classId === null) window.sessionStorage.removeItem(CLASS_STORAGE_KEY);
    else window.sessionStorage.setItem(CLASS_STORAGE_KEY, classId);
  } catch {
    // Storage blocked: the class choice simply is not kept across reloads.
  }
}

/** Keeps Tab inside a dialog-like container. */
function trapTab(event: KeyboardEvent<HTMLElement>) {
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
}

/** Live `min-width: 1200px` match. */
function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(() => window.matchMedia(DESKTOP_QUERY).matches);
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      setDesktop(event.matches);
    };
    setDesktop(query.matches);
    query.addEventListener("change", onChange);
    return () => {
      query.removeEventListener("change", onChange);
    };
  }, []);
  return desktop;
}

/* ---------- Sidebar ---------- */

interface SidebarNavProps {
  /** `rail` follows the collapsed state and breakpoint; `overlay` always shows labels. */
  variant: "rail" | "overlay";
  collapsed: boolean;
  pendingSubmissions: number | null;
  copilotOpen: boolean;
  onToggleCopilot: () => void;
  /** Called after an entry is chosen (closes the overlay). */
  onNavigate?: (() => void) | undefined;
}

const ITEM_BASE =
  "relative flex min-h-[44px] w-full items-center gap-3 rounded-[12px] border-2 px-3 text-left font-body text-[15px] text-stroke transition-transform duration-[120ms] ease-out motion-reduce:transition-none";
const ITEM_ACTIVE =
  "border-stroke bg-[var(--world-tint,#ecefff)] font-extrabold shadow-retro-sm before:absolute before:-left-[11px] before:top-2 before:bottom-2 before:w-1.5 before:rounded-full before:bg-[var(--world-main,#7c8cff)] before:content-['']";
const ITEM_IDLE =
  "border-transparent font-semibold hover:-translate-y-px hover:border-stroke hover:bg-surface-100";

function SidebarNav({
  variant,
  collapsed,
  pendingSubmissions,
  copilotOpen,
  onToggleCopilot,
  onNavigate,
}: SidebarNavProps) {
  const { pathname } = useLocation();
  const compact = variant === "rail";
  /* Labels: always in the overlay; in the rail only on desktop and only when not collapsed. */
  const labelClass = compact ? (collapsed ? "hidden" : "hidden min-[1200px]:inline") : "inline";
  /* The count dot replaces the number whenever labels are hidden. */
  const dotClass = compact ? (collapsed ? "" : "min-[1200px]:hidden") : "hidden";
  const headingClass = compact ? (collapsed ? "hidden" : "hidden min-[1200px]:block") : "block";
  const layoutClass = cn(
    compact && "justify-center min-[1200px]:justify-start",
    compact && collapsed && "min-[1200px]:justify-center",
  );

  return (
    <nav aria-label="Teacher" className="flex flex-col gap-3 px-3 py-3">
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
              const Icon = item.icon;
              const count = item.id === "grading" ? (pendingSubmissions ?? 0) : 0;

              const inner = (
                <>
                  <span className="relative grid shrink-0 place-items-center">
                    <Icon aria-hidden="true" size={22} strokeWidth={2.5} />
                    {count > 0 && (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-stroke bg-danger-600",
                          dotClass,
                        )}
                      />
                    )}
                  </span>
                  <span className={cn("min-w-0 flex-1 truncate", labelClass)}>{item.label}</span>
                  {count > 0 && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "ml-auto grid h-5 min-w-5 place-items-center rounded-full border-2 border-stroke bg-[var(--world-soft,#ffd93d)] px-1 font-heading text-[11px] font-bold tabular-nums leading-none",
                        labelClass,
                      )}
                    >
                      {formatCount(count)}
                    </span>
                  )}
                  {count > 0 && (
                    <span className="sr-only">
                      , {count} {count === 1 ? "submission" : "submissions"} waiting
                    </span>
                  )}
                </>
              );

              if (item.kind === "copilot") {
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-pressed={copilotOpen}
                      aria-keyshortcuts="Control+J Meta+J"
                      title={compact && collapsed ? `${item.label} (Ctrl/Cmd+J)` : undefined}
                      onClick={() => {
                        onToggleCopilot();
                        onNavigate?.();
                      }}
                      className={cn(ITEM_BASE, copilotOpen ? ITEM_ACTIVE : ITEM_IDLE, layoutClass)}
                    >
                      {inner}
                    </button>
                  </li>
                );
              }

              const active = isLinkActive(item, pathname);
              return (
                <li key={item.id}>
                  <Link
                    to={item.to}
                    aria-current={active ? "page" : undefined}
                    title={compact && collapsed ? item.label : undefined}
                    onClick={onNavigate}
                    className={cn(ITEM_BASE, active ? ITEM_ACTIVE : ITEM_IDLE, layoutClass)}
                  >
                    {inner}
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
  const settingsActive = matches(normalize(pathname), ["/teacher/settings"], false);
  const labelClass = compact ? (collapsed ? "hidden" : "hidden min-[1200px]:inline") : "inline";

  return (
    <div className="mt-auto flex flex-col gap-2 border-t-2 border-stroke px-3 py-3">
      <Link
        to="/teacher/settings"
        aria-current={settingsActive ? "page" : undefined}
        title={compact && collapsed ? "Settings" : undefined}
        onClick={onNavigate}
        className={cn(
          ITEM_BASE,
          settingsActive ? ITEM_ACTIVE : ITEM_IDLE,
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

/* ---------- Navigation drawer (tablet expand, mobile "More", focused mode) ---------- */

interface NavDrawerProps {
  id: string;
  open: boolean;
  /** Focused mode keeps the drawer available at every width, including desktop. */
  allowDesktop: boolean;
  onClose: () => void;
  pendingSubmissions: number | null;
  copilotOpen: boolean;
  onToggleCopilot: () => void;
}

function NavDrawer({
  id,
  open,
  allowDesktop,
  onClose,
  pendingSubmissions,
  copilotOpen,
  onToggleCopilot,
}: NavDrawerProps) {
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

  // With the sidebar visible (desktop, not focused) the drawer has no job.
  useEffect(() => {
    if (!open || allowDesktop) return;
    const query = window.matchMedia(DESKTOP_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) onClose();
    };
    query.addEventListener("change", onChange);
    return () => {
      query.removeEventListener("change", onChange);
    };
  }, [open, allowDesktop, onClose]);

  if (!open) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    trapTab(event);
  };

  return (
    <div className={cn("fixed inset-0 z-50", !allowDesktop && "min-[1200px]:hidden")}>
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
        <SidebarNav
          variant="overlay"
          collapsed={false}
          pendingSubmissions={pendingSubmissions}
          copilotOpen={copilotOpen}
          onToggleCopilot={onToggleCopilot}
          onNavigate={onClose}
        />
        <SidebarFooter variant="overlay" collapsed={false} onNavigate={onClose} />
      </div>
    </div>
  );
}

/* ---------- Mobile bottom tab bar (spec §3.3) ---------- */

interface Tab {
  id: "home" | "classes" | "grading" | "reports";
  label: string;
  to: string;
  icon: LucideIcon;
  prefixes: readonly string[];
  exact?: boolean;
}

const TABS: readonly Tab[] = [
  { id: "home", label: "Home", to: "/teacher", icon: Home, prefixes: ["/teacher"], exact: true },
  {
    id: "classes",
    label: "Classes",
    to: "/teacher/classes",
    icon: Users,
    prefixes: ["/teacher/classes"],
  },
  {
    id: "grading",
    label: "Grading",
    to: "/teacher/grading",
    icon: ClipboardCheck,
    prefixes: ["/teacher/grading"],
  },
  {
    id: "reports",
    label: "Reports",
    to: "/teacher/reports",
    icon: BarChart3,
    prefixes: ["/teacher/reports"],
  },
];

const TAB_BASE =
  "group relative flex min-h-[56px] w-full flex-col items-center justify-center gap-0.5 px-1 py-1.5 font-body text-[12px] leading-none text-stroke";

function tabPill(active: boolean): string {
  return cn(
    "relative grid h-8 w-12 place-items-center rounded-full border-2 transition-transform duration-[120ms] ease-out motion-reduce:transition-none",
    active
      ? "-translate-y-0.5 border-stroke bg-[var(--world-main,#7c8cff)] shadow-retro-sm"
      : "border-transparent group-active:scale-95",
  );
}

interface BottomNavProps {
  pendingSubmissions: number | null;
  onOpenMore: () => void;
  moreOpen: boolean;
  moreId: string;
}

function TeacherBottomNav({ pendingSubmissions, onOpenMore, moreOpen, moreId }: BottomNavProps) {
  const { pathname } = useLocation();
  const path = normalize(pathname);
  const activeTab = TABS.find((tab) => matches(path, tab.prefixes, tab.exact === true));

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-stroke bg-surface-0 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {TABS.map((tab) => {
          const active = activeTab?.id === tab.id;
          const count = tab.id === "grading" ? (pendingSubmissions ?? 0) : 0;
          const Icon = tab.icon;
          return (
            <li key={tab.id} className="min-w-0">
              <Link to={tab.to} aria-current={active ? "page" : undefined} className={TAB_BASE}>
                <span className={tabPill(active)}>
                  <Icon aria-hidden="true" size={22} strokeWidth={2.5} />
                  {count > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full border-2 border-stroke bg-[var(--world-soft,#ffd93d)] px-0.5 font-heading text-[10px] font-bold tabular-nums leading-none"
                    >
                      {formatCount(count)}
                    </span>
                  )}
                </span>
                <span className={cn("truncate", active ? "font-extrabold" : "font-semibold")}>
                  {tab.label}
                </span>
                {count > 0 && (
                  <span className="sr-only">
                    , {count} {count === 1 ? "submission" : "submissions"} waiting
                  </span>
                )}
              </Link>
            </li>
          );
        })}
        <li className="min-w-0">
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-controls={moreOpen ? moreId : undefined}
            aria-current={activeTab === undefined ? "page" : undefined}
            onClick={onOpenMore}
            className={TAB_BASE}
          >
            <span className={tabPill(activeTab === undefined)}>
              <Ellipsis aria-hidden="true" size={22} strokeWidth={2.5} />
            </span>
            <span
              className={cn(
                "truncate",
                activeTab === undefined ? "font-extrabold" : "font-semibold",
              )}
            >
              More
            </span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

/* ---------- Copilot panel (spec §4.11) ---------- */

interface CopilotPanelProps {
  id: string;
  desktop: boolean;
  onClose: () => void;
  children?: ReactNode;
}

function CopilotPanel({ id, desktop, onClose, children }: CopilotPanelProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // Focus moves into the panel on open and returns to the opener on close.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => {
      opener?.focus();
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    // Below 1200px the panel is a modal sheet: keep Tab inside it.
    if (!desktop) trapTab(event);
  };

  return (
    <aside
      ref={panelRef}
      id={id}
      aria-labelledby={titleId}
      role={desktop ? undefined : "dialog"}
      aria-modal={desktop ? undefined : true}
      className={cn(
        "fixed inset-0 z-50 bg-surface-0",
        "min-[1200px]:inset-y-0 min-[1200px]:left-auto min-[1200px]:right-0 min-[1200px]:w-[420px] min-[1200px]:border-l-2 min-[1200px]:border-stroke min-[1200px]:shadow-retro-lg",
        "min-[1200px]:static min-[1200px]:z-auto min-[1200px]:shrink-0 min-[1200px]:shadow-none",
      )}
    >
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div className="flex h-full flex-col" onKeyDown={onKeyDown}>
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b-2 border-stroke px-4">
          <p
            id={titleId}
            className="flex items-center gap-2 font-heading text-[20px] font-semibold text-stroke"
          >
            <Sparkles aria-hidden="true" size={20} strokeWidth={2.5} />
            AI Copilot
          </p>
          <button
            type="button"
            aria-label="Close AI Copilot"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-full border-2 border-stroke bg-surface-0 text-stroke shadow-retro-sm"
          >
            <X aria-hidden="true" size={20} strokeWidth={2.5} />
          </button>
        </div>
        <div data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto">
          {children ?? (
            <p className="p-4 font-body text-[14px] font-medium text-muted">
              The AI Copilot is not connected on this page yet.
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}

/* ---------- Shell ---------- */

export interface TeacherAppShellProps {
  /** Active classes for the switcher. Archived classes must not be passed. */
  classes: readonly TeacherShellClass[];
  /** `true` while the class list loads. */
  classesLoading?: boolean | undefined;
  /**
   * Controlled class selection (`null` = All classes). Leave it out and the shell keeps the
   * choice itself for the browser session.
   */
  selectedClassId?: string | null | undefined;
  /** Called whenever the teacher picks a class (controlled or not). */
  onSelectClass?: ((classId: string | null) => void) | undefined;
  /** Submissions waiting for the teacher; shown next to Grading. `null` while unknown. */
  pendingSubmissions: number | null;
  unreadNotifications?: number | undefined;
  /** Controlled Copilot state. Leave it out and the shell manages it. */
  copilotOpen?: boolean | undefined;
  onCopilotOpenChange?: ((open: boolean) => void) | undefined;
  /** Copilot panel content (chat, context chips, action cards). */
  copilot?: ReactNode;
  /** Force focused mode on or off. Default: on for /teacher/grading/<id>. */
  focused?: boolean | undefined;
  /** Where the focused-mode back link goes. Default: the grading queue, or the dashboard. */
  focusedBackTo?: { to: string; label: string } | undefined;
  /** Replaces the route-derived title (for example the student's name while grading). */
  title?: string | undefined;
  /** Title for pages that are not in the navigation. Default "Al Hikmah English". */
  fallbackTitle?: string | undefined;
  /** Page content. Defaults to the matched child route (`<Outlet />`). */
  children?: ReactNode;
}

export function TeacherAppShell({
  classes,
  classesLoading = false,
  selectedClassId,
  onSelectClass,
  pendingSubmissions,
  unreadNotifications,
  copilotOpen,
  onCopilotOpenChange,
  copilot,
  focused,
  focusedBackTo,
  title,
  fallbackTitle = "Al Hikmah English",
  children,
}: TeacherAppShellProps) {
  const { pathname } = useLocation();
  const desktop = useIsDesktop();
  const drawerId = useId();
  const copilotId = useId();

  const onGrading = isGradingScreen(pathname);
  const isFocused = focused ?? onGrading;
  const backTo =
    focusedBackTo ??
    (onGrading
      ? { to: "/teacher/grading", label: "Grading queue" }
      : { to: "/teacher", label: "Dashboard" });

  const [collapsed, setCollapsed] = useState(() => readStored(SIDEBAR_STORAGE_KEY) === "collapsed");
  const [drawerOpen, setDrawerOpen] = useState(false);

  /* Class selection: controlled by the parent, or kept here for the browser session. */
  const [storedClassId, setStoredClassId] = useState<string | null>(readStoredClass);
  const requestedClassId = selectedClassId !== undefined ? selectedClassId : storedClassId;
  const classKnown =
    requestedClassId !== null && classes.some((item) => item.id === requestedClassId);
  // A class that is gone (archived, other account) falls back to "All classes" once the list is in.
  const activeClassId = classKnown || classesLoading ? requestedClassId : null;

  const handleSelectClass = useCallback(
    (classId: string | null) => {
      setStoredClassId(classId);
      writeStoredClass(classId);
      onSelectClass?.(classId);
    },
    [onSelectClass],
  );

  /* Copilot: controlled by the parent, or managed here. */
  const [internalCopilotOpen, setInternalCopilotOpen] = useState(false);
  const isCopilotOpen = copilotOpen ?? internalCopilotOpen;
  const setCopilotOpen = useCallback(
    (next: boolean) => {
      setInternalCopilotOpen(next);
      onCopilotOpenChange?.(next);
    },
    [onCopilotOpenChange],
  );
  const toggleCopilot = useCallback(() => {
    setCopilotOpen(!isCopilotOpen);
  }, [isCopilotOpen, setCopilotOpen]);
  const closeCopilot = useCallback(() => {
    setCopilotOpen(false);
  }, [setCopilotOpen]);

  // Ctrl/Cmd+J opens and closes the Copilot from anywhere (spec §3.1).
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === "j"
      ) {
        event.preventDefault();
        toggleCopilot();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [toggleCopilot]);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // New page: scroll to the top and close the drawer. The Copilot stays open (spec §4.11).
  useEffect(() => {
    if (scrollRef.current !== null) scrollRef.current.scrollTop = 0;
    setDrawerOpen(false);
  }, [pathname]);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      writeStored(SIDEBAR_STORAGE_KEY, next ? "collapsed" : "expanded");
      return next;
    });
  };

  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
  }, []);
  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const pageTitle = title ?? titleFor(pathname, fallbackTitle);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-surface-50 font-body text-stroke">
      <a
        href="#teacher-main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("teacher-main")?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-full focus:border-2 focus:border-stroke focus:bg-surface-0 focus:px-4 focus:py-2 focus:font-bold focus:shadow-retro-sm"
      >
        Skip to content
      </a>

      {/* Focused mode removes the sidebar completely (task UIK-24). */}
      {!isFocused && (
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
              onClick={openDrawer}
              aria-label="Open navigation menu"
              aria-expanded={drawerOpen}
              aria-controls={drawerId}
              className="grid h-11 w-11 place-items-center rounded-full border-2 border-stroke bg-[var(--world-main,#7c8cff)] font-heading text-[18px] font-bold text-stroke shadow-retro-sm min-[1200px]:hidden"
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
                "hidden h-11 w-11 place-items-center rounded-full border-2 border-stroke bg-[var(--world-main,#7c8cff)] font-heading text-[18px] font-bold shadow-retro-sm",
                collapsed ? "min-[1200px]:grid" : "",
              )}
            >
              AH
            </span>
          </div>
          <SidebarNav
            variant="rail"
            collapsed={collapsed}
            pendingSubmissions={pendingSubmissions}
            copilotOpen={isCopilotOpen}
            onToggleCopilot={toggleCopilot}
          />
          <SidebarFooter variant="rail" collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TeacherTopBar
          title={pageTitle}
          classes={classes}
          classesLoading={classesLoading}
          selectedClassId={activeClassId}
          onSelectClass={handleSelectClass}
          pendingSubmissions={pendingSubmissions}
          unreadNotifications={unreadNotifications}
          copilotOpen={isCopilotOpen}
          onToggleCopilot={toggleCopilot}
          copilotPanelId={copilotId}
          onOpenNav={openDrawer}
          navOpen={drawerOpen}
          navId={drawerId}
          focused={isFocused}
          backTo={backTo}
        />

        <div className="flex min-h-0 flex-1">
          <div
            ref={scrollRef}
            className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain"
          >
            <div className="pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
              <main
                id="teacher-main"
                tabIndex={-1}
                className="mx-auto w-full max-w-[1440px] px-4 py-6 outline-none md:px-6 min-[1200px]:px-8"
              >
                {children ?? <Outlet />}
              </main>
            </div>
          </div>

          {isCopilotOpen && (
            <CopilotPanel id={copilotId} desktop={desktop} onClose={closeCopilot}>
              {copilot}
            </CopilotPanel>
          )}
        </div>
      </div>

      {/* Mobile: floating "Ask AI" (spec §3.3). */}
      {!isCopilotOpen && (
        <button
          type="button"
          aria-label="Ask AI"
          onClick={toggleCopilot}
          className={cn(
            "fixed right-4 z-40 grid h-14 w-14 place-items-center rounded-full border-2 border-stroke bg-[var(--world-main,#7c8cff)] text-stroke shadow-retro-md md:hidden",
            isFocused
              ? "bottom-[calc(1rem+env(safe-area-inset-bottom))]"
              : "bottom-[calc(4.5rem+env(safe-area-inset-bottom))]",
          )}
        >
          <Sparkles aria-hidden="true" size={24} strokeWidth={2.5} />
        </button>
      )}

      {!isFocused && (
        <TeacherBottomNav
          pendingSubmissions={pendingSubmissions}
          onOpenMore={openDrawer}
          moreOpen={drawerOpen}
          moreId={drawerId}
        />
      )}

      <NavDrawer
        id={drawerId}
        open={drawerOpen}
        allowDesktop={isFocused}
        onClose={closeDrawer}
        pendingSubmissions={pendingSubmissions}
        copilotOpen={isCopilotOpen}
        onToggleCopilot={toggleCopilot}
      />
    </div>
  );
}
