/**
 * handlers/csv-import.ts
 *
 * BE-EDGE-13: `import_users` background job handler for the job-runner Edge Function.
 *
 * Validates uploaded roster CSVs (AD-05 wizard input), resolves schema conflicts,
 * and bulk-creates student / teacher accounts plus class enrollments.
 *
 * Four steps with live `job_steps` progress (07-AI-SYSTEM section 9):
 *   1. Parse CSV (RFC-4180, BOM/CRLF tolerant) ................ 20%
 *   2. Validate rows (exact row + column error pins) .......... 50%
 *   3. Commit in batches of 100 .............................. 90%
 *   4. Credentials file, error report, audit, notify ......... 100%
 *
 * Table mapping (actual migrations, NOT the idealized backend/docs superset):
 *   - accounts      -> auth.users (via service-role auth.admin API) + profiles
 *                       (profiles has ONLY id/username/display_name/role/status/
 *                       avatar_url/equipped_theme/must_change_password — there are
 *                       no grade/email/name/code columns yet, so grade and email
 *                       are validated and used for class matching / dedupe but
 *                       only username/display_name/role/status are persisted;
 *                       grade + email ride along in the credentials sheet)
 *   - enrollments   -> class_enrollments (students) / class_teachers (teachers)
 *   - row states    -> jobs.result_payload.partial (no import_rows table exists
 *                       in migrations and creating one is outside this task's
 *                       file ownership)
 *   - credentials   -> private `imports` bucket, `credentials/{job_id}.csv`,
 *                       short expiry, returned once via credentials_asset_id
 *   - error report  -> private `imports` bucket, `error-reports/{job_id}.csv`
 *   - audit         -> audit_log (action users.import, action_type imports)
 *   - notify        -> notifications
 *
 * Identity rules (04-AUTH-AND-ACCESS):
 *   - username: lowercase, 3-32 chars of a-z 0-9 . _ -, unique (citext), immutable
 *   - auth email is synthetic: {username}@accounts.invalid, email_confirm=true
 *   - temp password: 10 chars from an unambiguous alphabet (upper+lower+digit),
 *     must_change_password=true, returned ONCE via the credentials file
 *
 * Transactional consistency: thousands of Auth+DB writes cannot run in one DB
 * transaction. Instead the handler is IDEMPOTENT and resumable:
 *   - completed row ranges (by row_no) are recorded in result_payload.partial
 *     and never re-processed; a retry continues with the next batch;
 *   - each created user is tracked; a per-user failure rolls back that user
 *     (profiles delete cascades; auth.admin.deleteUser best-effort);
 *   - a fatal job failure leaves already-committed valid rows in place (they
 *     are reported as created) and marks remaining rows failed — valid rows
 *     are never silently dropped (AD-05: "rows with errors are excluded and
 *     listed; valid rows are imported").
 *
 * WIRING NOTE (for the BE-EDGE-11 owner — outside this task's file ownership):
 * job-runner/index.ts and handlers/registry.ts hold `import_users` stubs that
 * never import this module. To activate, add a side-effect import in index.ts:
 *     import "./handlers/csv-import.ts";
 * (which triggers the guarded self-registration below).
 */

// -------------------------------------------------------------------
// Constants
// -------------------------------------------------------------------

/** Job kind this handler serves (matches jobs.kind check constraint). */
export const IMPORT_USERS_KIND = "import_users";

/** Step definitions: index (1-based; 0 is the runner's "started" sentinel). */
export const CSV_IMPORT_STEPS = [
  { index: 1, name: "parse", progress: 20 },
  { index: 2, name: "validate", progress: 50 },
  { index: 3, name: "commit", progress: 90 },
  { index: 4, name: "finalize", progress: 100 },
] as const;

/** AD-05 upload limit. */
export const MAX_IMPORT_ROWS = 2000;
/** Conflict Prevention: chunk inserts in batches of 100. */
export const COMMIT_BATCH_SIZE = 100;
/** Chunk size for bulk `IN` lookups. */
export const LOOKUP_CHUNK_SIZE = 200;
/** Page size for the one auth-user sweep per job. */
export const AUTH_SWEEP_PAGE_SIZE = 200;

/** Username rule (04-AUTH-AND-ACCESS section 1, SHARED-SPEC). */
export const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;
/** Unambiguous alphabet: no 0/O, 1/I/l (04-AUTH section 3.2). */
export const TEMP_PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
export const TEMP_PASSWORD_LENGTH = 10;

export const IMPORT_BUCKET = "imports";
export const CREDENTIALS_PREFIX = "credentials";
export const ERROR_REPORT_PREFIX = "error-reports";

/** Canonical platform fields addressable through the column mapping. */
export const IMPORT_FIELDS = [
  "username",
  "first_name",
  "last_name",
  "display_name",
  "email",
  "grade",
  "class_name",
  "class_id",
  "student_code",
  "employee_code",
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];
export type ImportType = "students" | "teachers" | "enrollments";
export type DuplicatesPolicy = "skip" | "update";
export type RowStatus = "ok" | "warning" | "error" | "excluded" | "imported" | "failed";

// -------------------------------------------------------------------
// Minimal Supabase client surface (structural; the runner injects a
// service-role client so RLS never blocks job writes, storage and the
// Auth admin API are reachable).
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

