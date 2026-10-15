// ============================================================
// ADM-03 — User detail dossier, account status control and administrative notes (AD-03)
//
// Route: /admin/users/:userId (mounted by the routing task)
// Spec:  frontend/docs/05-admin/ADMIN-SPEC.md §AD-03
// Contracts:
//   - backend/docs/04-AUTH-AND-ACCESS.md §3.2/§5: reset-password, view-as-start Edge functions
//   - backend/docs/05-API-CONTRACT.md §6.2: admin_update_user, admin_user_notes
//   - backend/docs/02-DATA-MODEL-CORE.md + supabase/migrations: profiles, admin_notes,
//     student_stats, xp_ledger, coin_ledger, streak_days, class_enrollments, class_teachers,
//     classes, courses, assignment_submissions, audit_log
//
// Reads run through PostgREST with the session bearer token and are gated by row-level
// security (administrators read these tables). Writes use the documented administrator
// contracts:
//   - profile changes (status lock/unlock, role, display name) go through the
//     `admin-update-user` Edge function; when that surface is not deployed the page falls
//     back to a direct, RLS-guarded write and verifies the stored row before reporting
//     success, so "immediate effect" is always proven against the database.
//   - password reset and View-As simulation call their Edge functions and surface the
//     documented one-time results (temporary password, simulation session).
// Every panel renders real rows or an explicit, actionable state — nothing is mocked.
// ============================================================

import { useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Coins,
  Copy,
  Eye,
  Flame,
  KeyRound,
  Lock,
  LockOpen,
  Printer,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCog,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { env } from "@/shared/config/env";
import { supabase } from "@/shared/api/supabase";
import { useToast, type ToastContextValue } from "@/shared/hooks/useToast";
import { Avatar } from "@/shared/components/ui/Avatar";
import { Badge } from "@/shared/components/ui/Badge";
import { Button } from "@/shared/components/ui/Button";
import { Dialog } from "@/shared/components/ui/Dialog";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { FormField } from "@/shared/components/ui/FormField";
import { Input } from "@/shared/components/ui/Input";
import { Select } from "@/shared/components/ui/Select";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/Tabs";
import { Textarea } from "@/shared/components/ui/Textarea";

// ============================================================
// Types
// ============================================================

type UserRole = "student" | "teacher" | "admin" | "super_admin";
type UserStatus = "active" | "locked" | "archived";

interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string;
  role: UserRole;
  status: UserStatus;
  avatar_url: string | null;
  equipped_theme: string | null;
  must_change_password: boolean | null;
  created_at: string;
  updated_at: string;
}

interface ViewerRow {
  id: string;
  role: UserRole;
  display_name: string;
}

interface StudentStatsRow {
  total_xp: number;
  current_level: number;
  current_coins: number;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
}

interface StreakDayRow {
  activity_date: string;
  xp_earned: number;
  is_frozen: boolean;
}

interface LedgerRow {
  id: string;
  amount: number;
  source: string;
  created_at: string;
}

interface ClassEmbed {
  id: string;
  name: string;
  grade_level: string | null;
  is_archived: boolean;
}

interface MembershipRow {
  classes: ClassEmbed | null;
  status?: string;
  enrolled_at?: string;
  is_primary?: boolean;
}

interface SubmissionRow {
  id: string;
  assessment_id: string;
  class_id: string;
  status: string;
  submitted_at: string | null;
  is_late: boolean;
  created_at: string;
  classes: { id: string; name: string } | null;
}

interface CourseRow {
  id: string;
  title: string;
  status: string;
  grade_level: string | null;
  is_official: boolean;
  updated_at: string;
}

interface AuditRow {
  id: string;
  user_id: string | null;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  action_type: string | null;
  summary: string | null;
  reason: string | null;
  target_type: string | null;
  target_id: string | null;
  created_at: string;
}

interface ActorRow {
  id: string;
  display_name: string | null;
  username: string | null;
}

interface AdminNoteRow {
  id: string;
  user_id: string;
  author_id: string;
  note: string;
  created_at: string;
}

/** Per-block load outcome, so one restricted table never blanks a whole panel. */
type Settled<T> = { ok: true; data: T } | { ok: false; error: string };

interface LearningData {
  stats: Settled<StudentStatsRow[]>;
  streakDays: Settled<StreakDayRow[]>;
  xpEntries: Settled<LedgerRow[]>;
  coinEntries: Settled<LedgerRow[]>;
  memberships: Settled<MembershipRow[]>;
  submissions: Settled<SubmissionRow[]>;
  authoredCourses: Settled<CourseRow[]>;
}

interface ActivityData {
  rows: AuditRow[];
  actors: Record<string, ActorRow>;
}

interface NotesData {
  notes: AdminNoteRow[];
  authors: Record<string, ActorRow>;
}

interface ViewAsStartResponse {
  token?: string;
  access_token?: string;
  expires_at?: string;
  session_id?: string;
  profile?: { display_name?: string; role?: string };
}

type StatusMutation = UseMutationResult<void, Error, UserStatus>;
type RoleMutation = UseMutationResult<void, Error, UserRole>;
type NameMutation = UseMutationResult<void, Error, string>;
type AddNoteMutation = UseMutationResult<void, Error, string>;
type DeleteNoteMutation = UseMutationResult<void, Error, string>;
type ResetPasswordMutation = UseMutationResult<string | null, Error, void>;
type ViewAsMutation = UseMutationResult<ViewAsStartResponse, Error, string>;

/** Profile fields this page is allowed to change through the admin update contract. */
type UserFieldPatch = Partial<Pick<ProfileRow, "status" | "role" | "display_name">>;

// ============================================================
// Constants
// ============================================================

const REST_URL = `${env.VITE_SUPABASE_URL.replace(/\/$/, "")}/rest/v1`;

const PROFILE_SELECT =
  "id,username,display_name,role,status,avatar_url,equipped_theme,must_change_password,created_at,updated_at";

const ROLE_LABELS: Record<UserRole, string> = {
  student: "Student",
  teacher: "Teacher",
  admin: "School admin",
  super_admin: "Super admin",
};

const STATUS_META: Record<
  UserStatus,
  { label: string; tone: "success" | "warning" | "info"; help: string }
> = {
  active: {
    label: "Active",
    tone: "success",
    help: "The account can sign in and work normally.",
  },
  locked: {
    label: "Locked",
    tone: "warning",
    help: "Sign-in is blocked until an administrator unlocks the account.",
  },
  archived: {
    label: "Archived",
    tone: "info",
    help: "Archived accounts cannot sign in; history is kept.",
  },
};

/** The contract converts people between student and teacher; admin roles live in AD-28. */
const CONVERTIBLE_ROLE_OPTIONS = [
  { value: "student", label: "Student" },
  { value: "teacher", label: "Teacher" },
];

const SUBMISSION_LABELS: Record<string, string> = {
  in_progress: "In progress",
  submitted: "Submitted",
  graded: "Graded",
  returned: "Returned",
};

// ============================================================
// Generic helpers
// ============================================================

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An unexpected error occurred.";
}

function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    // Not JSON: the caller falls back to the raw text.
    return null;
  }
}

const DATE_TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});
const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const DAY_FORMAT = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric" });

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : DATE_TIME_FORMAT.format(date);
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : DATE_FORMAT.format(date);
}

/** Date-only values ("2026-10-03") parse at local midnight, so no timezone day-shift. */
function formatDayLabel(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : DAY_FORMAT.format(date);
}

