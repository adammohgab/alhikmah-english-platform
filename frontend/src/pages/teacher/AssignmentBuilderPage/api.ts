import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";

/* ========================================
   Assignment builder data layer (TEACHER-SPEC TC-14, API-CONTRACT "Drafts use direct writes")

   Core fields (title, prompt, class, due date, status) are written straight to `assessments`
   under RLS. The rubric link, late policy and close date have no column in the current schema,
   so they go in a second write that is allowed to fail on a missing column: the draft itself is
   still saved and the page tells the teacher those settings were not stored. Publishing calls
   the contract RPC `publish_assessment`; where that RPC does not exist yet the status is set
   directly.
   ======================================== */

export const BUILDER_KEY = "teacher-assignment-builder";

export type LatePolicy = "reject" | "penalty" | "accept";

export interface AssignmentForm {
  title: string;
  classId: string;
  /** `datetime-local` value, or "". */
  dueAt: string;
  closeAt: string;
  latePolicy: LatePolicy;
  penaltyPerDay: string;
  penaltyMax: string;
  promptHtml: string;
  rubricId: string;
}

export const EMPTY_FORM: AssignmentForm = {
  title: "",
  classId: "",
  dueAt: "",
  closeAt: "",
  latePolicy: "reject",
  penaltyPerDay: "10",
  penaltyMax: "50",
  promptHtml: "",
  rubricId: "",
};

const classRow = z.object({
  id: z.string(),
  name: z.string(),
  grade_level: z.coerce.string().nullish(),
});
const rubricRow = z.object({
  id: z.string(),
  title: z.string(),
  max_score: z.coerce.number().nullish(),
});
const assessmentRow = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullish(),
  class_id: z.string().nullish(),
  due_date: z.string().nullish(),
  status: z.string(),
});
const extrasRow = z.object({
  rubric_id: z.string().nullish(),
  late_policy: z.string().nullish(),
  late_penalty_pct_per_day: z.coerce.number().nullish(),
  late_penalty_max_pct: z.coerce.number().nullish(),
  close_date: z.string().nullish(),
});

export type ClassOption = z.infer<typeof classRow>;
export type RubricOption = z.infer<typeof rubricRow>;

interface DbError {
  message: string;
  code?: string;
}
interface Result {
  data: unknown;
  error: DbError | null;
}
interface Query extends PromiseLike<Result> {
  eq(column: string, value: string): Query;
  order(column: string, options: { ascending: boolean }): Query;
  select(columns?: string): Query;
}
interface LooseClient {
  from(table: string): {
    select(columns: string): Query;
    insert(values: Record<string, unknown>): Query;
    update(values: Record<string, unknown>): Query;
  };
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<Result>;
}
const client = (): LooseClient => {
  const raw: unknown = supabase;
  return raw as LooseClient;
};

async function load<T>(request: PromiseLike<Result>, schema: z.ZodType<T>, what: string) {
  const { data, error } = await request;
  if (error) throw new Error(normalizeApiError(error).message);
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error(`${what} came back in an unexpected shape.`);
  return parsed.data;
}

export function fetchClasses(): Promise<ClassOption[]> {
  return load(
    client().from("classes").select("id, name, grade_level").order("name", { ascending: true }),
    z.array(classRow),
    "Your classes",
  );
}

export function fetchRubrics(): Promise<RubricOption[]> {
  return load(
    client().from("rubrics").select("id, title, max_score").order("title", { ascending: true }),
    z.array(rubricRow),
    "Your rubrics",
  );
}

/* ---- date helpers (datetime-local <-> ISO) ---- */

const pad = (n: number) => String(n).padStart(2, "0");

export function isoToLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function localToIso(local: string): string | null {
  if (!local) return null;
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function fetchAssignment(id: string): Promise<AssignmentForm> {
  const rows = await load(
    client()
      .from("assessments")
      .select("id, title, description, class_id, due_date, status")
      .eq("id", id),
    z.array(assessmentRow),
    "The assignment",
  );
  const row = rows[0];
  if (!row) throw new Error("This assignment was not found.");

  let extras: z.infer<typeof extrasRow> | undefined;
  const result = await client()
    .from("assessments")
    .select("rubric_id, late_policy, late_penalty_pct_per_day, late_penalty_max_pct, close_date")
    .eq("id", id);
  if (!result.error) {
    const parsed = z.array(extrasRow).safeParse(result.data);
    extras = parsed.success ? parsed.data[0] : undefined;
  }

  const policy = extras?.late_policy;
  return {
    title: row.title,
    classId: row.class_id ?? "",
    dueAt: isoToLocal(row.due_date),
    closeAt: isoToLocal(extras?.close_date),
    latePolicy: policy === "penalty" || policy === "accept" ? policy : "reject",
    penaltyPerDay: String(extras?.late_penalty_pct_per_day ?? 10),
    penaltyMax: String(extras?.late_penalty_max_pct ?? 50),
    promptHtml: row.description ?? "",
    rubricId: extras?.rubric_id ?? "",
  };
}

export interface SaveResult {
  id: string;
  /** False when the rubric, late policy or close date could not be stored. */
  extrasSaved: boolean;
  published: boolean;
}

const isMissingColumn = (error: DbError) =>
  error.code === "42703" || error.code === "PGRST204" || /column/i.test(error.message);
const isMissingFunction = (error: DbError) =>
  error.code === "PGRST202" ||
  error.code === "42883" ||
  /could not find the function/i.test(error.message);

export async function saveAssignment(
  userId: string,
  existingId: string | null,
  form: AssignmentForm,
  publish: boolean,
): Promise<SaveResult> {
  const base = {
    title: form.title.trim(),
    description: form.promptHtml,
    class_id: form.classId,
    due_date: localToIso(form.dueAt),
    kind: "assignment",
  };

  let id = existingId;
  if (id) {
    const { error } = await client().from("assessments").update(base).eq("id", id);
    if (error) throw new Error(normalizeApiError(error).message);
  } else {
    const { data, error } = await client()
      .from("assessments")
      .insert({ ...base, author_id: userId, status: "draft" })
      .select("id");
    if (error) throw new Error(normalizeApiError(error).message);
    const parsed = z.array(z.object({ id: z.string() })).safeParse(data);
    id = parsed.success ? (parsed.data[0]?.id ?? null) : null;
    if (!id) throw new Error("The assignment was saved but its id was not returned.");
  }

  const extras = await client()
    .from("assessments")
    .update({
      rubric_id: form.rubricId || null,
      late_policy: form.latePolicy,
      late_penalty_pct_per_day: form.latePolicy === "penalty" ? Number(form.penaltyPerDay) : null,
      late_penalty_max_pct: form.latePolicy === "penalty" ? Number(form.penaltyMax) : null,
      close_date: localToIso(form.closeAt),
    })
    .eq("id", id);
  let extrasSaved = true;
  if (extras.error) {
    if (!isMissingColumn(extras.error)) throw new Error(normalizeApiError(extras.error).message);
    extrasSaved = false;
  }

  if (publish) {
    const rpc = await client().rpc("publish_assessment", {
      kind: "assignment",
      id,
      schedule: "now",
    });
    if (rpc.error) {
      if (!isMissingFunction(rpc.error)) throw new Error(normalizeApiError(rpc.error).message);
      const direct = await client()
        .from("assessments")
        .update({ status: "published" })
        .eq("id", id);
      if (direct.error) throw new Error(normalizeApiError(direct.error).message);
    }
  }
  return { id, extrasSaved, published: publish };
}
