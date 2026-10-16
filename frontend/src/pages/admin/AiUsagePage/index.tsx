import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface DailyUsage {
  date: string;
  tokens: number;
  cost: number;
}
export interface FeatureUsage {
  feature: "Tutor" | "Writing" | "Copilot";
  cost: number;
  tokens: number;
}
export interface ClassUsage {
  className: string;
  tokens: number;
  cost: number;
}
export interface AiUsageReport {
  daily: DailyUsage[];
  features: FeatureUsage[];
  classes: ClassUsage[];
}
interface Props {
  report: AiUsageReport;
  currency?: string;
}

export default function AiUsagePage({ report, currency = "USD" }: Props) {
  const [query, setQuery] = useState("");
  const filteredClasses = useMemo(
    () => report.classes.filter((row) => row.className.toLowerCase().includes(query.toLowerCase())),
    [report.classes, query],
  );

  const totalTokens = report.daily.reduce((sum, row) => sum + row.tokens, 0);
  const totalCost = report.daily.reduce((sum, row) => sum + row.cost, 0);

  function exportCsv() {
    const lines = [
      ["section", "date_or_name", "tokens", "cost", "feature"],
      ...report.daily.map((row) => [
        "daily",
        row.date,
        String(row.tokens),
        row.cost.toFixed(4),
        "",
      ]),
      ...report.features.map((row) => [
        "feature",
        row.feature,
        String(row.tokens),
        row.cost.toFixed(4),
        row.feature,
      ]),
      ...report.classes.map((row) => [
        "class",
        row.className,
        String(row.tokens),
        row.cost.toFixed(4),
        "",
      ]),
    ];

    const csv = lines
      .map((line) => line.map((value) => `"${value.replace(/"/g, '""')}"`).join(","))
      .join("\r\n");

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "ai-usage-report.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main style={{ maxWidth: 1100, margin: "2rem auto", fontFamily: "system-ui" }}>
      <h1>AI Usage &amp; Cost</h1>
      <p>
        Historical usage summary · {totalTokens.toLocaleString()} tokens ·{" "}
        {new Intl.NumberFormat(undefined, {
          style: "currency",
          currency,
        }).format(totalCost)}
      </p>
      <button onClick={exportCsv}>Export CSV report</button>

      <section>
        <h2>Daily token consumption and spend</h2>
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <LineChart data={report.daily}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="tokens" />
              <YAxis yAxisId="cost" orientation="right" />
              <Tooltip />
              <Legend />
              <Line
                yAxisId="tokens"
                type="monotone"
                dataKey="tokens"
                stroke="#3867d6"
                name="Tokens"
              />
              <Line
                yAxisId="cost"
                type="monotone"
                dataKey="cost"
                stroke="#20a070"
                name={`Cost (${currency})`}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section>
        <h2>Cost breakdown by feature</h2>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={report.features}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="feature" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="cost" fill="#7965d6" name={`Cost (${currency})`} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section>
        <h2>Token spend per class</h2>
        <label>
          Filter classes <input value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <BarChart data={filteredClasses}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="className" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="tokens" fill="#3c82c4" />
              <Bar dataKey="cost" fill="#e7a23b" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </main>
  );
}
