import { useEffect, useRef, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarClock,
  CheckCircle2,
  Flag,
  FilePlus2,
  Info,
  Pencil,
  Rocket,
  Sparkles,
  Star,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";
import { Button } from "../ui/Button";
import { TypingIndicator } from "./TypingIndicator";

/* ActionCardDisplay: a proposed change set from the AI (Teacher / Admin Copilot, AI builders),
   summarized in plain words with explicit Apply Changes / Discard buttons.

   Data shapes follow `ai_action_cards` (backend/docs/07-AI-SYSTEM.md §8): `summary`, typed
   `changes`, `sources`, `notes`, `status`. Each change carries a ready-made plain-language
   `description` (the preview text the server builds, for example "Assigns it to 8B and 8C"),
   so the card never interprets raw database payloads.

   Pure UI: nothing is applied here. `onApply` / `onDiscard` / `onUndo` / `onRegenerate` are
   the page's job (RPC `ai_action_apply` and friends). Nothing AI-made goes live without Apply.
   Focus: when the card leaves the `ready` state its buttons disappear, so focus moves to the card
   itself and its status message is announced. */

export type ActionCardStatus =
  "generating" | "ready" | "approved" | "edited" | "discarded" | "stale" | "failed";

export type ActionChangeOp =
  | "create_draft"
  | "update"
  | "publish"
  | "assign"
  | "schedule"
  | "notify"
  | "award"
  | "create_quest";

export interface ActionCardChange {
  op: ActionChangeOp;
  /** Plain-language description of this one change. */
  description: string;
  /** For `update`: the value now and the value after applying. */
  before?: string | undefined;
  after?: string | undefined;
}

export interface ActionCardSource {
  label: string;
  href?: string | undefined;
}

export interface ActionCardData {
  id: string;
  /** Card kind (create_quiz, bonus_award, ...). Used for the title when `title` is absent. */
  kind: string;
  title?: string | undefined;
  summary: string;
  changes: ActionCardChange[];
  sources?: ActionCardSource[] | undefined;
  notes?: string[] | undefined;
  status: ActionCardStatus;
}

export interface ActionCardDisplayProps {
  card: ActionCardData;
  onApply: () => void;
  onDiscard: () => void;
  /** Apply is running (shows a spinner and blocks both buttons). */
  applying?: boolean | undefined;
  /** Discard is running. */
  discarding?: boolean | undefined;
  /** Offered after the card was applied, while the backend undo window is open. */
  onUndo?: (() => void) | undefined;
  /** Offered when the card is stale or failed. */
  onRegenerate?: (() => void) | undefined;
  className?: string | undefined;
}

const OPS: Record<ActionChangeOp, { label: string; Icon: LucideIcon }> = {
  create_draft: { label: "Create", Icon: FilePlus2 },
  update: { label: "Update", Icon: Pencil },
  publish: { label: "Publish", Icon: Rocket },
  assign: { label: "Assign", Icon: Users },
  schedule: { label: "Schedule", Icon: CalendarClock },
  notify: { label: "Notify", Icon: Bell },
  award: { label: "Award", Icon: Star },
  create_quest: { label: "Quest", Icon: Flag },
};

function titleOf(card: ActionCardData): string {
  if (card.title) return card.title;
  const words = card.kind.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function Banner({
  tone,
  icon,
  children,
}: {
  tone: "success" | "warning" | "danger" | "muted";
  icon: LucideIcon;
  children: ReactNode;
}) {
  const Icon = icon;
  const style = {
    success: "border-success-600 bg-success-100",
    warning: "border-stroke bg-world-amber-100",
    danger: "border-danger-600 bg-danger-100",
    muted: "border-dashed border-muted bg-surface-200 text-muted",
  }[tone];
  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-[12px] border-2 px-3 py-2 text-[15px] font-semibold",
        style,
      )}
    >
      <Icon size={20} />
      {children}
    </div>
  );
}

