import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronDown,
  ClipboardCheck,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";
import { useAuth } from "@/app/providers/auth-context";
import { useToast } from "@/shared/hooks/useToast";

/* ========================================
   Teacher top bar (TEACHER-SPEC §2, §3.1, §3.3, §3.4; TASKS UIK-24)

   Calm and efficient (spec §2): no streak, coin or XP chips here.
   Normal mode, left to right: page title, Class switcher, Grading queue pill, "Ask AI" toggle,
   notification bell, avatar menu. Below 768px the switcher and the grading pill move into a
   strip under the bar. Focused mode (grading screen, builders) swaps the title area for a "back"
   link and keeps only what a teacher needs while working: the class context, Ask AI, avatar.

   Nothing is fetched here. The owner of the teacher route passes the active classes, the
   waiting-submission count and the unread notification count; this bar only renders them.
   ======================================== */

/** One active class in the switcher. `name` is what the teacher recognises, e.g. "8B". */
export interface TeacherShellClass {
  id: string;
  name: string;
}

export interface TeacherTopBarProps {
  /** Page title (normal mode) or document title (focused mode). */
  title: string;
  /** Active classes the teacher can switch between. Archived classes must not be passed. */
  classes: readonly TeacherShellClass[];
  /** `true` while the class list loads. */
  classesLoading?: boolean | undefined;
  /** Selected class id, or `null` for "All classes". */
  selectedClassId: string | null;
  onSelectClass: (classId: string | null) => void;
  /** Submissions waiting for the teacher. `null` while unknown; zero shows no number. */
  pendingSubmissions: number | null;
  unreadNotifications?: number | undefined;
  copilotOpen: boolean;
  onToggleCopilot: () => void;
  /** Id of the Copilot panel (for `aria-controls`). */
  copilotPanelId: string;
  /** Opens the navigation drawer. */
  onOpenNav: () => void;
  navOpen: boolean;
  navId: string;
  /** Focused mode: slim header, "back" link instead of the plain title. */
  focused: boolean;
  /** Where the focused-mode back link goes. */
  backTo?: { to: string; label: string } | undefined;
  className?: string | undefined;
}

const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

function formatCount(count: number): string {
  return count > 99 ? "99+" : NUMBER_FORMAT.format(count);
}

function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : "";
  return `${first}${last}`.toUpperCase() || "?";
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

/** Arrow / Home / End navigation across the focusable items of a menu or listbox. */
function moveFocus(event: KeyboardEvent<HTMLElement>, itemSelector: string): boolean {
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(itemSelector));
  if (items.length === 0) return false;
  const index = items.indexOf(document.activeElement as HTMLElement);
  let next: number | null = null;
  if (event.key === "ArrowDown") next = (index + 1) % items.length;
  else if (event.key === "ArrowUp") next = (index - 1 + items.length) % items.length;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = items.length - 1;
  if (next === null) return false;
  event.preventDefault();
  items[next]?.focus();
  return true;
}

const CONTROL_BASE =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border-2 border-stroke bg-surface-0 font-body text-[14px] font-bold text-stroke shadow-retro-sm transition-transform duration-[120ms] ease-out hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-retro-md active:translate-x-0.5 active:translate-y-0.5 active:shadow-none motion-reduce:transition-none";

const PANEL_BASE =
  "absolute top-[calc(100%+8px)] z-50 rounded-[14px] border-2 border-stroke bg-surface-0 p-2 shadow-retro-md";

/* ---------- Class switcher ---------- */

interface ClassSwitcherProps {
  classes: readonly TeacherShellClass[];
  loading: boolean;
  selectedClassId: string | null;
  onSelectClass: (classId: string | null) => void;
  className?: string;
}

