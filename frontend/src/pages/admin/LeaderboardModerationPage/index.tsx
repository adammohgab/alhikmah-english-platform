import React, { useMemo, useState } from "react";

export type LeaderboardStudent = {
  id: string;
  name: string;
  className: string;
  xpLast10Minutes: number;
  consecutivePerfect: number;
  hidden: boolean;
};

type Props = {
  students: LeaderboardStudent[];
  schoolVisible: boolean;
  classVisible: (className: string) => boolean;
  investigate: (studentId: string) => void;
  adjustXp: (studentId: string, amount: number, justification: string) => Promise<void>;
  setHidden: (studentId: string, hidden: boolean) => Promise<void>;
  setVisibility: (scope: "school" | "class", visible: boolean, className?: string) => Promise<void>;
};

export default function LeaderboardModerationPage({
  students,
  schoolVisible,
  classVisible,
  investigate,
  adjustXp,
  setHidden,
  setVisibility,
}: Props) {
  const [student, setStudent] = useState<LeaderboardStudent | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedClass, setSelectedClass] = useState("");

  const classes = [...new Set(students.map((item) => item.className))];
  const flagged = useMemo(
    () => students.filter((item) => item.xpLast10Minutes > 500 || item.consecutivePerfect >= 10),
    [students],
  );

  async function update(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
      setMessage("Change saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function submitAdjustment(event: React.FormEvent) {
    event.preventDefault();
    if (!student || !note.trim() || !amount) return;

    await update(async () => {
      await adjustXp(student.id, Number(amount), note);
      setStudent(null);
      setAmount("");
      setNote("");
    });
  }

  return (
    <main style={{ maxWidth: 1050, margin: "2rem auto", fontFamily: "system-ui" }}>
      <h1>Leaderboard Moderation</h1>

      <section>
        <h2>Visibility</h2>
        <label>
          <input
            type="checkbox"
            checked={schoolVisible}
            onChange={(event) => void update(() => setVisibility("school", event.target.checked))}
          />{" "}
          School leaderboard visible
        </label>

        <p>
          <label>
            Class{" "}
            <select
              value={selectedClass}
              onChange={(event) => setSelectedClass(event.target.value)}
            >
              <option value="">Select class</option>
              {classes.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          {selectedClass && (
            <>
              {" "}
              <label>
                <input
                  type="checkbox"
                  checked={classVisible(selectedClass)}
                  onChange={(event) =>
                    void update(() => setVisibility("class", event.target.checked, selectedClass))
                  }
                />{" "}
                Visible
              </label>
            </>
          )}
        </p>
      </section>

      <h2>Suspicious activity flags ({flagged.length})</h2>
      {flagged.map((item) => (
        <article
          key={item.id}
          style={{
            border: "1px solid #ddd",
            borderLeft: "5px solid #bd3434",
            padding: 16,
            margin: "12px 0",
          }}
        >
          <strong>{item.name}</strong> · {item.className}
          <ul>
            {item.xpLast10Minutes > 500 && (
              <li>{item.xpLast10Minutes} XP earned in the last 10 minutes (threshold: 500)</li>
            )}
            {item.consecutivePerfect >= 10 && (
              <li>{item.consecutivePerfect} consecutive perfect exercise scores (threshold: 10)</li>
            )}
          </ul>
          <button onClick={() => investigate(item.id)}>Investigate Activity Log</button>{" "}
          <button onClick={() => setStudent(item)}>Adjust Student XP</button>{" "}
          <button
            disabled={busy}
            onClick={() => void update(() => setHidden(item.id, !item.hidden))}
          >
            {item.hidden ? "Restore to leaderboard" : "Temporarily Hide from Leaderboard"}
          </button>
        </article>
      ))}

      {flagged.length === 0 && <p>No anomalies detected.</p>}

      {student && (
        <div role="dialog" aria-modal="true" style={dialogStyle}>
          <form onSubmit={submitAdjustment} style={formStyle}>
            <h2>Adjust XP for {student.name}</h2>
            <p>
              <label>
                XP change (+ or -){" "}
                <input
                  type="number"
                  required
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </label>
            </p>
            <p>
              <label>
                Justification note{" "}
                <textarea
                  required
                  rows={4}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
            </p>
            <button disabled={busy || !note.trim()}>{busy ? "Saving…" : "Save adjustment"}</button>{" "}
            <button type="button" onClick={() => setStudent(null)}>
              Cancel
            </button>
          </form>
        </div>
      )}

      <p role="status">{message}</p>
    </main>
  );
}

const dialogStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "#0008",
  display: "grid",
  placeItems: "center",
};

const formStyle: React.CSSProperties = {
  background: "white",
  padding: 24,
  borderRadius: 12,
};
