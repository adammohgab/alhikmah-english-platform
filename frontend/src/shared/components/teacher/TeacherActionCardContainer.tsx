import { useMemo, useState } from "react";
import { Check, ChevronRight, PencilLine, Save, X } from "lucide-react";
import { supabase } from "@/shared/api/supabase";
import { useToast } from "@/shared/hooks/useToast";
import {
  ActionCardDisplay,
  type ActionCardChange,
  type ActionCardData,
  type ActionCardStatus,
} from "@/shared/components/ai/ActionCardDisplay";

/** Raw action-card row as returned by ai-copilot/Supabase. */
export interface TeacherActionCardRecord {
  id: string;
  card_type?: string;
  kind?: string;
  title?: string;
  summary?: string;
  preview?: unknown;
  payload?: Record<string, unknown> | null;
  changes: unknown[];
  sources?: unknown;
  notes?: string[] | null;
  status: string;
}

interface Props {
  card: TeacherActionCardRecord;
  onResolved?: (result: {
    id: string;
    status: "approved" | "edited" | "discarded";
    result?: unknown;
  }) => void;
  className?: string;
}

type RawChange = Record<string, unknown>;

function objectValue(value: unknown): RawChange {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RawChange) : {};
}

function displayOperation(change: RawChange): ActionCardChange["op"] {
  const action = String(change.action ?? change.op ?? "create_draft").toLowerCase();
  if (action === "update") return "update";
  if (action === "publish") return "publish";
  if (action === "assign") return "assign";
  if (action === "schedule") return "schedule";
  if (action === "notify") return "notify";
  if (action === "award") return "award";
  if (action === "create_quest") return "create_quest";
  return "create_draft";
}

function changeDescription(change: RawChange, index: number): string {
  if (typeof change.description === "string" && change.description.trim())
    return change.description;
  const action = String(change.action ?? change.op ?? "create_draft").replace(/_/g, " ");
  const entity = String(change.entity ?? "curriculum item").replace(/_/g, " ");
  const data = objectValue(change.data ?? change.patch);
  const title = data.title ?? data.name ?? data.prompt ?? data.question;
  if (title) return `${action} ${entity}: ${String(title)}`;
  return `${action} ${entity} (change ${index + 1})`;
}

function normalizeStatus(status: string): ActionCardStatus {
  if (status === "generating") return "generating";
  if (status === "ready" || status === "pending") return "ready";
  if (status === "applied" || status === "accepted") return "approved";
  if (status === "edited") return "edited";
  if (status === "discarded") return "discarded";
  if (status === "stale") return "stale";
  if (status === "failed") return "failed";
  return "ready";
}

function getSummary(record: TeacherActionCardRecord): string {
  if (record.summary?.trim()) return record.summary;
  if (typeof record.preview === "string") return record.preview;
  const payload = objectValue(record.payload);
  return typeof payload.summary === "string"
    ? payload.summary
    : "Review the proposed changes below before applying them.";
}

