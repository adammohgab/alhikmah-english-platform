import React, { useMemo, useState } from "react";

interface Config {
  dailyCap: number;
  lessonXp: number;
  activityXp: number;
  perfectBonus: number;
}

interface Props {
  initial: Config;
  save: (config: Config) => Promise<void>;
  averageLessonsPerWeek?: number;
}

export default function EconomyStudioPage({ initial, save, averageLessonsPerWeek = 5 }: Props) {
  const [config, setConfig] = useState(initial);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const curve = useMemo(
    () => Array.from({ length: 50 }, (_, index) => Math.round(100 * Math.pow(index + 1, 1.65))),
    [],
  );
  const curvePeak = Math.max(...curve, 1);

  const weekly = Math.min(
    config.dailyCap * 5,
    config.lessonXp * averageLessonsPerWeek +
      config.activityXp * averageLessonsPerWeek +
      config.perfectBonus,
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);

    try {
      await save(config);
      setMessage("Economy settings saved atomically.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: "2rem auto", fontFamily: "system-ui" }}>
      <h1>Economy Studio</h1>

      <form
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        {(
          [
            ["dailyCap", "Daily XP Cap", 1000],
            ["lessonXp", "Base Lesson XP", 20],
            ["activityXp", "Base Activity XP", 10],
            ["perfectBonus", "Quiz Perfect Score Bonus", 50],
          ] as const
        ).map(([key, label, defaultValue]) => (
          <p key={key}>
            <label>
              {label}{" "}
              <input
                type="number"
                min="0"
                value={config[key]}
                placeholder={String(defaultValue)}
                onChange={(event) => setConfig({ ...config, [key]: Number(event.target.value) })}
              />
            </label>
          </p>
        ))}
        <button disabled={busy}>{busy ? "Saving…" : "Save economy configuration"}</button> {message}
      </form>

      <h2>Level progression (XP required)</h2>
      <div
        style={{
          display: "flex",
          alignItems: "end",
          gap: 3,
          height: 180,
          borderBottom: "1px solid",
        }}
      >
        {curve.map((value, index) => (
          <div
            key={index}
            title={`Level ${index + 1}: ${value} XP`}
            style={{
              height: `${Math.max(4, (value / curvePeak) * 100)}%`,
              background: "#5681d8",
              flex: 1,
            }}
          />
        ))}
      </div>

      <p>
        Level 1–50 · Estimated average earnings: <strong>{weekly} XP/week</strong>
      </p>
    </main>
  );
}
