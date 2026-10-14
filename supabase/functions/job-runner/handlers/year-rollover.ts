/**
 * handlers/year-rollover.ts
 *
 * BE-EDGE-14: `rollover` background job handler for the job-runner Edge Function.
 *
 * Executes the academic year rollover (AD-06) and its rollback, from an
 * admin-approved plan: archive concluding classes, advance students by
 * migrating enrollments to next-grade classes, graduate grade 12, and keep a
 * reversal snapshot with a 7-day undo window.
 *
 * Steps (execute path) with live `job_steps` progress (07-AI-SYSTEM section 9):
 *   1. Authorize + snapshot ............................ 20%
 *   2. Archive concluding classes ..................... 40%
 *   3. Promote (new classes, enrollments, links) ....... 75%
 *   4. Audit + notify ................................. 100%
 * Steps (undo path):
 *   1. Verify window + load snapshot .................. 20%
 *   2. Restore (reverse) .............................. 70%
 *   3. Audit + notify ................................. 100%
 *
 * Table mapping (actual migrations, NOT the idealized backend/docs superset):
 *   - grades            -> there is NO grade column on profiles; grade lives on
 *                          classes.grade_level (text). "Advancing a grade" means
 *                          migrating an active class_enrollments row from a
 *                          concluding class to a new class whose grade_level is
 *                          one higher. Grade 12 students are graduated by setting
 *                          profiles.status='archived' (history kept).
 *   - archive           -> classes.is_archived=true (never delete: submissions
 *                          and results history must survive)
 *   - old enrollments   -> class_enrollments.status set to 'archived'
 *                          (before-image kept for undo)
 *   - new enrollments   -> class_enrollments rows (status active)
 *   - teachers          -> class_teachers rows copied (is_primary preserved)
 *   - courses           -> class_courses rows copied to the new class
 *                          (classes INSERT fires create_default_class_rules(),
 *                          so class_rules need no handling)
 *   - snapshot/changes  -> jobs.result_payload.partial + final result
 *                          (no rollover_runs/rollover_changes tables exist in
 *                          migrations and creating them is outside this task's
 *                          file ownership)
 *   - audit             -> audit_log (action rollover.execute / rollover.undo,
 *                          action_type rollover)
 *   - notify            -> notifications (initiator + affected teachers)
 *
 * Transactional consistency: hundreds of writes cannot run in one DB
 * transaction. Instead both directions are IDEMPOTENT and resumable:
 *   - execute records completed class ids + created ids in partial and skips
 *     them on retry; existing new-class links are looked up before inserting
 *     (unique pairs never error);
 *   - undo replays the stored before-images; entities changed after the
 *     rollover (e.g. new enrollments added post-hoc) are left untouched and
 *     reported as conflicts instead of being silently overwritten.
 *
 * WIRING NOTE (for the BE-EDGE-11 owner — outside this task's file ownership):
 * job-runner/index.ts has no `rollover` stub at all. To activate, add a
 * side-effect import in index.ts:
 *     import "./handlers/year-rollover.ts";
 * (which triggers the guarded self-registration below).
 */

// -------------------------------------------------------------------
// Constants
// -------------------------------------------------------------------

/** Job kind this handler serves (matches jobs.kind check constraint). */
export const ROLLOVER_KIND = "rollover";

/** Execute-path steps: index (1-based; 0 is the runner's "started" sentinel). */
export const ROLLOVER_EXEC_STEPS = [
  { index: 1, name: "snapshot", progress: 20 },
  { index: 2, name: "archive", progress: 40 },
  { index: 3, name: "promote", progress: 75 },
  { index: 4, name: "finalize", progress: 100 },
] as const;

/** Undo-path steps (same indexes, undo names). */
export const ROLLOVER_UNDO_STEPS = [
  { index: 1, name: "verify", progress: 20 },
  { index: 2, name: "restore", progress: 70 },
  { index: 3, name: "finalize", progress: 100 },
] as const;

/** Undo window per 05-API-CONTRACT + 11-OPERATIONS (task text said 48h). */
export const UNDO_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** Highest promotable grade; graduates archive as alumni (history kept). */
export const GRADUATING_GRADE = 12;
/** Danger-zone confirmation text (AD-06 step 5). */
export const ROLLOVER_CONFIRM_TEXT = "ROLLOVER";

// -------------------------------------------------------------------
// Minimal Supabase client surface (structural; the runner injects a
// service-role client so RLS never blocks job writes).
// -------------------------------------------------------------------

export interface DbResult {
  data: any;
  error: { message: string } | null;
}

export interface DbQuery {
  eq(column: string, value: unknown): DbQuery;
  in(column: string, values: unknown[]): DbQuery;
  order(column: string, options?: { ascending?: boolean }): DbQuery;
  limit(count: number): DbQuery;
  single(): Promise<DbResult>;
  throwOnError(): DbQuery;
  then: PromiseLike<DbResult>["then"];
}

export interface DbTable {
  select(columns?: string): DbQuery;
  insert(rows: unknown): DbQuery;
  update(patch: Record<string, unknown>): DbQuery;
  delete(): DbQuery;
  upsert(rows: unknown, options?: Record<string, unknown>): DbQuery;
}

export interface SupaClient {
  from(table: string): DbTable;
}

export interface JobRecord {
  id: string;
  kind: string;
  status: string;
  initiator_id: string;
  input_params: Record<string, unknown>;
  result_payload?: Record<string, unknown> | null;
}

export interface HandlerResult {
  progress_percent: number;
  finishAfterStep: boolean;
  result_payload?: Record<string, unknown>;
}

// -------------------------------------------------------------------
// Errors
// -------------------------------------------------------------------

export class RolloverError extends Error {
  readonly code: string;
  readonly stepIndex?: number;
  constructor(code: string, message: string, stepIndex?: number) {
    super(message);
    this.name = "RolloverError";
    this.code = code;
    this.stepIndex = stepIndex;
  }
}

// -------------------------------------------------------------------
// Plan input (AD-06 wizard output; rollover_execute contract)
// -------------------------------------------------------------------

export type RolloverMode = "execute" | "undo";

export interface GradeMapping {
  from: string;
  to: string;
}

export interface RolloverException {
  student_id: string;
  action: "retain" | "graduate" | "move";
  to_class_id?: string;
}

export interface ClassPlanEntry {
  old_class_id: string;
  new_name?: string;
  new_grade?: string;
}

export interface RolloverParams {
  mode: RolloverMode;
  fromYearId?: string;
  toYearId?: string;
  newYear?: { name: string; start_date?: string; end_date?: string };
  gradeMap?: GradeMapping[];
  exceptions?: RolloverException[];
  classPlan?: ClassPlanEntry[];
  classIds?: string[];
  confirmText?: string;
  undoHours?: number;
  runJobId?: string;
}

