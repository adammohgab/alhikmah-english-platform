import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  Bell,
  Bot,
  BookOpen,
  CalendarClock,
  ChevronDown,
  ClipboardList,
  FileText,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  Library,
  Lock,
  LogOut,
  Megaphone,
  Menu,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Store,
  Target,
  TrendingUp,
  Trophy,
  Upload,
  UserRound,
  Users,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/app/providers/auth-context";
import { Badge, type BadgeStatus } from "@/shared/components/ui/Badge";
import { IconButton } from "@/shared/components/ui/IconButton";
import { cn } from "@/shared/lib/utils/cn";
import { ViewAsBanner, type ViewAsSession } from "./ViewAsBanner";

/* ========================================
   AdminAppShell (ADMIN-SPEC §4 Global shell AD-00, §3 permissions, §2 permission-aware UI)

   Layout: the shell fills the viewport and only <main> scrolls, so the ViewAsBanner and
   the top bar never move.
     desktop  >= 1200px   sidebar 264px, collapsible to a 72px icon rail
     tablet   768-1199px  icon rail; the menu button opens the full sidebar as an overlay
     mobile   < 768px     no sidebar; bottom tab bar (Home, Users, Moderation, AI, More);
                          "More" and the menu button open the overlay
   In every overlay and on every screen below desktop, sections start collapsed except the
   one holding the current page. On desktop they start open and can be collapsed by hand.

   Permissions (spec §3): "Super admin" sees everything and gets a Super admin badge on the
   platform-level items. "School admin" never sees those items, and sees a lock icon on the
   items that are read-only for that role.
   ======================================== */

export type SystemHealth = "operational" | "degraded" | "outage";

/** `full` for both roles, `view` is read-only for a School admin, `super` is Super admin only. */
type Access = "full" | "view" | "super";

interface NavItem {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  access: Access;
  /** Only the exact path matches (used by the Overview item at /admin). */
  exact?: boolean;
  /** Child routes that belong to a different item and must not highlight this one. */
  exclude?: readonly string[];
}

interface NavSection {
  id: string;
  /** `null` renders the items without a collapsible header. */
  label: string | null;
  items: readonly NavItem[];
}

const NAV_SECTIONS: readonly NavSection[] = [
  {
    id: "overview",
    label: null,
    items: [
      {
        id: "overview",
        label: "Overview",
        to: "/admin",
        icon: LayoutDashboard,
        access: "full",
        exact: true,
      },
    ],
  },
  {
    id: "people",
    label: "People",
    items: [
      {
        id: "users",
        label: "Users",
        to: "/admin/users",
        icon: Users,
        access: "full",
        exclude: ["/admin/users/import", "/admin/users/rollover"],
      },
      {
        id: "classes",
        label: "Classes",
        to: "/admin/classes",
        icon: GraduationCap,
        access: "full",
      },
      { id: "import", label: "Import", to: "/admin/users/import", icon: Upload, access: "full" },
      {
        id: "rollover",
        label: "Rollover",
        to: "/admin/users/rollover",
        icon: CalendarClock,
        access: "full",
      },
    ],
  },
  {
    id: "content",
    label: "Curriculum & Content",
    items: [
      {
        id: "curriculum",
        label: "Curriculum",
        to: "/admin/curriculum",
        icon: BookOpen,
        access: "full",
      },
      { id: "content", label: "Content", to: "/admin/content", icon: Library, access: "full" },
      {
        id: "announcements",
        label: "Announcements",
        to: "/admin/announcements",
        icon: Megaphone,
        access: "full",
      },
      {
        id: "moderation",
        label: "Moderation",
        to: "/admin/moderation",
        icon: ShieldAlert,
        access: "full",
      },
    ],
  },
  {
    id: "engagement",
    label: "Engagement Studios",
    items: [
      { id: "xp", label: "XP and rules", to: "/admin/engagement/xp", icon: Zap, access: "view" },
      {
        id: "quests",
        label: "Quests and badges",
        to: "/admin/engagement/quests-badges",
        icon: Target,
        access: "view",
      },
      {
        id: "shop",
        label: "Shop catalog",
        to: "/admin/engagement/shop",
        icon: Store,
        access: "view",
      },
      {
        id: "avatar",
        label: "Avatar studio",
        to: "/admin/engagement/avatar",
        icon: UserRound,
        access: "view",
      },
      {
        id: "themes",
        label: "Themes studio",
        to: "/admin/engagement/themes",
        icon: Palette,
        access: "view",
      },
      {
        id: "leaderboard",
        label: "Leaderboard",
        to: "/admin/engagement/leaderboard",
        icon: Trophy,
        access: "full",
      },
    ],
  },
  {
    id: "ai",
    label: "AI Governance",
    items: [
      {
        id: "ai-features",
        label: "Features and limits",
        to: "/admin/ai/features",
        icon: Bot,
        access: "view",
      },
      {
        id: "ai-safety",
        label: "Safety and instructions",
        to: "/admin/ai/safety",
        icon: ShieldCheck,
        access: "view",
      },
      {
        id: "ai-usage",
        label: "Usage and cost",
        to: "/admin/ai/usage",
        icon: TrendingUp,
        access: "view",
      },
      {
        id: "ai-log",
        label: "Activity log",
        to: "/admin/ai/log",
        icon: ScrollText,
        access: "view",
      },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { id: "reports", label: "Reports", to: "/admin/reports", icon: FileText, access: "full" },
      { id: "audit", label: "Audit log", to: "/admin/audit", icon: ClipboardList, access: "full" },
      {
        id: "settings",
        label: "Platform settings",
        to: "/admin/settings",
        icon: Settings,
        access: "super",
        exclude: ["/admin/settings/admins"],
      },
      {
        id: "admins",
        label: "Admins and roles",
        to: "/admin/settings/admins",
        icon: KeyRound,
        access: "super",
      },
    ],
  },
];