export interface AuthAdminUser {
  id: string;
  email?: string;
}

export interface AuthAdmin {
  createUser(params: {
    email: string;
    password: string;
    email_confirm: boolean;
    user_metadata?: Record<string, unknown>;
  }): Promise<{ data: { user: AuthAdminUser | null }; error: { message: string } | null }>;
  deleteUser(id: string): Promise<{ data: unknown; error: { message: string } | null }>;
  listUsers(params: { page: number; perPage: number }): Promise<{
    data: { users: AuthAdminUser[] };
    error: { message: string } | null;
  }>;
}

export interface StorageBucket {
  upload(
    path: string,
    body: string | Uint8Array,
    options?: Record<string, unknown>
  ): Promise<{ data: { path: string } | null; error: { message: string } | null }>;
}

export interface SupaClient {
  from(table: string): DbTable;
  auth: { admin: AuthAdmin };
  storage: { from(bucket: string): StorageBucket };
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

export class CsvImportError extends Error {
  readonly code: string;
  readonly stepIndex?: number;
  constructor(code: string, message: string, stepIndex?: number) {
    super(message);
    this.name = "CsvImportError";
    this.code = code;
    this.stepIndex = stepIndex;
  }
}

// -------------------------------------------------------------------
// Wizard input (AD-05 steps 1-2 output + AD-05 step 4 review choices)
// -------------------------------------------------------------------

export interface ImportParams {
  importType: ImportType;
  csvText: string;
  mapping: Record<string, string>;
  duplicates: DuplicatesPolicy;
  classId?: string;
  excludedRows?: number[];
}

export function parseImportParams(input: Record<string, unknown>): ImportParams {
  const rawType = typeof input["import_type"] === "string" ? input["import_type"] : input["importType"];
  if (rawType !== "students" && rawType !== "teachers" && rawType !== "enrollments") {
    throw new CsvImportError(
      "validation_failed",
      "Import type is required: `import_type` must be students, teachers or enrollments."
    );
  }
  const csvText =
    typeof input["csv_text"] === "string"
      ? input["csv_text"]
      : typeof input["csvText"] === "string"
        ? input["csvText"]
        : "";
  if (!csvText.trim()) {
    throw new CsvImportError(
      "validation_failed",
      "CSV content is missing: provide `csv_text` in jobs.input_params."
    );
  }
  const rawMapping = input["mapping"];
  if (rawMapping === null || typeof rawMapping !== "object" || Array.isArray(rawMapping)) {
    throw new CsvImportError(
      "validation_failed",
      "Column mapping is missing: provide `mapping` (CSV header -> platform field) in jobs.input_params."
    );
  }
  const mapping: Record<string, string> = {};
  for (const [header, field] of Object.entries(rawMapping as Record<string, unknown>)) {
    if (typeof field !== "string") continue;
    const f = field.trim();
    if (!(IMPORT_FIELDS as readonly string[]).includes(f)) {
      throw new CsvImportError(
        "validation_failed",
        `Unknown mapped field "${f}" for column "${header}". Allowed: ${IMPORT_FIELDS.join(", ")}.`
      );
    }
    mapping[header] = f;
  }
  if (Object.keys(mapping).length === 0) {
    throw new CsvImportError("validation_failed", "Column mapping is empty: map at least one CSV column.");
  }
  const rawDup = input["duplicates"];
  const duplicates: DuplicatesPolicy = rawDup === "update" ? "update" : "skip";
  const classId =
    typeof input["class_id"] === "string" && input["class_id"].trim()
      ? input["class_id"].trim()
      : undefined;
  const excludedRows = Array.isArray(input["excluded_rows"])
    ? (input["excluded_rows"] as unknown[])
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n > 0)
    : Array.isArray(input["excludedRows"])
      ? (input["excludedRows"] as unknown[])
          .map((n) => Number(n))
          .filter((n) => Number.isInteger(n) && n > 0)
      : [];
  return { importType: rawType, csvText, mapping, duplicates, classId, excludedRows };
}

// -------------------------------------------------------------------
// Pure helpers (exported for unit tests)
// -------------------------------------------------------------------

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  /** Physical 1-based CSV line number where each record starts (header = 1). */
  lineNumbers: number[];
}

/** Minimal RFC-4180 parser: quoted fields, "" escapes, CRLF, embedded newlines. */
export function parseCsv(text: string): ParsedCsv {
  const src = text.replace(/^\uFEFF/, "");
  const headers: string[] = [];
  const rows: string[][] = [];
  const lineNumbers: number[] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  let line = 1;
  let recordStartLine = 1;
  let hasContent = false;

  const endField = (): void => {
    record.push(field);
    field = "";
  };
  const endRecord = (): void => {
    endField();
    if (record.length === 1 && record[0].trim() === "") {
      record = [];
      recordStartLine = line;
      return;
    }
    hasContent = true;
    if (headers.length === 0) {
      headers.push(...record.map((h) => h.trim()));
    } else {
      rows.push(record);
      lineNumbers.push(recordStartLine);
    }
    record = [];
    recordStartLine = line;
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === "\n") line++;
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      if (field === "") {
        inQuotes = true;
      } else {
        throw new CsvImportError(
          "validation_failed",
          `Malformed CSV on line ${line}: unexpected quote inside unquoted field.`
        );
      }
    } else if (ch === ",") {
      endField();
    } else if (ch === "\r") {
      if (src[i + 1] === "\n") i++;
      line++;
      endRecord();
    } else if (ch === "\n") {
      line++;
      endRecord();
    } else {
      field += ch;
    }
  }
  if (inQuotes) {
    throw new CsvImportError("validation_failed", "Malformed CSV: unterminated quoted field.");
  }
  if (field !== "" || record.length > 0) endRecord();
  if (!hasContent || headers.length === 0) {
    throw new CsvImportError("validation_failed", "CSV has no header row.");
  }
  return { headers, rows, lineNumbers };
}