function humanizeKey(value: string): string {
  const spaced = value.replace(/[_-]+/g, " ").trim();
  if (spaced === "") return value;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatAmount(value: number): string {
  if (value > 0) return `+${value.toLocaleString()}`;
  return value.toLocaleString();
}

// ============================================================
// REST plumbing
// ============================================================

async function restFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error(`Could not read the current session: ${sessionError.message}`);
  }

  const headers = new Headers(init?.headers);
  headers.set("apikey", env.VITE_SUPABASE_ANON_KEY);
  headers.set(
    "Authorization",
    `Bearer ${sessionData.session?.access_token ?? env.VITE_SUPABASE_ANON_KEY}`,
  );
  headers.set("Accept", "application/json");

  const response = await fetch(`${REST_URL}${path}`, { ...init, headers });

  if (!response.ok) {
    const text = await response.text();
    const parsed = safeJsonParse<{ message?: string; code?: string }>(text);
    const message =
      parsed?.message ?? (text === "" ? "The server returned no message." : text.slice(0, 200));
    const code = parsed?.code !== undefined ? ` (${parsed.code})` : "";
    throw new Error(`Request failed with ${response.status}${code}: ${message}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  const bodyText = await response.text();
  if (bodyText === "") {
    return undefined as T;
  }
  const parsedBody = safeJsonParse<T>(bodyText);
  if (parsedBody === null) {
    throw new Error(
      `The server returned a response that could not be parsed (${response.status}).`,
    );
  }
  return parsedBody;
}

interface EdgeErrorBody {
  message?: string;
  error?: string;
}

/**
 * Invokes a documented Edge function and resolves with its JSON payload.
 * The slug convention is hyphenated (ai-copilot, job-runner, ...), matching
 * backend/docs/04-AUTH-AND-ACCESS.md.
 */
async function edgeInvoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const response = await supabase.functions.invoke<T>(name, { body });
  if (response.error !== null && response.error !== undefined) {
    throw new Error(await describeEdgeError(name, response.error as unknown));
  }
  if (response.data === null || response.data === undefined) {
    throw new Error(`The ${name} service returned no data.`);
  }
  return response.data;
}

async function describeEdgeError(name: string, error: unknown): Promise<string> {
  let detail = "";

  if (typeof error === "object" && error !== null) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const text = await context.clone().text();
        if (text !== "") {
          const parsed = safeJsonParse<EdgeErrorBody>(text);
          detail = parsed?.message ?? parsed?.error ?? text.slice(0, 200);
        }
      } catch (readFailure) {
        detail = `The service returned an error body that could not be read (${toErrorMessage(
          readFailure,
        )}).`;
      }
    }
    if (detail === "") {
      const message = (error as { message?: unknown }).message;
      detail = typeof message === "string" ? message : "";
    }
  } else if (typeof error === "string") {
    detail = error;
  }

  if (detail === "") detail = "The service did not return a readable error.";
  return `The ${name} service failed: ${detail}`;
}

/** HTTP status behind an Edge invocation failure, when the client exposes the response. */
function edgeFailureStatus(error: unknown): number | null {
  if (typeof error === "object" && error !== null) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) return context.status;
  }
  return null;
}

/**
 * True when the failure means the Edge surface is not reachable (not deployed, network
 * blocked or server fault) rather than a deliberate policy rejection by the service.
 */
function isMissingEdgeSurface(error: unknown): boolean {
  const status = edgeFailureStatus(error);
  if (status === null) return true;
  return status === 404 || status >= 500;
}

// ============================================================
// Data loaders
// ============================================================

async function loadViewerProfile(): Promise<ViewerRow> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error(`Could not read the current session: ${sessionError.message}`);
  }
  const viewerId = sessionData.session?.user.id;
  if (viewerId === undefined) {
    throw new Error("Sign in as an administrator to open this page.");
  }

  const rows = await restFetch<ViewerRow[]>(
    `/profiles?id=eq.${encodeURIComponent(viewerId)}&select=id,role,display_name&limit=1`,
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error("Your administrator profile could not be read.");
  }
  return row;
}

async function loadProfile(userId: string): Promise<ProfileRow> {
  const rows = await restFetch<ProfileRow[]>(
    `/profiles?id=eq.${encodeURIComponent(userId)}&select=${PROFILE_SELECT}&limit=1`,
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error("No account matches this identifier, or it is not visible to your role.");
  }
  return row;
}

async function settled<T>(promise: Promise<T>): Promise<Settled<T>> {
  try {
    return { ok: true, data: await promise };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

function noRows<T>(): Settled<T[]> {
  return { ok: true, data: [] };
}

async function loadLearning(userId: string, role: UserRole): Promise<LearningData> {
  const enc = encodeURIComponent(userId);
  const isStudent = role === "student";
  const isStaff = role === "teacher" || role === "admin" || role === "super_admin";

  const [stats, streakDays, xpEntries, coinEntries, memberships, submissions, authoredCourses] =
    await Promise.all([
      isStudent
        ? settled(
            restFetch<StudentStatsRow[]>(
              `/student_stats?student_id=eq.${enc}&select=total_xp,current_level,current_coins,current_streak,longest_streak,last_active_date&limit=1`,
            ),
          )
        : Promise.resolve(noRows<StudentStatsRow>()),
      isStudent
        ? settled(
            restFetch<StreakDayRow[]>(
              `/streak_days?student_id=eq.${enc}&select=activity_date,xp_earned,is_frozen&order=activity_date.desc&limit=14`,
            ),
          )
        : Promise.resolve(noRows<StreakDayRow>()),
      isStudent
        ? settled(
            restFetch<LedgerRow[]>(
              `/xp_ledger?student_id=eq.${enc}&select=id,amount,source,created_at&order=created_at.desc&limit=8`,
            ),
          )
        : Promise.resolve(noRows<LedgerRow>()),
      isStudent
        ? settled(
            restFetch<LedgerRow[]>(
              `/coin_ledger?student_id=eq.${enc}&select=id,amount,source,created_at&order=created_at.desc&limit=8`,
            ),
          )
        : Promise.resolve(noRows<LedgerRow>()),
      settled(
        restFetch<MembershipRow[]>(
          isStudent
            ? `/class_enrollments?student_id=eq.${enc}&status=eq.active&select=id,status,enrolled_at,classes(id,name,grade_level,is_archived)`
            : `/class_teachers?teacher_id=eq.${enc}&select=class_id,is_primary,classes(id,name,grade_level,is_archived)`,
        ),
      ),
      isStudent
        ? settled(
            restFetch<SubmissionRow[]>(
              `/assignment_submissions?student_id=eq.${enc}&select=id,assessment_id,class_id,status,submitted_at,is_late,created_at,classes(id,name)&order=created_at.desc&limit=12`,
            ),
          )
        : Promise.resolve(noRows<SubmissionRow>()),
      isStaff
        ? settled(
            restFetch<CourseRow[]>(
              `/courses?author_id=eq.${enc}&select=id,title,status,grade_level,is_official,updated_at&order=updated_at.desc&limit=10`,
            ),
          )
        : Promise.resolve(noRows<CourseRow>()),
    ]);

  return { stats, streakDays, xpEntries, coinEntries, memberships, submissions, authoredCourses };
}

async function loadActivity(userId: string): Promise<ActivityData> {
  const enc = encodeURIComponent(userId);
  const rows = await restFetch<AuditRow[]>(
    `/audit_log?select=id,user_id,actor_id,actor_role,action,action_type,summary,reason,target_type,target_id,created_at&or=(user_id.eq.${enc},actor_id.eq.${enc})&order=created_at.desc&limit=30`,
  );

  const actorIds = [
    ...new Set(rows.map((row) => row.actor_id).filter((id): id is string => id !== null)),
  ];
  let actors: Record<string, ActorRow> = {};
  if (actorIds.length > 0) {
    const profiles = await restFetch<ActorRow[]>(
      `/profiles?id=in.(${actorIds.join(",")})&select=id,display_name,username`,
    );
    actors = Object.fromEntries(profiles.map((profile) => [profile.id, profile]));
  }

  return { rows, actors };
}

async function loadNotes(userId: string): Promise<NotesData> {
  const enc = encodeURIComponent(userId);
  const notes = await restFetch<AdminNoteRow[]>(
    `/admin_notes?user_id=eq.${enc}&select=id,user_id,author_id,note,created_at&order=created_at.desc&limit=50`,
  );

  const authorIds = [...new Set(notes.map((note) => note.author_id))];
  let authors: Record<string, ActorRow> = {};
  if (authorIds.length > 0) {
    const profiles = await restFetch<ActorRow[]>(
      `/profiles?id=in.(${authorIds.join(",")})&select=id,display_name,username`,
    );
    authors = Object.fromEntries(profiles.map((profile) => [profile.id, profile]));
  }

  return { notes, authors };
}

// ------------------------------------------------------------
// Writes
// ------------------------------------------------------------

async function userFieldsMatch(userId: string, fields: UserFieldPatch): Promise<boolean> {
  const keys = Object.keys(fields) as Array<keyof UserFieldPatch>;
  const rows = await restFetch<Array<Record<string, unknown>>>(
    `/profiles?id=eq.${encodeURIComponent(userId)}&select=${keys.join(",")}`,
  );
  const row = rows[0];
  if (row === undefined) return false;
  return keys.every((key) => row[key] === fields[key]);
}

/**
 * Applies profile fields through the documented admin update contract and verifies the
 * stored row before resolving. Verified read-back is what makes "immediate effect" real:
 * if neither the Edge function nor the direct RLS-guarded write changes the row, the
 * caller gets an explicit error instead of a silent no-op.
 */
async function saveUserFields(userId: string, fields: UserFieldPatch): Promise<void> {
  let edgeFailure: string | null = null;
  let edgeSucceeded = false;
  let allowDirectWrite = false;
  try {
    await edgeInvoke("admin-update-user", { user_id: userId, fields });
    edgeSucceeded = true;
  } catch (error) {
    edgeFailure = toErrorMessage(error);
    allowDirectWrite = isMissingEdgeSurface(error);
  }

  if (await userFieldsMatch(userId, fields)) return;

  if (allowDirectWrite) {
    // The Edge surface is not reachable yet: try the direct, RLS-guarded write and verify.
    await restFetch(`/profiles?id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(fields),
    });

    if (await userFieldsMatch(userId, fields)) return;
  }

  if (edgeSucceeded) {
    throw new Error(
      "The admin update service accepted the change, but the stored account still shows the previous value. Refresh the page and check again.",
    );
  }
  const failure = edgeFailure ?? "The admin update service is unavailable.";
  throw new Error(
    allowDirectWrite
      ? `${failure} The direct database write was also rejected by row-level security, so nothing changed.`
      : failure,
  );
}

