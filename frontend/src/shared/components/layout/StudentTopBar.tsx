import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bell, Coins, Flame, LogOut, Menu, Palette, Settings, User } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";
import { useAuth } from "@/app/providers/auth-context";
import { useToast } from "@/shared/hooks/useToast";
import { useTheme, useWorld } from "@/shared/hooks/useWorld";
import type { WorldId } from "@/shared/hooks/useWorld";
import { LevelIndicator } from "@/shared/components/ui/LevelIndicator";

/* ========================================
   Student top bar (STUDENT-SPEC §3.1, §3.3, §3.5; TASKS UIK-23)

   Desktop and tablet (md+), 64px tall:  page title ... streak, coins, level + XP, world and
   theme switcher, notification bell, avatar menu.
   Mobile (<768px): hamburger, page title, bell, avatar menu, plus a slim stats strip under the
   bar so Coins, Streak, Level and XP stay visible at 375px.

   The numbers are NOT fetched here. The owner of the student route (the `my_stats` RPC through
   TanStack Query, refreshed after every award) passes `stats`; this bar re-renders on each change
   and shows a floating "+25 XP" / "+10 coins" gain (spec §3.5), announced politely to screen
   readers. `stats = null` means "still loading" and renders calm placeholders, never fake zeros.
   ======================================== */

/** Shape of the `my_stats` RPC result (backend API contract) that the bar needs. */
export interface StudentShellStats {
  /** Total XP earned, used to detect gains. */
  xpTotal: number;
  level: number;
  /** XP earned inside the current level. */
  xpInLevel: number;
  /** XP still needed for the next level. `0` at the top level. */
  xpToNext: number;
  coins: number;
  /** Current streak in days. */
  streakDays: number;
  /** Rank title such as "Explorer". Optional, shown as a tooltip text on the level chip. */
  rankTitle?: string | undefined;
}

export interface StudentTopBarProps {
  /** Page title shown on the left. */
  title: string;
  /** Live stats, or `null` while they load. */
  stats: StudentShellStats | null;
  /** Unread notifications. Zero or missing hides the dot. */
  unreadNotifications?: number | undefined;
  /** Opens the navigation drawer (hamburger on mobile). */
  onOpenNav: () => void;
  /** Whether the navigation drawer is open (for `aria-expanded`). */
  navOpen: boolean;
  /** Id of the drawer element (for `aria-controls`). */
  navId: string;
  className?: string | undefined;
}

const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

/** The skill each of the six worlds belongs to (GLOBAL-STYLES-SPEC §3.2). */
const WORLD_LABELS: Record<WorldId, string> = {
  coral: "Translation",
  amber: "Writing",
  mint: "Listening",
  sky: "Reading",
  violet: "Grammar",
  rose: "Vocabulary",
};

function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : "";
  return `${first}${last}`.toUpperCase() || "?";
}

/* ---------- Gain pop ("+25 XP") ---------- */

interface Gain {
  amount: number;
  key: number;
}

/** Reports the latest increase of `value` for about two seconds, then clears. */
function useGain(value: number | undefined): Gain | null {
  const previous = useRef<number | undefined>(undefined);
  const [gain, setGain] = useState<Gain | null>(null);

  useEffect(() => {
    if (value === undefined) return;
    const before = previous.current;
    previous.current = value;
    if (before === undefined || value <= before) {
      setGain(null);
      return;
    }
    setGain((current) => ({ amount: value - before, key: (current?.key ?? 0) + 1 }));
    const timer = window.setTimeout(() => {
      setGain(null);
    }, 2200);
    return () => {
      window.clearTimeout(timer);
    };
  }, [value]);

  return gain;
}

function GainPop({ text }: { text: string }) {
  const [lifted, setLifted] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLifted(true);
    }, 20);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute -bottom-1 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border-2 border-stroke bg-[var(--world-pop,#2fd6a3)] px-2 py-0.5 font-heading text-[12px] font-bold leading-none text-stroke shadow-retro-sm",
        "transition-[transform,opacity] duration-[1600ms] ease-out motion-reduce:transition-none",
        lifted ? "translate-y-5 opacity-0 motion-reduce:opacity-100" : "translate-y-0 opacity-100",
      )}
    >
      {text}
    </span>
  );
}

/* ---------- Stat chips ---------- */

const CHIP_BASE =
  "relative inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-stroke bg-surface-0 px-3 font-heading text-[15px] font-semibold leading-none tabular-nums text-stroke shadow-retro-sm";