/** Normalize a raw username cell: trim + lowercase (warn when it changes input). */
export function normalizeUsername(raw: string): { username: string; changed: boolean } {
  const trimmed = raw.trim();
  const lowered = trimmed.toLowerCase();
  return { username: lowered, changed: lowered !== raw };
}

export function isValidUsername(username: string): boolean {
  return USERNAME_RE.test(username);
}

export function isValidEmail(email: string): boolean {
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email.trim());
}

export function parseGrade(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isInteger(n)) return null;
  return n;
}

/** Compose display_name per 02-DATA-MODEL-CORE ("first name plus initial"). */
export function composeDisplayName(
  firstName: string,
  lastName: string,
  explicit: string,
  username: string
): string {
  if (explicit.trim()) return explicit.trim();
  const f = firstName.trim();
  const l = lastName.trim();
  if (f && l) return `${f} ${l.charAt(0).toUpperCase()}.`;
  if (f) return f;
  return username;
}

/**
 * Temporary password generator (04-AUTH section 3.2): 10 chars from the
 * unambiguous alphabet with at least one upper, one lower and one digit.
 * `rand` is injectable for deterministic unit tests.
 */
export function generateTempPassword(rand: () => number = Math.random): string {
  const uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowers = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const pick = (pool: string): string => pool[Math.floor(rand() * pool.length)];
  const chars = [pick(uppers), pick(lowers), pick(digits)];
  while (chars.length < TEMP_PASSWORD_LENGTH) {
    chars.push(TEMP_PASSWORD_ALPHABET[Math.floor(rand() * TEMP_PASSWORD_ALPHABET.length)]);
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = chars[i]!;
    chars[i] = chars[j]!;
    chars[j] = tmp;
  }
  return chars.join("");
}

export function syntheticEmail(username: string): string {
  return `${username}@accounts.invalid`;
}

export interface RowIssue {
  column: string;
  message: string;
}

export interface NormalizedRow {
  rowNo: number;
  lineNumber: number;
  username: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  gradeText: string;
  className: string;
  classId: string;
  studentCode: string;
  employeeCode: string;
}

export interface ValidatedRow extends NormalizedRow {
  grade: number | null;
  status: RowStatus;
  issues: RowIssue[];
  /** update (existing account) vs create (new account) vs enroll (link only). */
  action: "create" | "update" | "enroll";
}

/** Map one CSV record to canonical fields through the admin-approved mapping. */
export function applyMapping(
  headers: string[],
  record: string[],
  mapping: Record<string, string>,
  rowNo: number,
  lineNumber: number
): NormalizedRow {
  const byField: Record<string, string> = {};
  headers.forEach((h, i) => {
    const field = mapping[h];
    if (field && i < record.length) byField[field] = (record[i] ?? "").trim();
  });
  return {
    rowNo,
    lineNumber,
    username: byField["username"] ?? "",
    firstName: byField["first_name"] ?? "",
    lastName: byField["last_name"] ?? "",
    displayName: byField["display_name"] ?? "",
    email: byField["email"] ?? "",
    gradeText: byField["grade"] ?? "",
    className: byField["class_name"] ?? "",
    classId: byField["class_id"] ?? "",
    studentCode: byField["student_code"] ?? "",
    employeeCode: byField["employee_code"] ?? "",
  };
}

export interface ValidationContext {
  importType: ImportType;
  duplicates: DuplicatesPolicy;
  excludedRows: Set<number>;
  usernamesInFile: Map<string, number>;
  emailsInFile: Map<string, number>;
  existingProfiles: Map<string, { id: string; role: string }>;
  existingEmails: Set<string>;
  classesById: Map<string, { id: string; name: string }>;
  classesByName: Map<string, { id: string; name: string }>;
  scopeClassId?: string;
}