function ClassSwitcher({
  classes,
  loading,
  selectedClassId,
  onSelectClass,
  className,
}: ClassSwitcherProps) {
  const { open, setOpen, close, triggerRef, panelRef } = usePopover();
  const listId = useId();
  const selected = classes.find((item) => item.id === selectedClassId) ?? null;
  const label = loading ? "Loading classes…" : selected !== null ? selected.name : "All classes";
  const disabled = loading || classes.length === 0;

  // Focus the selected option (or the first) when the list opens.
  useEffect(() => {
    if (!open) return;
    const target =
      panelRef.current?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]') ??
      panelRef.current?.querySelector<HTMLElement>('[role="option"]');
    target?.focus();
  }, [open, panelRef]);

  const choose = (classId: string | null) => {
    onSelectClass(classId);
    close(true);
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      close(false);
      return;
    }
    moveFocus(event, '[role="option"]');
  };

  const optionClass = (isSelected: boolean) =>
    cn(
      "flex min-h-[44px] w-full items-center justify-between gap-3 rounded-[12px] border-2 px-3 text-left font-body text-[14px] font-bold text-stroke focus-visible:border-stroke",
      isSelected
        ? "border-stroke bg-[var(--world-tint,#ecefff)] shadow-retro-sm"
        : "border-transparent hover:border-stroke hover:bg-surface-100",
    );

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`Class: ${label}. Change class`}
        title={classes.length === 0 && !loading ? "No active classes yet" : undefined}
        onClick={() => {
          setOpen((current) => !current);
        }}
        className={cn(
          CONTROL_BASE,
          "max-w-[180px] px-3 disabled:cursor-not-allowed disabled:border-dashed disabled:text-muted disabled:shadow-none",
        )}
      >
        <Users aria-hidden="true" size={18} strokeWidth={2.5} className="shrink-0" />
        <span aria-hidden="true" className="truncate">
          {label}
        </span>
        <ChevronDown aria-hidden="true" size={16} strokeWidth={3} className="shrink-0" />
      </button>

      {open && (
        <div
          ref={panelRef}
          id={listId}
          role="listbox"
          aria-label="Class"
          tabIndex={-1}
          data-lenis-prevent
          onKeyDown={onListKeyDown}
          className={cn(
            PANEL_BASE,
            "left-0 max-h-[60vh] w-[240px] max-w-[calc(100vw-2rem)] overflow-y-auto",
          )}
        >
          <button
            type="button"
            role="option"
            tabIndex={-1}
            aria-selected={selected === null}
            onClick={() => {
              choose(null);
            }}
            className={optionClass(selected === null)}
          >
            <span>All classes</span>
            {selected === null && <Check aria-hidden="true" size={16} strokeWidth={3} />}
          </button>
          {classes.map((item) => {
            const isSelected = item.id === selectedClassId;
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={isSelected}
                onClick={() => {
                  choose(item.id);
                }}
                className={optionClass(isSelected)}
              >
                <span className="truncate">{item.name}</span>
                {isSelected && <Check aria-hidden="true" size={16} strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Grading queue pill ---------- */

function GradingPill({ count, className }: { count: number | null; className?: string }) {
  const waiting = count !== null && count > 0;
  return (
    <Link
      to="/teacher/grading"
      aria-label={
        count === null
          ? "Grading queue"
          : waiting
            ? `Grading queue, ${count} ${count === 1 ? "submission" : "submissions"} waiting`
            : "Grading queue, nothing waiting"
      }
      className={cn(CONTROL_BASE, "px-3", waiting && "bg-[var(--world-soft,#ffd93d)]", className)}
    >
      <ClipboardCheck aria-hidden="true" size={18} strokeWidth={2.5} className="shrink-0" />
      <span aria-hidden="true">Grading</span>
      {waiting && (
        <span
          aria-hidden="true"
          className="grid h-6 min-w-6 place-items-center rounded-full border-2 border-stroke bg-surface-0 px-1.5 font-heading text-[12px] font-bold tabular-nums leading-none"
        >
          {formatCount(count)}
        </span>
      )}
    </Link>
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
    if (event.key === "Tab") {
      close(false);
      return;
    }
    moveFocus(event, '[role="menuitem"]:not([aria-disabled="true"])');
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
    "flex min-h-[44px] w-full items-center gap-3 rounded-[12px] border-2 border-transparent px-3 text-left font-body text-[14px] font-bold text-stroke hover:border-stroke hover:bg-surface-100 focus-visible:border-stroke";

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
        className={cn(CONTROL_BASE, "w-11 bg-[var(--world-soft,#c9cfff)] font-heading text-[15px]")}
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
          className={cn(PANEL_BASE, "right-0 w-[220px]")}
        >
          {fullName !== "" && (
            <p className="truncate px-3 pb-1 pt-1 font-heading text-[14px] font-semibold text-stroke">
              {fullName}
            </p>
          )}
          <Link
            to="/teacher/settings"
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

export function TeacherTopBar({
  title,
  classes,
  classesLoading = false,
  selectedClassId,
  onSelectClass,
  pendingSubmissions,
  unreadNotifications = 0,
  copilotOpen,
  onToggleCopilot,
  copilotPanelId,
  onOpenNav,
  navOpen,
  navId,
  focused,
  backTo,
  className,
}: TeacherTopBarProps) {
  const unread = Math.max(0, Math.trunc(unreadNotifications));

  return (
    <header className={cn("shrink-0 border-b-2 border-stroke bg-surface-0", className)}>
      <div
        className={cn(
          "flex items-center gap-2 px-3 md:gap-3 md:px-6 min-[1200px]:px-8",
          focused ? "h-14" : "h-16",
        )}
      >
        {/* Navigation drawer: always on mobile, and in focused mode where the sidebar is hidden. */}
        <button
          type="button"
          aria-label="Open navigation menu"
          aria-expanded={navOpen}
          aria-controls={navId}
          onClick={onOpenNav}
          className={cn(CONTROL_BASE, "w-11", focused ? "" : "md:hidden")}
        >
          <Menu aria-hidden="true" size={20} strokeWidth={2.5} />
        </button>

        {focused && backTo !== undefined && (
          <Link
            to={backTo.to}
            aria-label={backTo.label}
            className={cn(CONTROL_BASE, "w-11 md:w-auto md:px-3")}
          >
            <ArrowLeft aria-hidden="true" size={18} strokeWidth={2.5} />
            <span aria-hidden="true" className="hidden md:inline">
              {backTo.label}
            </span>
          </Link>
        )}

        <p
          className={cn(
            "min-w-0 flex-1 truncate font-heading font-semibold leading-none text-stroke",
            focused ? "text-[18px]" : "text-[20px] md:text-[24px]",
          )}
        >
          {title}
        </p>

        <ClassSwitcher
          classes={classes}
          loading={classesLoading}
          selectedClassId={selectedClassId}
          onSelectClass={onSelectClass}
          className="hidden md:block"
        />
        {!focused && <GradingPill count={pendingSubmissions} className="hidden md:inline-flex" />}

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-pressed={copilotOpen}
            aria-controls={copilotOpen ? copilotPanelId : undefined}
            aria-keyshortcuts="Control+J Meta+J"
            aria-label="Ask AI"
            title="Ask AI (Ctrl/Cmd+J)"
            onClick={onToggleCopilot}
            className={cn(
              CONTROL_BASE,
              "hidden w-11 md:inline-flex min-[1200px]:w-auto min-[1200px]:px-3",
              copilotOpen && "bg-[var(--world-main,#7c8cff)] shadow-none",
            )}
          >
            <Sparkles aria-hidden="true" size={18} strokeWidth={2.5} />
            <span aria-hidden="true" className="hidden min-[1200px]:inline">
              Ask AI
            </span>
          </button>
          <Link
            to="/teacher/notifications"
            aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
            className={cn(CONTROL_BASE, "relative w-11")}
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

      {/* Mobile strip: class context and the grading queue stay one tap away. */}
      <div className="flex items-center gap-2 border-t-2 border-stroke/10 px-3 py-2 md:hidden">
        <ClassSwitcher
          classes={classes}
          loading={classesLoading}
          selectedClassId={selectedClassId}
          onSelectClass={onSelectClass}
        />
        {!focused && <GradingPill count={pendingSubmissions} />}
      </div>
    </header>
  );
}
