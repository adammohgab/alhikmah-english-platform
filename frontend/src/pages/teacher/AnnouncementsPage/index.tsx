import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useAuth } from "@/shared/hooks/useAuth";
import { Button } from "@/shared/components/ui/Button";
import { Chip } from "@/shared/components/ui/Chip";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { Input } from "@/shared/components/ui/Input";
import { ProgressBar } from "@/shared/components/ui/ProgressBar";
import { SegmentedControl } from "@/shared/components/ui/SegmentedControl";
import { Select } from "@/shared/components/ui/Select";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { ANNOUNCEMENTS_KEY, fetchMyAnnouncements, fetchMyClasses, fetchReceipts } from "./api";
import type { AnnouncementRow } from "./api";
import { AnnouncementComposer } from "./AnnouncementComposer";
import { AnnouncementDrawer } from "./AnnouncementDrawer";
import {
  PRIORITY_LABEL,
  PRIORITY_WORLD,
  isPriority,
  plainText,
  readRate,
  formatWhen,
} from "./rules";
import type { AnnouncementPriority } from "./rules";
import { useReceiptsRealtime } from "./useReceiptsRealtime";

/* ========================================
   Announcements hub (TEACHER-SPEC TC-26, task TCH-CORE-17)
   Every announcement the teacher has sent, newest first, with its class, priority, publish time
   and a live read rate ("18 of 24 read"). Filters cover class, priority and text. Selecting a
   title opens the drawer with the full message and the read / unread students. "New
   announcement" opens the composer. On phones the rows stack as cards.
   ======================================== */

const PANEL = "rounded-[20px] border-2 border-stroke bg-surface-0 p-4 shadow-retro-sm";
const ROW =
  "flex flex-col gap-3 rounded-[16px] border-2 border-stroke bg-surface-0 p-4 shadow-retro-sm";
const TITLE_BUTTON =
  "min-w-0 break-words rounded-[6px] text-left font-heading text-lg font-bold text-stroke underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

type PriorityFilter = "all" | AnnouncementPriority;

const PRIORITY_OPTIONS: { value: PriorityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "normal", label: "Normal" },
  { value: "important", label: "Important" },
  { value: "urgent", label: "Urgent" },
];