interface StatChipProps {
  icon: ReactNode;
  /** Visible value; `null` while loading. */
  value: string | null;
  /** Full sentence for assistive tech, e.g. "Streak: 5 days". */
  accessibleLabel: string;
  gain?: Gain | null;
  gainText?: string | undefined;
  className?: string;
}

function StatChip({ icon, value, accessibleLabel, gain, gainText, className }: StatChipProps) {
  return (
    <div className={cn(CHIP_BASE, className)} role="group" aria-label={accessibleLabel}>
      {icon}
      <span aria-hidden="true">{value ?? "–"}</span>
      {gain !== null && gain !== undefined && gainText !== undefined && (
        <GainPop key={gain.key} text={gainText} />
      )}
    </div>
  );
}

function XpProgress({ stats }: { stats: StudentShellStats | null }) {
  const total = stats === null ? 0 : stats.xpInLevel + stats.xpToNext;
  const percent =
    stats === null
      ? 0
      : total > 0
        ? Math.min(100, Math.max(0, (stats.xpInLevel / total) * 100))
        : 100;
  const valueText =
    stats === null
      ? "XP loading"
      : stats.xpToNext === 0
        ? `${NUMBER_FORMAT.format(stats.xpInLevel)} XP, top level`
        : `${NUMBER_FORMAT.format(stats.xpInLevel)} of ${NUMBER_FORMAT.format(total)} XP`;

  return (
    <div className="flex min-w-0 flex-col justify-center gap-1">
      <div
        role="progressbar"
        aria-label="XP in this level"
        aria-valuemin={0}
        aria-valuemax={Math.max(total, 1)}
        aria-valuenow={stats === null ? 0 : stats.xpInLevel}
        aria-valuetext={valueText}
        className="h-3 w-16 overflow-hidden rounded-full border-2 border-stroke bg-surface-100 md:w-24"
      >
        <div
          className="h-full bg-[var(--world-main,#ffb84d)] transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span aria-hidden="true" className="font-body text-[11px] font-bold leading-none text-muted">
        {stats === null
          ? "– XP"
          : stats.xpToNext === 0
            ? `${NUMBER_FORMAT.format(stats.xpInLevel)} XP`
            : `${NUMBER_FORMAT.format(stats.xpInLevel)}/${NUMBER_FORMAT.format(total)} XP`}
      </span>
    </div>
  );
}

interface StatsGroupProps {
  stats: StudentShellStats | null;
  /** Layout hook so the same group can sit in the bar or in the mobile strip. */
  className?: string;
}