async function insertAdminNote(userId: string, authorId: string, note: string): Promise<void> {
  await restFetch<undefined>(`/admin_notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      id: crypto.randomUUID(),
      user_id: userId,
      author_id: authorId,
      note,
    }),
  });
}

async function removeAdminNote(noteId: string): Promise<void> {
  await restFetch<undefined>(`/admin_notes?id=eq.${encodeURIComponent(noteId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

/** Returns the one-time temporary password when the service includes it in the response. */
async function requestPasswordReset(userId: string): Promise<string | null> {
  const data = await edgeInvoke<{
    temporary_password?: string;
    temp_password?: string;
    password?: string;
  }>("reset-password", { profile_id: userId });
  return data.temporary_password ?? data.temp_password ?? data.password ?? null;
}

async function startViewAsSession(userId: string, reason: string): Promise<ViewAsStartResponse> {
  return edgeInvoke<ViewAsStartResponse>("view-as-start", { target_id: userId, reason });
}

// ============================================================
// Small presentational pieces
// ============================================================

function PageShell({ children }: { children: ReactNode }) {
  return (
    <main
      data-world="coral"
      className="min-h-screen bg-world-coral-50 px-4 py-8 text-stroke sm:px-6 lg:px-10"
    >
      <div className="mx-auto max-w-7xl space-y-6">{children}</div>
    </main>
  );
}

function SectionCard({
  id,
  title,
  description,
  action,
  children,
}: {
  id: string;
  title: ReactNode;
  description?: ReactNode | undefined;
  action?: ReactNode | undefined;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-[24px] border-2 border-stroke bg-surface-0 p-5 shadow-retro-sm sm:p-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={id} className="font-heading text-xl font-bold">
            {title}
          </h2>
          {description !== undefined && description !== null ? (
            <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p>
          ) : null}
        </div>
        {action}
      </header>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StatTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[18px] border-2 border-stroke bg-surface-0 px-4 py-3 shadow-retro-sm">
      <p className="flex items-center gap-1.5 text-[13px] font-bold text-muted">
        <span aria-hidden="true" className="inline-flex items-center">
          {icon}
        </span>
        {label}
      </p>
      <p className="mt-1 font-heading text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: UserStatus }) {
  const meta = STATUS_META[status];
  return (
    <Badge status={meta.tone} size="sm">
      {meta.label}
    </Badge>
  );
}

function InlineError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: (() => void) | undefined;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-dashed border-muted bg-surface-100 px-4 py-3"
    >
      <p className="min-w-0 break-words text-sm font-semibold">{message}</p>
      {onRetry !== undefined ? (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          <RefreshCw size={15} aria-hidden="true" /> Retry
        </Button>
      ) : null}
    </div>
  );
}

function DataBlock<T>({
  state,
  onRetry,
  emptyTitle,
  emptyDescription,
  isEmpty,
  children,
}: {
  state: Settled<T[]>;
  onRetry: () => void;
  emptyTitle: string;
  emptyDescription: string;
  isEmpty?: ((rows: T[]) => boolean) | undefined;
  children: (rows: T[]) => ReactNode;
}) {
  if (!state.ok) {
    return <InlineError message={state.error} onRetry={onRetry} />;
  }
  const empty = isEmpty !== undefined ? isEmpty(state.data) : state.data.length === 0;
  if (empty) {
    return <EmptyState size="sm" title={emptyTitle} description={emptyDescription} />;
  }
  return <>{children(state.data)}</>;
}

const TH_CLASS =
  "border-b-2 border-stroke px-3 py-2 text-left font-heading text-[13px] font-semibold";
const TD_CLASS = "border-b-2 border-surface-200 px-3 py-2 align-top";

function TableShell({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

async function copyText(
  text: string,
  label: string,
  show: ToastContextValue["show"],
): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    show({
      type: "success",
      title: "Copied",
      description: `${label} is in the clipboard.`,
    });
  } catch (error) {
    show({
      type: "error",
      title: "Copy failed",
      description: `${toErrorMessage(error)}. Select the text and copy it manually.`,
    });
  }
}

function CopyTextButton({
  text,
  label,
  variant = "secondary",
}: {
  text: string;
  label: string;
  variant?: ComponentProps<typeof Button>["variant"];
}) {
  const { show } = useToast();
  const handleCopy = () => {
    void copyText(text, label, show);
  };
  return (
    <Button size="sm" variant={variant} onClick={handleCopy}>
      <Copy size={15} aria-hidden="true" /> {label}
    </Button>
  );
}

// ============================================================
// Dialogs
// ============================================================

function LockToggleDialog({
  account,
  mutation,
  onClose,
}: {
  account: ProfileRow;
  mutation: StatusMutation;
  onClose: () => void;
}) {
  const nextStatus: UserStatus = account.status === "locked" ? "active" : "locked";
  const locking = nextStatus === "locked";

  const handleConfirm = () => {
    mutation.mutate(nextStatus, { onSuccess: () => onClose() });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
      title={locking ? "Lock this account?" : "Unlock this account?"}
      description={
        locking
          ? `${account.display_name} will be blocked from signing in. Existing sessions end when their tokens expire (up to 15 minutes). You can unlock the account at any time.`
          : `${account.display_name} will be allowed to sign in again. The change is verified against the database before this dialog closes.`
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant={locking ? "danger" : "success"}
            loading={mutation.isPending}
            onClick={handleConfirm}
          >
            {locking ? "Lock account" : "Unlock account"}
          </Button>
        </>
      }
    >
      {mutation.error !== null ? (
        <InlineError message={toErrorMessage(mutation.error)} />
      ) : (
        <p className="text-sm text-muted">
          This action is recorded in the audit log with your administrator account as the actor.
        </p>
      )}
    </Dialog>
  );
}

function RoleChangeDialog({
  account,
  mutation,
  onClose,
}: {
  account: ProfileRow;
  mutation: RoleMutation;
  onClose: () => void;
}) {
  const [nextRole, setNextRole] = useState<UserRole>(account.role);
  const changed = nextRole !== account.role;

  const handleConfirm = () => {
    if (!changed) return;
    mutation.mutate(nextRole, { onSuccess: () => onClose() });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
      title="Change role"
      description="The role is stored on the account and applies to permissions the next time the account loads data."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            disabled={!changed}
            onClick={handleConfirm}
          >
            Save role
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="New role" hint="Admin roles are managed in the administrator directory.">
          <Select
            value={nextRole}
            onValueChange={(value) => {
              setNextRole(value as UserRole);
            }}
            options={CONVERTIBLE_ROLE_OPTIONS}
          />
        </FormField>

        <p className="rounded-xl border-2 border-surface-200 bg-surface-100 px-4 py-3 text-sm">
          <span className="font-bold">Change summary:</span> {ROLE_LABELS[account.role]} →{" "}
          {ROLE_LABELS[nextRole]}
        </p>

        {mutation.error !== null ? <InlineError message={toErrorMessage(mutation.error)} /> : null}
      </div>
    </Dialog>
  );
}

function PasswordResetDialog({
  account,
  mutation,
  onClose,
}: {
  account: ProfileRow;
  mutation: ResetPasswordMutation;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<"confirm" | "result">("confirm");
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const { show } = useToast();

  const handleConfirm = () => {
    mutation.mutate(undefined, {
      onSuccess: (password) => {
        setTemporaryPassword(password);
        setStage("result");
        show({
          type: password !== null ? "success" : "warning",
          title: password !== null ? "Temporary password generated" : "Reset finished",
          description:
            password !== null
              ? "Copy it now — it is shown once and never stored in readable form."
              : "The service reported success but did not include a readable temporary password.",
        });
      },
    });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
      title={stage === "confirm" ? "Reset password" : "Temporary password"}
      description={
        stage === "confirm"
          ? `A temporary password replaces the current one for ${account.display_name}. It must be changed at the next sign-in and the password is shown only once.`
          : `Share this temporary password with ${account.display_name} through a secure channel. It will not be shown again.`
      }
      footer={
        stage === "confirm" ? (
          <>
            <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button variant="danger" loading={mutation.isPending} onClick={handleConfirm}>
              <KeyRound size={16} aria-hidden="true" /> Reset password
            </Button>
          </>
        ) : (
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        )
      }
    >
      {stage === "confirm" ? (
        mutation.error !== null ? (
          <InlineError message={toErrorMessage(mutation.error)} />
        ) : (
          <p className="text-sm text-muted">
            The reset is audit-logged with your administrator account as the actor. The account
            owner is signed out of active sessions.
          </p>
        )
      ) : temporaryPassword !== null ? (
        <div className="space-y-4">
          <p className="break-all rounded-[14px] border-2 border-stroke bg-surface-100 px-4 py-3 font-mono text-lg font-bold tracking-wide">
            {temporaryPassword}
          </p>
          <div className="flex flex-wrap gap-2">
            <CopyTextButton text={temporaryPassword} label="Copy password" variant="primary" />
            <Button size="sm" variant="secondary" onClick={() => window.print()}>
              <Printer size={15} aria-hidden="true" /> Print
            </Button>
          </div>
        </div>
      ) : (
        <InlineError message="The service reported a successful reset but no temporary password was readable in the response. Generate a new reset or check the service configuration before handing credentials to the user." />
      )}
    </Dialog>
  );
}

function ViewAsDialog({
  account,
  mutation,
  onClose,
}: {
  account: ProfileRow;
  mutation: ViewAsMutation;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<"confirm" | "result">("confirm");
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [session, setSession] = useState<ViewAsStartResponse | null>(null);
  const { show } = useToast();

  const handleStart = () => {
    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      setValidationError(
        "Give a reason of at least 5 characters — it is written to the audit log.",
      );
      return;
    }
    setValidationError(null);
    mutation.mutate(trimmed, {
      onSuccess: (started) => {
        setSession(started);
        setStage("result");
        show({
          type: "success",
          title: "Simulation session created",
          description: "The session is read-only, audit-logged and expires on its own.",
        });
      },
    });
  };

  const token = session?.token ?? session?.access_token ?? null;
  const targetName = session?.profile?.display_name ?? account.display_name;
  const targetRole = session?.profile?.role;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
      title={stage === "confirm" ? "Simulate View-As user" : "Simulation session started"}
      description={
        stage === "confirm"
          ? `Open ${account.display_name}'s experience in a read-only simulation. Writes are blocked by the platform, and the session is recorded in the audit log.`
          : `A read-only simulation session is active for ${targetName}${
              typeof targetRole === "string" ? ` (${humanizeKey(targetRole)})` : ""
            }. It expires automatically (30 minutes by default).`
      }
      footer={
        stage === "confirm" ? (
          <>
            <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button variant="primary" loading={mutation.isPending} onClick={handleStart}>
              <Eye size={16} aria-hidden="true" /> Start simulation
            </Button>
          </>
        ) : (
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        )
      }
    >
      {stage === "confirm" ? (
        <div className="space-y-4">
          <Textarea
            label="Reason for this simulation"
            helperText="Required (at least 5 characters). Stored in the audit log for accountability."
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              if (validationError !== null) setValidationError(null);
            }}
            error={
              validationError ?? (mutation.error !== null ? toErrorMessage(mutation.error) : null)
            }
            maxLength={280}
            showCount
            rows={3}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <dl className="grid gap-2 text-sm">
            {session?.session_id !== undefined ? (
              <div className="flex flex-wrap items-baseline gap-2">
                <dt className="font-bold">Session</dt>
                <dd className="break-all font-mono">{session.session_id}</dd>
              </div>
            ) : null}
            {session?.expires_at !== undefined ? (
              <div className="flex flex-wrap items-baseline gap-2">
                <dt className="font-bold">Expires</dt>
                <dd>{formatDateTime(session.expires_at)}</dd>
              </div>
            ) : null}
          </dl>

          {token !== null ? (
            <div className="space-y-2">
              <p className="text-sm font-bold">Session credential (keep it private)</p>
              <p className="break-all rounded-[14px] border-2 border-stroke bg-surface-100 px-4 py-3 font-mono text-xs">
                {token}
              </p>
              <CopyTextButton text={token} label="Copy token" />
            </div>
          ) : (
            <p className="text-sm text-muted">
              The service did not include a session token in the response. The session may still be
              active — check the audit log before starting another one.
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}

// ============================================================
// Tabs
// ============================================================

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[13px] font-bold text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm">{children}</dd>
    </div>
  );
}

function ProfileTab({
  account,
  nameMutation,
}: {
  account: ProfileRow;
  nameMutation: NameMutation;
}) {
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const handleSaveName = () => {
    if (nameDraft === null) return;
    const trimmed = nameDraft.trim();
    if (trimmed === "") {
      setNameError("Display name cannot be empty.");
      return;
    }
    setNameError(null);
    nameMutation.mutate(trimmed, {
      onSuccess: () => setNameDraft(null),
    });
  };

  return (
    <div className="space-y-6">
      <SectionCard
        id="profile-fields"
        title="Profile"
        description="Account fields stored in the identity directory."
      >
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Username">
            <span className="font-mono">{account.username ?? "—"}</span>{" "}
            <span className="text-muted">(immutable)</span>
          </Detail>

          <Detail label="Display name">
            {nameDraft === null ? (
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{account.display_name}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setNameDraft(account.display_name);
                    setNameError(null);
                    nameMutation.reset();
                  }}
                >
                  Edit
                </Button>
              </span>
            ) : (
              <div className="space-y-3">
                <Input
                  label="Display name"
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  error={
                    nameError ??
                    (nameMutation.error !== null ? toErrorMessage(nameMutation.error) : null)
                  }
                  maxLength={80}
                  showCount
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    loading={nameMutation.isPending}
                    onClick={handleSaveName}
                    sound={false}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setNameDraft(null)}
                    disabled={nameMutation.isPending}
                    sound={false}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </Detail>

          <Detail label="Role">
            <Badge tone="soft" size="sm" world="coral">
              {ROLE_LABELS[account.role]}
            </Badge>
          </Detail>

          <Detail label="Status">
            <span className="flex flex-wrap items-center gap-2">
              <StatusBadge status={account.status} />
              <span className="text-muted">{STATUS_META[account.status].help}</span>
            </span>
          </Detail>

          <Detail label="Must change password">
            {account.must_change_password === true
              ? "Yes — a new password is required at next sign-in."
              : "No"}
          </Detail>

          <Detail label="Equipped theme">{account.equipped_theme ?? "—"}</Detail>

          <Detail label="Created">{formatDateTime(account.created_at)}</Detail>

          <Detail label="Last updated">{formatDateTime(account.updated_at)}</Detail>

          <Detail label="Account ID">
            <span className="flex flex-wrap items-center gap-2">
              <span className="break-all font-mono text-xs">{account.id}</span>
              <CopyTextButton text={account.id} label="Copy" />
            </span>
          </Detail>
        </dl>
      </SectionCard>
    </div>
  );
}

function LearningTab({
  account,
  learningQuery,
}: {
  account: ProfileRow;
  learningQuery: UseQueryResult<LearningData, Error>;
}) {
  const retry = () => {
    void learningQuery.refetch();
  };

  if (learningQuery.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" label="Loading learning record" />
        <Skeleton className="h-48 w-full" label={null} />
      </div>
    );
  }

  const learning = learningQuery.data;
  if (learning === undefined) {
    return (
      <InlineError
        message={toErrorMessage(learningQuery.error ?? "The learning record could not be loaded.")}
        onRetry={retry}
      />
    );
  }

  const isStudent = account.role === "student";

  return (
    <div className="space-y-6">
      {isStudent ? (
        <SectionCard
          id="learning-stats"
          title="Learning summary"
          description="Read-only view of the student's progress signals."
        >
          <DataBlock
            state={learning.stats}
            onRetry={retry}
            isEmpty={(rows) => rows.length === 0}
            emptyTitle="No learning stats yet"
            emptyDescription="Stats appear once the student earns XP, coins or a streak."
          >
            {(rows) => {
              const stats = rows[0];
              if (stats === undefined) return null;
              return (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <StatTile
                      icon={<ShieldCheck size={15} />}
                      label="Level"
                      value={stats.current_level.toLocaleString()}
                    />
                    <StatTile
                      icon={<BookOpen size={15} />}
                      label="Total XP"
                      value={stats.total_xp.toLocaleString()}
                    />
                    <StatTile
                      icon={<Coins size={15} />}
                      label="Coins"
                      value={stats.current_coins.toLocaleString()}
                    />
                    <StatTile
                      icon={<Flame size={15} />}
                      label="Current streak"
                      value={stats.current_streak.toLocaleString()}
                    />
                    <StatTile
                      icon={<CalendarDays size={15} />}
                      label="Longest streak"
                      value={stats.longest_streak.toLocaleString()}
                    />
                  </div>
                  {stats.last_active_date !== null ? (
                    <p className="text-sm text-muted">
                      Last active on {formatDate(stats.last_active_date)}.
                    </p>
                  ) : null}
                </div>
              );
            }}
          </DataBlock>
        </SectionCard>
      ) : null}

      {isStudent ? (
        <SectionCard
          id="learning-streak"
          title="Recent activity days"
          description="The last two weeks of learning activity and streak freezes."
        >
          <DataBlock
            state={learning.streakDays}
            onRetry={retry}
            emptyTitle="No activity days yet"
            emptyDescription="Learning days are recorded when the student completes activities."
          >
            {(days) => (
              <ul className="flex flex-wrap gap-2">
                {days.map((day) => (
                  <li
                    key={day.activity_date}
                    className="rounded-[14px] border-2 border-stroke bg-surface-0 px-3 py-2 text-center shadow-retro-sm"
                  >
                    <p className="font-heading text-[13px] font-semibold">
                      {formatDayLabel(day.activity_date)}
                    </p>
                    <p className="text-xs font-bold tabular-nums">
                      {formatAmount(day.xp_earned)} XP
                    </p>
                    {day.is_frozen ? (
                      <p className="text-[11px] font-bold text-muted">streak freeze</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </DataBlock>
        </SectionCard>
      ) : null}

      {isStudent ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard id="learning-xp" title="Recent XP rewards">
            <DataBlock
              state={learning.xpEntries}
              onRetry={retry}
              emptyTitle="No XP rewards yet"
              emptyDescription="XP entries appear after completed activities."
            >
              {(entries) => (
                <ul className="divide-y-2 divide-surface-200">
                  {entries.map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0 truncate text-sm">{humanizeKey(entry.source)}</span>
                      <span className="shrink-0 text-right">
                        <span className="block font-bold tabular-nums">
                          {formatAmount(entry.amount)} XP
                        </span>
                        <span className="block text-xs text-muted">
                          {formatDateTime(entry.created_at)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </DataBlock>
          </SectionCard>

          <SectionCard id="learning-coins" title="Recent coin rewards">
            <DataBlock
              state={learning.coinEntries}
              onRetry={retry}
              emptyTitle="No coin rewards yet"
              emptyDescription="Coin entries appear after completed activities and purchases."
            >
              {(entries) => (
                <ul className="divide-y-2 divide-surface-200">
                  {entries.map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0 truncate text-sm">{humanizeKey(entry.source)}</span>
                      <span className="shrink-0 text-right">
                        <span className="block font-bold tabular-nums">
                          {formatAmount(entry.amount)} coins
                        </span>
                        <span className="block text-xs text-muted">
                          {formatDateTime(entry.created_at)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </DataBlock>
          </SectionCard>
        </div>
      ) : null}

      <SectionCard
        id="learning-classes"
        title={isStudent ? "Enrolled classes" : "Teaching assignments"}
        description={
          isStudent
            ? "Active enrollments in this school."
            : "Classes where this account is listed as a teacher."
        }
      >
        <DataBlock
          state={learning.memberships}
          onRetry={retry}
          emptyTitle={isStudent ? "No active classes" : "No teaching assignments"}
          emptyDescription={
            isStudent
              ? "The student is not enrolled in an active class right now."
              : "This account is not assigned to any class right now."
          }
        >
          {(memberships) => (
            <ul className="flex flex-wrap gap-2">
              {memberships.map((membership, index) => (
                <li
                  key={membership.classes?.id ?? `membership-${index}`}
                  className="rounded-[14px] border-2 border-stroke bg-surface-0 px-3 py-2 shadow-retro-sm"
                >
                  <p className="text-sm font-bold">
                    {membership.classes?.name ?? "Unknown class"}
                    {membership.is_primary === true ? " · Primary" : ""}
                  </p>
                  <p className="text-xs text-muted">
                    {membership.classes?.grade_level !== null &&
                    membership.classes?.grade_level !== undefined
                      ? `Grade ${membership.classes.grade_level}`
                      : "Grade not set"}
                    {membership.classes?.is_archived === true ? " · archived" : ""}
                    {membership.enrolled_at !== undefined
                      ? ` · enrolled ${formatDate(membership.enrolled_at)}`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </DataBlock>
      </SectionCard>

      {isStudent ? (
        <SectionCard
          id="learning-submissions"
          title="Recent assignment submissions"
          description="The latest submissions recorded for this student."
        >
          <DataBlock
            state={learning.submissions}
            onRetry={retry}
            emptyTitle="No assignment submissions"
            emptyDescription="Submissions appear when the student starts or hands in an assignment."
          >
            {(submissions) => (
              <TableShell caption="Recent assignment submissions">
                <thead>
                  <tr>
                    <th scope="col" className={TH_CLASS}>
                      Assignment
                    </th>
                    <th scope="col" className={TH_CLASS}>
                      Class
                    </th>
                    <th scope="col" className={TH_CLASS}>
                      Status
                    </th>
                    <th scope="col" className={TH_CLASS}>
                      Submitted
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((submission) => (
                    <tr key={submission.id}>
                      <td className={TD_CLASS}>
                        <span className="font-mono text-xs">
                          {submission.assessment_id.slice(0, 8)}
                        </span>
                      </td>
                      <td className={TD_CLASS}>{submission.classes?.name ?? "—"}</td>
                      <td className={TD_CLASS}>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Badge size="sm" status={submissionStatusTone(submission.status)}>
                            {SUBMISSION_LABELS[submission.status] ?? humanizeKey(submission.status)}
                          </Badge>
                          {submission.is_late ? (
                            <span className="text-xs font-bold text-danger-600">late</span>
                          ) : null}
                        </span>
                      </td>
                      <td className={TD_CLASS}>
                        {submission.submitted_at !== null
                          ? formatDateTime(submission.submitted_at)
                          : "Not yet"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            )}
          </DataBlock>
        </SectionCard>
      ) : null}

      {account.role !== "student" ? (
        <SectionCard
          id="learning-courses"
          title="Authored courses"
          description="Courses created by this account, newest first."
        >
          <DataBlock
            state={learning.authoredCourses}
            onRetry={retry}
            emptyTitle="No authored courses"
            emptyDescription="Courses appear here when this account creates curriculum content."
          >
            {(courses) => (
              <TableShell caption="Authored courses">
                <thead>
                  <tr>
                    <th scope="col" className={TH_CLASS}>
                      Course
                    </th>
                    <th scope="col" className={TH_CLASS}>
                      Grade
                    </th>
                    <th scope="col" className={TH_CLASS}>
                      Status
                    </th>
                    <th scope="col" className={TH_CLASS}>
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course) => (
                    <tr key={course.id}>
                      <td className={TD_CLASS}>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold">{course.title}</span>
                          {course.is_official ? (
                            <Badge tone="pop" size="sm">
                              Official
                            </Badge>
                          ) : null}
                        </span>
                      </td>
                      <td className={TD_CLASS}>{course.grade_level ?? "—"}</td>
                      <td className={TD_CLASS}>{humanizeKey(course.status)}</td>
                      <td className={TD_CLASS}>{formatDateTime(course.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            )}
          </DataBlock>
        </SectionCard>
      ) : null}
    </div>
  );
}

function submissionStatusTone(status: string): "success" | "info" | "warning" | undefined {
  switch (status) {
    case "graded":
      return "success";
    case "submitted":
      return "info";
    case "returned":
      return "warning";
    default:
      return undefined;
  }
}

function ActivityTab({
  account,
  activityQuery,
}: {
  account: ProfileRow;
  activityQuery: UseQueryResult<ActivityData, Error>;
}) {
  const retry = () => {
    void activityQuery.refetch();
  };

  if (activityQuery.isPending) {
    return <Skeleton className="h-56 w-full" label="Loading the audit trail" />;
  }

  const activity = activityQuery.data;
  if (activity === undefined) {
    return (
      <InlineError
        message={toErrorMessage(activityQuery.error ?? "The audit trail could not be loaded.")}
        onRetry={retry}
      />
    );
  }

  if (activity.rows.length === 0) {
    return (
      <SectionCard
        id="activity-empty"
        title="Audit trail"
        description="Administrative history for this account."
      >
        <EmptyState
          size="sm"
          title="No entries visible"
          description="Your role reads a scoped slice of the audit log. Entries involving this account may still be recorded and remain readable by a super administrator."
        />
        <p className="mt-4 text-xs text-muted">
          Sign-in attempts are kept in the server-side authentication log and are not exposed to the
          client.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      id="activity-trail"
      title="Audit trail"
      description={`Administrative actions involving ${account.display_name}, newest first (up to 30 entries).`}
    >
      <TableShell caption="Audit entries for this account">
        <thead>
          <tr>
            <th scope="col" className={TH_CLASS}>
              When
            </th>
            <th scope="col" className={TH_CLASS}>
              Actor
            </th>
            <th scope="col" className={TH_CLASS}>
              Action
            </th>
            <th scope="col" className={TH_CLASS}>
              Summary
            </th>
          </tr>
        </thead>
        <tbody>
          {activity.rows.map((row) => {
            const actor = row.actor_id !== null ? activity.actors[row.actor_id] : undefined;
            const actorLabel =
              actor !== undefined
                ? (actor.display_name ?? actor.username ?? "Administrator")
                : (row.actor_id ?? "System");
            return (
              <tr key={row.id}>
                <td className={TD_CLASS}>{formatDateTime(row.created_at)}</td>
                <td className={TD_CLASS}>
                  <span className="block font-semibold">{actorLabel}</span>
                  {row.actor_role !== null ? (
                    <span className="block text-xs text-muted">
                      {ROLE_LABELS[row.actor_role as UserRole] ?? humanizeKey(row.actor_role)}
                    </span>
                  ) : null}
                </td>
                <td className={TD_CLASS}>
                  <span className="block font-semibold">{humanizeKey(row.action)}</span>
                  {row.action_type !== null ? (
                    <span className="block text-xs text-muted">{humanizeKey(row.action_type)}</span>
                  ) : null}
                </td>
                <td className={TD_CLASS}>
                  <span className="block break-words">{row.summary ?? "—"}</span>
                  {row.reason !== null ? (
                    <span className="block text-xs text-muted">Reason: {row.reason}</span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableShell>
      <p className="mt-4 text-xs text-muted">
        Sign-in attempts are kept in the server-side authentication log and are not exposed to the
        client.
      </p>
    </SectionCard>
  );
}

function NotesTab({
  account,
  viewerId,
  notesQuery,
  addNoteMutation,
  deleteNoteMutation,
}: {
  account: ProfileRow;
  viewerId: string;
  notesQuery: UseQueryResult<NotesData, Error>;
  addNoteMutation: AddNoteMutation;
  deleteNoteMutation: DeleteNoteMutation;
}) {
  const [draft, setDraft] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const { show } = useToast();

  const handleSave = () => {
    const trimmed = draft.trim();
    if (trimmed === "") {
      setValidationError("Write the note before saving.");
      return;
    }
    setValidationError(null);
    addNoteMutation.mutate(trimmed, {
      onSuccess: () => {
        setDraft("");
        show({
          type: "success",
          title: "Note saved",
          description: "The note is stored and visible to administrators only.",
        });
      },
    });
  };

  const retry = () => {
    void notesQuery.refetch();
  };

  return (
    <div className="space-y-6">
      <SectionCard
        id="notes-composer"
        title="Private notes"
        description="Visible to administrators only — the account owner never sees these notes."
      >
        <div className="space-y-3">
          <Textarea
            label="New note"
            helperText={`Keep context about ${account.display_name}: support history, follow-ups, decisions.`}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              if (validationError !== null) setValidationError(null);
            }}
            error={
              validationError ??
              (addNoteMutation.error !== null ? toErrorMessage(addNoteMutation.error) : null)
            }
            maxLength={2000}
            showCount
            rows={4}
          />
          <div className="flex justify-end">
            <Button loading={addNoteMutation.isPending} onClick={handleSave}>
              Save note
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard id="notes-feed" title="Note history">
        {notesQuery.isPending ? (
          <Skeleton className="h-32 w-full" label="Loading notes" />
        ) : notesQuery.data === undefined ? (
          <InlineError
            message={toErrorMessage(notesQuery.error ?? "The notes could not be loaded.")}
            onRetry={retry}
          />
        ) : notesQuery.data.notes.length === 0 ? (
          <EmptyState
            size="sm"
            title="No private notes yet"
            description="Notes help staff keep context about this account."
          />
        ) : (
          <ul className="space-y-3">
            {notesQuery.data.notes.map((note) => {
              const author = notesQuery.data.authors[note.author_id];
              const authorLabel =
                author !== undefined
                  ? (author.display_name ?? author.username ?? "Administrator")
                  : "Administrator";
              const confirming = confirmingId === note.id;
              return (
                <li
                  key={note.id}
                  className="rounded-[18px] border-2 border-stroke bg-surface-0 px-4 py-3 shadow-retro-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold text-muted">
                      {authorLabel}
                      {note.author_id === viewerId ? " (you)" : ""} ·{" "}
                      {formatDateTime(note.created_at)}
                    </p>
                    <span className="flex flex-wrap items-center gap-2">
                      {confirming ? (
                        <>
                          <Button
                            size="sm"
                            variant="danger"
                            loading={deleteNoteMutation.isPending}
                            onClick={() => {
                              deleteNoteMutation.mutate(note.id, {
                                onSuccess: () => {
                                  setConfirmingId(null);
                                  show({
                                    type: "success",
                                    title: "Note deleted",
                                    description: "The note was removed from the private log.",
                                  });
                                },
                              });
                            }}
                          >
                            Confirm delete
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setConfirmingId(null)}
                            disabled={deleteNoteMutation.isPending}
                          >
                            Keep
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            deleteNoteMutation.reset();
                            setConfirmingId(note.id);
                          }}
                        >
                          <Trash2 size={15} aria-hidden="true" /> Delete
                        </Button>
                      )}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm">{note.note}</p>
                </li>
              );
            })}
          </ul>
        )}

        {deleteNoteMutation.error !== null ? (
          <div className="mt-4">
            <InlineError message={toErrorMessage(deleteNoteMutation.error)} />
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}

// ============================================================
// Query keys
// ============================================================

const VIEWER_KEY = ["admin", "user-detail", "viewer"] as const;
const profileKey = (userId: string) => ["admin", "user-detail", userId, "profile"] as const;
const learningKey = (userId: string) => ["admin", "user-detail", userId, "learning"] as const;
const activityKey = (userId: string) => ["admin", "user-detail", userId, "activity"] as const;
const notesKey = (userId: string) => ["admin", "user-detail", userId, "notes"] as const;

// ============================================================
// Page
// ============================================================

export default function UserDetailPage() {
  const { userId: userIdParam } = useParams<{ userId: string }>();
  const userId = userIdParam ?? "";
  const queryClient = useQueryClient();
  const { show } = useToast();

  const [lockOpen, setLockOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [viewAsOpen, setViewAsOpen] = useState(false);

  const viewerQuery = useQuery({
    queryKey: VIEWER_KEY,
    queryFn: loadViewerProfile,
    staleTime: 5 * 60_000,
  });

  const profileQuery = useQuery({
    queryKey: profileKey(userId),
    queryFn: () => loadProfile(userId),
    enabled: userId !== "",
  });

  const account = profileQuery.data;
  const viewerAccount = viewerQuery.data;

  const learningQuery = useQuery({
    queryKey: learningKey(userId),
    queryFn: () => loadLearning(userId, account?.role ?? "student"),
    enabled: userId !== "" && account !== undefined,
  });

  const activityQuery = useQuery({
    queryKey: activityKey(userId),
    queryFn: () => loadActivity(userId),
    enabled: userId !== "",
  });

  const notesQuery = useQuery({
    queryKey: notesKey(userId),
    queryFn: () => loadNotes(userId),
    enabled: userId !== "" && viewerAccount !== undefined,
  });

  const viewerId = viewerAccount?.id ?? "";

  const lockMutation = useMutation({
    mutationFn: (nextStatus: UserStatus) => saveUserFields(userId, { status: nextStatus }),
    onSuccess: (_result, nextStatus) => {
      show({
        type: "success",
        title: nextStatus === "locked" ? "Account locked" : "Account unlocked",
        description:
          nextStatus === "locked"
            ? "Sign-in is blocked for this account until it is unlocked."
            : "Sign-in is allowed again for this account.",
      });
      void queryClient.invalidateQueries({ queryKey: profileKey(userId) });
      void queryClient.invalidateQueries({ queryKey: activityKey(userId) });
    },
  });

  const roleMutation = useMutation({
    mutationFn: (nextRole: UserRole) => saveUserFields(userId, { role: nextRole }),
    onSuccess: (_result, nextRole) => {
      show({
        type: "success",
        title: "Role updated",
        description: `The account now has the ${ROLE_LABELS[nextRole]} role.`,
      });
      void queryClient.invalidateQueries({ queryKey: profileKey(userId) });
      void queryClient.invalidateQueries({ queryKey: learningKey(userId) });
      void queryClient.invalidateQueries({ queryKey: activityKey(userId) });
    },
  });

  const nameMutation = useMutation({
    mutationFn: (nextName: string) => saveUserFields(userId, { display_name: nextName }),
    onSuccess: (_result, nextName) => {
      const current = queryClient.getQueryData<ProfileRow>(profileKey(userId));
      const previous = current?.display_name;
      show({
        type: "success",
        title: "Profile saved",
        description:
          previous !== undefined
            ? `Display name changed from “${previous}” to “${nextName}”.`
            : `Display name set to “${nextName}”.`,
      });
      void queryClient.invalidateQueries({ queryKey: profileKey(userId) });
      void queryClient.invalidateQueries({ queryKey: activityKey(userId) });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: (note: string) => {
      if (viewerId === "") throw new Error("Your administrator account could not be identified.");
      return insertAdminNote(userId, viewerId, note);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notesKey(userId) });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => removeAdminNote(noteId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notesKey(userId) });
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => requestPasswordReset(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileKey(userId) });
      void queryClient.invalidateQueries({ queryKey: activityKey(userId) });
    },
  });

  const viewAsMutation = useMutation({
    mutationFn: (reason: string) => startViewAsSession(userId, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: activityKey(userId) });
    },
  });

  const refreshAll = () => {
    void profileQuery.refetch();
    void learningQuery.refetch();
    void activityQuery.refetch();
    void notesQuery.refetch();
  };

  // ---------- Guards ----------

  if (userId === "") {
    return (
      <PageShell>
        <ErrorState
          world="coral"
          title="No account selected"
          description="Open a person from the users directory to review their record."
        />
      </PageShell>
    );
  }

  if (profileQuery.isError || viewerQuery.isError) {
    const failure = profileQuery.isError ? profileQuery.error : viewerQuery.error;
    return (
      <PageShell>
        <ErrorState
          world="coral"
          title="This record could not be loaded"
          description={toErrorMessage(failure)}
          onRetry={() => {
            void profileQuery.refetch();
            void viewerQuery.refetch();
          }}
        />
      </PageShell>
    );
  }

  if (account === undefined || viewerAccount === undefined) {
    return (
      <PageShell>
        <Skeleton className="h-52 w-full" label="Loading the user record" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-40 w-full" label={null} />
          <Skeleton className="h-40 w-full" label={null} />
          <Skeleton className="h-40 w-full" label={null} />
        </div>
      </PageShell>
    );
  }

  const viewerIsAdmin = viewerAccount.role === "admin" || viewerAccount.role === "super_admin";
  const viewerIsSchoolAdmin = viewerAccount.role === "admin";
  const targetIsAdmin = account.role === "admin" || account.role === "super_admin";
  const isSelf = viewerAccount.id === account.id;

  if (!viewerIsAdmin) {
    return (
      <PageShell>
        <ErrorState
          world="coral"
          title="Not available for your role"
          description="User records are managed by school administrators and super administrators."
        />
      </PageShell>
    );
  }

  if (viewerIsSchoolAdmin && targetIsAdmin && !isSelf) {
    return (
      <PageShell>
        <section className="rounded-[26px] border-2 border-stroke bg-surface-0 p-6 shadow-retro-md sm:p-8">
          <p className="inline-flex items-center gap-2 rounded-full border-2 border-stroke bg-surface-0 px-3 py-1 text-xs font-extrabold uppercase tracking-wider">
            <ShieldAlert size={15} aria-hidden="true" /> Restricted record
          </p>
          <h1 className="mt-4 font-heading text-3xl font-bold">Administrator account</h1>
          <p className="mt-2 max-w-2xl text-muted">
            School administrators cannot open administrator accounts. Only a super administrator can
            view or manage this account.
          </p>
          <div className="mt-6">
            <Link
              to="/admin"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-stroke bg-surface-0 px-4 font-bold shadow-retro-sm"
            >
              <ArrowLeft size={17} aria-hidden="true" /> Back to the admin dashboard
            </Link>
          </div>
        </section>
      </PageShell>
    );
  }

  // ---------- Derived view state ----------

  const actionHints: string[] = [];
  if (isSelf) {
    actionHints.push(
      "You are reviewing your own account: locking yourself out, changing your own role and self-simulation are disabled.",
    );
  }
  if (account.status === "archived") {
    actionHints.push(
      "Archived accounts cannot sign in; locking and unlocking do not apply. Restore is not available from this page.",
    );
  }
  if (targetIsAdmin && !isSelf) {
    actionHints.push(
      "Administrator roles and simulations are managed in the administrator directory.",
    );
  }

  const lockDisabled = isSelf || account.status === "archived";
  const roleDisabled = isSelf || targetIsAdmin;
  const resetDisabled = isSelf;
  const viewAsDisabled = isSelf || targetIsAdmin || account.status === "archived";
  const refreshing =
    profileQuery.isFetching ||
    learningQuery.isFetching ||
    activityQuery.isFetching ||
    notesQuery.isFetching;

  return (
    <PageShell>
      <header className="rounded-[26px] border-2 border-stroke bg-world-coral-200 p-6 shadow-retro-md sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/admin" className="text-sm font-bold underline underline-offset-4">
            Admin dashboard
          </Link>
          <Button
            variant="secondary"
            size="sm"
            onClick={refreshAll}
            loading={refreshing}
            sound={false}
          >
            <RefreshCw size={15} aria-hidden="true" /> Refresh
          </Button>
        </div>

        <div className="mt-5 flex flex-wrap items-start gap-4">
          <Avatar
            size="xl"
            src={account.avatar_url}
            name={account.display_name}
            className="shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-2 rounded-full border-2 border-stroke bg-surface-0 px-3 py-1 text-xs font-extrabold uppercase tracking-wider">
              <ShieldCheck size={15} aria-hidden="true" /> User dossier
            </p>
            <h1 className="mt-3 break-words font-heading text-3xl font-bold sm:text-4xl">
              {account.display_name}
            </h1>
            <p className="mt-1 font-mono text-sm text-muted">{account.username ?? account.id}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone="soft" size="sm" world="coral">
                {ROLE_LABELS[account.role]}
              </Badge>
              <StatusBadge status={account.status} />
              {account.must_change_password === true ? (
                <Badge status="warning" size="sm">
                  Must change password
                </Badge>
              ) : null}
            </div>
            <p className="mt-3 text-sm text-muted">
              Created {formatDateTime(account.created_at)} · Last updated{" "}
              {formatDateTime(account.updated_at)}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            variant={account.status === "locked" ? "success" : "danger"}
            onClick={() => {
              lockMutation.reset();
              setLockOpen(true);
            }}
            disabled={lockDisabled}
          >
            {account.status === "locked" ? (
              <LockOpen size={17} aria-hidden="true" />
            ) : (
              <Lock size={17} aria-hidden="true" />
            )}
            {account.status === "locked" ? "Unlock account" : "Lock account"}
          </Button>

          <Button
            variant="secondary"
            onClick={() => {
              resetMutation.reset();
              setResetOpen(true);
            }}
            disabled={resetDisabled}
          >
            <KeyRound size={17} aria-hidden="true" /> Reset password
          </Button>

          <Button
            variant="secondary"
            onClick={() => {
              roleMutation.reset();
              setRoleOpen(true);
            }}
            disabled={roleDisabled}
          >
            <UserCog size={17} aria-hidden="true" /> Change role
          </Button>

          <Button
            variant="secondary"
            onClick={() => {
              viewAsMutation.reset();
              setViewAsOpen(true);
            }}
            disabled={viewAsDisabled}
          >
            <Eye size={17} aria-hidden="true" /> Simulate View-As user
          </Button>
        </div>

        {actionHints.length > 0 ? (
          <ul className="mt-4 space-y-1 text-xs text-muted">
            {actionHints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        ) : null}
      </header>

      <Tabs defaultValue="profile">
        <TabsList aria-label="User record sections">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="learning">Learning</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab account={account} nameMutation={nameMutation} />
        </TabsContent>

        <TabsContent value="learning">
          <LearningTab account={account} learningQuery={learningQuery} />
        </TabsContent>

        <TabsContent value="activity">
          <ActivityTab account={account} activityQuery={activityQuery} />
        </TabsContent>

        <TabsContent value="notes">
          <NotesTab
            account={account}
            viewerId={viewerAccount.id}
            notesQuery={notesQuery}
            addNoteMutation={addNoteMutation}
            deleteNoteMutation={deleteNoteMutation}
          />
        </TabsContent>
      </Tabs>

      {lockOpen ? (
        <LockToggleDialog
          account={account}
          mutation={lockMutation}
          onClose={() => setLockOpen(false)}
        />
      ) : null}

      {roleOpen ? (
        <RoleChangeDialog
          account={account}
          mutation={roleMutation}
          onClose={() => setRoleOpen(false)}
        />
      ) : null}

      {resetOpen ? (
        <PasswordResetDialog
          account={account}
          mutation={resetMutation}
          onClose={() => setResetOpen(false)}
        />
      ) : null}

      {viewAsOpen ? (
        <ViewAsDialog
          account={account}
          mutation={viewAsMutation}
          onClose={() => setViewAsOpen(false)}
        />
      ) : null}
    </PageShell>
  );
}
