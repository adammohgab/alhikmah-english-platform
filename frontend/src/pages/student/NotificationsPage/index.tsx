import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, Megaphone, Sparkles, BellRing } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";
import { useAuth } from "@/app/providers/auth-context";
import { Button } from "@/shared/components/ui/Button";
import { Chip } from "@/shared/components/ui/Chip";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { useToast } from "@/shared/hooks/useToast";
import {
  PAGE_SIZE,
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationsRead,
} from "./api";
import type { NotificationRow } from "./api";
import { NOTIFICATIONS_KEY, useStudentNotificationsRealtime } from "./useUnreadCount";

const PANEL = "rounded-[20px] border-2 border-stroke bg-surface-0 p-3 shadow-retro-sm";
const FILTERS = ["all", "unread", "announcements", "activity"] as const;

type StudentFilter = (typeof FILTERS)[number];

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function categorize(kind: string): "announcements" | "activity" {
  if (/announcement|school|urgent|admin|class/.test(kind)) return "announcements";
  return "activity";
}

function matchesCategory(row: NotificationRow, filter: StudentFilter): boolean {
  if (filter === "all") return true;
  if (filter === "unread") return !row.is_read;
  return categorize(row.kind) === filter;
}

function destinationFor(row: NotificationRow): string | null {
  if (row.link && row.link.startsWith("/") && !row.link.startsWith("//")) return row.link;
  return null;
}

function Item({ row, onOpen }: { row: NotificationRow; onOpen: (row: NotificationRow) => void }) {
  const category = categorize(row.kind);
  const Icon = category === "announcements" ? Megaphone : row.priority === "urgent" ? BellRing : Sparkles;
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(row)}
        className={cn(
          "flex w-full items-start gap-3 rounded-[12px] border-2 border-transparent px-3 py-3 text-start hover:border-stroke hover:bg-surface-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
          !row.is_read && "bg-world-sky-50",
        )}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-stroke bg-world-sky-100">
          <Icon size={17} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block text-stroke", row.is_read ? "font-semibold" : "font-extrabold")}>
            {!row.is_read && <span className="sr-only">Unread: </span>}
            {row.title}
          </span>
          <span className="block text-sm text-muted">{row.body}</span>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
            {row.priority === "urgent" && (
              <Chip size="sm" world="amber">
                Urgent
              </Chip>
            )}
            <time dateTime={row.created_at}>{formatWhen(row.created_at)}</time>
          </span>
        </span>
        {!row.is_read && (
          <span
            aria-hidden="true"
            className="mt-2 h-3 w-3 shrink-0 rounded-full border-2 border-stroke bg-world-coral-500"
          />
        )}
      </button>
    </li>
  );
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<StudentFilter>("all");

  useStudentNotificationsRealtime(userId);

  const list = useInfiniteQuery({
    queryKey: [NOTIFICATIONS_KEY, "list", userId],
    queryFn: ({ pageParam }) => fetchNotifications(userId!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.length === PAGE_SIZE ? last[last.length - 1]?.created_at : undefined,
    enabled: Boolean(userId),
  });

  const unread = useQuery({
    queryKey: [NOTIFICATIONS_KEY, "unread", userId],
    queryFn: () => fetchUnreadCount(userId!),
    enabled: Boolean(userId),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] });
  const onError = (error: Error) =>
    toast.show({
      type: "error",
      title: "Could not update notifications",
      description: error.message,
    });

  const markOne = useMutation({
    mutationFn: (id: string) => markNotificationsRead([id]),
    onSuccess: refresh,
    onError,
  });

  const markAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: refresh,
    onError,
  });

  const rows = useMemo(
    () => (list.data?.pages.flat() ?? []).filter((row) => matchesCategory(row, filter)),
    [list.data, filter],
  );

  const open = (row: NotificationRow) => {
    if (!row.is_read) markOne.mutate(row.id);
    const destination = destinationFor(row);
    if (destination) navigate(destination);
  };

  const unreadCount = unread.data ?? 0;

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 text-stroke">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold sm:text-4xl">
            Notifications
            {unreadCount > 0 && (
              <span
                data-testid="unread-badge"
                className="ms-3 rounded-full border-2 border-stroke bg-world-amber-300 px-3 py-0.5 align-middle font-body text-base font-extrabold"
              >
                {unreadCount} unread
              </span>
            )}
          </h1>
          <p className="font-medium text-muted">Announcements, rewards, and updates from your school.</p>
        </div>
        <Button
          variant="outline"
          disabled={unreadCount === 0}
          loading={markAll.isPending}
          onClick={() => markAll.mutate()}
        >
          <CheckCheck size={17} aria-hidden="true" /> Mark all as read
        </Button>
      </header>

      <div role="group" aria-label="Filter notifications" className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <Chip
            key={item}
            selected={filter === item}
            onClick={() => setFilter(item)}
            aria-label={item === "all" ? "All" : item === "unread" ? "Unread" : item === "announcements" ? "Announcements" : "Activity"}
          >
            {item === "all" ? "All" : item === "unread" ? "Unread" : item === "announcements" ? "Announcements" : "Activity"}
          </Chip>
        ))}
      </div>

      <section aria-label="Notifications" className={PANEL}>
        {!userId || list.isPending ? (
          <div role="status" aria-label="Loading" className="space-y-3 p-2">
            {[0, 1, 2, 3].map((item) => (
              <Skeleton key={item} label={null} className="h-16 w-full" />
            ))}
          </div>
        ) : list.isError ? (
          <ErrorState
            size="sm"
            title="Notifications could not be loaded"
            description="Check your connection and try again."
            onRetry={() => void list.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            size="sm"
            title="You are all caught up."
            description={filter === "all" ? "No notifications yet." : "Nothing here in this category."}
          />
        ) : (
          <ul className="space-y-1">
            {rows.map((row) => (
              <Item key={row.id} row={row} onOpen={open} />
            ))}
          </ul>
        )}

        {list.hasNextPage && (
          <div className="p-3 text-center">
            <Button variant="outline" loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
              Load older notifications
            </Button>
          </div>
        )}
      </section>
    </main>
  );
}