/** Pure per-row validator: pins every problem to exact column + message. */
export function validateRow(row: NormalizedRow, ctx: ValidationContext): ValidatedRow {
  const issues: RowIssue[] = [];
  let status: RowStatus = "ok";
  const err = (column: string, message: string): void => {
    issues.push({ column, message });
    status = "error";
  };
  const warn = (column: string, message: string): void => {
    if (status === "ok") status = "warning";
    issues.push({ column, message });
  };

  if (ctx.excludedRows.has(row.rowNo)) {
    return { ...row, grade: null, status: "excluded", issues: [{ column: "", message: "Excluded by admin review." }], action: "create" };
  }

  // --- username ---
  const { username, changed } = normalizeUsername(row.username);
  if (!username) {
    err("username", "Username is required.");
  } else if (!isValidUsername(username)) {
    err("username", "Username must be 3-32 chars of lowercase a-z 0-9 . _ -.");
  } else if (changed) {
    warn("username", "Username was lowercased/trimmed to match the required format.");
  }
  const firstSeenAt = ctx.usernamesInFile.get(username);
  if (username && firstSeenAt !== undefined && firstSeenAt !== row.rowNo) {
    err("username", `Duplicate username in this file (first seen on row ${firstSeenAt}).`);
  }

  // --- names / email / grade ---
  const displayName = composeDisplayName(row.firstName, row.lastName, row.displayName, username || row.username);
  if (row.email) {
    if (!isValidEmail(row.email)) {
      err("email", "Email address format is invalid.");
    } else {
      const lowered = row.email.trim().toLowerCase();
      const emailFirst = ctx.emailsInFile.get(lowered);
      if (emailFirst !== undefined && emailFirst !== row.rowNo) {
        err("email", `Duplicate email in this file (first seen on row ${emailFirst}).`);
      } else if (ctx.existingEmails.has(lowered)) {
        err("email", "Email already used by another account.");
      }
    }
  }
  let grade: number | null = null;
  if (ctx.importType === "students") {
    const gradeText = row.gradeText.trim();
    if (!gradeText) {
      warn("grade", "Grade is empty; the row will be imported without grade context.");
    } else {
      const parsed = parseGrade(gradeText);
      if (parsed === null || parsed < 7 || parsed > 12) {
        err("grade", "Grade must be an integer from 7 to 12.");
      } else {
        grade = parsed;
      }
    }
  }

  // --- class resolution (students + enrollments need a class) ---
  let classId = "";
  if (ctx.importType !== "teachers") {
    classId = row.classId.trim() || ctx.scopeClassId || "";
    if (!classId && row.className.trim()) {
      const found = ctx.classesByName.get(row.className.trim());
      if (!found) {
        err("class_name", `Class "${row.className.trim()}" not found.`);
      } else {
        classId = found.id;
      }
    }
    if (!classId && !row.className.trim()) {
      err("class_name", "Class is required: provide class_name or a target class for the import.");
    } else if (row.classId.trim() && !ctx.classesById.has(row.classId.trim())) {
      err("class_id", `Class id "${row.classId.trim()}" not found.`);
    } else if (row.classId.trim()) {
      classId = row.classId.trim();
    }
  }

  // --- duplicates against the database ---
  const existing = username ? ctx.existingProfiles.get(username) : undefined;
  let action: "create" | "update" | "enroll" = "create";
  if (existing) {
    if (ctx.importType === "enrollments") {
      action = "enroll";
    } else if (ctx.duplicates === "update") {
      action = "update";
    } else {
      err("username", "Username already exists (duplicates policy is skip).");
    }
  } else if (ctx.importType === "enrollments") {
    err("username", "Username does not exist; enrollments import only links existing accounts.");
  }

  return {
    ...row,
    username,
    displayName,
    grade,
    classId,
    status,
    issues,
    action,
  };
}

