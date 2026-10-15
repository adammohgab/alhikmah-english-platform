import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronDown,
  FileSearch,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { env } from "@/shared/config/env";
import { supabase } from "@/shared/api/supabase";

interface AuditRow {
  id: string;
  user_id: string | null;
  actor_id: string | null;
  action: string;
  action_type: string | null;
  target_table: string | null;
  target_type: string | null;
  target_id: string | null;
  ip_address: string | null;
  old_values: unknown;
  new_values: unknown;
  created_at: string;
  actor?: { display_name: string | null; username: string | null } | null;
}

const restUrl = `${env.VITE_SUPABASE_URL.replace(/\/$/, "")}/rest/v1`;

async function loadAuditRows(): Promise<AuditRow[]> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(`Could not read the current session: ${sessionError.message}`);

  const response = await fetch(
    `${restUrl}/audit_log?select=id,user_id,actor_id,action,action_type,target_table,target_type,target_id,ip_address,old_values,new_values,created_at&order=created_at.desc&limit=500`,
    {
      headers: {
        apikey: env.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${sessionData.session?.access_token ?? env.VITE_SUPABASE_ANON_KEY}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Audit log request failed (${response.status}): ${await response.text()}`);
  }

  return (await response.json()) as AuditRow[];
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function JsonValue({ value }: { value: unknown }) {
  return (
    <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl border-2 border-stroke bg-surface-0 p-4 text-xs leading-5">
      {JSON.stringify(value ?? {}, null, 2)}
    </pre>
  );
}

export default function AuditLogPage() {
  const auditQuery = useQuery({
    queryKey: ["admin-audit-log"],
    queryFn: loadAuditRows,
  });
  const [search, setSearch] = useState("");
  const [actionType, setActionType] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selected, setSelected] = useState<AuditRow | null>(null);

  const rows = useMemo(() => auditQuery.data ?? [], [auditQuery.data]);
  const actionTypes = useMemo(
    () =>
      [
        ...new Set(
          rows.map((row) => row.action_type).filter((type): type is string => Boolean(type)),
        ),
      ].sort(),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const to = toDate ? new Date(`${toDate}T23:59:59.999`) : null;

    return rows.filter((row) => {
      const createdAt = new Date(row.created_at);
      const matchesType = actionType === "all" || row.action_type === actionType;
      const matchesFrom = !from || createdAt >= from;
      const matchesTo = !to || createdAt <= to;
      const searchable = [
        row.action,
        row.action_type,
        row.target_table,
        row.target_type,
        row.target_id,
        row.actor?.display_name,
        row.actor?.username,
        row.actor_id,
        row.user_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesType && matchesFrom && matchesTo && (!query || searchable.includes(query));
    });
  }, [actionType, fromDate, rows, search, toDate]);

  return (
    <main
      data-world="coral"
      className="min-h-screen bg-world-coral-50 px-4 py-8 text-stroke sm:px-6 lg:px-10"
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[26px] border-2 border-stroke bg-world-coral-200 p-6 shadow-retro-md sm:p-8">
          <Link to="/admin" className="text-sm font-bold underline underline-offset-4">
            Admin dashboard
          </Link>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border-2 border-stroke bg-surface-0 px-3 py-1 text-xs font-extrabold uppercase tracking-wider">
                <ShieldCheck size={15} aria-hidden="true" /> Immutable records
              </p>
              <h1 className="mt-3 font-heading text-4xl font-bold">Audit Log</h1>
              <p className="mt-2 text-muted">
                Review administrative changes and compare before-and-after values.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void auditQuery.refetch()}
              disabled={auditQuery.isFetching}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-stroke bg-surface-0 px-4 font-bold shadow-retro-sm disabled:opacity-60"
            >
              <RefreshCw
                size={17}
                className={auditQuery.isFetching ? "animate-spin" : ""}
                aria-hidden="true"
              />
              Refresh
            </button>
          </div>
        </header>

        <section className="rounded-[24px] border-2 border-stroke bg-surface-0 p-5 shadow-retro-sm sm:p-6">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="relative md:col-span-2">
              <span className="sr-only">Search audit events</span>
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search actor, action, target…"
                className="min-h-11 w-full rounded-xl border-2 border-stroke bg-surface-0 pl-10 pr-3 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              />
            </label>

            <label className="relative">
              <span className="sr-only">Filter by action type</span>
              <select
                value={actionType}
                onChange={(event) => setActionType(event.target.value)}
                className="min-h-11 w-full appearance-none rounded-xl border-2 border-stroke bg-surface-0 px-3 pr-9 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <option value="all">All action types</option>
                {actionTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
            </label>

            <div className="flex items-center gap-2 text-sm font-bold text-muted">
              <CalendarDays size={17} aria-hidden="true" />
              {filteredRows.length} records
            </div>

            <label>
              <span className="mb-1 block text-xs font-bold text-muted">From date</span>
              <input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className="min-h-11 w-full rounded-xl border-2 border-stroke bg-surface-0 px-3 font-medium"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold text-muted">To date</span>
              <input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className="min-h-11 w-full rounded-xl border-2 border-stroke bg-surface-0 px-3 font-medium"
              />
            </label>
          </div>
        </section>

        {auditQuery.isError && (
          <div
            role="alert"
            className="rounded-2xl border-2 border-stroke bg-world-rose-100 p-4 shadow-retro-sm"
          >
            <p className="font-bold">Audit entries could not be loaded.</p>
            <p className="mt-1 text-sm">{auditQuery.error.message}</p>
          </div>
        )}

        <section className="overflow-hidden rounded-[24px] border-2 border-stroke bg-surface-0 shadow-retro-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead className="bg-world-sky-100">
                <tr className="border-b-2 border-stroke text-xs uppercase tracking-wider">
                  <th scope="col" className="px-4 py-3">
                    Timestamp
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Admin
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Action
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Target
                  </th>
                  <th scope="col" className="px-4 py-3">
                    IP address
                  </th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {auditQuery.isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center font-semibold">
                      Loading audit records…
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <FileSearch className="mx-auto mb-2" size={25} aria-hidden="true" />
                      <p className="font-bold">No matching audit records</p>
                      <p className="mt-1 text-sm text-muted">
                        Try changing the search or date filters.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-stroke/10 last:border-0 hover:bg-world-coral-50"
                    >
                      <td className="whitespace-nowrap px-4 py-4 text-sm">
                        {formatDate(row.created_at)}
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-bold">
                          {row.actor?.display_name ?? row.actor?.username ?? "Admin account"}
                        </p>
                        <p className="text-xs text-muted">
                          {row.actor_id ?? row.user_id ?? "System"}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-bold">{row.action.replace(/_/g, " ")}</p>
                        {row.action_type && (
                          <p className="mt-1 text-xs text-muted">{row.action_type}</p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <span className="font-semibold">
                          {row.target_table ?? row.target_type ?? "—"}
                        </span>
                        {row.target_id && (
                          <span className="ml-2 text-xs text-muted">{row.target_id}</span>
                        )}
                      </td>
                      <td className="px-4 py-4 font-mono text-xs">{row.ip_address ?? "—"}</td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelected(row)}
                          className="min-h-9 rounded-lg border-2 border-stroke bg-surface-0 px-3 text-sm font-bold shadow-retro-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                          View diff
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-stroke/60 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-diff-title"
            className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[24px] border-2 border-stroke bg-world-coral-50 p-5 shadow-retro-md sm:p-7"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-muted">
                  {formatDate(selected.created_at)}
                </p>
                <h2 id="audit-diff-title" className="mt-1 font-heading text-2xl font-bold">
                  {selected.action.replace(/_/g, " ")}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {selected.target_table ?? selected.target_type ?? "Target"} ·{" "}
                  {selected.target_id ?? "No target ID"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="min-h-10 rounded-xl border-2 border-stroke bg-surface-0 px-4 font-bold shadow-retro-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 font-bold text-world-rose-700">Before</h3>
                <JsonValue value={selected.old_values} />
              </div>
              <div>
                <h3 className="mb-2 font-bold text-world-mint-700">After</h3>
                <JsonValue value={selected.new_values} />
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
