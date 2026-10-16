import React, { useState } from "react";

export type GradeBand = "1-3" | "4-6" | "7-9" | "10-12";

export type AiConfig = {
  features: Record<GradeBand, { tutor: boolean; writing: boolean; translation: boolean }>;
  dailyMessages: number;
  tokensPerClass: number;
  monthlyAlert: number;
};

type Props = {
  initial: AiConfig;
  save: (config: AiConfig) => Promise<void>;
};

const bands: GradeBand[] = ["1-3", "4-6", "7-9", "10-12"];

export default function AiGovernancePage({ initial, save }: Props) {
  const [config, setConfig] = useState(initial);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);

    try {
      await save(config);
      setMessage("Configuration saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  function setFeature(
    band: GradeBand,
    feature: "tutor" | "writing" | "translation",
    enabled: boolean,
  ) {
    setConfig((current) => ({
      ...current,
      features: {
        ...current.features,
        [band]: { ...current.features[band], [feature]: enabled },
      },
    }));
  }

  return (
    <main style={{ maxWidth: 900, margin: "2rem auto", fontFamily: "system-ui" }}>
      <h1>AI Features &amp; Limits</h1>

      <form onSubmit={submit}>
        <table style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Grade level</th>
              <th>AI Tutor chat</th>
              <th>AI Writing Feedback</th>
              <th>AI Translation</th>
            </tr>
          </thead>
          <tbody>
            {bands.map((band) => (
              <tr key={band}>
                <th>Grades {band}</th>
                {(["tutor", "writing", "translation"] as const).map((feature) => (
                  <td key={feature}>
                    <input
                      aria-label={`${feature} for grades ${band}`}
                      type="checkbox"
                      checked={config.features[band][feature]}
                      onChange={(event) => setFeature(band, feature, event.target.checked)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          <label>
            Daily student messages{" "}
            <input
              type="number"
              min="0"
              max="500"
              value={config.dailyMessages}
              onChange={(event) =>
                setConfig({ ...config, dailyMessages: Number(event.target.value) })
              }
            />
          </label>
        </p>
        <p>
          <label>
            Token budget per class{" "}
            <input
              type="number"
              min="0"
              value={config.tokensPerClass}
              onChange={(event) =>
                setConfig({ ...config, tokensPerClass: Number(event.target.value) })
              }
            />
          </label>
        </p>
        <p>
          <label>
            Monthly cost alert ($){" "}
            <input
              type="number"
              min="0"
              step="1"
              value={config.monthlyAlert}
              onChange={(event) =>
                setConfig({ ...config, monthlyAlert: Number(event.target.value) })
              }
            />
          </label>
        </p>
        <button disabled={busy}>{busy ? "Saving…" : "Save governance settings"}</button> {message}
      </form>
    </main>
  );
}