/** CSV-escape one cell for the credentials / error-report sheets. */
export function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function buildCredentialsCsv(rows: Array<{ username: string; displayName: string; password: string; email: string }>): string {
  const lines = ["username,display_name,temporary_password,email"];
  for (const r of rows) {
    lines.push([r.username, r.displayName, r.password, r.email].map(csvCell).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

export function buildErrorReportCsv(rows: ValidatedRow[]): string {
  const lines = ["row_no,csv_line,username,status,column,message"];
  for (const r of rows) {
    if (r.issues.length === 0) continue;
    for (const issue of r.issues) {
      lines.push(
        [String(r.rowNo), String(r.lineNumber), r.username || r.displayName, r.status, issue.column, issue.message]
          .map(csvCell)
          .join(",")
      );
    }
  }
  return lines.join("\r\n") + "\r\n";
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
  const rows = Array.isArray(res.data) ? res.data : [];
  for (const r of rows) {
    if (r && r.status === "completed" && typeof r.step_index === "number") done.add(r.step_index);
  }
  return done;
}

export interface PartialImport {
  validated?: ValidatedRow[];
  counts?: { created: number; updated: number; skipped: number; failed: number };
  createdUserIds?: string[];
  credentials?: Array<{ username: string; displayName: string; password: string; email: string }>;
  committedThrough?: number;
  credentialsPath?: string;
  errorReportPath?: string;
}

function readPartial(resultPayload: Record<string, unknown> | null | undefined): PartialImport {
  const p = resultPayload?.["partial"];
  if (p !== null && typeof p === "object" && !Array.isArray(p)) return p as PartialImport;
  return {};
}

async function writePartial(supa: SupaClient, jobId: string, partial: PartialImport): Promise<void> {
  const current = await readJob(supa, jobId);
  await touchJob(supa, jobId, {
    result_payload: { ...(current.result_payload ?? {}), partial: { ...partial } },
  });
}

function chunked<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Bulk-fetch existing profiles for candidate usernames (one IN query per chunk). */
async function fetchExistingProfiles(
  supa: SupaClient,
  usernames: string[]
): Promise<Map<string, { id: string; role: string }>> {
  const found = new Map<string, { id: string; role: string }>();
  const unique = [...new Set(usernames.filter(Boolean))];
  for (const batch of chunked(unique, LOOKUP_CHUNK_SIZE)) {
    const res: DbResult = await supa.from("profiles").select("id,username,role").in("username", batch);
    if (res.error) throw new Error(`profiles lookup failed: ${res.error.message}`);
    const rows = Array.isArray(res.data) ? res.data : [];
    for (const r of rows) {
      if (r && typeof r.username === "string") {
        found.set(String(r.username).toLowerCase(), { id: r.id, role: r.role });
      }
    }
  }
  return found;
}

/** One auth-user sweep per job for email-dedupe (no emails table exists). */
async function fetchExistingEmails(supa: SupaClient): Promise<Set<string>> {
  const emails = new Set<string>();
  let page = 1;
  for (;;) {
    const res = await supa.auth.admin.listUsers({ page, perPage: AUTH_SWEEP_PAGE_SIZE });
    if (res.error) throw new Error(`auth user sweep failed: ${res.error.message}`);
    const users = res.data?.users ?? [];
    if (users.length === 0) break;
    for (const u of users) {
      if (u.email) emails.add(u.email.toLowerCase());
    }
    if (users.length < AUTH_SWEEP_PAGE_SIZE) break;
    page++;
  }
  return emails;
}

async function fetchClasses(
  supa: SupaClient,
  ids: string[],
  names: string[]
): Promise<{ byId: Map<string, { id: string; name: string }>; byName: Map<string, { id: string; name: string }> }> {
  const byId = new Map<string, { id: string; name: string }>();
  const byName = new Map<string, { id: string; name: string }>();
  const uniqIds = [...new Set(ids.filter(Boolean))];
  const uniqNames = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  for (const batch of chunked(uniqIds, LOOKUP_CHUNK_SIZE)) {
    const res: DbResult = await supa.from("classes").select("id,name").in("id", batch);
    if (res.error) throw new Error(`classes lookup failed: ${res.error.message}`);
    for (const r of (Array.isArray(res.data) ? res.data : []) as any[]) {
      byId.set(r.id, { id: r.id, name: r.name });
      byName.set(String(r.name), { id: r.id, name: r.name });
    }
  }
  for (const batch of chunked(uniqNames, LOOKUP_CHUNK_SIZE)) {
    const res: DbResult = await supa.from("classes").select("id,name").in("name", batch);
    if (res.error) throw new Error(`classes lookup failed: ${res.error.message}`);
    for (const r of (Array.isArray(res.data) ? res.data : []) as any[]) {
      byId.set(r.id, { id: r.id, name: r.name });
      byName.set(String(r.name), { id: r.id, name: r.name });
    }
  }
  return { byId, byName };
}

/** Existing enrollment pairs so commit skips (not errors on) the unique constraint. */
async function fetchEnrollmentPairs(
  supa: SupaClient,
  table: "class_enrollments" | "class_teachers",
  classIds: string[],
  userIds: string[]
): Promise<Set<string>> {
  const pairs = new Set<string>();
  const idCol = table === "class_enrollments" ? "student_id" : "teacher_id";
  for (const classBatch of chunked([...new Set(classIds)], LOOKUP_CHUNK_SIZE)) {
    for (const userBatch of chunked([...new Set(userIds)], LOOKUP_CHUNK_SIZE)) {
      const res: DbResult = await supa
        .from(table)
        .select(`class_id,${idCol}`)
        .in("class_id", classBatch)
        .in(idCol, userBatch);
      if (res.error) throw new Error(`${table} lookup failed: ${res.error.message}`);
      for (const r of (Array.isArray(res.data) ? res.data : []) as any[]) {
        pairs.add(`${r.class_id}::${r[idCol]}`);
      }
    }
  }
  return pairs;
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

// -------------------------------------------------------------------
// Steps
// -------------------------------------------------------------------

async function runParseStep(
  params: ImportParams
): Promise<{ headers: string[]; records: NormalizedRow[] }> {
  const parsed = parseCsv(params.csvText);
  if (parsed.rows.length === 0) {
    throw new CsvImportError("validation_failed", "CSV has a header row but no data rows.", 1);
  }
  if (parsed.rows.length > MAX_IMPORT_ROWS) {
    throw new CsvImportError(
      "validation_failed",
      `CSV has ${parsed.rows.length} rows; the limit is ${MAX_IMPORT_ROWS} (AD-05). Split the file and import in parts.`,
      1
    );
  }
  const unknownHeaders = parsed.headers.filter((h) => !(h in params.mapping));
  if (unknownHeaders.length > 0) {
    throw new CsvImportError(
      "validation_failed",
      `Unmapped columns: ${unknownHeaders.map((h) => `"${h}"`).join(", ")}. Map every column or remove it from the file.`,
      1
    );
  }
  const records = parsed.rows.map((record, i) =>
    applyMapping(parsed.headers, record, params.mapping, i + 1, parsed.lineNumbers[i] ?? i + 2)
  );
  return { headers: parsed.headers, records };
}

async function runValidateStep(
  supa: SupaClient,
  params: ImportParams,
  records: NormalizedRow[]
): Promise<ValidatedRow[]> {
  const usernamesInFile = new Map<string, number>();
  const emailsInFile = new Map<string, number>();
  for (const r of records) {
    const { username } = normalizeUsername(r.username);
    if (username && !usernamesInFile.has(username)) usernamesInFile.set(username, r.rowNo);
    const email = r.email.trim().toLowerCase();
    if (email && !emailsInFile.has(email)) emailsInFile.set(email, r.rowNo);
  }
  const [existingProfiles, existingEmails, classes] = await Promise.all([
    fetchExistingProfiles(supa, records.map((r) => normalizeUsername(r.username).username)),
    params.importType === "students" || records.some((r) => r.email.trim())
      ? fetchExistingEmails(supa)
      : Promise.resolve(new Set<string>()),
    fetchClasses(
      supa,
      [...(params.classId ? [params.classId] : []), ...records.map((r) => r.classId.trim()).filter(Boolean)],
      records.map((r) => r.className)
    ),
  ]);
  if (params.classId && !classes.byId.has(params.classId)) {
    throw new CsvImportError(
      "validation_failed",
      `Target class id "${params.classId}" not found.`,
      2
    );
  }
  const ctx: ValidationContext = {
    importType: params.importType,
    duplicates: params.duplicates,
    excludedRows: new Set(params.excludedRows),
    usernamesInFile,
    emailsInFile,
    existingProfiles,
    existingEmails,
    classesById: classes.byId,
    classesByName: classes.byName,
    scopeClassId: params.classId,
  };
  return records.map((r) => validateRow(r, ctx));
}

export interface CommitCounts {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

async function commitBatch(
  supa: SupaClient,
  params: ImportParams,
  batch: ValidatedRow[],
  existingProfiles: Map<string, { id: string; role: string }>,
  enrollmentPairs: Set<string>,
  credentials: Array<{ username: string; displayName: string; password: string; email: string }>,
  createdUserIds: string[],
  rand: () => number
): Promise<CommitCounts> {
  const counts: CommitCounts = { created: 0, updated: 0, skipped: 0, failed: 0 };
  const enrollTable = params.importType === "teachers" ? "class_teachers" : "class_enrollments";
  const userIdCol = params.importType === "teachers" ? "teacher_id" : "student_id";
  const role = params.importType === "teachers" ? "teacher" : "student";

  for (const row of batch) {
    if (row.status === "error" || row.status === "excluded") {
      counts.skipped++;
      continue;
    }
    try {
      const known = existingProfiles.get(row.username);
      let profileId = known?.id;

      if (row.action === "create") {
        const password = generateTempPassword(rand);
        const created = await supa.auth.admin.createUser({
          email: syntheticEmail(row.username),
          password,
          email_confirm: true,
          user_metadata: { username: row.username, role },
        });
        if (created.error || !created.data?.user) {
          throw new Error(`auth account creation failed: ${created.error?.message ?? "no user returned"}`);
        }
        profileId = created.data.user.id;
        try {
          await insertReturning(supa, "profiles", {
            id: profileId,
            username: row.username,
            display_name: row.displayName,
            role,
            status: "active",
            must_change_password: true,
          });
        } catch (profileErr) {
          // Roll back the orphan auth account; never leave half-created users.
          try {
            await supa.auth.admin.deleteUser(profileId);
          } catch (deleteErr) {
            console.warn(
              `[csv-import] orphan auth user ${profileId} could not be removed: ${deleteErr instanceof Error ? deleteErr.message : deleteErr}`
            );
          }
          throw profileErr;
        }
        existingProfiles.set(row.username, { id: profileId, role });
        createdUserIds.push(profileId);
        credentials.push({
          username: row.username,
          displayName: row.displayName,
          password,
          email: row.email.trim(),
        });
        counts.created++;
      } else if (row.action === "update" && profileId) {
        const res: DbResult = await supa
          .from("profiles")
          .update({ display_name: row.displayName })
          .eq("id", profileId);
        if (res.error) throw new Error(`profiles update failed: ${res.error.message}`);
        counts.updated++;
      }

      // Link the account to its class (teachers only when a class is given).
      if (row.classId && profileId) {
        const key = `${row.classId}::${profileId}`;
        if (!enrollmentPairs.has(key)) {
          if (params.importType === "teachers") {
            await insertReturning(supa, enrollTable, {
              class_id: row.classId,
              [userIdCol]: profileId,
              is_primary: false,
            });
          } else {
            await insertReturning(supa, enrollTable, {
              class_id: row.classId,
              [userIdCol]: profileId,
              status: "active",
            });
          }
          enrollmentPairs.add(key);
        }
      }
    } catch (err) {
      row.status = "failed";
      row.issues.push({
        column: "",
        message: err instanceof Error ? err.message : "Commit failed.",
      });
      counts.failed++;
    }
  }
  return counts;
}

async function runCommitStep(
  supa: SupaClient,
  job: JobRecord,
  params: ImportParams,
  validated: ValidatedRow[],
  partial: PartialImport,
  rand: () => number
): Promise<{ counts: CommitCounts; credentials: Array<{ username: string; displayName: string; password: string; email: string }>; createdUserIds: string[] }> {
  const startAt = partial.committedThrough ?? 0;
  const existingProfiles = await fetchExistingProfiles(
    supa,
    validated.map((r) => r.username)
  );
  const profileIds = [...existingProfiles.values()].map((p) => p.id);
  const classIds = [...new Set(validated.map((r) => r.classId).filter(Boolean))];
  const table = params.importType === "teachers" ? "class_teachers" : "class_enrollments";
  const enrollmentPairs = await fetchEnrollmentPairs(supa, table, classIds, [
    ...profileIds,
    ...(partial.createdUserIds ?? []),
  ]);

  const totals: CommitCounts = { ...(partial.counts ?? { created: 0, updated: 0, skipped: 0, failed: 0 }) };
  const credentials = [...(partial.credentials ?? [])];
  const createdUserIds = [...(partial.createdUserIds ?? [])];
  const pending = validated
    .map((row, i) => ({ row, i: i + 1 }))
    .filter(({ i }) => i > startAt);
  const totalBatches = Math.max(1, Math.ceil(pending.length / COMMIT_BATCH_SIZE));
  let doneBatches = 0;

  for (let b = 0; b < pending.length; b += COMMIT_BATCH_SIZE) {
    const status = (await readJob(supa, job.id)).status;
    if (status === "cancelled") {
      throw new CsvImportError("cancelled", "Job was cancelled by the requester.", 3);
    }
    const slice = pending.slice(b, b + COMMIT_BATCH_SIZE).map(({ row }) => row);
    const batchCounts = await commitBatch(
      supa,
      params,
      slice,
      existingProfiles,
      enrollmentPairs,
      credentials,
      createdUserIds,
      rand
    );
    totals.created += batchCounts.created;
    totals.updated += batchCounts.updated;
    totals.skipped += batchCounts.skipped;
    totals.failed += batchCounts.failed;
    doneBatches++;
    const committedThrough = startAt + b + slice.length;
    const nextPartial: PartialImport = {
      validated,
      counts: { ...totals },
      createdUserIds: [...createdUserIds],
      credentials: [...credentials],
      committedThrough,
    };
    await writePartial(supa, job.id, nextPartial);
    await writeStep(
      supa,
      job.id,
      3,
      "commit",
      "running",
      Math.min(89, 50 + Math.round((doneBatches / totalBatches) * 40)),
      `Committed batch ${doneBatches}/${totalBatches} (${totals.created} created, ${totals.updated} updated, ${totals.failed} failed)`
    );
  }
  return { counts: totals, credentials, createdUserIds };
}

async function runFinalizeStep(
  supa: SupaClient,
  job: JobRecord,
  params: ImportParams,
  validated: ValidatedRow[],
  counts: CommitCounts,
  credentials: Array<{ username: string; displayName: string; password: string; email: string }>,
  createdUserIds: string[]
): Promise<Record<string, unknown>> {
  // Credentials sheet: written ONCE to the private bucket, never logged.
  const credentialsPath = `${CREDENTIALS_PREFIX}/${job.id}.csv`;
  const credUpload = await supa.storage
    .from(IMPORT_BUCKET)
    .upload(credentialsPath, buildCredentialsCsv(credentials), {
      contentType: "text/csv",
      upsert: true,
    });
  if (credUpload.error) {
    throw new CsvImportError(
      "provider_error",
      `Credentials file upload failed: ${credUpload.error.message}`,
      4
    );
  }

  // Error report for excluded / failed rows (AD-05 "Download error report").
  let errorReportPath: string | undefined;
  const problemRows = validated.filter((r) => r.issues.length > 0);
  if (problemRows.length > 0) {
    const path = `${ERROR_REPORT_PREFIX}/${job.id}.csv`;
    const repUpload = await supa.storage
      .from(IMPORT_BUCKET)
      .upload(path, buildErrorReportCsv(validated), { contentType: "text/csv", upsert: true });
    if (repUpload.error) {
      console.warn(`[csv-import] error report upload failed: ${repUpload.error.message}`);
    } else {
      errorReportPath = path;
    }
  }

  const resultPayload: Record<string, unknown> = {
    created: counts.created,
    updated: counts.updated,
    skipped: counts.skipped,
    failed: counts.failed,
    credentials_asset_id: credentialsPath,
    ...(errorReportPath ? { error_report_asset_id: errorReportPath } : {}),
    import_type: params.importType,
    duplicates: params.duplicates,
  };

  const now = new Date().toISOString();
  await touchJob(supa, job.id, {
    status: "completed",
    result_payload: resultPayload,
    completed_at: now,
  });

  // AD-05: a completed import creates one audit entry listing the counts.
  let auditWritten = false;
  try {
    const actor = await supa.from("profiles").select("id,role").eq("id", job.initiator_id).single();
    if (!actor.error) {
      const auditRes: DbResult = await supa.from("audit_log").insert({
        user_id: job.initiator_id,
        actor_id: job.initiator_id,
        actor_role: (actor.data as any)?.role ?? "admin",
        action: "users.import",
        action_type: "imports",
        target_type: "job",
        target_id: job.id,
        summary: `CSV import (${params.importType}): ${counts.created} created, ${counts.updated} updated, ${counts.skipped} skipped, ${counts.failed} failed.`,
        after: { ...resultPayload, created_user_ids: createdUserIds },
      });
      auditWritten = !auditRes.error;
      if (auditRes.error) {
        console.warn(`[csv-import] audit write failed: ${auditRes.error.message}`);
      }
    }
  } catch (auditErr) {
    console.warn(
      `[csv-import] audit write failed: ${auditErr instanceof Error ? auditErr.message : auditErr}`
    );
  }
  (resultPayload as Record<string, unknown>)["audit_written"] = auditWritten;

  // Notify the initiating admin (best-effort: never fails a completed job).
  try {
    await insertReturning(supa, "notifications", {
      user_id: job.initiator_id,
      kind: "import_completed",
      title: "CSV import finished",
      body: `${counts.created} created, ${counts.updated} updated, ${counts.skipped} skipped, ${counts.failed} failed. Credentials are ready for download.`,
      payload: { job_id: job.id, counts },
      link: "/admin/users/import",
      priority: "normal",
    });
  } catch (notifyErr) {
    console.warn(
      `[csv-import] completion notification failed: ${notifyErr instanceof Error ? notifyErr.message : notifyErr}`
    );
  }

  return resultPayload;
}

// -------------------------------------------------------------------
// Main handler
// -------------------------------------------------------------------

export async function handleCsvImport(
  job: JobRecord,
  supa: SupaClient,
  rand: () => number = Math.random
): Promise<HandlerResult> {
  if (job.kind !== IMPORT_USERS_KIND) {
    throw new CsvImportError(
      "validation_failed",
      `handleCsvImport cannot process kind="${job.kind}".`
    );
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

  const stepOf = (index: number) => CSV_IMPORT_STEPS.find((s) => s.index === index)!;
  const ensureRunning = async (index: number, message: string): Promise<void> => {
    const status = (await readJob(supa, current.id)).status;
    if (status === "cancelled") {
      throw new CsvImportError("cancelled", "Job was cancelled by the requester.", index);
    }
    const step = stepOf(index);
    await writeStep(supa, current.id, index, step.name, "running", step.progress, message);
  };

  try {
    const params = parseImportParams(current.input_params);
    await touchJob(supa, current.id, { started_at: new Date().toISOString() });
    const done = await readCompletedSteps(supa, current.id);

    // --- Step 1: parse (20%) ---
    let records: NormalizedRow[] | undefined;
    if (!done.has(1)) {
      await ensureRunning(1, "Parsing CSV file");
      records = (await runParseStep(params)).records;
      await writeStep(supa, current.id, 1, stepOf(1).name, "completed", 20, `${records.length} rows parsed`);
    }

    // --- Step 2: validate (50%) ---
    let validated = partial.validated;
    if (!done.has(2) || !validated) {
      await ensureRunning(2, "Validating rows against schema");
      if (!records) {
        // Resuming after a crash between steps: re-parse (pure, deterministic).
        records = (await runParseStep(params)).records;
      }
      validated = await runValidateStep(supa, params, records);
      const bad = validated.filter((r) => r.status === "error").length;
      partial = { ...readPartial((await readJob(supa, current.id)).result_payload), validated };
      await writePartial(supa, current.id, partial);
      await writeStep(
        supa,
        current.id,
        2,
        stepOf(2).name,
        "completed",
        50,
        `${validated.length - bad} valid, ${bad} with errors`
      );
    }

    // --- Step 3: commit (90%) ---
    const committedThrough = partial.committedThrough ?? 0;
    let counts = partial.counts;
    let credentials = partial.credentials;
    let createdUserIds = partial.createdUserIds;
    if (!done.has(3) || committedThrough < validated.length || !counts) {
      await ensureRunning(3, "Creating accounts in batches of 100");
      const committed = await runCommitStep(supa, current, params, validated, partial, rand);
      counts = committed.counts;
      credentials = committed.credentials;
      createdUserIds = committed.createdUserIds;
      partial = readPartial((await readJob(supa, current.id)).result_payload);
      await writeStep(
        supa,
        current.id,
        3,
        stepOf(3).name,
        "completed",
        90,
        `${counts.created} created, ${counts.updated} updated, ${counts.failed} failed`
      );
    }

    // --- Step 4: finalize (100%) ---
    await ensureRunning(4, "Writing credentials file and audit entry");
    partial = readPartial((await readJob(supa, current.id)).result_payload);
    const resultPayload = await runFinalizeStep(
      supa,
      current,
      params,
      partial.validated ?? validated,
      counts ?? { created: 0, updated: 0, skipped: 0, failed: 0 },
      credentials ?? [],
      createdUserIds ?? []
    );
    await writeStep(supa, current.id, 4, stepOf(4).name, "completed", 100, "Import finalized");

    return { progress_percent: 100, finishAfterStep: true, result_payload: resultPayload };
  } catch (err) {
    if (err instanceof CsvImportError && err.code === "cancelled") {
      return { progress_percent: 0, finishAfterStep: true };
    }
    const code = err instanceof CsvImportError ? err.code : "provider_error";
    const stepIndex = err instanceof CsvImportError ? err.stepIndex : undefined;
    const stepName = stepIndex !== undefined ? stepOf(stepIndex).name : "commit";
    const message = err instanceof Error ? err.message : "CSV import failed.";
    console.warn(`[csv-import] job ${current.id} failed at step "${stepName}": ${message}`);
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
      (register as (kind: string, handler: typeof handleCsvImport) => void)(
        IMPORT_USERS_KIND,
        handleCsvImport
      );
    }
  } catch (err) {
    console.warn(
      `[csv-import] self-registration skipped (wire handleCsvImport in job-runner/index.ts): ${
        err instanceof Error ? err.message : err
      }`
    );
  }
})();
