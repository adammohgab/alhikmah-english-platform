import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownUp,
  CheckCircle2,
  Clock3,
  GitCompareArrows,
  History,
  LoaderCircle,
  RotateCcw,
  X,
} from "lucide-react";
import { supabase } from "@/shared/api/supabase";

interface SnapshotRow {
  id: string;
  course_id: string;
  version_number: number;
  snapshot_data: Record<string, unknown>;
  published_at: string;
  published_by: string | null;
}
interface SnapshotNode {
  key: string;
  label: string;
  detail: string;
  kind: "course" | "unit" | "lesson" | "block";
}
type ChangeKind = "added" | "modified" | "deleted";
interface DiffItem {
  key: string;
  label: string;
  detail: string;
  kind: ChangeKind;
  nodeKind: SnapshotNode["kind"];
}
interface Props {
  courseId: string;
  open: boolean;
  onClose: () => void;
  onRestored?: () => void;
}

const panelStyle: React.CSSProperties = {
  background: "var(--color-card, #fff)",
  border: "1px solid var(--color-border, #e2e8f0)",
  borderRadius: 14,
  padding: 16,
};
const buttonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  border: "1px solid #cbd5e1",
  borderRadius: 9,
  padding: "9px 12px",
  background: "var(--color-card, #fff)",
  color: "inherit",
  cursor: "pointer",
  font: "inherit",
};
const selectStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 9,
  padding: "10px 11px",
  background: "var(--color-card, #fff)",
  color: "inherit",
  font: "inherit",
};