interface MobileTab {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
}

/* Spec §4.2: Home, Users, Moderation, AI, More. "More" opens the navigation overlay. */
const MOBILE_TABS: readonly MobileTab[] = [
  {
    id: "home",
    label: "Home",
    to: "/admin",
    icon: LayoutDashboard,
    isActive: (p) => p === "/admin",
  },
  {
    id: "users",
    label: "Users",
    to: "/admin/users",
    icon: Users,
    isActive: (p) => p.startsWith("/admin/users"),
  },
  {
    id: "moderation",
    label: "Moderation",
    to: "/admin/moderation",
    icon: ShieldAlert,
    isActive: (p) => p.startsWith("/admin/moderation"),
  },
  {
    id: "ai",
    label: "AI",
    to: "/admin/ai/features",
    icon: Bot,
    isActive: (p) => p.startsWith("/admin/ai"),
  },
];

const HEALTH: Record<SystemHealth, { status: BadgeStatus; label: string }> = {
  operational: { status: "success", label: "Operational" },
  degraded: { status: "warning", label: "Degraded" },
  outage: { status: "danger", label: "Outage" },
};

const ROLE_LABEL = {
  super_admin: "Super admin",
  school_admin: "School admin",
} as const;

/* ---------- Helpers ---------- */

function isPathInside(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.exact === true) return pathname === item.to;
  if (!isPathInside(pathname, item.to)) return false;
  return !(item.exclude ?? []).some((path) => isPathInside(pathname, path));
}

function getVisibleSections(isSuper: boolean): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => isSuper || item.access !== "super"),
  })).filter((section) => section.items.length > 0);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const lastPart = parts.length > 1 ? parts[parts.length - 1] : undefined;
  const last = lastPart?.[0] ?? "";
  return (first + last).toUpperCase() || "A";
}

function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => {
        list.removeEventListener("change", onChange);
      };
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

const FOCUSABLE = "a[href], button:not([disabled])";

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => element.closest("[hidden]") === null,
  );
}

/* ---------- Navigation ---------- */

interface AdminNavProps {
  sections: readonly NavSection[];
  pathname: string;
  /** Icon-only layout: no section headers, labels kept for screen readers. */
  rail: boolean;
  isSuper: boolean;
  moderationCount: number;
  /** Sections start open (desktop) or only the section holding the current page does. */
  openByDefault: boolean;
  overrides: Readonly<Record<string, boolean>>;
  onToggleSection: (id: string, open: boolean) => void;
  onNavigate: () => void;
}

