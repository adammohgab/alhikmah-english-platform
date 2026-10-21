import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Chip } from "@/shared/components/ui/Chip";
import { Drawer } from "@/shared/components/ui/Drawer";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { ProgressBar } from "@/shared/components/ui/ProgressBar";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { cn } from "@/shared/lib/utils/cn";
import { ANNOUNCEMENTS_KEY, fetchRecipientDetails } from "./api";
import type { AnnouncementRow, RecipientDetail } from "./api";
import {
  PRIORITY_LABEL,
  PRIORITY_WORLD,
  isPriority,
  readRate,
  sanitizeAnnouncementHtml,
  formatWhen,
} from "./rules";

/* ========================================
   Announcement drawer (TEACHER-SPEC TC-26)
   The full message as students see it, the audience and the read / unread lists. Each list
   row shows the student's name, and read rows show when they opened it. The read rate bar
   updates live through `useReceiptsRealtime`, which refreshes the open details too.
   ======================================== */

const byName = (a: RecipientDetail, b: RecipientDetail) =>
  (a.profiles?.full_name ?? "").localeCompare(b.profiles?.full_name ?? "");

interface DrawerProps {
  announcement: AnnouncementRow | null;
  className: string | null;
  onClose: () => void;
}

export function AnnouncementDrawer({ announcement, className, onClose }: DrawerProps) {
  return (
    <Drawer
      open={announcement !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={announcement?.title ?? "Announcement"}
      description="Who received this announcement and who has opened it."
      size="md"
    >
      {announcement && <DrawerDetails announcement={announcement} className={className} />}
    </Drawer>
  );
}

function DrawerDetails({
  announcement,
  className,
}: {
  announcement: AnnouncementRow;
  className: string | null;
}) {
  const details = useQuery({
    queryKey: [ANNOUNCEMENTS_KEY, "recipients", announcement.id],
    queryFn: () => fetchRecipientDetails(announcement.id),
  });
  const body = useMemo(() => sanitizeAnnouncementHtml(announcement.body), [announcement.body]);
  const priority = isPriority(announcement.priority) ? announcement.priority : "normal";

  const rows = details.data ?? [];
  const read = rows.filter((row) => row.read_at).sort(byName);
  const unread = rows.filter((row) => !row.read_at).sort(byName);
  const rate = readRate(read.length, rows.length);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5">
        <Chip size="sm" world={PRIORITY_WORLD[priority]}>
          {PRIORITY_LABEL[priority]}
        </Chip>
        {className && (
          <Chip size="sm" world="sky">
            {className}
          </Chip>
        )}
        {announcement.expires_at && (
          <Chip size="sm">Expires {formatWhen(announcement.expires_at)}</Chip>
        )}
      </div>

      <p className="text-sm font-semibold text-muted">
        Published {formatWhen(announcement.publish_at)}
      </p>

      <div
        className="break-words rounded-[16px] border-2 border-stroke bg-surface-0 p-4 text-stroke [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
        dangerouslySetInnerHTML={{ __html: body }}
      />

      <section aria-labelledby="receipts-heading" className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id="receipts-heading" className="font-heading text-lg font-bold">
            Read receipts
          </h3>
          {details.isSuccess && <p className="font-heading text-lg font-bold">{rate}%</p>}
        </div>

        {details.isPending && <Skeleton label={null} className="h-16 w-full" />}

        {details.isError && (
          <ErrorState
            size="sm"
            title="Read receipts could not be loaded"
            onRetry={() => void details.refetch()}
          />
        )}

        {details.isSuccess && rows.length === 0 && (
          <EmptyState
            size="sm"
            title="No students in this class yet"
            description="Enrol students in the class and they will receive future announcements."
          />
        )}

        {details.isSuccess && rows.length > 0 && (
          <>
            <ProgressBar
              value={rate}
              label="Read rate"
              valueText={`${read.length} of ${rows.length} read`}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <ReceiptList
                title={`Read (${read.length})`}
                rows={read}
                empty="Nobody has opened it yet."
                showTime
              />
              <ReceiptList
                title={`Not read yet (${unread.length})`}
                rows={unread}
                empty="Everyone has read it."
              />
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ReceiptList({
  title,
  rows,
  empty,
  showTime = false,
}: {
  title: string;
  rows: RecipientDetail[];
  empty: string;
  showTime?: boolean;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-extrabold">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-sm font-semibold text-muted">{empty}</p>
      ) : (
        <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {rows.map((row) => (
            <li
              key={row.user_id}
              className={cn(
                "flex items-center justify-between gap-2 rounded-[10px] border-2 border-stroke px-3 py-1.5 text-sm font-bold",
                row.read_at ? "bg-surface-0" : "bg-surface-100",
              )}
            >
              <span className="truncate">{row.profiles?.full_name ?? "Student"}</span>
              {showTime && row.read_at && (
                <span className="shrink-0 text-xs font-semibold text-muted">
                  {formatWhen(row.read_at)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