export function parseRolloverParams(input: Record<string, unknown>): RolloverParams {
  const rawMode = input["mode"];
  const mode: RolloverMode = rawMode === "undo" ? "undo" : "execute";
  if (mode === "undo") {
    const runJobId = typeof input["run_job_id"] === "string" ? input["run_job_id"].trim() : "";
    if (!runJobId) {
      throw new RolloverError(
        "validation_failed",
        "Undo requires `run_job_id` of the completed rollover job."
      );
    }
    return { mode, runJobId };
  }
  const str = (v: unknown): string | undefined =>
    typeof v === "string" && v.trim() ? v.trim() : undefined;
  const fromYearId = str(input["from_year_id"] ?? input["fromYearId"]);
  const toYearId = str(input["to_year_id"] ?? input["toYearId"]);
  const rawNewYear = input["new_year"] ?? input["newYear"];
  let newYear: RolloverParams["newYear"];
  if (rawNewYear !== null && typeof rawNewYear === "object" && !Array.isArray(rawNewYear)) {
    const rec = rawNewYear as Record<string, unknown>;
    if (typeof rec["name"] === "string" && rec["name"].trim()) {
      newYear = {
        name: rec["name"].trim(),
        ...(typeof rec["start_date"] === "string" ? { start_date: rec["start_date"] } : {}),
        ...(typeof rec["end_date"] === "string" ? { end_date: rec["end_date"] } : {}),
      };
    }
  }
  if (!toYearId && !newYear) {
    throw new RolloverError(
      "validation_failed",
      "Rollover needs a target year: `to_year_id` or `new_year: {name}`."
    );
  }
  const confirmText = str(input["confirm_text"] ?? input["confirmText"]);
  if (confirmText !== ROLLOVER_CONFIRM_TEXT) {
    throw new RolloverError(
      "validation_failed",
      `Danger-zone confirmation missing: set confirm_text to "${ROLLOVER_CONFIRM_TEXT}".`
    );
  }
  const gradeMap = Array.isArray(input["grade_map"] ?? input["gradeMap"])
    ? ((input["grade_map"] ?? input["gradeMap"]) as unknown[])
        .filter((g): g is Record<string, unknown> => typeof g === "object" && g !== null)
        .map((g) => ({ from: String(g["from"] ?? "").trim(), to: String(g["to"] ?? "").trim() }))
        .filter((g) => g.from && g.to)
    : undefined;
  const exceptions = Array.isArray(input["exceptions"])
    ? (input["exceptions"] as unknown[])
        .filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)
        .map((e) => ({
          student_id: String(e["student_id"] ?? ""),
          action: (e["action"] === "retain" || e["action"] === "graduate" || e["action"] === "move"
            ? e["action"]
            : "retain") as RolloverException["action"],
          ...(typeof e["to_class_id"] === "string" ? { to_class_id: e["to_class_id"] } : {}),
        }))
        .filter((e) => e.student_id)
    : [];
  const classPlan = Array.isArray(input["class_plan"] ?? input["classPlan"])
    ? ((input["class_plan"] ?? input["classPlan"]) as unknown[])
        .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
        .map((c) => ({
          old_class_id: String(c["old_class_id"] ?? ""),
          ...(typeof c["new_name"] === "string" && c["new_name"].trim() ? { new_name: c["new_name"].trim() } : {}),
          ...(typeof c["new_grade"] === "string" && c["new_grade"].trim() ? { new_grade: c["new_grade"].trim() } : {}),
        }))
        .filter((c) => c.old_class_id)
    : [];
  const classIds = Array.isArray(input["class_ids"] ?? input["classIds"])
    ? ((input["class_ids"] ?? input["classIds"]) as unknown[])
        .map((c) => String(c ?? "").trim())
        .filter(Boolean)
    : [];
  const rawUndoHours = Number(input["undo_hours"] ?? input["undoHours"]);
  const undoHours =
    Number.isFinite(rawUndoHours) && rawUndoHours > 0 ? rawUndoHours : UNDO_WINDOW_MS / 3600000;
  return {
    mode,
    fromYearId,
    toYearId,
    newYear,
    gradeMap,
    exceptions,
    classPlan,
    classIds,
    confirmText,
    undoHours,
  };
}

// -------------------------------------------------------------------
// Pure helpers (exported for unit tests)
// -------------------------------------------------------------------

/** Numeric grade from a grade_level text ("8" -> 8, "Grade 8A" -> null). */
export function parseGradeLevel(gradeLevel: string): number | null {
  const t = (gradeLevel ?? "").trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) ? n : null;
}

export function isGraduatedTarget(to: string): boolean {
  const t = to.trim().toLowerCase();
  return t === "graduated" || t === "graduate" || t === "archive" || t === "archived";
}

/** Default grade map from observed grades: n -> n+1, 12 -> graduated. */
export function defaultGradeMap(gradeLevels: string[]): GradeMapping[] {
  const nums = [...new Set(gradeLevels.map(parseGradeLevel).filter((n): n is number => n !== null))].sort(
    (a, b) => a - b
  );
  return nums.map((n) => ({
    from: String(n),
    to: n >= GRADUATING_GRADE ? "graduated" : String(n + 1),
  }));
}

/** Default new-class name: bump the leading grade digits ("Grade 8A" -> "Grade 9A"). */
export function defaultNewClassName(oldName: string, toGrade: string): string {
  const m = /^(\D*)(\d+)(.*)$/.exec(oldName.trim());
  if (!m) return `${toGrade} ${oldName.trim()}`;
  return `${m[1]}${toGrade}${m[3]}`.trim() || `${toGrade} Class`;
}

export interface SnapshotEnrollment {
  class_id: string;
  student_id: string;
  status: string;
}

export interface SnapshotTeacher {
  class_id: string;
  teacher_id: string;
  is_primary: boolean;
}

export interface SnapshotCourseLink {
  class_id: string;
  course_id: string;
  is_active: boolean;
}

export interface SnapshotClass {
  id: string;
  name: string;
  grade_level: string;
  term_id: string | null;
  is_archived: boolean;
}

export interface RolloverSnapshot {
  from_year_id: string;
  to_year_id: string;
  classes: SnapshotClass[];
  enrollments: SnapshotEnrollment[];
  teachers: SnapshotTeacher[];
  courseLinks: SnapshotCourseLink[];
  profileStatuses: Array<{ profile_id: string; before: string }>;
  classMap: Array<{ old_class_id: string; new_class_id: string | null; grade_from: string; grade_to: string }>;
  /** Auto-created "{grade} Repeat" classes for retained students. */
  repeatClasses: string[];
  /** Teacher copies assigned to repeat classes (for undo cascade + counts). */
  repeatTeachers: SnapshotTeacher[];
  /** Retained-student enrollments created in repeat classes. */
  retainedMoves: Array<{ new_class_id: string; student_id: string }>;
}

export interface RolloverCounts {
  classes_archived: number;
  classes_created: number;
  promoted: number;
  retained: number;
  graduated: number;
  enrollments_created: number;
  teachers_assigned: number;
  courses_linked: number;
  skipped: number;
}

export function emptyCounts(): RolloverCounts {
  return {
    classes_archived: 0,
    classes_created: 0,
    promoted: 0,
    retained: 0,
    graduated: 0,
    enrollments_created: 0,
    teachers_assigned: 0,
    courses_linked: 0,
    skipped: 0,
  };
}

// -------------------------------------------------------------------
// DB helpers
// -------------------------------------------------------------------