function AdminNav({
  sections,
  pathname,
  rail,
  isSuper,
  moderationCount,
  openByDefault,
  overrides,
  onToggleSection,
  onNavigate,
}: AdminNavProps) {
  const baseId = useId();

  return (
    <nav aria-label="Admin" className="px-3 py-3">
      <ul className="space-y-2">
        {sections.map((section, index) => {
          const hasActive = section.items.some((item) => isItemActive(item, pathname));
          const open = overrides[section.id] ?? (openByDefault || hasActive);
          const listId = `${baseId}-${section.id}`;
          const showHeader = section.label !== null && !rail;
          const expanded = section.label === null || rail || open;

          return (
            <li key={section.id}>
              {rail && index > 0 && (
                <div aria-hidden="true" className="mx-2 mb-2 h-[2px] rounded-full bg-line-200" />
              )}
              {showHeader && (
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={listId}
                  onClick={() => {
                    onToggleSection(section.id, !open);
                  }}
                  className="flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left font-body text-[13px] font-bold text-muted hover:bg-surface-200"
                >
                  <span>{section.label}</span>
                  <ChevronDown
                    aria-hidden="true"
                    strokeWidth={2.5}
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform",
                      open ? "rotate-0" : "-rotate-90",
                    )}
                  />
                </button>
              )}
              <ul id={listId} hidden={!expanded} className={cn("space-y-1", showHeader && "mt-1")}>
                {section.items.map((item) => (
                  <li key={item.id}>
                    <AdminNavLink
                      item={item}
                      active={isItemActive(item, pathname)}
                      rail={rail}
                      readOnly={item.access === "view" && !isSuper}
                      count={item.id === "moderation" ? moderationCount : 0}
                      onNavigate={onNavigate}
                    />
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

interface AdminNavLinkProps {
  item: NavItem;
  active: boolean;
  rail: boolean;
  readOnly: boolean;
  count: number;
  onNavigate: () => void;
}

function AdminNavLink({ item, active, rail, readOnly, count, onNavigate }: AdminNavLinkProps) {
  const Icon = item.icon;

  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={rail ? item.label : undefined}
      className={cn(
        "relative flex h-10 items-center gap-3 rounded-[10px] border-2 px-3 font-body text-[14px] font-semibold",
        rail && "justify-center px-0",
        active
          ? "border-stroke bg-[var(--world-soft,#ffd93d)] text-stroke"
          : "border-transparent text-muted hover:bg-surface-200 hover:text-stroke",
      )}
    >
      <Icon aria-hidden="true" strokeWidth={2.25} className="h-5 w-5 shrink-0" />
      <span className={cn(rail ? "sr-only" : "min-w-0 flex-1 truncate")}>{item.label}</span>
      {count > 0 && (
        <>
          <Badge
            count={count}
            size="sm"
            aria-hidden="true"
            className={cn(rail && "absolute right-0 top-0")}
          />
          <span className="sr-only">, {count} open items</span>
        </>
      )}
      {readOnly && (
        <>
          <Lock
            aria-hidden="true"
            strokeWidth={2.5}
            className={cn("h-3.5 w-3.5 shrink-0", rail && "hidden")}
          />
          <span className="sr-only">, read only</span>
        </>
      )}
      {item.access === "super" && (
        <>
          {!rail && (
            <Badge size="sm" tone="pop" aria-hidden="true">
              Super admin
            </Badge>
          )}
          <span className="sr-only">, Super admin only</span>
        </>
      )}
    </Link>
  );
}

function Wordmark({ rail }: { rail: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border-2 border-stroke bg-[var(--world-main,#ffb84d)] font-heading text-[15px] font-semibold"
      >
        AH
      </span>
      {!rail && (
        <p className="min-w-0 font-heading text-[17px] font-semibold leading-tight">
          Al Hikmah <span className="block font-body text-[12px] font-bold text-muted">Admin</span>
        </p>
      )}
    </div>
  );
}

interface SidebarFooterProps {
  name: string;
  roleLabel: string;
  rail: boolean;
  onSignOut: () => void;
}

function SidebarFooter({ name, roleLabel, rail, onSignOut }: SidebarFooterProps) {
  return (
    <div className="shrink-0 border-t-2 border-stroke p-3">
      <div className={cn("flex items-center gap-3", rail && "flex-col")}>
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-stroke bg-[var(--world-soft,#ffd93d)] font-heading text-[13px] font-semibold"
        >
          {getInitials(name)}
        </span>
        {!rail && (
          <div className="min-w-0 flex-1">
            <p className="truncate font-body text-[14px] font-bold">{name}</p>
            <p className="truncate font-body text-[12px] font-medium text-muted">{roleLabel}</p>
          </div>
        )}
        <IconButton aria-label="Sign out" size="sm" variant="secondary" onClick={onSignOut}>
          <LogOut className="h-5 w-5" />
        </IconButton>
      </div>
    </div>
  );
}

/* ---------- Overlay (tablet and mobile) ---------- */

interface NavOverlayProps {
  /** `restoreFocus` is true when the overlay is dismissed rather than used to navigate. */
  onClose: (restoreFocus: boolean) => void;
  children: ReactNode;
}

function NavOverlay({ onClose, children }: NavOverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    if (panel === null) return;
    getFocusable(panel)[0]?.focus();
  }, []);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose(true);
      return;
    }
    if (event.key !== "Tab" || panelRef.current === null) return;
    const focusable = getFocusable(panelRef.current);
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
    <div className="absolute inset-0 z-40">
      <button
        type="button"
        aria-label="Close admin navigation"
        className="absolute inset-0 border-0 bg-stroke/40 p-0"
        onClick={() => {
          onClose(true);
        }}
      />
      {/* The dialog key handler wraps keyboard focus among its navigation controls. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Admin navigation"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="absolute inset-y-0 left-0 flex w-[264px] max-w-[85vw] flex-col border-r-2 border-stroke bg-surface-0"
      >
        {children}
      </div>
    </div>
  );
}

/* ---------- Top bar ---------- */

function HealthPill({ health }: { health: SystemHealth }) {
  const { status, label } = HEALTH[health];
  return (
    <span role="status">
      <Badge status={status}>
        <span className="sr-only">System status: </span>
        {label}
      </Badge>
    </span>
  );
}

interface BreadcrumbProps {
  sectionLabel: string | null;
  pageLabel: string;
}

function Breadcrumb({ sectionLabel, pageLabel }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 font-body text-[14px]">
        {sectionLabel !== null && (
          <>
            <li className="hidden shrink-0 font-medium text-muted sm:block">{sectionLabel}</li>
            <li aria-hidden="true" className="hidden shrink-0 text-muted sm:block">
              /
            </li>
          </>
        )}
        <li aria-current="page" className="truncate font-bold">
          {pageLabel}
        </li>
      </ol>
    </nav>
  );
}

/* ---------- Shell ---------- */

type LayoutMode = "mobile" | "tablet" | "desktop";

interface AdminAppShellBaseProps {
  /** Page content. Defaults to the matched child route (`<Outlet />`). */
  children?: ReactNode;
  /** Platform health shown in the top bar. Default `operational`. */
  health?: SystemHealth | undefined;
  /** Open items in the moderation queue, shown as a count on the Moderation item. */
  moderationCount?: number | undefined;
}

type ViewAsProps =
  | {
      viewAs?: null | undefined;
      onExitViewAs?: (() => void) | undefined;
      exitingViewAs?: boolean | undefined;
    }
  | {
      /** While set, the ViewAsBanner is docked to the top of the screen. */
      viewAs: ViewAsSession;
      /** Ends the simulation and restores the admin session. Required while `viewAs` is set. */
      onExitViewAs: () => void;
      exitingViewAs?: boolean | undefined;
    };

export type AdminAppShellProps = AdminAppShellBaseProps & ViewAsProps;

export function AdminAppShell(props: AdminAppShellProps) {
  const { children, health = "operational", moderationCount = 0 } = props;
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();

  const isSuper = user?.adminLevel === "super_admin";
  const sections = useMemo(() => getVisibleSections(isSuper), [isSuper]);

  const isDesktop = useMediaQuery("(min-width: 1200px)");
  const isTablet = useMediaQuery("(min-width: 768px)");
  const mode: LayoutMode = isDesktop ? "desktop" : isTablet ? "tablet" : "mobile";

  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const drawerVisible = drawerOpen && mode !== "desktop";
  const rail = mode === "tablet" || (mode === "desktop" && collapsed);

  const openDrawer = useCallback(() => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback((restoreFocus: boolean) => {
    setDrawerOpen(false);
    if (restoreFocus) returnFocusRef.current?.focus();
  }, []);

  const toggleSection = useCallback((id: string, open: boolean) => {
    setOverrides((previous) => ({ ...previous, [id]: open }));
  }, []);

  const handleSignOut = useCallback(() => {
    void signOut();
  }, [signOut]);

  const name = user?.fullName ?? "Administrator";
  const roleLabel = user?.adminLevel ? ROLE_LABEL[user.adminLevel] : "Admin";

  let pageLabel = "Admin";
  let sectionLabel: string | null = null;
  if (pathname.startsWith("/admin/notifications")) {
    pageLabel = "Notifications";
  } else {
    for (const section of sections) {
      const match = section.items.find((item) => isItemActive(item, pathname));
      if (match !== undefined) {
        pageLabel = match.label;
        sectionLabel = section.label;
        break;
      }
    }
  }

  const navProps = {
    sections,
    pathname,
    isSuper,
    moderationCount,
    overrides,
    onToggleSection: toggleSection,
  };

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-surface-100 font-body text-stroke">
      <a
        href="#admin-main"
        className="sr-only font-body text-[14px] font-bold focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[70] focus:rounded-[10px] focus:border-2 focus:border-stroke focus:bg-surface-0 focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      {props.viewAs != null && (
        <ViewAsBanner
          session={props.viewAs}
          onExit={props.onExitViewAs}
          exiting={props.exitingViewAs ?? false}
        />
      )}

      <div className="relative flex min-h-0 flex-1">
        {mode !== "mobile" && (
          <aside
            className={cn(
              "flex shrink-0 flex-col border-r-2 border-stroke bg-surface-0",
              rail ? "w-[72px]" : "w-[264px]",
            )}
          >
            <div className="flex h-16 shrink-0 items-center border-b-2 border-stroke px-4">
              <Wordmark rail={rail} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <AdminNav
                {...navProps}
                rail={rail}
                openByDefault={mode === "desktop"}
                onNavigate={() => undefined}
              />
            </div>
            <SidebarFooter
              name={name}
              roleLabel={roleLabel}
              rail={rail}
              onSignOut={handleSignOut}
            />
          </aside>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center gap-3 border-b-2 border-stroke bg-surface-0 px-4 sm:px-6">
            {mode === "desktop" ? (
              <IconButton
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-expanded={!collapsed}
                size="sm"
                variant="secondary"
                onClick={() => {
                  setCollapsed((previous) => !previous);
                }}
              >
                {collapsed ? (
                  <PanelLeftOpen className="h-5 w-5" />
                ) : (
                  <PanelLeftClose className="h-5 w-5" />
                )}
              </IconButton>
            ) : (
              <IconButton
                aria-label="Open navigation menu"
                aria-expanded={drawerVisible}
                size="sm"
                variant="secondary"
                onClick={openDrawer}
              >
                <Menu className="h-5 w-5" />
              </IconButton>
            )}
            <Breadcrumb sectionLabel={sectionLabel} pageLabel={pageLabel} />
            <div className="ml-auto flex shrink-0 items-center gap-3">
              <HealthPill health={health} />
              <Link
                to="/admin/notifications"
                aria-label="Notifications"
                aria-current={pathname.startsWith("/admin/notifications") ? "page" : undefined}
                className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-stroke bg-surface-0 hover:bg-surface-200"
              >
                <Bell aria-hidden="true" strokeWidth={2.5} className="h-[18px] w-[18px]" />
              </Link>
              <Badge tone="soft">{roleLabel}</Badge>
            </div>
          </header>

          <main id="admin-main" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1440px] p-4 sm:p-6 lg:p-8">
              {children ?? <Outlet />}
            </div>
          </main>

          {mode === "mobile" && (
            <nav
              aria-label="Admin quick navigation"
              className="flex shrink-0 border-t-2 border-stroke bg-surface-0"
            >
              {MOBILE_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = tab.isActive(pathname);
                return (
                  <Link
                    key={tab.id}
                    to={tab.to}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 font-body text-[12px] font-bold",
                      active ? "bg-[var(--world-soft,#ffd93d)] text-stroke" : "text-muted",
                    )}
                  >
                    <Icon aria-hidden="true" strokeWidth={2.25} className="h-5 w-5" />
                    {tab.label}
                    {tab.id === "moderation" && moderationCount > 0 && (
                      <>
                        <Badge
                          count={moderationCount}
                          size="sm"
                          aria-hidden="true"
                          className="absolute right-3 top-1"
                        />
                        <span className="sr-only">, {moderationCount} open items</span>
                      </>
                    )}
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={openDrawer}
                aria-expanded={drawerVisible}
                className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 font-body text-[12px] font-bold text-muted"
              >
                <Menu aria-hidden="true" strokeWidth={2.25} className="h-5 w-5" />
                More
              </button>
            </nav>
          )}
        </div>

        {drawerVisible && (
          <NavOverlay onClose={closeDrawer}>
            <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b-2 border-stroke px-4">
              <Wordmark rail={false} />
              <IconButton
                aria-label="Close navigation menu"
                size="sm"
                variant="secondary"
                onClick={() => {
                  closeDrawer(true);
                }}
              >
                <X className="h-5 w-5" />
              </IconButton>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <AdminNav
                {...navProps}
                rail={false}
                openByDefault={false}
                onNavigate={() => {
                  closeDrawer(false);
                }}
              />
            </div>
            <SidebarFooter
              name={name}
              roleLabel={roleLabel}
              rail={false}
              onSignOut={handleSignOut}
            />
          </NavOverlay>
        )}
      </div>
    </div>
  );
}
