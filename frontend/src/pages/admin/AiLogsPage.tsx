import { useMemo, useState } from "react";

export type AiLog = {
  id: string;
  createdAt: string;
  model: string;
  feature: string;
  className: string;
  promptPreview: string;
  tokens: number;
  latencyMs: number;
  safetyStatus: "passed" | "flagged" | "blocked";
};

type Props = { logs: AiLog[] };

export default function AiLogsPage({ logs }: Props) {
  const [search, setSearch] = useState("");
  const [safety, setSafety] = useState("");
  const [model, setModel] = useState("");
  const [minTokens, setMinTokens] = useState("");

  const models = [...new Set(logs.map((row) => row.model))];

  const rows = useMemo(
    () =>
      logs
        .filter(
          (row) =>
            (!search ||
              `${row.className} ${row.feature} ${row.promptPreview}`
                .toLowerCase()
                .includes(search.toLowerCase())) &&
            (!safety || row.safetyStatus === safety) &&
            (!model || row.model === model) &&
            (!minTokens || row.tokens >= Number(minTokens)),
        )
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [logs, search, safety, model, minTokens],
  );

  return (
    <main style={{ maxWidth: 1150, margin: "2rem auto", fontFamily: "system-ui" }}>
      <h1>AI Activity Logs</h1>
      <p>Filter interactions to investigate high token usage, slow responses, and safety events.</p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <label>
          Search class, feature, prompt{" "}
          <input value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label>
          Model{" "}
          <select value={model} onChange={(event) => setModel(event.target.value)}>
            <option value="">All models</option>
            {models.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Safety{" "}
          <select value={safety} onChange={(event) => setSafety(event.target.value)}>
            <option value="">All statuses</option>
            <option value="passed">Passed</option>
            <option value="flagged">Flagged</option>
            <option value="blocked">Blocked</option>
          </select>
        </label>
        <label>
          Minimum tokens{" "}
          <input
            type="number"
            min="0"
            value={minTokens}
            onChange={(event) => setMinTokens(event.target.value)}
          />
        </label>
      </div>

      <table style={{ width: "100%", marginTop: 20, borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>Time</th>
            <th>Model / Feature</th>
            <th>Class</th>
            <th>Prompt preview</th>
            <th>Tokens</th>
            <th>Latency</th>
            <th>Safety</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{new Date(row.createdAt).toLocaleString()}</td>
              <td>
                {row.model}
                <br />
                <small>{row.feature}</small>
              </td>
              <td>{row.className}</td>
              <td>{row.promptPreview}</td>
              <td align="right">{row.tokens.toLocaleString()}</td>
              <td align="right">{row.latencyMs.toLocaleString()} ms</td>
              <td>
                <span style={{ color: row.safetyStatus === "passed" ? "#287a42" : "#b22" }}>
                  {row.safetyStatus}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {rows.length === 0 && <p>No matching activity.</p>}
    </main>
  );
}