async function insertReturning(supa: SupaClient, table: string, rows: unknown): Promise<any[]> {
  const res: DbResult = await (supa.from(table).insert(rows) as unknown as DbQuery & {
    select(columns?: string): DbQuery;
  }).select("*");
  if (res.error) throw new Error(`${table} insert failed: ${res.error.message}`);
  const data = (res as unknown as { data: unknown }).data;
  if (Array.isArray(data)) return data;
  if (data !== null && data !== undefined) return [data];
  throw new Error(`${table} insert returned no rows`);
}

async function writeStep(
  supa: SupaClient,
  jobId: string,
  stepIndex: number,
  name: string,
  status: "running" | "completed" | "failed",
  progressPercent: number,
  log?: string
): Promise<void> {
  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
    job_id: jobId,
    step_index: stepIndex,
    name,
    status,
    progress_percent: progressPercent,
    ...(log ? { log } : {}),
    started_at: now,
    ...(status !== "running" ? { completed_at: now } : {}),
  };
  const res: DbResult = await supa.from("job_steps").upsert(row, { onConflict: "job_id,step_index" });
  if (res.error) throw new Error(`job_steps write failed: ${res.error.message}`);
  // Row writes drive the Realtime `job:{job_id}` channel via Postgres Changes.
}

async function touchJob(supa: SupaClient, jobId: string, patch: Record<string, unknown>): Promise<void> {
  const res: DbResult = await supa.from("jobs").update(patch).eq("id", jobId);
  if (res.error) throw new Error(`jobs update failed: ${res.error.message}`);
}

async function readJob(supa: SupaClient, jobId: string): Promise<JobRecord> {
  const res: DbResult = await supa.from("jobs").select("*").eq("id", jobId).single();
  if (res.error) throw new Error(`jobs read failed: ${res.error.message}`);
  const data = res.data as any;
  return {
    id: data.id,
    kind: data.kind,
    status: data.status,
    initiator_id: data.initiator_id,
    input_params: (data.input_params ?? {}) as Record<string, unknown>,
    result_payload: (data.result_payload ?? null) as Record<string, unknown> | null,
  };
}

async function readCompletedSteps(supa: SupaClient, jobId: string): Promise<Set<number>> {
  const res: DbResult = await supa.from("job_steps").select("step_index,status").eq("job_id", jobId);
  if (res.error) throw new Error(`job_steps read failed: ${res.error.message}`);
  const done = new Set<number>();
  for (const r of (Array.isArray(res.data) ? res.data : []) as any[]) {
    if (r && r.status === "completed" && typeof r.step_index === "number") done.add(r.step_index);
  }
  return done;
}

async function selectAll(supa: SupaClient, table: string, columns: string): Promise<any[]> {
  const res: DbResult = await supa.from(table).select(columns);
  if (res.error) throw new Error(`${table} read failed: ${res.error.message}`);
  return Array.isArray(res.data) ? res.data : [];
}

async function selectWhere(
  supa: SupaClient,
  table: string,
  columns: string,
  column: string,
  values: unknown[]
): Promise<any[]> {
  const out: any[] = [];
  for (let i = 0; i < values.length; i += 200) {
    const batch = values.slice(i, i + 200);
    if (batch.length === 0) continue;
    const res: DbResult = await supa.from(table).select(columns).in(column, batch);
    if (res.error) throw new Error(`${table} lookup failed: ${res.error.message}`);
    out.push(...(Array.isArray(res.data) ? res.data : []));
  }
  return out;
}

async function failJob(
  supa: SupaClient,
  jobId: string,
  stepIndex: number | undefined,
  stepName: string,
  code: string,
  message: string
): Promise<HandlerResult> {
  const now = new Date().toISOString();
  if (stepIndex !== undefined) {
    await writeStep(supa, jobId, stepIndex, stepName, "failed", 0, `${code}: ${message}`);
  }
  await touchJob(supa, jobId, { status: "failed", error_message: message, completed_at: now });
  return { progress_percent: 0, finishAfterStep: true };
}

/** Super-admin gate: only role 'super_admin' may roll over (task requirement). */
async function requireSuperAdmin(supa: SupaClient, initiatorId: string): Promise<void> {
  const res: DbResult = await supa.from("profiles").select("id,role").eq("id", initiatorId).single();
  if (res.error || !res.data) {
    throw new RolloverError("forbidden", "Rollover is restricted to Super admins: initiator profile not found.", 1);
  }
  if ((res.data as any).role !== "super_admin") {
    throw new RolloverError(
      "forbidden",
      "Rollover is restricted to Super admins.",
      1
    );
  }
}

