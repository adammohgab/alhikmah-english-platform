import React, { useState } from "react";

export interface Announcement {
  title: string;
  body: string;
  audience: "all" | "students" | "teachers";
  priority: "normal" | "urgent";
  releaseAt: string;
  expiresAt: string;
}

interface Props {
  publish: (announcement: Announcement) => Promise<void>;
}

export default function SchoolAnnouncementsPage({ publish }: Props) {
  const [announcement, setAnnouncement] = useState<Announcement>({
    title: "",
    body: "",
    audience: "all",
    priority: "normal",
    releaseAt: "",
    expiresAt: "",
  });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);

    try {
      await publish(announcement);
      setMessage(
        "Announcement published. Urgent announcements should be fanned out through the realtime service.",
      );
      setAnnouncement((current) => ({ ...current, title: "", body: "" }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Publish failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: "2rem auto", fontFamily: "system-ui" }}>
      <h1>School Announcements</h1>

      <form onSubmit={(event) => {
          void submit(event);
        }}>
        <p>
          <label>
            Title{" "}
            <input
              required
              maxLength={160}
              value={announcement.title}
              onChange={(event) => setAnnouncement({ ...announcement, title: event.target.value })}
            />
          </label>
        </p>
        <p>
          <label>
            Message{" "}
            <textarea
              required
              rows={6}
              value={announcement.body}
              onChange={(event) => setAnnouncement({ ...announcement, body: event.target.value })}
            />
          </label>
        </p>
        <p>
          <label>
            Target audience{" "}
            <select
              value={announcement.audience}
              onChange={(event) =>
                setAnnouncement({
                  ...announcement,
                  audience: event.target.value as Announcement["audience"],
                })
              }
            >
              <option value="all">All School</option>
              <option value="students">All Students</option>
              <option value="teachers">All Teachers</option>
            </select>
          </label>
        </p>
        <p>
          <label>
            Priority{" "}
            <select
              value={announcement.priority}
              onChange={(event) =>
                setAnnouncement({
                  ...announcement,
                  priority: event.target.value as Announcement["priority"],
                })
              }
            >
              <option value="normal">Normal</option>
              <option value="urgent">Urgent Broadcast</option>
            </select>
          </label>
        </p>
        <p>
          <label>
            Scheduled release{" "}
            <input
              type="datetime-local"
              value={announcement.releaseAt}
              onChange={(event) =>
                setAnnouncement({ ...announcement, releaseAt: event.target.value })
              }
            />
          </label>{" "}
          <label>
            Expiration{" "}
            <input
              type="datetime-local"
              value={announcement.expiresAt}
              onChange={(event) =>
                setAnnouncement({ ...announcement, expiresAt: event.target.value })
              }
            />
          </label>
        </p>
        <button disabled={busy}>{busy ? "Publishing…" : "Publish announcement"}</button> {message}
      </form>
    </main>
  );
}
