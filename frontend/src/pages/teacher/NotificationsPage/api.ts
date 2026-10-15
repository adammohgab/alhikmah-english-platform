import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";

/* ========================================
   Teacher notifications data layer (TEACHER-SPEC TC-28, API-CONTRACT §4.9)
   Reads the teacher's own `notifications` rows; `mark_notifications_read` batches updates.
   ======================================== */

export const PAGE_SIZE = 30;

const notificationRow = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  body: z.string(),
  payload: z.record(z.string(), z.unknown()).nullish(),
  link: z.string().nullish(),
  priority: z.string(),
  is_read: z.boolean(),
  created_at: z.string(),
});

export type NotificationRow = z.infer<typeof notificationRow>;

interface DbError {
  message: string;
  code?: string;
}

/** The part of the query builder this page uses; the generated Database type does not list
 * `notifications` yet, so results are validated with zod instead of trusted. */
interface LooseBuilder extends PromiseLike<{
  data: unknown;
  error: DbError | null;
  count?: number | null;
}> {
  eq(column: string, value: string | boolean): LooseBuilder;
  lt(column: string, value: string): LooseBuilder;
  order(column: string, options: { ascending: boolean }): LooseBuilder;
  limit(count: number): LooseBuilder;
}

const notificationsTable = () =>
  (
    supabase as unknown as {
      from(table: string): {
        select(columns: string, options?: { count: "exact"; head: boolean }): LooseBuilder;
      };
    }
  ).from("notifications");

export async function fetchNotifications(
  userId: string,
  before: string | undefined,
): Promise<NotificationRow[]> {
  let query = notificationsTable()
    .select("id, kind, title, body, payload, link, priority, is_read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
  if (before) query = query.lt("created_at", before);
  const { data, error } = await query;
  if (error) throw new Error(normalizeApiError(error).message);
  const parsed = z.array(notificationRow).safeParse(data);
  if (!parsed.success) throw new Error("Notifications were returned in an unexpected shape.");
  return parsed.data;
}

export async function fetchUnreadCount(userId: string): Promise<number> {
  const { count, error } = await notificationsTable()
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) throw new Error(normalizeApiError(error).message);
  return count ?? 0;
}

type LooseRpc = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ error: DbError | null }>;

async function markRead(args: Record<string, unknown>): Promise<void> {
  const rpc = supabase.rpc.bind(supabase) as unknown as LooseRpc;
  const { error } = await rpc("mark_notifications_read", args);
  if (error) throw new Error(normalizeApiError(error).message);
}

export const markNotificationsRead = (ids: string[]) => markRead({ ids });
export const markAllNotificationsRead = () => markRead({ all: true });
