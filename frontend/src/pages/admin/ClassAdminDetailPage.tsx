import { useState } from "react";

export interface RosterStudent {
  id: string;
  name: string;
  average: number | null;
}

interface Props {
  classId: string;
  className: string;
  teacher: string;
  coTeachers: string[];
  roster: RosterStudent[];
  onSave: (value: { teacher: string; coTeachers: string[] }) => Promise<void>;
  onArchive: () => Promise<void>;
  onResetCode: () => Promise<void>;
}

export default function ClassAdminDetailPage(props: Props) {
  const [teacher, setTeacher] = useState(props.teacher);
  const [coTeachers, setCoTeachers] = useState(props.coTeachers.join(", "));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function runAction(action: () => Promise<void>, successMessage: string) {
    setBusy(true);
    try {
      await action();
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: "2rem auto", fontFamily: "system-ui" }}>
      <h1>{props.className}</h1>
      <p>
        Class ID: {props.classId} · Enrollment: {props.roster.length}
      </p>

      <section>
        <h2>Class administration</h2>
        <label>
          Primary teacher{" "}
          <input value={teacher} onChange={(event) => setTeacher(event.target.value)} />
        </label>
        <p>
          <label>
            Co-teachers (comma separated){" "}
            <input value={coTeachers} onChange={(event) => setCoTeachers(event.target.value)} />
          </label>
        </p>
        <button
          disabled={busy}
          onClick={() =>
            runAction(
              () =>
                props.onSave({
                  teacher,
                  coTeachers: coTeachers
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
                }),
              "Teacher assignments saved.",
            )
          }
        >
          Save assignments
        </button>{" "}
        <button disabled={busy} onClick={() => runAction(props.onResetCode, "Join code reset.")}>
          Force reset join code
        </button>{" "}
        <button
          disabled={busy}
          onClick={() => {
            if (window.confirm("Archive this class? Historical records will be retained.")) {
              void runAction(props.onArchive, "Class archived.");
            }
          }}
        >
          Archive class
        </button>
      </section>

      <h2>Roster &amp; grade averages</h2>
      <table style={{ width: "100%" }}>
        <thead>
          <tr>
            <th align="left">Student</th>
            <th>Average</th>
          </tr>
        </thead>
        <tbody>
          {props.roster.map((student) => (
            <tr key={student.id}>
              <td>{student.name}</td>
              <td align="center">
                {student.average == null ? "—" : `${student.average.toFixed(1)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p role="status">{message}</p>
    </main>
  );
}