export default function TeacherActionCardContainer({ card, onResolved, className }: Props) {
  const toast = useToast();
  const [rawChanges, setRawChanges] = useState<RawChange[]>(() => card.changes.map(objectValue));
  const [editing, setEditing] = useState(false);
  const [jsonDrafts, setJsonDrafts] = useState<string[]>([]);
  const [jsonErrors, setJsonErrors] = useState<Record<number, string>>({});
  const [applying, setApplying] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [resolvedStatus, setResolvedStatus] = useState<ActionCardStatus>(
    normalizeStatus(card.status),
  );

  const viewCard = useMemo<ActionCardData>(() => {
    const kind = card.kind ?? card.card_type ?? "curriculum_change";
    return {
      id: card.id,
      kind,
      title: card.title ?? kind.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase()),
      summary: getSummary(card),
      changes: rawChanges.map((change, index) => {
        const before = change.before;
        const after = change.after ?? change.patch ?? change.data;
        return {
          op: displayOperation(change),
          description: changeDescription(change, index),
          ...(before !== undefined
            ? { before: typeof before === "string" ? before : JSON.stringify(before) }
            : {}),
          ...(after !== undefined
            ? { after: typeof after === "string" ? after : JSON.stringify(after) }
            : {}),
        };
      }),
      sources: (Array.isArray(card.sources)
        ? card.sources
        : Object.entries(objectValue(card.sources)).map(([label, href]) => ({
            label,
            href: typeof href === "string" ? href : undefined,
          }))
      )
        .map((source) => objectValue(source))
        .filter((source) => typeof source.label === "string" && source.label.trim())
        .map((source) => ({
          label: String(source.label),
          ...(typeof source.href === "string" ? { href: source.href } : {}),
        })),
      notes: card.notes ?? [],
      status: resolvedStatus,
    };
  }, [card, rawChanges, resolvedStatus]);

  function startEditing() {
    setJsonDrafts(rawChanges.map((change) => JSON.stringify(change, null, 2)));
    setJsonErrors({});
    setEditing(true);
  }

  function updateDraft(index: number, value: string) {
    setJsonDrafts((previous) =>
      previous.map((entry, current) => (current === index ? value : entry)),
    );
    setJsonErrors((previous) => ({ ...previous, [index]: "" }));
  }

  function saveEdits() {
    const parsed: RawChange[] = [];
    const errors: Record<number, string> = {};
    jsonDrafts.forEach((draft, index) => {
      try {
        const value: unknown = JSON.parse(draft);
        if (!value || typeof value !== "object" || Array.isArray(value))
          throw new Error("Each change must be a JSON object.");
        parsed[index] = value as RawChange;
      } catch (error) {
        errors[index] = error instanceof Error ? error.message : "Invalid JSON.";
      }
    });
    if (Object.keys(errors).length > 0) {
      setJsonErrors(errors);
      toast.show({
        title: "Fix the highlighted edits",
        description: "Each proposed change must remain a valid JSON object.",
        type: "warning",
      });
      return;
    }
    setRawChanges(parsed);
    setEditing(false);
    toast.show({
      title: "Draft updated",
      description: "Review the updated preview before applying changes.",
      type: "success",
    });
  }

  async function apply() {
    if (resolvedStatus !== "ready" || applying || discarding) return;
    if (editing) {
      toast.show({
        title: "Save or cancel your edits first",
        description: "The apply action only uses the saved draft shown in the preview.",
        type: "warning",
      });
      return;
    }
    setApplying(true);
    try {
      const edits =
        editing ||
        rawChanges.some(
          (change, index) =>
            JSON.stringify(change) !== JSON.stringify(objectValue(card.changes[index])),
        )
          ? { changes: rawChanges }
          : null;
      const { data, error } = await (supabase as any).rpc("apply_action_card", {
        card_id: card.id,
        edits,
      });
      if (error) throw error;
      const status = edits === null ? "approved" : "edited";
      setResolvedStatus(status);
      toast.show({
        title: "Changes applied",
        description: "The action card was applied successfully.",
        type: "success",
      });
      onResolved?.({ id: card.id, status, result: data });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not apply this action card.";
      const stale = /stale|changed since|version mismatch/i.test(message);
      if (stale) setResolvedStatus("stale");
      toast.show({
        title: stale ? "Action card is out of date" : "Could not apply changes",
        description: message,
        type: "error",
      });
    } finally {
      setApplying(false);
    }
  }

  async function undo() {
    if ((resolvedStatus !== "approved" && resolvedStatus !== "edited") || undoing) return;
    setUndoing(true);
    try {
      const { error } = await (supabase as any).rpc("undo_action_card", { card_id: card.id });
      if (error) throw error;
      setResolvedStatus("ready");
      toast.show({
        title: "Changes undone",
        description: "The action card changes were reverted.",
        type: "success",
      });
    } catch (error) {
      toast.show({
        title: "Could not undo changes",
        description: error instanceof Error ? error.message : "Please try again.",
        type: "error",
      });
    } finally {
      setUndoing(false);
    }
  }

  async function discard() {
    if (resolvedStatus !== "ready" || applying || discarding) return;
    setDiscarding(true);
    try {
      const { error } = await (supabase as any).rpc("discard_action_card", { card_id: card.id });
      if (error) throw error;
      setResolvedStatus("discarded");
      toast.show({
        title: "Action card discarded",
        description: "No curriculum changes were applied.",
        type: "success",
      });
      onResolved?.({ id: card.id, status: "discarded" });
    } catch (error) {
      toast.show({
        title: "Could not discard action card",
        description: error instanceof Error ? error.message : "Please try again.",
        type: "error",
      });
    } finally {
      setDiscarding(false);
    }
  }

  return (
    <div className={className}>
      {resolvedStatus === "ready" && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-dashed border-amber-500 bg-amber-50 p-3 text-sm text-amber-950">
          <div>
            <strong>AI draft · Not applied</strong>
            <p className="mt-0.5">
              Review the proposed database changes. You can edit the operation payload before
              applying.
            </p>
          </div>
          {!editing ? (
            <button
              type="button"
              onClick={startEditing}
              className="inline-flex items-center gap-2 rounded-lg border-2 border-amber-700 bg-white px-3 py-2 font-bold hover:bg-amber-100"
            >
              <PencilLine size={16} /> Edit changes
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveEdits}
                className="inline-flex items-center gap-2 rounded-lg border-2 border-emerald-700 bg-emerald-100 px-3 py-2 font-bold"
              >
                <Save size={16} /> Save edits
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="inline-flex items-center gap-2 rounded-lg border-2 border-stroke bg-white px-3 py-2 font-bold"
              >
                <X size={16} /> Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {editing && resolvedStatus === "ready" && (
        <section
          className="mb-4 space-y-3 rounded-xl border-2 border-stroke bg-surface-0 p-4"
          aria-label="Edit proposed changes"
        >
          <h4 className="font-heading text-lg font-bold">Edit change payloads</h4>
          <p className="text-sm text-muted">
            Edit the proposed values below. Changes remain a draft until you press Apply Changes.
          </p>
          {jsonDrafts.map((draft, index) => (
            <div key={index} className="space-y-1">
              <label htmlFor={`action-change-${card.id}-${index}`} className="font-semibold">
                Change {index + 1}: {changeDescription(rawChanges[index] ?? {}, index)}
              </label>
              <textarea
                id={`action-change-${card.id}-${index}`}
                value={draft}
                onChange={(event) => updateDraft(index, event.target.value)}
                rows={Math.min(12, Math.max(4, draft.split("\n").length))}
                spellCheck={false}
                className="w-full rounded-lg border-2 border-stroke bg-white p-3 font-mono text-xs"
              />
              {jsonErrors[index] && (
                <p role="alert" className="text-danger text-sm font-semibold">
                  {jsonErrors[index]}
                </p>
              )}
            </div>
          ))}
          {jsonDrafts.length === 0 && (
            <p className="text-sm text-muted">This card contains no changes to edit.</p>
          )}
        </section>
      )}

      <ActionCardDisplay
        card={viewCard}
        applying={applying}
        discarding={discarding}
        onApply={() => void apply()}
        onDiscard={() => void discard()}
        onUndo={() => void undo()}
        className="shadow-none"
      />
      {resolvedStatus === "ready" && !editing && rawChanges.length > 0 && (
        <details className="mt-3 rounded-xl border border-stroke/20 bg-surface-0 p-3 text-sm">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
            <ChevronRight size={16} className="details-chevron" /> View proposed payload (JSON)
          </summary>
          <pre className="bg-surface-2 mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg p-3 text-xs">
            {JSON.stringify(rawChanges, null, 2)}
          </pre>
        </details>
      )}
      {resolvedStatus === "approved" || resolvedStatus === "edited" ? (
        <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <Check size={16} />{" "}
          {resolvedStatus === "edited" ? "Edited changes applied" : "Changes applied"}
        </p>
      ) : null}
    </div>
  );
}