function isExpired(item: AnnouncementRow): boolean {
  return item.expires_at != null && Date.parse(item.expires_at) <= Date.now();
}

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [query, setQuery] = useState("");

  useReceiptsRealtime(userId);

  const classes = useQuery({
    queryKey: [ANNOUNCEMENTS_KEY, "classes"],
    queryFn: fetchMyClasses,
  });

  const feed = useQuery({
    queryKey: [ANNOUNCEMENTS_KEY, "feed", userId],
    queryFn: () => fetchMyAnnouncements(userId!),
    enabled: Boolean(userId),
  });

  const items = useMemo(() => feed.data ?? [], [feed.data]);
  const ids = useMemo(() => items.map((item) => item.id), [items]);

  const receipts = useQuery({
    queryKey: [ANNOUNCEMENTS_KEY, "receipts", ids],
    queryFn: () => fetchReceipts(ids),
    enabled: feed.isSuccess,
  });

  const totalsById = useMemo(() => {
    const totals = new Map<string, { read: number; total: number }>();
    for (const row of receipts.data ?? []) {
      const current = totals.get(row.announcement_id) ?? { read: 0, total: 0 };
      current.total += 1;
      if (row.read_at) current.read += 1;
      totals.set(row.announcement_id, current);
    }
    return totals;
  }, [receipts.data]);

  const classNames = useMemo(
    () => new Map((classes.data ?? []).map((item) => [item.id, item.name])),
    [classes.data],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (classFilter !== "all" && item.target_class_id !== classFilter) return false;
      if (priorityFilter !== "all" && item.priority !== priorityFilter) return false;
      if (!needle) return true;
      return (
        item.title.toLowerCase().includes(needle) ||
        plainText(item.body).toLowerCase().includes(needle)
      );
    });
  }, [items, classFilter, priorityFilter, query]);

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const selectedClassName = selected?.target_class_id
    ? (classNames.get(selected.target_class_id) ?? null)
    : null;

  const openComposer = () => setComposerOpen(true);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-heading text-3xl font-bold text-stroke">Announcements</h1>
          <p className="text-sm font-semibold text-muted">
            What you have sent to your classes, and how many students have read it.
          </p>
        </div>
        <Button onClick={openComposer}>
          <Plus size={18} aria-hidden="true" />
          New announcement
        </Button>
      </header>

      {classes.isError && (
        <ErrorState
          size="sm"
          title="Your classes could not be loaded"
          description="You need a class to send an announcement."
          onRetry={() => void classes.refetch()}
        />
      )}

      <section aria-labelledby="announcements-filters" className={PANEL}>
        <h2 id="announcements-filters" className="sr-only">
          Filter announcements
        </h2>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
          <Input
            type="search"
            aria-label="Search announcements"
            placeholder="Search title or text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="space-y-1.5">
            <p id="announcements-class-filter" className="text-sm font-bold">
              Class
            </p>
            <Select
              aria-labelledby="announcements-class-filter"
              value={classFilter}
              onValueChange={setClassFilter}
              options={[
                { value: "all", label: "All classes" },
                ...(classes.data ?? []).map((item) => ({ value: item.id, label: item.name })),
              ]}
            />
          </div>
          <div className="space-y-1.5 lg:col-span-2">
            <p id="announcements-priority-filter" className="text-sm font-bold">
              Priority
            </p>
            <SegmentedControl
              aria-label="Filter by priority"
              value={priorityFilter}
              onValueChange={(next) => {
                if (next === "all" || isPriority(next)) setPriorityFilter(next);
              }}
              options={PRIORITY_OPTIONS}
            />
          </div>
        </div>
      </section>

      {feed.isPending && feed.fetchStatus !== "idle" && (
        <ul className="grid gap-3" aria-label="Loading announcements">
          {[0, 1, 2].map((index) => (
            <li key={index}>
              <Skeleton label={null} className="h-32 w-full" />
            </li>
          ))}
        </ul>
      )}

      {feed.isError && (
        <ErrorState
          title="Announcements could not be loaded"
          description={feed.error instanceof Error ? feed.error.message : undefined}
          onRetry={() => void feed.refetch()}
        />
      )}

      {feed.isSuccess && items.length === 0 && (
        <EmptyState
          title="No announcements yet"
          description="Send a note, a homework reminder or an urgent alert to one of your classes."
          actionLabel="New announcement"
          onAction={openComposer}
        />
      )}

      {feed.isSuccess && items.length > 0 && visible.length === 0 && (
        <EmptyState
          size="sm"
          title="No announcements match these filters"
          description="Change the class, priority or search text."
        />
      )}

      {visible.length > 0 && (
        <>
          {receipts.isError && (
            <ErrorState
              size="sm"
              title="Read rates could not be loaded"
              onRetry={() => void receipts.refetch()}
            />
          )}
          <ul className="grid gap-3">
            {visible.map((item) => {
              const priority = isPriority(item.priority) ? item.priority : "normal";
              const totals = totalsById.get(item.id);
              const className = item.target_class_id
                ? (classNames.get(item.target_class_id) ?? "Class")
                : "School";
              const rate = totals ? readRate(totals.read, totals.total) : 0;
              return (
                <li key={item.id} className={ROW}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <button
                      type="button"
                      className={TITLE_BUTTON}
                      onClick={() => setSelectedId(item.id)}
                    >
                      {item.title}
                    </button>
                    <div className="flex flex-wrap gap-1.5">
                      <Chip size="sm" world={PRIORITY_WORLD[priority]}>
                        {PRIORITY_LABEL[priority]}
                      </Chip>
                      {isExpired(item) && <Chip size="sm">Expired</Chip>}
                    </div>
                  </div>

                  <p className="flex flex-wrap gap-x-2 text-sm font-semibold text-muted">
                    <span>{className}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatWhen(item.publish_at)}</span>
                  </p>

                  {receipts.isPending ? (
                    <p className="text-sm font-semibold text-muted">Loading read rate…</p>
                  ) : totals && totals.total > 0 ? (
                    <div className="space-y-1">
                      <ProgressBar
                        value={rate}
                        label="Read rate"
                        valueText={`${totals.read} of ${totals.total} read`}
                      />
                      <p className="text-sm font-bold">
                        {rate}% read · {totals.read} of {totals.total}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-muted">
                      No students in this class yet.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <AnnouncementComposer
        open={composerOpen}
        onOpenChange={setComposerOpen}
        classes={classes.data ?? []}
      />

      <AnnouncementDrawer
        announcement={selected}
        className={selectedClassName}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