async function writeAudit(
  supa: SupaClient,
  initiatorId: string,
  action: string,
  summary: string,
  after: Record<string, unknown>
): Promise<boolean> {
  try {
    const actor = await supa.from("profiles").select("id,role").eq("id", initiatorId).single();
    const res: DbResult = await supa.from("audit_log").insert({
      user_id: initiatorId,
      actor_id: initiatorId,
      actor_role: !actor.error ? (actor.data as any)?.role ?? "admin" : "admin",
      action,
      action_type: "rollover",
      target_type: "job",
      summary,
      after,
    });
    if (res.error) {
      console.warn(`[year-rollover] audit write failed: ${res.error.message}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[year-rollover] audit write failed: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

async function notifyUser(
  supa: SupaClient,
  userId: string,
  kind: string,
  title: string,
  body: string,
  payload: Record<string, unknown>,
  link?: string
): Promise<void> {
  try {
    await insertReturning(supa, "notifications", {
      user_id: userId,
      kind,
      title,
      body,
      payload,
      ...(link ? { link } : {}),
      priority: "normal",
    });
  } catch (err) {
    console.warn(
      `[year-rollover] notification to ${userId} failed: ${err instanceof Error ? err.message : err}`
    );
  }
}

// -------------------------------------------------------------------
// Execute path
// -------------------------------------------------------------------

interface YearContext {
  fromYearId: string;
  toYearId: string;
  toTermId: string | null;
}

async function resolveYears(
  supa: SupaClient,
  params: RolloverParams
): Promise<YearContext> {
  let fromYearId = params.fromYearId;
  if (!fromYearId) {
    const years = await selectAll(supa, "school_years", "id,is_active");
    const active = (years as any[]).find((y) => y.is_active);
    if (!active) {
      throw new RolloverError(
        "validation_failed",
        "No active school year found: provide `from_year_id`.",
        1
      );
    }
    fromYearId = String(active.id);
  }
  let toYearId = params.toYearId;
  if (!toYearId && params.newYear) {
    // Idempotent: a retry after a crash must reuse the already-created year.
    const existing: DbResult = await supa.from("school_years").select("id").eq("name", params.newYear.name).limit(1);
    if (existing.error) throw new Error(`school_year lookup failed: ${existing.error.message}`);
    const found = (Array.isArray(existing.data) ? existing.data : []) as any[];
    if (found.length > 0) {
      toYearId = found[0].id as string;
    } else {
      const created = await insertReturning(supa, "school_years", {
        name: params.newYear.name,
        is_active: false,
        ...(params.newYear.start_date ? { start_date: params.newYear.start_date } : {}),
        ...(params.newYear.end_date ? { end_date: params.newYear.end_date } : {}),
      });
      toYearId = created[0].id as string;
    }
  }
  if (!toYearId) {
    throw new RolloverError("validation_failed", "Target school year could not be resolved.", 1);
  }
  const terms = await selectWhere(supa, "terms", "id,year_id,start_date", "year_id", [toYearId]);
  const sorted = (terms as any[]).sort((a, b) => String(a.start_date ?? "").localeCompare(String(b.start_date ?? "")));
  return { fromYearId, toYearId, toTermId: sorted.length > 0 ? sorted[0].id : null };
}

async function loadConcludingClasses(
  supa: SupaClient,
  fromYearId: string,
  classIds: string[]
): Promise<any[]> {
  const terms = await selectWhere(supa, "terms", "id", "year_id", [fromYearId]);
  const termIds = (terms as any[]).map((t) => t.id);
  const all = await selectAll(supa, "classes", "id,name,grade_level,term_id,is_archived");
  return (all as any[]).filter((c) => {
    if (c.is_archived) return false;
    if (classIds.length > 0) return classIds.includes(c.id);
    if (!c.term_id) return false;
    return termIds.includes(c.term_id);
  });
}

interface ExecuteSnapshot extends RolloverSnapshot {
  undo_until: string;
}

async function runSnapshotStep(
  supa: SupaClient,
  job: JobRecord,
  params: RolloverParams,
  years: YearContext,
  gradeMap: GradeMapping[]
): Promise<ExecuteSnapshot> {
  const classes = await loadConcludingClasses(supa, years.fromYearId, params.classIds ?? []);
  if (classes.length === 0) {
    throw new RolloverError(
      "validation_failed",
      "No concluding classes found for this school year (or the given class_ids).",
      1
    );
  }
  const classIds = classes.map((c) => c.id);
  const [enrollRows, teacherRows, linkRows] = await Promise.all([
    selectWhere(supa, "class_enrollments", "class_id,student_id,status", "class_id", classIds),
    selectWhere(supa, "class_teachers", "class_id,teacher_id,is_primary", "class_id", classIds),
    selectWhere(supa, "class_courses", "class_id,course_id,is_active", "class_id", classIds),
  ]);
  const studentIds = [...new Set((enrollRows as any[]).map((e) => e.student_id))];
  const statusRows = await selectWhere(supa, "profiles", "id,status", "id", studentIds);
  const undoMs = (params.undoHours ?? UNDO_WINDOW_MS / 3600000) * 3600000;
  return {
    from_year_id: years.fromYearId,
    to_year_id: years.toYearId,
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      grade_level: c.grade_level ?? "",
      term_id: c.term_id ?? null,
      is_archived: !!c.is_archived,
    })),
    enrollments: (enrollRows as any[]).map((e) => ({
      class_id: e.class_id,
      student_id: e.student_id,
      status: e.status ?? "active",
    })),
    teachers: (teacherRows as any[]).map((t) => ({
      class_id: t.class_id,
      teacher_id: t.teacher_id,
      is_primary: !!t.is_primary,
    })),
    courseLinks: (linkRows as any[]).map((l) => ({
      class_id: l.class_id,
      course_id: l.course_id,
      is_active: l.is_active !== false,
    })),
    profileStatuses: (statusRows as any[]).map((p) => ({ profile_id: p.id, before: p.status ?? "active" })),
    classMap: classes.map((c) => {
      const gm = gradeMap.find((g) => g.from === (c.grade_level ?? ""));
      return {
        old_class_id: c.id,
        new_class_id: null,
        grade_from: c.grade_level ?? "",
        grade_to: gm ? gm.to : "",
      };
    }),
    repeatClasses: [],
    repeatTeachers: [],
    retainedMoves: [],
    undo_until: new Date(Date.now() + undoMs).toISOString(),
  };
}

async function runArchiveStep(
  supa: SupaClient,
  snapshot: ExecuteSnapshot,
  completed: Set<string>
): Promise<number> {
  let archived = 0;
  for (const cls of snapshot.classes) {
    if (completed.has(cls.id)) {
      archived++;
      continue;
    }
    const res: DbResult = await supa.from("classes").update({ is_archived: true }).eq("id", cls.id);
    if (res.error) throw new Error(`archive class ${cls.id} failed: ${res.error.message}`);
    // Archive (never delete) the concluding enrollments; before-images are in the snapshot.
    const enr = await supa.from("class_enrollments").update({ status: "archived" }).eq("class_id", cls.id);
    if (enr.error) throw new Error(`archive enrollments of ${cls.id} failed: ${enr.error.message}`);
    completed.add(cls.id);
    archived++;
  }
  return archived;
}

async function runPromoteStep(
  supa: SupaClient,
  job: JobRecord,
  snapshot: ExecuteSnapshot,
  params: RolloverParams,
  years: YearContext,
  completed: Set<string>,
  counts: RolloverCounts,
  save: () => Promise<void>
): Promise<void> {
  const exceptions = new Map((params.exceptions ?? []).map((e) => [e.student_id, e]));
  const planByOld = new Map((params.classPlan ?? []).map((c) => [c.old_class_id, c]));
  const enrollByClass = new Map<string, SnapshotEnrollment[]>();
  for (const e of snapshot.enrollments) {
    const list = enrollByClass.get(e.class_id) ?? [];
    list.push(e);
    enrollByClass.set(e.class_id, list);
  }
  const teachersByClass = new Map<string, SnapshotTeacher[]>();
  for (const t of snapshot.teachers) {
    const list = teachersByClass.get(t.class_id) ?? [];
    list.push(t);
    teachersByClass.set(t.class_id, list);
  }
  const linksByClass = new Map<string, SnapshotCourseLink[]>();
  for (const l of snapshot.courseLinks) {
    const list = linksByClass.get(l.class_id) ?? [];
    list.push(l);
    linksByClass.set(l.class_id, list);
  }
  // Repeat-class cache for retained students (one per grade), reseeded from
  // the snapshot so a resume never creates a second "{grade} Repeat" class.
  const repeatClasses = new Map<string, string>();
  if (snapshot.repeatClasses.length > 0) {
    const rows = await selectWhere(supa, "classes", "id,grade_level", "id", snapshot.repeatClasses);
    for (const r of rows as any[]) repeatClasses.set(r.grade_level ?? "", r.id);
  }

  /** Idempotent enrollment: inserts only when the pair is absent. */
  const ensureEnrollment = async (studentId: string, classId: string): Promise<boolean> => {
    const exists: DbResult = await supa
      .from("class_enrollments")
      .select("id")
      .eq("class_id", classId)
      .eq("student_id", studentId)
      .limit(1);
    if (exists.error) throw new Error(`enrollment lookup failed: ${exists.error.message}`);
    if ((Array.isArray(exists.data) ? exists.data : []).length > 0) return false;
    await insertReturning(supa, "class_enrollments", {
      class_id: classId,
      student_id: studentId,
      status: "active",
    });
    return true;
  };

  /** Idempotent repeat-class fetch/create for retained students. */
  const ensureRepeatClass = async (sameGrade: string, teachers: SnapshotTeacher[]): Promise<string> => {
    let repeatId = repeatClasses.get(sameGrade);
    if (!repeatId) {
      const created = await insertReturning(supa, "classes", {
        term_id: years.toTermId,
        name: `${sameGrade} Repeat`,
        grade_level: sameGrade,
        is_archived: false,
      });
      repeatId = created[0].id as string;
      repeatClasses.set(sameGrade, repeatId);
      if (!snapshot.repeatClasses.includes(repeatId)) snapshot.repeatClasses.push(repeatId);
      counts.classes_created++;
      await save();
    }
    // A class must keep at least one teacher: carry the old class's teachers
    // (existence-checked so resumes never violate the PK).
    for (const t of teachers) {
      const exists: DbResult = await supa
        .from("class_teachers")
        .select("class_id")
        .eq("class_id", repeatId)
        .eq("teacher_id", t.teacher_id)
        .limit(1);
      if (exists.error) throw new Error(`teacher lookup failed: ${exists.error.message}`);
      if ((Array.isArray(exists.data) ? exists.data : []).length > 0) continue;
      await insertReturning(supa, "class_teachers", {
        class_id: repeatId,
        teacher_id: t.teacher_id,
        is_primary: t.is_primary,
      });
      counts.teachers_assigned++;
      if (
        !(snapshot.repeatTeachers ?? []).some(
          (r) => r.class_id === repeatId && r.teacher_id === t.teacher_id
        )
      ) {
        (snapshot.repeatTeachers ?? (snapshot.repeatTeachers = [])).push({
          class_id: repeatId,
          teacher_id: t.teacher_id,
          is_primary: t.is_primary,
        });
      }
    }
    return repeatId;
  };

  /** Place a retained student, recording the move for undo + reconciliation. */
  const enrollRetained = async (
    studentId: string,
    sameGrade: string,
    teachers: SnapshotTeacher[]
  ): Promise<void> => {
    const repeatId = await ensureRepeatClass(sameGrade, teachers);
    if (await ensureEnrollment(studentId, repeatId)) counts.enrollments_created++;
    if (
      !snapshot.retainedMoves.some((m) => m.new_class_id === repeatId && m.student_id === studentId)
    ) {
      snapshot.retainedMoves.push({ new_class_id: repeatId, student_id: studentId });
    }
    counts.retained++;
  };

  const total = snapshot.classMap.length;
  let processed = 0;
  for (const entry of snapshot.classMap) {
    const status = (await readJob(supa, job.id)).status;
    if (status === "cancelled") {
      throw new RolloverError("cancelled", "Job was cancelled by the requester.", 3);
    }
    if (completed.has(entry.old_class_id)) {
      processed++;
      continue;
    }
    const oldCls = snapshot.classes.find((c) => c.id === entry.old_class_id)!;
    const plan = planByOld.get(entry.old_class_id);
    const gradeTo = plan?.new_grade || entry.grade_to;

    if (!gradeTo) {
      // No mapping for this grade: leave archived, count as skipped (reported).
      counts.skipped++;
      completed.add(entry.old_class_id);
      processed++;
      await save();
      continue;
    }

    if (isGraduatedTarget(gradeTo)) {
      // Graduate: archive profiles, keep every history row in place.
      // Retained / redirected students are still placed, never graduated.
      // Pre-check statuses so a resume never double-counts.
      const gradIds: string[] = [];
      for (const e of enrollByClass.get(entry.old_class_id) ?? []) {
        const ex = exceptions.get(e.student_id);
        if (ex && ex.action === "retain") {
          await enrollRetained(e.student_id, oldCls.grade_level, teachersByClass.get(entry.old_class_id) ?? []);
          continue;
        }
        if (ex && ex.action === "move" && ex.to_class_id) {
          if (await ensureEnrollment(e.student_id, ex.to_class_id)) counts.enrollments_created++;
          counts.promoted++;
          continue;
        }
        gradIds.push(e.student_id);
      }
      const statusRows = await selectWhere(supa, "profiles", "id,status", "id", gradIds);
      const statusById = new Map((statusRows as any[]).map((r) => [r.id, r.status]));
      for (const sid of gradIds) {
        if (statusById.get(sid) === "archived") continue; // already processed (resume)
        const upd: DbResult = await supa.from("profiles").update({ status: "archived" }).eq("id", sid);
        if (upd.error) throw new Error(`graduate ${sid} failed: ${upd.error.message}`);
        counts.graduated++;
      }
      completed.add(entry.old_class_id);
      processed++;
      await save();
      continue;
    }

    // Ensure the target class exists (idempotent: reuse recorded id).
    let newClassId = entry.new_class_id;
    if (!newClassId) {
      const newName = plan?.new_name || defaultNewClassName(oldCls.name, gradeTo);
      const created = await insertReturning(supa, "classes", {
        term_id: years.toTermId,
        name: newName,
        grade_level: gradeTo,
        is_archived: false,
      });
      newClassId = created[0].id as string;
      entry.new_class_id = newClassId;
      counts.classes_created++;
      await save();
    }
    const targetId = newClassId;

    // Teachers ride along (skip pairs that already exist).
    for (const t of teachersByClass.get(entry.old_class_id) ?? []) {
      const exists: DbResult = await supa
        .from("class_teachers")
        .select("class_id")
        .eq("class_id", targetId)
        .eq("teacher_id", t.teacher_id)
        .limit(1);
      if (exists.error) throw new Error(`teacher lookup failed: ${exists.error.message}`);
      if ((Array.isArray(exists.data) ? exists.data : []).length === 0) {
        await insertReturning(supa, "class_teachers", {
          class_id: targetId,
          teacher_id: t.teacher_id,
          is_primary: t.is_primary,
        });
        counts.teachers_assigned++;
      }
    }
    // Course links ride along.
    for (const l of linksByClass.get(entry.old_class_id) ?? []) {
      const exists: DbResult = await supa
        .from("class_courses")
        .select("class_id")
        .eq("class_id", targetId)
        .eq("course_id", l.course_id)
        .limit(1);
      if (exists.error) throw new Error(`course link lookup failed: ${exists.error.message}`);
      if ((Array.isArray(exists.data) ? exists.data : []).length === 0) {
        await insertReturning(supa, "class_courses", {
          class_id: targetId,
          course_id: l.course_id,
          is_active: l.is_active,
        });
        counts.courses_linked++;
      }
    }

    // Students: promote, retain, redirect, or graduate.
    for (const e of enrollByClass.get(entry.old_class_id) ?? []) {
      const ex = exceptions.get(e.student_id);
      if (ex && ex.action === "graduate") {
        const upd: DbResult = await supa.from("profiles").update({ status: "archived" }).eq("id", e.student_id);
        if (upd.error) throw new Error(`graduate ${e.student_id} failed: ${upd.error.message}`);
        counts.graduated++;
        continue;
      }
      if (ex && ex.action === "retain") {
        await enrollRetained(e.student_id, oldCls.grade_level, teachersByClass.get(entry.old_class_id) ?? []);
        continue;
      }
      const destClassId = ex && ex.action === "move" && ex.to_class_id ? ex.to_class_id : targetId;
      const exists: DbResult = await supa
        .from("class_enrollments")
        .select("id")
        .eq("class_id", destClassId)
        .eq("student_id", e.student_id)
        .limit(1);
      if (exists.error) throw new Error(`enrollment lookup failed: ${exists.error.message}`);
      if ((Array.isArray(exists.data) ? exists.data : []).length === 0) {
        await insertReturning(supa, "class_enrollments", {
          class_id: destClassId,
          student_id: e.student_id,
          status: "active",
        });
        counts.enrollments_created++;
      }
      counts.promoted++;
    }

    completed.add(entry.old_class_id);
    processed++;
    await save();
    await writeStep(
      supa,
      job.id,
      3,
      "promote",
      "running",
      Math.min(74, 40 + Math.round((processed / Math.max(1, total)) * 35)),
      `Promoted ${processed}/${total} classes`
    );
  }
}

export interface RolloverPartial {
  snapshot?: ExecuteSnapshot;
  counts?: RolloverCounts;
  archivedClasses?: string[];
  completedClasses?: string[];
  undoneClasses?: string[];
  conflicts?: string[];
}

// -------------------------------------------------------------------
// Undo path
// -------------------------------------------------------------------

async function runUndo(
  supa: SupaClient,
  job: JobRecord,
  runJobId: string,
  partial: RolloverPartial
): Promise<Record<string, unknown>> {
  const source = await readJob(supa, runJobId);
  if (source.kind !== ROLLOVER_KIND) {
    throw new RolloverError("validation_failed", `Job ${runJobId} is not a rollover job.`, 1);
  }
  if (source.status !== "completed") {
    throw new RolloverError(
      "validation_failed",
      `Job ${runJobId} is not completed (status=${source.status}); only completed rollovers can be undone.`,
      1
    );
  }
  const snapshot = (source.result_payload?.["snapshot"] ?? readPartial(source.result_payload).snapshot) as
    | ExecuteSnapshot
    | undefined;
  if (!snapshot || !Array.isArray(snapshot.classMap)) {
    throw new RolloverError("validation_failed", `Job ${runJobId} carries no rollover snapshot.`, 1);
  }
  if (Date.now() > Date.parse(snapshot.undo_until)) {
    throw new RolloverError(
      "validation_failed",
      `Undo window closed at ${snapshot.undo_until}; restore from backup instead (11-OPERATIONS).`,
      1
    );
  }
  await writeStep(supa, job.id, 1, "verify", "completed", 20, `Snapshot loaded (${snapshot.classes.length} classes)`);

  const undone = new Set(partial.undoneClasses ?? []);
  const conflicts: string[] = [...(partial.conflicts ?? [])];

  const total = snapshot.classMap.length;
  let processed = 0;
  for (const entry of snapshot.classMap) {
    const status = (await readJob(supa, job.id)).status;
    if (status === "cancelled") {
      throw new RolloverError("cancelled", "Job was cancelled by the requester.", 2);
    }
    if (undone.has(entry.old_class_id)) {
      processed++;
      continue;
    }
    // New-class enrollments NOT in the snapshot moved set = post-rollover
    // activity: never delete that class, report the conflict instead.
    if (entry.new_class_id) {
      const current: DbResult = await supa
        .from("class_enrollments")
        .select("student_id")
        .eq("class_id", entry.new_class_id);
      if (current.error) throw new Error(`enrollment scan failed: ${current.error.message}`);
      const currentIds = new Set(
        ((Array.isArray(current.data) ? current.data : []) as any[]).map((r) => r.student_id)
      );
      const snapshotIds = new Set(
        snapshot.enrollments
          .filter((e) => e.class_id === entry.old_class_id)
          .map((e) => e.student_id)
      );
      const extras = [...currentIds].filter((id) => !snapshotIds.has(id));
      if (extras.length > 0) {
        conflicts.push(
          `Class ${entry.new_class_id}: ${extras.length} post-rollover enrollment(s) found; class kept as-is.`
        );
      } else {
        const del: DbResult = await supa.from("classes").delete().eq("id", entry.new_class_id);
        if (del.error) throw new Error(`delete class ${entry.new_class_id} failed: ${del.error.message}`);
        // Enrollments, teacher links and course links cascade from classes.
      }
    }
    // Un-archive the concluding class.
    const unarch: DbResult = await supa.from("classes").update({ is_archived: false }).eq("id", entry.old_class_id);
    if (unarch.error) throw new Error(`un-archive ${entry.old_class_id} failed: ${unarch.error.message}`);
    // Restore concluding enrollment statuses from before-images.
    for (const e of snapshot.enrollments.filter((x) => x.class_id === entry.old_class_id)) {
      const upd: DbResult = await supa
        .from("class_enrollments")
        .update({ status: e.status })
        .eq("class_id", e.class_id)
        .eq("student_id", e.student_id);
      if (upd.error) throw new Error(`restore enrollment failed: ${upd.error.message}`);
    }
    undone.add(entry.old_class_id);
    processed++;
    await writeStep(
      supa,
      job.id,
      2,
      "restore",
      "running",
      Math.min(69, 20 + Math.round((processed / Math.max(1, total)) * 50)),
      `Restored ${processed}/${total} classes`
    );
  }
  // Restore repeat classes created for retained students (same conflict rule).
  const retainedByRepeat = new Map<string, Set<string>>();
  for (const m of snapshot.retainedMoves) {
    const set = retainedByRepeat.get(m.new_class_id) ?? new Set<string>();
    set.add(m.student_id);
    retainedByRepeat.set(m.new_class_id, set);
  }
  for (const repeatId of snapshot.repeatClasses) {
    if (undone.has(`repeat:${repeatId}`)) continue;
    const current: DbResult = await supa
      .from("class_enrollments")
      .select("student_id")
      .eq("class_id", repeatId);
    if (current.error) throw new Error(`enrollment scan failed: ${current.error.message}`);
    const currentIds = new Set(
      ((Array.isArray(current.data) ? current.data : []) as any[]).map((r) => r.student_id)
    );
    const expected = retainedByRepeat.get(repeatId) ?? new Set<string>();
    const extras = [...currentIds].filter((id) => !expected.has(id));
    if (extras.length > 0) {
      conflicts.push(
        `Repeat class ${repeatId}: ${extras.length} post-rollover enrollment(s) found; class kept as-is.`
      );
    } else {
      const del: DbResult = await supa.from("classes").delete().eq("id", repeatId);
      if (del.error) throw new Error(`delete repeat class ${repeatId} failed: ${del.error.message}`);
      // Teacher links cascade from classes.
    }
    undone.add(`repeat:${repeatId}`);
  }
  // Restore graduated profile statuses.
  for (const p of snapshot.profileStatuses) {
    if (p.before === "archived") continue;
    const cur: DbResult = await supa.from("profiles").select("status").eq("id", p.profile_id).single();
    if (!cur.error && (cur.data as any)?.status === "archived") {
      const upd: DbResult = await supa.from("profiles").update({ status: p.before }).eq("id", p.profile_id);
      if (upd.error) throw new Error(`restore profile ${p.profile_id} failed: ${upd.error.message}`);
    }
  }

  const restoredClasses = [...undone].filter((id) => !id.startsWith("repeat:")).length;
  const result = {
    undone_classes: restoredClasses,
    undone_repeat_classes: undone.size - restoredClasses,
    restored_enrollments: snapshot.enrollments.length,
    restored_profiles: snapshot.profileStatuses.filter((p) => p.before !== "archived").length,
    conflicts,
    run_job_id: runJobId,
  };
  const now = new Date().toISOString();
  await touchJob(supa, job.id, { status: "completed", result_payload: result, completed_at: now });
  await writeStep(supa, job.id, 2, "restore", "completed", 70, `Restored ${restoredClasses} classes`);
  await writeAudit(supa, job.initiator_id, "rollover.undo", `Rollover undo of job ${runJobId}: ${restoredClasses} classes restored, ${conflicts.length} conflicts.`, {
    ...result,
  });
  await notifyUser(
    supa,
    job.initiator_id,
    "rollover_undone",
    "Year rollover was undone",
    `${restoredClasses} classes restored from the pre-rollover snapshot.${conflicts.length > 0 ? ` ${conflicts.length} conflict(s) need review.` : ""}`,
    { job_id: job.id, run_job_id: runJobId },
    "/admin/classes"
  );
  return result;
}

function readPartial(resultPayload: Record<string, unknown> | null | undefined): RolloverPartial {
  const p = resultPayload?.["partial"];
  if (p !== null && typeof p === "object" && !Array.isArray(p)) return p as RolloverPartial;
  return {};
}

/**
 * Recompute exact counts from the database + snapshot at finalize time, so a
 * crash-resume can never inflate the reported numbers (accumulators are only
 * used for progress logs mid-run).
 */
async function reconcileCounts(supa: SupaClient, snapshot: ExecuteSnapshot): Promise<RolloverCounts> {
  const counts = emptyCounts();
  counts.classes_archived = snapshot.classes.length;
  counts.skipped = snapshot.classMap.filter((e) => !e.grade_to).length;

  const newClassIds = snapshot.classMap.map((e) => e.new_class_id).filter((id): id is string => !!id);
  const allTargetIds = [...new Set([...newClassIds, ...snapshot.repeatClasses])];
  const movedByOld = new Map<string, Set<string>>();
  for (const e of snapshot.enrollments) {
    const set = movedByOld.get(e.class_id) ?? new Set<string>();
    set.add(e.student_id);
    movedByOld.set(e.class_id, set);
  }
  if (allTargetIds.length > 0) {
    const enrRows = await selectWhere(supa, "class_enrollments", "class_id,student_id", "class_id", allTargetIds);
    const retainedSet = new Set(snapshot.retainedMoves.map((m) => `${m.new_class_id}::${m.student_id}`));
    for (const r of enrRows as any[]) {
      const key = `${r.class_id}::${r.student_id}`;
      if (retainedSet.has(key)) {
        counts.retained++;
        counts.enrollments_created++;
        continue;
      }
      const entry = snapshot.classMap.find((e) => e.new_class_id === r.class_id);
      if (entry && (movedByOld.get(entry.old_class_id) ?? new Set()).has(r.student_id)) {
        counts.promoted++;
        counts.enrollments_created++;
      }
    }
    const teacherRows = await selectWhere(supa, "class_teachers", "class_id,teacher_id", "class_id", allTargetIds);
    const snapshotTeachers = new Set(snapshot.teachers.map((t) => `${t.class_id}::${t.teacher_id}`));
    const repeatTeacherSet = new Set(
      (snapshot.repeatTeachers ?? []).map((t) => `${t.class_id}::${t.teacher_id}`)
    );
    const oldByNew = new Map(snapshot.classMap.filter((e) => e.new_class_id).map((e) => [e.new_class_id as string, e.old_class_id]));
    for (const r of teacherRows as any[]) {
      const key = `${r.class_id}::${r.teacher_id}`;
      if (repeatTeacherSet.has(key)) {
        counts.teachers_assigned++;
        continue;
      }
      const oldId = oldByNew.get(r.class_id);
      if (oldId && snapshotTeachers.has(`${oldId}::${r.teacher_id}`)) counts.teachers_assigned++;
    }
    const linkRows = await selectWhere(supa, "class_courses", "class_id,course_id", "class_id", allTargetIds);
    const snapshotLinks = new Set(snapshot.courseLinks.map((l) => `${l.class_id}::${l.course_id}`));
    for (const r of linkRows as any[]) {
      const oldId = oldByNew.get(r.class_id);
      if (oldId && snapshotLinks.has(`${oldId}::${r.course_id}`)) counts.courses_linked++;
    }
  }
  counts.classes_created = newClassIds.length + snapshot.repeatClasses.length;
  const profileIds = snapshot.profileStatuses.filter((p) => p.before !== "archived").map((p) => p.profile_id);
  if (profileIds.length > 0) {
    const profRows = await selectWhere(supa, "profiles", "id,status", "id", profileIds);
    for (const r of profRows as any[]) {
      if (r.status === "archived") counts.graduated++;
    }
  }
  return counts;
}

async function writePartial(supa: SupaClient, jobId: string, partial: RolloverPartial): Promise<void> {
  const current = await readJob(supa, jobId);
  await touchJob(supa, jobId, {
    result_payload: { ...(current.result_payload ?? {}), partial: { ...partial } },
  });
}

// -------------------------------------------------------------------
// Main handler
// -------------------------------------------------------------------

export async function handleYearRollover(job: JobRecord, supa: SupaClient): Promise<HandlerResult> {
  if (job.kind !== ROLLOVER_KIND) {
    throw new RolloverError("validation_failed", `handleYearRollover cannot process kind="${job.kind}".`);
  }

  const fresh = await readJob(supa, job.id);
  if (fresh.status === "completed") {
    return { progress_percent: 100, finishAfterStep: true, result_payload: fresh.result_payload ?? {} };
  }
  if (fresh.status === "cancelled") {
    return { progress_percent: 0, finishAfterStep: true };
  }
  const current: JobRecord = { ...job, ...fresh };
  let partial = readPartial(current.result_payload);

  try {
    const params = parseRolloverParams(current.input_params);

    if (params.mode === "undo") {
      const steps = ROLLOVER_UNDO_STEPS;
      await writeStep(supa, current.id, 1, steps[0].name, "running", steps[0].progress, "Verifying undo window");
      const result = await runUndo(supa, current, params.runJobId!, partial);
      await writeStep(supa, current.id, 3, steps[2].name, "completed", 100, "Rollover undone");
      return { progress_percent: 100, finishAfterStep: true, result_payload: result };
    }

    const steps = ROLLOVER_EXEC_STEPS;
    const stepOf = (index: number) => steps.find((s) => s.index === index)!;
    await requireSuperAdmin(supa, current.initiator_id);
    await touchJob(supa, current.id, { started_at: new Date().toISOString() });
    const done = await readCompletedSteps(supa, current.id);

    // --- Step 1: authorize + snapshot (20%) ---
    let snapshot = partial.snapshot;
    if (!done.has(1) || !snapshot) {
      await writeStep(supa, current.id, 1, stepOf(1).name, "running", 20, "Capturing pre-rollover snapshot");
      const years = await resolveYears(supa, params);
      const gradeLevels = (await loadConcludingClasses(supa, years.fromYearId, params.classIds ?? [])).map(
        (c) => c.grade_level ?? ""
      );
      const gradeMap = params.gradeMap ?? defaultGradeMap(gradeLevels);
      snapshot = await runSnapshotStep(supa, current, params, years, gradeMap);
      (snapshot as ExecuteSnapshot).to_year_id = years.toYearId;
      partial = { ...readPartial((await readJob(supa, current.id)).result_payload), snapshot };
      await writePartial(supa, current.id, partial);
      await writeStep(
        supa,
        current.id,
        1,
        stepOf(1).name,
        "completed",
        20,
        `Snapshot: ${snapshot.classes.length} classes, ${snapshot.enrollments.length} enrollments`
      );
    }
    const snap = snapshot;
    const years: { fromYearId: string; toYearId: string; toTermId: string | null } = {
      fromYearId: snap.from_year_id,
      toYearId: snap.to_year_id,
      toTermId: null,
    };
    if (!years.toTermId) {
      const terms = await selectWhere(supa, "terms", "id,year_id,start_date", "year_id", [snap.to_year_id]);
      const sorted = (terms as any[]).sort((a, b) => String(a.start_date ?? "").localeCompare(String(b.start_date ?? "")));
      years.toTermId = sorted.length > 0 ? sorted[0].id : null;
    }

    // --- Step 2: archive (40%) ---
    const archivedSet = new Set(partial.archivedClasses ?? []);
    if (!done.has(2) || archivedSet.size < snap.classes.length) {
      await writeStep(supa, current.id, 2, stepOf(2).name, "running", 40, "Archiving concluding classes");
      const archived = await runArchiveStep(supa, snap, archivedSet);
      partial = {
        ...readPartial((await readJob(supa, current.id)).result_payload),
        snapshot: snap,
        archivedClasses: [...archivedSet],
      };
      await writePartial(supa, current.id, partial);
      await writeStep(supa, current.id, 2, stepOf(2).name, "completed", 40, `${archived} classes archived`);
    }

    // --- Step 3: promote (75%) ---
    const completedSet = new Set(partial.completedClasses ?? []);
    // Reconcile: entries that already recorded a new class id count as completed.
    for (const entry of snap.classMap) {
      if (entry.new_class_id) completedSet.add(entry.old_class_id);
    }
    let counts: RolloverCounts = partial.counts ?? emptyCounts();
    if (!done.has(3) || completedSet.size < snap.classMap.length) {
      await writeStep(supa, current.id, 3, stepOf(3).name, "running", 40, "Creating next-year classes");
      // Snapshot object is mutated with created ids for resume continuity,
      // persisted per class inside runPromoteStep via save().
      await runPromoteStep(supa, current, snap, params, years, completedSet, counts, async () => {
        const p = readPartial((await readJob(supa, current.id)).result_payload);
        p.snapshot = snap;
        p.counts = { ...counts };
        p.archivedClasses = [...archivedSet];
        p.completedClasses = [...completedSet];
        await writePartial(supa, current.id, p);
      });
      counts.classes_archived = snap.classes.length;
      partial = {
        ...readPartial((await readJob(supa, current.id)).result_payload),
        snapshot: snap,
        counts: { ...counts },
        archivedClasses: [...archivedSet],
        completedClasses: [...completedSet],
      };
      await writePartial(supa, current.id, partial);
      await writeStep(
        supa,
        current.id,
        3,
        stepOf(3).name,
        "completed",
        75,
        `${counts.promoted} promoted, ${counts.graduated} graduated`
      );
    } else {
      counts = partial.counts ?? counts;
    }

    // --- Step 4: finalize (100%) ---
    // Exact counts reconciled from the database: accumulator drift from a
    // crash-resume can never leak into the reported result.
    await writeStep(supa, current.id, 4, stepOf(4).name, "running", 90, "Reconciling counts");
    counts = await reconcileCounts(supa, snap);
    await writeStep(supa, current.id, 4, stepOf(4).name, "running", 92, "Writing audit entry");
    const resultPayload: Record<string, unknown> = {
      counts: { ...counts },
      undo_until: snap.undo_until,
      to_year_id: snap.to_year_id,
      from_year_id: snap.from_year_id,
      snapshot: snap,
    };
    const now = new Date().toISOString();
    await touchJob(supa, current.id, {
      status: "completed",
      result_payload: resultPayload,
      completed_at: now,
    });
    await writeStep(supa, current.id, 4, stepOf(4).name, "completed", 100, "Rollover finalized");
    await writeAudit(
      supa,
      current.initiator_id,
      "rollover.execute",
      `Year rollover ${snap.from_year_id} -> ${snap.to_year_id}: ${counts.promoted} promoted, ${counts.retained} retained, ${counts.graduated} graduated, ${counts.classes_created} classes created, ${counts.classes_archived} archived.`,
      { counts: { ...counts }, undo_until: snap.undo_until, to_year_id: snap.to_year_id }
    );

    // Notify affected teachers + the initiator (best-effort).
    const teacherIds = [...new Set(snap.teachers.map((t) => t.teacher_id))];
    for (const tid of teacherIds) {
      await notifyUser(
        supa,
        tid,
        "rollover_completed",
        "New school year classes are ready",
        "Your classes were rolled over to the new school year. Review your rosters.",
        { job_id: current.id, to_year_id: snap.to_year_id }
      );
    }
    await notifyUser(
      supa,
      current.initiator_id,
      "rollover_completed",
      "Year rollover finished",
      `${counts.promoted} promoted, ${counts.graduated} graduated. Undo available until ${snap.undo_until}.`,
      { job_id: current.id, counts: { ...counts } },
      "/admin/classes"
    );

    return { progress_percent: 100, finishAfterStep: true, result_payload: resultPayload };
  } catch (err) {
    if (err instanceof RolloverError && err.code === "cancelled") {
      return { progress_percent: 0, finishAfterStep: true };
    }
    const code = err instanceof RolloverError ? err.code : "provider_error";
    const stepIndex = err instanceof RolloverError ? err.stepIndex : undefined;
    const isUndo = current.input_params["mode"] === "undo";
    const stepNames = isUndo
      ? ["verify", "restore", "finalize"]
      : ["snapshot", "archive", "promote", "finalize"];
    const stepName =
      stepIndex !== undefined ? (stepNames[stepIndex - 1] ?? "promote") : "promote";
    const message = err instanceof Error ? err.message : "Year rollover failed.";
    console.warn(`[year-rollover] job ${current.id} failed at step "${stepName}": ${message}`);
    return await failJob(supa, current.id, stepIndex, stepName, code, message);
  }
}

// -------------------------------------------------------------------
// Self-registration (guarded: the runner may also wire this explicitly).
// -------------------------------------------------------------------

void (async () => {
  try {
    const registry = await import("./registry");
    const register = (registry as { registerHandler?: unknown }).registerHandler;
    if (typeof register === "function") {
      (register as (kind: string, handler: typeof handleYearRollover) => void)(
        ROLLOVER_KIND,
        handleYearRollover
      );
    }
  } catch (err) {
    console.warn(
      `[year-rollover] self-registration skipped (wire handleYearRollover in job-runner/index.ts): ${
        err instanceof Error ? err.message : err
      }`
    );
  }
})();