export function ActionCardDisplay({
  card,
  onApply,
  onDiscard,
  applying = false,
  discarding = false,
  onUndo,
  onRegenerate,
  className,
}: ActionCardDisplayProps) {
  const root = useRef<HTMLElement>(null);
  const previous = useRef<ActionCardStatus>(card.status);

  // The Apply / Discard buttons unmount when the card resolves; keep focus inside the card.
  useEffect(() => {
    if (previous.current === "ready" && card.status !== "ready") {
      const active = document.activeElement;
      if (!active || active === document.body || root.current?.contains(active)) {
        root.current?.focus();
      }
    }
    previous.current = card.status;
  }, [card.status]);

  const busy = applying || discarding;
  const count = card.changes.length;

  return (
    <section
      ref={root}
      tabIndex={-1}
      aria-label={`Proposed changes: ${titleOf(card)}`}
      aria-busy={card.status === "generating" || applying || discarding || undefined}
      className={cn(
        "flex w-full flex-col gap-4 rounded-[20px] border-2 border-stroke bg-surface-0 p-4 text-stroke shadow-[0_4px_0_0_#000] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke",
        card.status === "discarded" && "opacity-80",
        className,
      )}
    >
      <header className="flex flex-wrap items-center gap-2">
        <Sparkles size={20} aria-hidden="true" />
        <h3 className="font-heading text-[18px] font-bold leading-tight">{titleOf(card)}</h3>
        {count > 0 && (
          <span className="ml-auto rounded-full border-2 border-stroke bg-[var(--world-soft,#ffd93d)] px-2.5 py-0.5 text-[13px] font-bold">
            {count} {count === 1 ? "change" : "changes"}
          </span>
        )}
      </header>

      <p className="text-[16px] leading-relaxed">{card.summary}</p>

      {count > 0 && (
        <ul className="flex flex-col gap-2">
          {card.changes.map((change, index) => {
            const { label, Icon } = OPS[change.op];
            return (
              <li
                key={index}
                className="flex items-start gap-3 rounded-[12px] border-2 border-stroke bg-surface-200 px-3 py-2"
              >
                <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border-2 border-stroke bg-[var(--world-main,#ffb84d)] px-2 py-0.5 text-[12px] font-bold uppercase">
                  <Icon size={14} />
                  {label}
                </span>
                <span className="min-w-0 flex-1 text-[15px] leading-snug [overflow-wrap:anywhere]">
                  {change.description}
                  {change.before !== undefined && change.after !== undefined && (
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-[14px]">
                      <s className="text-muted">{change.before}</s>
                      <ArrowRight size={14} aria-label="becomes" />
                      <strong>{change.after}</strong>
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {card.notes && card.notes.length > 0 && (
        <ul className="flex flex-col gap-1 text-[14px]">
          {card.notes.map((note, index) => (
            <li key={index} className="flex items-start gap-2">
              <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      )}

      {card.sources && card.sources.length > 0 && (
        <p className="text-[14px] text-muted">
          Based on:{" "}
          {card.sources.map((source, index) => (
            <span key={index}>
              {index > 0 && ", "}
              {source.href ? (
                <a href={source.href} className="font-semibold underline underline-offset-2">
                  {source.label}
                </a>
              ) : (
                source.label
              )}
            </span>
          ))}
        </p>
      )}

      {card.status === "generating" && <TypingIndicator label="Preparing proposed changes" />}

      {card.status === "ready" && (
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="primary"
            loading={applying}
            disabled={discarding}
            onClick={onApply}
          >
            Apply Changes
          </Button>
          <Button
            type="button"
            variant="outline"
            loading={discarding}
            disabled={applying}
            onClick={onDiscard}
          >
            Discard
          </Button>
        </div>
      )}

      {(card.status === "approved" || card.status === "edited") && (
        <Banner tone="success" icon={CheckCircle2}>
          <span>Changes applied.</span>
          {onUndo && (
            <Button type="button" size="sm" variant="outline" onClick={onUndo} disabled={busy}>
              Undo
            </Button>
          )}
        </Banner>
      )}

      {card.status === "discarded" && (
        <Banner tone="muted" icon={XCircle}>
          Discarded. Nothing was changed.
        </Banner>
      )}

      {card.status === "stale" && (
        <Banner tone="warning" icon={AlertTriangle}>
          <span>This changed since it was prepared, so it cannot be applied.</span>
          {onRegenerate && (
            <Button type="button" size="sm" variant="outline" onClick={onRegenerate}>
              Regenerate
            </Button>
          )}
        </Banner>
      )}

      {card.status === "failed" && (
        <Banner tone="danger" icon={XCircle}>
          <span>Something went wrong. Nothing was changed.</span>
          {onRegenerate && (
            <Button type="button" size="sm" variant="outline" onClick={onRegenerate}>
              Try again
            </Button>
          )}
        </Banner>
      )}
    </section>
  );
}
