import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";
import type { AnnouncementPriority } from "./rules";

/* ========================================
   Announcements data layer (TEACHER-SPEC TC-26, TC-27, API-CONTRACT §4.9)
   Publishing goes through the `publish_announcement` RPC (migration 020), which validates the
   input, fans out recipients and, for urgent items, broadcasts the Realtime alert. The feed and
   read receipts are read from `announcements` and `announcement_recipients` under RLS: a teacher
   sees their own announcements and the recipient rows of those announcements.
   Results are validated with zod so drift shows up as a visible error state.
   ======================================== */

export const ANNOUNCEMENTS_KEY = "teacher-announcements";

interface DbError {
  message: string;
  code?: string;
}

type LooseRpc = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: DbError | null }>;

async function callRpc<T>(
  fn: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>,
): Promise<T> {
  // The generated Database type does not describe these RPCs yet; zod validates the result.
  const rpc = supabase.rpc.bind(supabase) as unknown as LooseRpc;
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error(normalizeApiError(error).message);
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error(`${fn} returned data in an unexpected shape.`);
  return parsed.data;
}

/* ---- Classes the teacher teaches (audience picker) -------------------------------------- */

const classesPage = z.object({
  items: z.array(
    z.object({
      class: z.object({ id: z.string(), name: z.string() }),
      students: z.number().int().nonnegative(),
    }),
  ),
  next_cursor: z.string().nullish(),
});

export interface TeacherClass {
  id: string;
  name: string;
  students: number;
}

const MAX_CLASS_PAGES = 10;

/** Every active class the teacher teaches, following the cursor for larger lists. */
export async function fetchMyClasses(): Promise<TeacherClass[]> {
  const classes: TeacherClass[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_CLASS_PAGES; page += 1) {
    const result = await callRpc(
      "list_my_classes",
      { status: "active", ...(cursor ? { cursor } : {}) },
      classesPage,
    );
    for (const item of result.items) {
      classes.push({ id: item.class.id, name: item.class.name, students: item.students });
    }
    if (!result.next_cursor) break;
    cursor = result.next_cursor;
  }
  return classes;
}

/* ---- Publishing -------------------------------------------------------------------------- */

export interface PublishInput {
  title: string;
  body: string;
  priority: AnnouncementPriority;
  classId: string;
  expiresAt: string | null;
}

const publishResult = z.object({
  announcement_id: z.string(),
  recipients: z.number().int().nonnegative(),
  status: z.string(),
});

export type PublishResult = z.infer<typeof publishResult>;

export const publishAnnouncement = (input: PublishInput) =>
  callRpc(
    "publish_announcement",
    {
      p_title: input.title,
      p_body: input.body,
      p_priority: input.priority,
      p_target_type: "class",
      p_target_class_id: input.classId,
      p_expires_at: input.expiresAt,
    },
    publishResult,
  );

/* ---- Feed and read receipts -------------------------------------------------------------- */

const announcementRow = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  priority: z.string(),
  target_type: z.string(),
  target_class_id: z.string().nullish(),
  publish_at: z.string(),
  expires_at: z.string().nullish(),
  status: z.string(),
});

export type AnnouncementRow = z.infer<typeof announcementRow>;

const receiptRow = z.object({
  announcement_id: z.string(),
  user_id: z.string(),
  read_at: z.string().nullish(),
});

const recipientDetailRow = z.object({
  user_id: z.string(),
  read_at: z.string().nullish(),
  profiles: z.object({ full_name: z.string() }).nullish(),
});

export type RecipientDetail = z.infer<typeof recipientDetailRow>;

interface QueryResult {
  data: unknown;
  error: DbError | null;
}

/** The part of the query builder this page uses. Results are validated with zod. */
interface LooseQuery extends PromiseLike<QueryResult> {
  eq(column: string, value: string): LooseQuery;
  in(column: string, values: string[]): LooseQuery;
  order(column: string, options: { ascending: boolean }): LooseQuery;
  limit(count: number): LooseQuery;
}

const fromTable = (name: string) =>
  (
    supabase as unknown as {
      from(table: string): { select(columns: string): LooseQuery };
    }
  ).from(name);

function parseRows<T>(label: string, data: unknown, schema: z.ZodType<T>): T[] {
  const parsed = z.array(schema).safeParse(data ?? []);
  if (!parsed.success) throw new Error(`${label} returned data in an unexpected shape.`);
  return parsed.data;
}

const FEED_LIMIT = 20;

/** The teacher's own announcements, newest first. One page; the query is bounded. */
export async function fetchMyAnnouncements(authorId: string): Promise<AnnouncementRow[]> {
  const { data, error } = await fromTable("announcements")
    .select(
      "id, title, body, priority, target_type, target_class_id, publish_at, expires_at, status",
    )
    .eq("author_id", authorId)
    .order("publish_at", { ascending: false })
    .limit(FEED_LIMIT);
  if (error) throw new Error(normalizeApiError(error).message);
  return parseRows("announcements", data, announcementRow);
}

/** Recipient rows (one per enrolled student) for the given announcements, for read rates. */
export async function fetchReceipts(announcementIds: string[]) {
  if (announcementIds.length === 0) return [];
  const { data, error } = await fromTable("announcement_recipients")
    .select("announcement_id, user_id, read_at")
    .in("announcement_id", announcementIds);
  if (error) throw new Error(normalizeApiError(error).message);
  return parseRows("announcement_recipients", data, receiptRow);
}

/** Who received one announcement and whether they have opened it, with their names. */
export async function fetchRecipientDetails(announcementId: string): Promise<RecipientDetail[]> {
  const { data, error } = await fromTable("announcement_recipients")
    .select("user_id, read_at, profiles(full_name)")
    .eq("announcement_id", announcementId);
  if (error) throw new Error(normalizeApiError(error).message);
  return parseRows("announcement_recipients", data, recipientDetailRow);
}
