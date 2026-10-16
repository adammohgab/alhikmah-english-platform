import { useState } from "react";

export interface ModerationItem {
  id: string;
  entityType: string;
  triggerReason: string;
  createdAt: string;
  urgency: "low" | "medium" | "high";
  excerpt?: string;
  status: "open" | "resolved";
}

type Action = "approve" | "redact" | "warn" | "notify";

interface Props {
  items: ModerationItem[];
  resolve: (id: string, action: Action, note: string) => Promise<void>;
}

const actions: { id: Action; label: string }[] = [
  { id: "approve", label: "Approve Content (False Positive)" },
  { id: "redact", label: "Redact Content" },
  { id: "warn", label: "Warn Student" },
  { id: "notify", label: "Notify Parents / Teacher" },
];

export default function ModerationQueuePage({ items, resolve }: Props) {
  const [selected, setSelected] = useState<ModerationItem | null>(null);
  const [action, setAction] = useState<Action>("approve");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!selected) return;

    setBusy(true);
    setError("");

    try {
      await resolve(selected.id, action, note);
      setSelected(null);
      setNote("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not resolve item.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 980, margin: "2rem auto", fontFamily: "system-ui" }}>
      <h1>Moderation Queue</h1>
      <p>Open items, oldest first. Resolution and notes are persisted to the moderation queue.</p>

      {items
        .filter((item) => item.status === "open")
        .slice()
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
        .map((item) => (
          <article
            key={item.id}
            style={{
              border: "1px solid #ddd",
              borderLeft: `5px solid ${
                item.urgency === "high" ? "#c22" : item.urgency === "medium" ? "#d90" : "#498"
              }`,
              padding: 16,
              margin: "12px 0",
              borderRadius: 8,
            }}
          >
            <strong>{item.entityType}</strong> · {item.triggerReason}
            <p>{item.excerpt !== undefined && item.excerpt !== ""
              ? item.excerpt
              : "Content details are available to authorized moderators."}</p>
            <small>
              {new Date(item.createdAt).toLocaleString()} · {item.urgency.toUpperCase()} urgency
            </small>
            <p>
              <button
                onClick={() => {
                  setSelected(item);
                  setError("");
                }}
              >
                Review and resolve
              </button>
            </p>
          </article>
        ))}

      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "#0008",
            display: "grid",
            placeItems: "center",
          }}
        >
          <section
            style={{
              background: "white",
              padding: 24,
              borderRadius: 12,
              width: "min(500px, 90vw)",
            }}
          >
            <h2>Resolve {selected.entityType}</h2>
            <label>
              Action{" "}
              <select value={action} onChange={(event) => setAction(event.target.value as Action)}>
                {actions.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <p>
              <label>
                Decision notes
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={4}
                  style={{ display: "block", width: "100%" }}
                  required
                />
              </label>
            </p>
            {error && <p role="alert">{error}</p>}
            <button disabled={busy || !note.trim()} onClick={() => {
              void submit();
            }}>
              {busy ? "Saving…" : "Save resolution"}
            </button>{" "}
            <button onClick={() => setSelected(null)}>Cancel</button>
          </section>
        </div>
      )}
    </main>
  );
}