function text(value: unknown, fallback = "Untitled"): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}
function arr(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    : [];
}
function stableId(item: Record<string, unknown>, fallback: string): string {
  return typeof item.id === "string" && item.id ? item.id : fallback;
}
function flattenSnapshot(snapshot: SnapshotRow): SnapshotNode[] {
  const data = snapshot.snapshot_data ?? {};
  const course = (data.course && typeof data.course === "object" ? data.course : {}) as Record<
    string,
    unknown
  >;
  const nodes: SnapshotNode[] = [
    {
      key: "course",
      label: text(course.title, "Course"),
      detail: [
        text(course.description, "No description"),
        `Grade: ${text(course.grade_level, "Not set")}`,
      ].join(" · "),
      kind: "course",
    },
  ];
  arr(data.units).forEach((unit, ui) => {
    const unitId = stableId(unit, `unit-${ui}`);
    const unitTitle = text(unit.title, `Unit ${ui + 1}`);
    nodes.push({
      key: `unit:${unitId}`,
      label: unitTitle,
      detail: text(unit.description, "Unit description not provided"),
      kind: "unit",
    });
    arr(unit.lessons).forEach((lesson, li) => {
      const lessonId = stableId(lesson, `${unitId}-lesson-${li}`);
      const lessonTitle = text(lesson.title, `Lesson ${li + 1}`);
      const lessonKey = `lesson:${lessonId}`;
      nodes.push({
        key: lessonKey,
        label: `${unitTitle} / ${lessonTitle}`,
        detail: text(lesson.description, "Lesson description not provided"),
        kind: "lesson",
      });
      arr(lesson.blocks).forEach((block, bi) => {
        const blockId = stableId(block, `${lessonId}-block-${bi}`);
        const content =
          block.content && typeof block.content === "object"
            ? JSON.stringify(block.content)
            : String(block.content ?? "");
        nodes.push({
          key: `block:${blockId}`,
          label: `${unitTitle} / ${lessonTitle} / Block ${bi + 1}`,
          detail: `${text(block.block_type, "Content block")} · ${content}`,
          kind: "block",
        });
      });
    });
  });
  return nodes;
}
function compareSnapshots(before: SnapshotRow, after: SnapshotRow): DiffItem[] {
  const oldNodes = new Map(flattenSnapshot(before).map((node) => [node.key, node]));
  const newNodes = new Map(flattenSnapshot(after).map((node) => [node.key, node]));
  const result: DiffItem[] = [];
  for (const [key, node] of newNodes) {
    const previous = oldNodes.get(key);
    if (!previous)
      result.push({
        key,
        label: node.label,
        detail: node.detail,
        kind: "added",
        nodeKind: node.kind,
      });
    else if (previous.label !== node.label || previous.detail !== node.detail)
      result.push({
        key,
        label: node.label,
        detail: `${previous.detail} → ${node.detail}`,
        kind: "modified",
        nodeKind: node.kind,
      });
  }
  for (const [key, node] of oldNodes) {
    if (!newNodes.has(key))
      result.push({
        key,
        label: node.label,
        detail: node.detail,
        kind: "deleted",
        nodeKind: node.kind,
      });
  }
  const order: Record<ChangeKind, number> = { added: 0, modified: 1, deleted: 2 };
  return result.sort((a, b) => order[a.kind] - order[b.kind] || a.label.localeCompare(b.label));
}
function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export default function VersionHistoryModal({ courseId, open, onClose, onRestored }: Props) {
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [beforeId, setBeforeId] = useState("");
  const [afterId, setAfterId] = useState("");
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadSnapshots = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    setError("");
    setNotice("");
    const query = supabase.from("content_snapshots" as never) as unknown as {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string,
        ) => {
          order: (
            column: string,
            options: { ascending: boolean },
          ) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
        };
      };
    };
    try {
      const { data, error: queryError } = await query
        .select("id,course_id,version_number,snapshot_data,published_at,published_by")
        .eq("course_id", courseId)
        .order("version_number", { ascending: false });
      if (queryError) throw new Error(queryError.message);
      const rows = (data ?? []) as SnapshotRow[];
      setSnapshots(rows);
      setBeforeId(rows[1]?.id ?? rows[0]?.id ?? "");
      setAfterId(rows[0]?.id ?? "");
    } catch (loadError) {
      setError(errorText(loadError));
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (open) void loadSnapshots();
  }, [open, loadSnapshots]);
  const before = snapshots.find((snapshot) => snapshot.id === beforeId);
  const after = snapshots.find((snapshot) => snapshot.id === afterId);
  const diff = useMemo(
    () => (before && after && before.id !== after.id ? compareSnapshots(before, after) : []),
    [before, after],
  );
  const counts = useMemo(
    () => ({
      added: diff.filter((item) => item.kind === "added").length,
      modified: diff.filter((item) => item.kind === "modified").length,
      deleted: diff.filter((item) => item.kind === "deleted").length,
    }),
    [diff],
  );

  async function restoreSnapshot() {
    if (!after) return;
    const version = after.version_number;
    if (
      !window.confirm(
        `Restore version ${version} into the current course draft? The published snapshot will remain unchanged.`,
      )
    )
      return;
    setRestoring(true);
    setError("");
    setNotice("");
    try {
      const { error: restoreError } = await supabase.rpc(
        "restore_course_snapshot" as never,
        { p_course_id: courseId, p_snapshot_id: after.id } as never,
      );
      if (restoreError) throw new Error(restoreError.message);
      setNotice(
        `Version ${version} has been restored as the current draft. Published history was not changed.`,
      );
      onRestored?.();
    } catch (restoreError) {
      setError(errorText(restoreError));
    } finally {
      setRestoring(false);
    }
  }

  if (!open) return null;
  const colors: Record<ChangeKind, { background: string; border: string; label: string }> = {
    added: { background: "#e8f7ed", border: "#39a765", label: "Added" },
    modified: { background: "#fff4d6", border: "#d89b19", label: "Modified" },
    deleted: { background: "#fde8e8", border: "#d94b4b", label: "Deleted" },
  };
  const versionOptions = snapshots.map((snapshot) => ({
    value: snapshot.id,
    label: `Version ${snapshot.version_number} · ${new Date(snapshot.published_at).toLocaleString()}`,
  }));

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !restoring) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(15,23,42,.58)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="version-history-title"
        style={{
          width: "min(100%, 1000px)",
          maxHeight: "min(92vh, 900px)",
          overflow: "auto",
          background: "var(--color-background, #fff)",
          color: "inherit",
          borderRadius: 18,
          boxShadow: "0 24px 70px rgba(0,0,0,.25)",
          padding: 24,
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "flex-start",
          }}
        >
          <div>
            <p
              style={{ margin: 0, color: "#64748b", display: "flex", alignItems: "center", gap: 7 }}
            >
              <History size={16} /> CURRICULUM HISTORY
            </p>
            <h2 id="version-history-title" style={{ margin: "8px 0" }}>
              Version history & snapshot diff
            </h2>
            <p style={{ margin: 0, color: "#64748b" }}>
              Compare published snapshots before updating your course. Restoring creates a draft; it
              never edits an immutable snapshot.
            </p>
          </div>
          <button
            aria-label="Close version history"
            onClick={onClose}
            style={{ ...buttonStyle, padding: 8 }}
          >
            <X size={18} />
          </button>
        </header>
        {error && (
          <p
            role="alert"
            style={{
              ...panelStyle,
              color: "#b91c1c",
              borderColor: "#fca5a5",
              background: "#fef2f2",
            }}
          >
            <AlertTriangle size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            style={{
              ...panelStyle,
              color: "#166534",
              borderColor: "#86efac",
              background: "#f0fdf4",
            }}
          >
            <CheckCircle2 size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />
            {notice}
          </p>
        )}
        {loading ? (
          <div style={{ padding: 36, textAlign: "center" }}>
            <LoaderCircle size={22} /> Loading snapshots…
          </div>
        ) : snapshots.length === 0 ? (
          <div style={{ ...panelStyle, marginTop: 20 }}>
            <Clock3 size={20} />
            <h3>No published snapshots yet</h3>
            <p>
              Publish the course once to create the first version, then later versions can be
              compared here.
            </p>
          </div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
                gap: 12,
                marginTop: 22,
              }}
            >
              <label style={panelStyle}>
                Compare from{" "}
                <select
                  aria-label="Older version"
                  value={beforeId}
                  onChange={(event) => setBeforeId(event.target.value)}
                  style={{ ...selectStyle, marginTop: 8 }}
                >
                  {versionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={panelStyle}>
                Compare with{" "}
                <select
                  aria-label="Newer version"
                  value={afterId}
                  onChange={(event) => setAfterId(event.target.value)}
                  style={{ ...selectStyle, marginTop: 8 }}
                >
                  {versionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {beforeId === afterId ? (
              <p style={{ color: "#64748b" }}>Choose two different versions to inspect changes.</p>
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 8,
                    margin: "16px 0",
                  }}
                >
                  <GitCompareArrows size={19} />
                  <strong>
                    Version {before?.version_number} → Version {after?.version_number}
                  </strong>
                  <span style={{ flex: 1 }} />
                  {(["added", "modified", "deleted"] as ChangeKind[]).map((kind) => (
                    <span
                      key={kind}
                      style={{
                        border: `1px solid ${colors[kind].border}`,
                        background: colors[kind].background,
                        padding: "4px 8px",
                        borderRadius: 99,
                        fontSize: 13,
                      }}
                    >
                      {counts[kind]} {colors[kind].label.toLowerCase()}
                    </span>
                  ))}
                </div>
                {diff.length === 0 ? (
                  <div style={panelStyle}>No content changes detected between these snapshots.</div>
                ) : (
                  <div style={{ display: "grid", gap: 9 }}>
                    {diff.map((item) => (
                      <article
                        key={`${item.kind}:${item.key}`}
                        style={{
                          border: `1px solid ${colors[item.kind].border}`,
                          background: colors[item.kind].background,
                          borderRadius: 10,
                          padding: 12,
                          overflowWrap: "anywhere",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <strong>{item.label}</strong>
                          <span
                            style={{
                              marginLeft: "auto",
                              border: `1px solid ${colors[item.kind].border}`,
                              borderRadius: 99,
                              padding: "2px 7px",
                              fontSize: 12,
                            }}
                          >
                            {colors[item.kind].label}
                          </span>
                          <small style={{ opacity: 0.75 }}>{item.nodeKind}</small>
                        </div>
                        <p style={{ margin: "8px 0 0", fontSize: 13, whiteSpace: "pre-wrap" }}>
                          {item.detail}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
            <footer
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                borderTop: "1px solid #e2e8f0",
                paddingTop: 18,
                marginTop: 22,
              }}
            >
              <p style={{ margin: 0, maxWidth: 560, color: "#64748b", fontSize: 13 }}>
                Restoring a version replaces the current draft course content. The published course
                and its historical snapshots remain untouched until you publish again.
              </p>
              <button
                disabled={!after || restoring}
                onClick={() => void restoreSnapshot()}
                style={{
                  ...buttonStyle,
                  background: "#1d4ed8",
                  color: "white",
                  borderColor: "#1d4ed8",
                  opacity: !after || restoring ? 0.6 : 1,
                }}
              >
                <RotateCcw size={16} />
                {restoring ? "Restoring…" : `Rollback to Version ${after?.version_number ?? "—"}`}
                <ArrowDownUp size={15} />
              </button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