function StatsGroup({ stats, className }: StatsGroupProps) {
  const xpGain = useGain(stats?.xpTotal);
  const coinGain = useGain(stats?.coins);

  const streakText =
    stats === null
      ? "Streak: loading"
      : `Streak: ${stats.streakDays} ${stats.streakDays === 1 ? "day" : "days"}`;
  const announcement = [
    xpGain !== null ? `You earned ${xpGain.amount} XP.` : "",
    coinGain !== null ? `You earned ${coinGain.amount} coins.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <StatChip
        icon={
          <Flame
            aria-hidden="true"
            size={20}
            strokeWidth={2.5}
            className={cn(
              "shrink-0 stroke-stroke",
              stats !== null && stats.streakDays > 0
                ? "fill-[var(--world-pop,#ff7a59)]"
                : "fill-surface-200",
            )}
          />
        }
        value={stats === null ? null : NUMBER_FORMAT.format(stats.streakDays)}
        accessibleLabel={streakText}
      />
      <StatChip
        icon={
          <Coins
            aria-hidden="true"
            size={20}
            strokeWidth={2.5}
            className="shrink-0 fill-[#ffd93d] stroke-stroke"
          />
        }
        value={stats === null ? null : NUMBER_FORMAT.format(stats.coins)}
        accessibleLabel={
          stats === null ? "Coins: loading" : `Coins: ${NUMBER_FORMAT.format(stats.coins)}`
        }
        gain={coinGain}
        gainText={coinGain === null ? undefined : `+${NUMBER_FORMAT.format(coinGain.amount)}`}
      />
      <div
        className="relative flex shrink-0 items-center gap-2"
        title={stats?.rankTitle}
        role="group"
        aria-label={
          stats === null
            ? "Level: loading"
            : `Level ${stats.level}${stats.rankTitle !== undefined ? `, ${stats.rankTitle}` : ""}`
        }
      >
        {stats === null ? (
          <span className={cn(CHIP_BASE, "h-8 px-3 text-[13px] font-bold")}>
            <span aria-hidden="true">Level –</span>
          </span>
        ) : (
          <span aria-hidden="true">
            <LevelIndicator level={stats.level} />
          </span>
        )}
        <XpProgress stats={stats} />
        {xpGain !== null && (
          <GainPop key={xpGain.key} text={`+${NUMBER_FORMAT.format(xpGain.amount)} XP`} />
        )}
      </div>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

/* ---------- Popover plumbing ---------- */

/** Open state plus outside-click and Escape dismissal; Escape returns focus to the trigger. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  return { open, setOpen, close, triggerRef, panelRef };
}

const TRIGGER_BASE =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border-2 border-stroke bg-surface-0 font-body text-[14px] font-bold text-stroke shadow-retro-sm transition-transform duration-[120ms] ease-out hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-retro-md active:translate-x-0.5 active:translate-y-0.5 active:shadow-none motion-reduce:transition-none";

const PANEL_BASE =
  "absolute right-0 top-[calc(100%+8px)] z-50 rounded-[14px] border-2 border-stroke bg-surface-0 p-2 shadow-retro-md";

/* ---------- World + theme switcher ---------- */

function AppearanceMenu() {
  const { world, worlds, setWorld } = useWorld();
  const { theme, themes, setTheme } = useTheme();
  const { open, setOpen, triggerRef, panelRef } = usePopover();
  const panelId = useId();
  const worldHeadingId = useId();
  const themeHeadingId = useId();
  const activePalette = theme.worlds[world];

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`World and theme, current world ${WORLD_LABELS[world]}`}
        onClick={() => {
          setOpen((current) => !current);
        }}
        className={cn(TRIGGER_BASE, "w-11 min-[1200px]:w-auto min-[1200px]:px-3")}
      >
        <span
          aria-hidden="true"
          className="h-5 w-5 shrink-0 rounded-full border-2 border-stroke"
          style={{ backgroundColor: activePalette.main }}
        />
        <span aria-hidden="true" className="hidden min-[1200px]:inline">
          {WORLD_LABELS[world]}
        </span>
        <Palette
          aria-hidden="true"
          size={18}
          strokeWidth={2.5}
          className="hidden min-[1200px]:block"
        />
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="World and theme"
          data-lenis-prevent
          className={cn(PANEL_BASE, "w-[280px] max-w-[calc(100vw-2rem)]")}
        >
          <p
            id={worldHeadingId}
            className="px-2 pb-1 pt-1 font-heading text-[14px] font-semibold text-stroke"
          >
            World
          </p>
          <div
            role="group"
            aria-labelledby={worldHeadingId}
            className="grid grid-cols-3 gap-2 px-1 pb-2"
          >
            {worlds.map((id) => {
              const selected = id === world;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setWorld(id);
                  }}
                  className={cn(
                    "flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-[12px] border-2 px-1 py-1.5 font-body text-[12px] font-bold text-stroke",
                    selected
                      ? "border-stroke bg-[var(--world-tint,#fff1e3)] shadow-retro-sm"
                      : "border-transparent hover:border-stroke",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="h-6 w-6 rounded-full border-2 border-stroke"
                    style={{ backgroundColor: theme.worlds[id].main }}
                  />
                  {WORLD_LABELS[id]}
                </button>
              );
            })}
          </div>

          {themes.length > 1 && (
            <>
              <p
                id={themeHeadingId}
                className="px-2 pb-1 pt-1 font-heading text-[14px] font-semibold text-stroke"
              >
                Theme
              </p>
              <div
                role="group"
                aria-labelledby={themeHeadingId}
                className="flex flex-col gap-1 px-1 pb-1"
              >
                {themes.map((candidate) => {
                  const selected = candidate.id === theme.id;
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setTheme(candidate.id);
                      }}
                      className={cn(
                        "flex min-h-[44px] items-center justify-between gap-2 rounded-[12px] border-2 px-3 font-body text-[14px] font-bold text-stroke",
                        selected
                          ? "border-stroke bg-[var(--world-tint,#fff1e3)] shadow-retro-sm"
                          : "border-transparent hover:border-stroke",
                      )}
                    >
                      <span>{candidate.name}</span>
                      <span aria-hidden="true" className="flex -space-x-1">
                        {worlds.map((id) => (
                          <span
                            key={id}
                            className="h-4 w-4 rounded-full border-2 border-stroke"
                            style={{ backgroundColor: candidate.worlds[id].main }}
                          />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Avatar menu ---------- */

function AvatarMenu() {
  const { user, signOut } = useAuth();
  const toast = useToast();
  const { open, setOpen, close, triggerRef, panelRef } = usePopover();
  const menuId = useId();
  const [signingOut, setSigningOut] = useState(false);
  const fullName = user?.fullName ?? "";

  // Focus the first item when the menu opens.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open, panelRef]);

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([aria-disabled="true"])',
      ),
    );
    const index = items.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    if (event.key === "ArrowDown") next = (index + 1) % items.length;
    else if (event.key === "ArrowUp") next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else if (event.key === "Tab") close(false);
    if (next !== null) {
      event.preventDefault();
      items[next]?.focus();
    }
  };

  const handleSignOut = () => {
    if (signingOut) return;
    setSigningOut(true);
    void signOut()
      .catch(() => {
        toast.show({
          type: "error",
          title: "Could not sign out",
          description: "Check your connection and try again.",
        });
      })
      .finally(() => {
        setSigningOut(false);
        setOpen(false);
      });
  };

  const itemClass =
    "flex min-h-[44px] w-full items-center gap-3 rounded-[12px] border-2 border-transparent px-3 text-left font-body text-[14px] font-bold text-stroke hover:border-stroke hover:bg-[var(--world-tint,#fff1e3)] focus-visible:border-stroke";

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={fullName !== "" ? `Account menu for ${fullName}` : "Account menu"}
        onClick={() => {
          setOpen((current) => !current);
        }}
        className={cn(TRIGGER_BASE, "w-11 bg-[var(--world-soft,#ffd93d)] font-heading text-[15px]")}
      >
        <span aria-hidden="true">{initialsOf(fullName)}</span>
      </button>

      {open && (
        <div
          ref={panelRef}
          id={menuId}
          role="menu"
          aria-label="Account"
          tabIndex={-1}
          data-lenis-prevent
          onKeyDown={onMenuKeyDown}
          className={cn(PANEL_BASE, "w-[220px]")}
        >
          {fullName !== "" && (
            <p className="truncate px-3 pb-1 pt-1 font-heading text-[14px] font-semibold text-stroke">
              {fullName}
            </p>
          )}
          <Link
            to="/student/profile"
            role="menuitem"
            tabIndex={-1}
            onClick={() => {
              setOpen(false);
            }}
            className={itemClass}
          >
            <User aria-hidden="true" size={18} strokeWidth={2.5} />
            Profile
          </Link>
          <Link
            to="/student/settings"
            role="menuitem"
            tabIndex={-1}
            onClick={() => {
              setOpen(false);
            }}
            className={itemClass}
          >
            <Settings aria-hidden="true" size={18} strokeWidth={2.5} />
            Settings
          </Link>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            aria-disabled={signingOut}
            onClick={handleSignOut}
            className={cn(itemClass, "text-danger-600")}
          >
            <LogOut aria-hidden="true" size={18} strokeWidth={2.5} />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- Top bar ---------- */

export function StudentTopBar({
  title,
  stats,
  unreadNotifications = 0,
  onOpenNav,
  navOpen,
  navId,
  className,
}: StudentTopBarProps) {
  const unread = Math.max(0, Math.trunc(unreadNotifications));

  return (
    <header className={cn("shrink-0 border-b-2 border-stroke bg-surface-0", className)}>
      <div className="flex h-16 items-center gap-2 px-3 md:gap-3 md:px-6 min-[1200px]:px-8">
        <button
          type="button"
          aria-label="Open navigation menu"
          aria-expanded={navOpen}
          aria-controls={navId}
          onClick={onOpenNav}
          className={cn(TRIGGER_BASE, "w-11 md:hidden")}
        >
          <Menu aria-hidden="true" size={20} strokeWidth={2.5} />
        </button>

        <p className="min-w-0 flex-1 truncate font-heading text-[20px] font-semibold leading-none text-stroke md:text-[24px]">
          {title}
        </p>

        <StatsGroup stats={stats} className="hidden md:flex" />

        <div className="flex shrink-0 items-center gap-2">
          <AppearanceMenu />
          <Link
            to="/student/notifications"
            aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
            className={cn(TRIGGER_BASE, "relative w-11")}
          >
            <Bell aria-hidden="true" size={20} strokeWidth={2.5} />
            {unread > 0 && (
              <span
                aria-hidden="true"
                className="absolute right-0 top-0 h-3.5 w-3.5 rounded-full border-2 border-stroke bg-danger-600"
              />
            )}
          </Link>
          <AvatarMenu />
        </div>
      </div>

      <div className="border-t-2 border-stroke/10 px-3 py-2 md:hidden">
        <StatsGroup stats={stats} className="overflow-x-auto pb-1 pr-1" />
      </div>
    </header>
  );
}
