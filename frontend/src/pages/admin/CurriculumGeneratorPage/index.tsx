// frontend/src/pages/admin/CurriculumGeneratorPage/index.tsx
//
// ADM-09 (AD-10) — AI Official Curriculum Wizard — /admin/curriculum/generate
//
// Three-step wizard that drafts a year-long official curriculum for one grade:
//   1. Plan      grade (7-12), academic weeks (30-40), CEFR target (A1-B2),
//                core themes (Grammar / Fiction / Essay Writing)
//   2. Generate  dispatches the `ai_curriculum` background job (jobs / job_steps,
//                migration 016) and tracks it through Supabase Realtime with a
//                3 s polling fallback (frontend/docs/ARCHITECTURE.md → Jobs)
//   3. Review    reads the generated draft (courses / units / lessons plus draft
//                milestone quizzes) so an admin can review before publishing.
//                Nothing is student-visible until the curriculum is published (AD-09).
//
// Backend contract:
//   - jobs.kind = 'ai_curriculum' with scope/shape input params
//     (backend/docs/05-API-CONTRACT.md §8: `ai_curriculum | scope, shape |
//     outline, unit steps, coverage`).
//   - Progress rows live in job_steps; admins read all rows through the
//     "Jobs admin" / "Admins read all job steps" policies (migration 018).
//   - The linked draft course comes from jobs.result_payload (`course_id` or
//     `curriculum_version_id`) with a same-author fallback while the
//     `ai_curriculum` handler (BE-EDGE-11/12 seam) is still being implemented.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Check,
  Clock,
  GraduationCap,
  Layers,
  ListChecks,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import { z } from "zod";
import { env } from "@/shared/config/env";
import { supabase } from "@/shared/api/supabase";
import { useToast } from "@/shared/hooks/useToast";

/* ------------------------------------------------------------------------ */
/* Constants                                                                */
/* ------------------------------------------------------------------------ */

/** Official curricula always ship as six units (ADM-09 acceptance criteria). */
const UNITS_PER_COURSE = 6;

const MIN_GRADE = 7;
const MAX_GRADE = 12;
const MIN_WEEKS = 30;
const MAX_WEEKS = 40;
const MIN_LESSONS_PER_UNIT = 4;
const MAX_LESSONS_PER_UNIT = 8;

/** Track an active job every 3 s; retry slower when the read itself fails. */
const ACTIVE_JOB_REFETCH_MS = 3000;
const ERROR_JOB_REFETCH_MS = 10000;

const GRADE_OPTIONS = [7, 8, 9, 10, 11, 12] as const;

const CEFR_OPTIONS = [
  { value: "A1", label: "A1 · Beginner" },
  { value: "A2", label: "A2 · Elementary" },
  { value: "B1", label: "B1 · Intermediate" },
  { value: "B2", label: "B2 · Upper intermediate" },
] as const;

/**
 * UI prefill mirror of GRADE_CEFR_MAP in
 * supabase/functions/_shared/ai/prompts.ts — only used to recommend a target
 * when the grade changes; admins stay free to override it.
 */
const CEFR_BY_GRADE: Readonly<Record<number, string>> = {
  7: "A1",
  8: "A2",
  9: "B1",
  10: "B2",
  11: "B2",
  12: "B2",
};

const THEME_OPTIONS = [
  { value: "grammar", label: "Grammar", hint: "Structures, rules and accuracy drills" },
  { value: "fiction", label: "Fiction", hint: "Stories, literature and reading fluency" },
  { value: "essay_writing", label: "Essay Writing", hint: "Composition, drafting and style" },
] as const;

/** Human-readable titles for job_steps.name values written by the runner. */
const JOB_STEP_LABELS: Readonly<Record<string, string>> = {
  started: "Worker claimed the job",
  outline: "Drafting the course outline",
  expand_units: "Expanding units into weekly lessons",
  lesson_content: "Writing lesson content and quizzes",
  assemble: "Assembling the official draft",
  completed: "Generation finished",
  failed: "Generation failed",
};

const EMPTY_STEPS: CurriculumJobStepRow[] = [];

/* ------------------------------------------------------------------------ */
/* Schemas — source of truth for the wizard form types                      */
/* ------------------------------------------------------------------------ */

const cefrSchema = z.enum(["A1", "A2", "B1", "B2"]);
const themeSchema = z.enum(["grammar", "fiction", "essay_writing"]);

const generationFormSchema = z.object({
  grade: z.coerce
    .number()
    .int()
    .min(MIN_GRADE, `Choose a grade between ${MIN_GRADE} and ${MAX_GRADE}.`)
    .max(MAX_GRADE, `Choose a grade between ${MIN_GRADE} and ${MAX_GRADE}.`),
  weeks: z.coerce
    .number()
    .int()
    .min(MIN_WEEKS, `Academic weeks must be between ${MIN_WEEKS} and ${MAX_WEEKS}.`)
    .max(MAX_WEEKS, `Academic weeks must be between ${MIN_WEEKS} and ${MAX_WEEKS}.`),
  cefr: cefrSchema,
  themes: z.array(themeSchema).min(1, "Choose at least one core theme."),
});

type CefrLevel = z.infer<typeof cefrSchema>;
type CoreTheme = z.infer<typeof themeSchema>;
type GenerationInput = z.infer<typeof generationFormSchema>;

/* ------------------------------------------------------------------------ */
/* Row types (shape of the REST payloads used by this page)                 */
/* ------------------------------------------------------------------------ */

type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
type JobStepStatus = "pending" | "running" | "completed" | "failed";
type WizardStage = "plan" | "generate" | "review";

interface CurriculumJobRow {
  id: string;
  kind: string;
  status: JobStatus;
  initiator_id: string;
  input_params: unknown;
  result_payload: unknown;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface CurriculumJobStepRow {
  id: string;
  job_id: string;
  step_index: number;
  name: string;
  status: JobStepStatus;
  progress_percent: number;
  log: string | null;
  started_at: string | null;
  completed_at: string | null;
}

interface CourseRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  grade_level: string | null;
  is_official: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

interface UnitRow {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  order_index: number;
}

interface LessonRow {
  id: string;
  unit_id: string;
  title: string;
  description: string | null;
  order_index: number;
  xp_reward: number;
  coin_reward: number;
}

interface AssessmentRow {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  status: string;
  created_at: string;
}

interface JobSnapshot {
  job: CurriculumJobRow;
  steps: CurriculumJobStepRow[];
}

interface SyllabusUnit extends UnitRow {
  lessons: LessonRow[];
}

interface SyllabusBundle {
  course: CourseRow;
  units: SyllabusUnit[];
  checkpoints: AssessmentRow[];
}

/** Normalized view of jobs.input_params for summaries and the review stage. */
interface ParsedScope {
  grade: number | null;
  weeks: number | null;
  cefr: CefrLevel | null;
  themes: CoreTheme[];
}

interface KickResult {
  notified: boolean;
  detail: string | null;
}

/** Narrow view of the Edge Function response (the SDK types `error` as `any`). */
interface RunnerInvokeResponse {
  error: { message: string } | null;
}

interface FormIssue {
  field: string;
  message: string;
}

/* ------------------------------------------------------------------------ */
/* Small utilities                                                          */
/* ------------------------------------------------------------------------ */

function errorMessageOf(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : "Something went wrong. Please try again.";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatDateTime(value: string | null): string {
  if (value === null) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    date,
  );
}

function formatRelative(value: string): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) {
    return "—";
  }
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) {
    return "just now";
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours} h ago`;
  }
  return `${Math.round(hours / 24)} d ago`;
}

function stepLabel(name: string): string {
  const known = JOB_STEP_LABELS[name];
  return known ?? name.replace(/_/g, " ");
}

function themeLabel(theme: CoreTheme): string {
  const match = THEME_OPTIONS.find((option) => option.value === theme);
  return match?.label ?? theme;
}

/** Distribute the academic weeks across the six units: unit 1 => weeks 1-5, … */
function unitWeekRange(unitIndex: number, weeks: number): { start: number; end: number } {
  const start = Math.floor((unitIndex * weeks) / UNITS_PER_COURSE) + 1;
  const end = Math.floor(((unitIndex + 1) * weeks) / UNITS_PER_COURSE);
  return { start, end: Math.max(start, end) };
}

/** Derive how many lessons each of the six units targets from the week count. */
function lessonsPerUnitFor(weeks: number): number {
  return clamp(Math.round(weeks / UNITS_PER_COURSE), MIN_LESSONS_PER_UNIT, MAX_LESSONS_PER_UNIT);
}

/* ------------------------------------------------------------------------ */
/* Defensive readers for jobs.input_params / jobs.result_payload            */
/* ------------------------------------------------------------------------ */

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function readString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNumber(source: Record<string, unknown>, key: string): number | null {
  const value = source[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseThemes(value: unknown): CoreTheme[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const themes: CoreTheme[] = [];
  for (const item of value as unknown[]) {
    const parsed = themeSchema.safeParse(item);
    if (parsed.success) {
      themes.push(parsed.data);
    }
  }
  return themes;
}

function parseCefr(value: string | null): CefrLevel | null {
  const parsed = cefrSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function parseJobScope(job: CurriculumJobRow): ParsedScope {
  const top = asRecord(job.input_params);
  const nestedScope = top === null ? null : asRecord(top["scope"]);
  const source: Record<string, unknown> = nestedScope ?? top ?? {};
  return {
    grade: readNumber(source, "grade"),
    weeks: readNumber(source, "weeks"),
    cefr: parseCefr(readString(source, "cefr_target") ?? readString(source, "cefr")),
    themes: parseThemes(source["themes"]),
  };
}

/**
 * Build jobs.input_params. The task wires grade/weeks/cefr/themes at the top
 * level while the API contract (backend/docs/05-API-CONTRACT.md §8) names the
 * same payload `scope` + `shape`, so both views are provided for the handler.
 */
function buildJobParams(input: GenerationInput): Record<string, unknown> {
  const lessonsPerUnit = lessonsPerUnitFor(input.weeks);
  return {
    grade: input.grade,
    weeks: input.weeks,
    cefr_target: input.cefr,
    themes: input.themes,
    units: UNITS_PER_COURSE,
    lessons_per_unit: lessonsPerUnit,
    scope: {
      grade: input.grade,
      weeks: input.weeks,
      cefr_target: input.cefr,
      themes: input.themes,
    },
    shape: {
      units: UNITS_PER_COURSE,
      lessons_per_unit: lessonsPerUnit,
      assessment_pattern: "quiz_per_unit",
    },
  };
}

/* ------------------------------------------------------------------------ */
/* Data access (PostgREST, mirroring the other admin pages)                 */
/* ------------------------------------------------------------------------ */

const apiBase = `${env.VITE_SUPABASE_URL.replace(/\/$/, "")}/rest/v1`;

const JOB_SELECT =
  "id,kind,status,initiator_id,input_params,result_payload,error_message,started_at,completed_at,created_at";
const JOB_STEP_SELECT =
  "id,job_id,step_index,name,status,progress_percent,log,started_at,completed_at";

interface SessionInfo {
  accessToken: string;
  userId: string;
}

/** Read the current session or fail with an actionable message. */
async function requireSession(): Promise<SessionInfo> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(`Could not read the current session: ${error.message}`);
  }
  if (data.session === null) {
    throw new Error("Sign in as an administrator to generate a curriculum.");
  }
  return { accessToken: data.session.access_token, userId: data.session.user.id };
}

async function restFetch(path: string, init?: RequestInit): Promise<Response> {
  const session = await requireSession();
  const headers = new Headers({
    apikey: env.VITE_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
  });
  if (init?.headers !== undefined) {
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  }
  const response = await fetch(`${apiBase}/${path}`, { ...init, headers });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Request to ${path.replace(/\?.*$/, "")} failed (${response.status}): ${detail}`,
    );
  }
  return response;
}

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await restFetch(path, init);
  return (await response.json()) as T;
}

async function restVoid(path: string, init?: RequestInit): Promise<void> {
  await restFetch(path, init);
}

/** Create the async generation job that drafts the official curriculum. */
async function createCurriculumJob(input: GenerationInput): Promise<CurriculumJobRow> {
  const session = await requireSession();
  const rows = await rest<CurriculumJobRow[]>("jobs", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      kind: "ai_curriculum",
      initiator_id: session.userId,
      input_params: buildJobParams(input),
    }),
  });
  const created = rows[0];
  if (created === undefined) {
    throw new Error("The generation job was created but no row was returned.");
  }
  return created;
}

async function fetchJobSnapshot(jobId: string): Promise<JobSnapshot> {
  const id = encodeURIComponent(jobId);
  const [jobs, steps] = await Promise.all([
    rest<CurriculumJobRow[]>(`jobs?select=${JOB_SELECT}&id=eq.${id}&limit=1`),
    rest<CurriculumJobStepRow[]>(
      `job_steps?select=${JOB_STEP_SELECT}&job_id=eq.${id}&order=step_index.asc,started_at.asc`,
    ),
  ]);
  const job = jobs[0];
  if (job === undefined) {
    throw new Error("This generation job could not be found (it may have been removed).");
  }
  return { job, steps };
}

async function fetchRecentJobs(): Promise<CurriculumJobRow[]> {
  return rest<CurriculumJobRow[]>(
    `jobs?select=${JOB_SELECT}&kind=eq.ai_curriculum&order=created_at.desc&limit=5`,
  );
}

async function cancelCurriculumJob(jobId: string): Promise<void> {
  await restVoid(`jobs?id=eq.${encodeURIComponent(jobId)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "cancelled", completed_at: new Date().toISOString() }),
  });
}

/**
 * Best-effort nudge for the background runner. The platform may also trigger
 * the runner through its own scheduler; a declined nudge is reported back to
 * the admin instead of being silently swallowed.
 */
async function kickJobRunner(jobId: string): Promise<KickResult> {
  try {
    const response = (await supabase.functions.invoke(
      `job-runner?job_id=${encodeURIComponent(jobId)}&kind=ai_curriculum`,
    )) as RunnerInvokeResponse;
    if (response.error !== null) {
      return { notified: false, detail: response.error.message };
    }
    return { notified: true, detail: null };
  } catch (error) {
    return {
      notified: false,
      detail: error instanceof Error ? error.message : "The Edge Function call failed.",
    };
  }
}

/* ------------------------------------------------------------------------ */
/* Review-stage reads                                                       */
/* ------------------------------------------------------------------------ */

/** Extract the draft course id the handler reported in jobs.result_payload. */
function courseIdFromResult(job: CurriculumJobRow): string | null {
  const payload = asRecord(job.result_payload);
  if (payload === null) {
    return null;
  }
  return readString(payload, "course_id") ?? readString(payload, "curriculum_version_id");
}

/**
 * Resolve which draft course belongs to a completed job. Primary source is
 * result_payload (course_id / curriculum_version_id). Until the ai_curriculum
 * handler reports an id, fall back to the most recent draft authored by the
 * same admin after the job was dispatched.
 */
async function resolveDraftCourseId(job: CurriculumJobRow): Promise<string | null> {
  const reported = courseIdFromResult(job);
  if (reported !== null) {
    return reported;
  }
  const rows = await rest<Array<{ id: string }>>(
    `courses?select=id&author_id=eq.${encodeURIComponent(job.initiator_id)}&status=eq.draft&created_at=gte.${encodeURIComponent(job.created_at)}&order=created_at.desc&limit=1`,
  );
  const latest = rows[0];
  return latest === undefined ? null : latest.id;
}

/**
 * Draft milestone quizzes (unit checkpoints) created while the job ran. Until
 * the handler reports assessment ids in result_payload, the review binds them
 * to the job through the initiator plus the job's creation window.
 */
async function loadMilestoneCheckpoints(job: CurriculumJobRow): Promise<AssessmentRow[]> {
  const from = encodeURIComponent(job.started_at ?? job.created_at);
  const to =
    job.completed_at === null ? "" : `&created_at=lte.${encodeURIComponent(job.completed_at)}`;
  return rest<AssessmentRow[]>(
    `assessments?select=id,title,description,kind,status,created_at&author_id=eq.${encodeURIComponent(job.initiator_id)}&kind=eq.quiz&created_at=gte.${from}${to}&order=created_at.asc&limit=24`,
  );
}

async function loadSyllabus(job: CurriculumJobRow): Promise<SyllabusBundle | null> {
  const courseId = await resolveDraftCourseId(job);
  if (courseId === null) {
    return null;
  }
  const courseRows = await rest<CourseRow[]>(
    `courses?select=id,title,slug,description,grade_level,is_official,status,created_at,updated_at&id=eq.${encodeURIComponent(courseId)}&limit=1`,
  );
  const course = courseRows[0];
  if (course === undefined) {
    throw new Error("The linked draft course could not be read.");
  }

  const unitRows = await rest<UnitRow[]>(
    `units?select=id,course_id,title,description,order_index&course_id=eq.${encodeURIComponent(courseId)}&order=order_index.asc`,
  );

  const unitIds = unitRows.map((unit) => unit.id);
  const [lessons, checkpoints] = await Promise.all([
    unitIds.length === 0
      ? Promise.resolve<LessonRow[]>([])
      : rest<LessonRow[]>(
          `lessons?select=id,unit_id,title,description,order_index,xp_reward,coin_reward&unit_id=in.(${unitIds.map(encodeURIComponent).join(",")})&order=order_index.asc`,
        ),
    loadMilestoneCheckpoints(job),
  ]);

  const units = unitRows.map((unit) => ({
    ...unit,
    lessons: lessons.filter((lesson) => lesson.unit_id === unit.id),
  }));

  return { course, units, checkpoints };
}

/* ------------------------------------------------------------------------ */
/* Presentational pieces                                                    */
/* ------------------------------------------------------------------------ */

const WIZARD_STEPS: ReadonlyArray<{ stage: WizardStage; label: string }> = [
  { stage: "plan", label: "Plan" },
  { stage: "generate", label: "Generate" },
  { stage: "review", label: "Review" },
];

function StepRail({ stage }: { stage: WizardStage }) {
  const activeIndex = WIZARD_STEPS.findIndex((step) => step.stage === stage);
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label="Wizard progress">
      {WIZARD_STEPS.map((step, index) => {
        const isDone = index < activeIndex;
        const isCurrent = index === activeIndex;
        return (
          <li key={step.stage} className="flex items-center gap-2">
            {index > 0 ? (
              <span aria-hidden="true" className="h-0.5 w-6 rounded-full bg-stroke" />
            ) : null}
            <span
              aria-current={isCurrent ? "step" : undefined}
              className={`inline-flex items-center gap-2 rounded-full border-2 border-stroke px-3 py-1 text-sm font-bold shadow-retro-sm ${
                isCurrent
                  ? "bg-world-amber-400 text-ink-900"
                  : isDone
                    ? "bg-world-mint-200 text-ink-900"
                    : "bg-surface-0 text-muted"
              }`}
            >
              <span className="grid h-5 w-5 place-items-center rounded-full border-2 border-stroke bg-surface-0 text-xs text-ink-900">
                {isDone ? <Check className="h-3 w-3" aria-hidden="true" /> : index + 1}
              </span>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const JOB_STATUS_STYLES: Readonly<Record<JobStatus, string>> = {
  queued: "bg-surface-200 text-muted",
  running: "bg-world-amber-200 text-ink-900",
  completed: "bg-world-mint-200 text-ink-900",
  failed: "bg-world-rose-200 text-ink-900",
  cancelled: "bg-surface-100 text-muted",
};

function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border-2 border-stroke px-2.5 py-0.5 text-xs font-bold capitalize ${JOB_STATUS_STYLES[status]}`}
    >
      {status === "running" ? (
        <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      ) : null}
      {status}
    </span>
  );
}

function StepStatusIcon({ status }: { status: JobStepStatus }) {
  if (status === "completed") {
    return <Check className="h-4 w-4 text-world-mint-700" aria-hidden="true" />;
  }
  if (status === "failed") {
    return <XCircle className="h-4 w-4 text-world-rose-700" aria-hidden="true" />;
  }
  if (status === "running") {
    return (
      <Loader2
        className="h-4 w-4 animate-spin text-world-amber-600 motion-reduce:animate-none"
        aria-hidden="true"
      />
    );
  }
  return <Clock className="h-4 w-4 text-muted" aria-hidden="true" />;
}

function ProgressBar({ percent, label }: { percent: number; label: string }) {
  const clamped = clamp(Math.round(percent), 0, 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className="h-3 w-full overflow-hidden rounded-full border-2 border-stroke bg-surface-100"
    >
      <div
        className="h-full rounded-full bg-world-amber-500 transition-[width] duration-300 ease-out motion-reduce:transition-none"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Page                                                                     */
/* ------------------------------------------------------------------------ */

export default function CurriculumGeneratorPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const jobId = searchParams.get("job");

  const gradeFieldId = useId();
  const weeksFieldId = useId();
  const cefrFieldId = useId();

  const [grade, setGrade] = useState<number>(9);
  const [weeksInput, setWeeksInput] = useState("34");
  const [cefr, setCefr] = useState<CefrLevel>("B1");
  const [themes, setThemes] = useState<CoreTheme[]>(["grammar", "fiction", "essay_writing"]);
  const [formIssues, setFormIssues] = useState<FormIssue[]>([]);
  const [kickResult, setKickResult] = useState<KickResult | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  /* ----- Track the dispatched job (Realtime + 3 s polling fallback) ----- */

  const jobQuery = useQuery({
    queryKey: ["curriculum-job", jobId],
    enabled: jobId !== null,
    queryFn: async () => {
      if (jobId === null) {
        throw new Error("No generation job selected.");
      }
      return fetchJobSnapshot(jobId);
    },
    refetchInterval: (query) => {
      const status = query.state.data?.job.status;
      if (status === "completed" || status === "failed" || status === "cancelled") {
        return false;
      }
      return query.state.status === "error" ? ERROR_JOB_REFETCH_MS : ACTIVE_JOB_REFETCH_MS;
    },
  });

  const job = jobQuery.data?.job ?? null;
  const steps = jobQuery.data?.steps ?? EMPTY_STEPS;

  const stage: WizardStage =
    jobId === null ? "plan" : job?.status === "completed" ? "review" : "generate";

  const scope = useMemo(() => (job === null ? null : parseJobScope(job)), [job]);

  const totalPercent =
    job?.status === "completed"
      ? 100
      : steps.reduce((max, step) => Math.max(max, step.progress_percent), 0);

  const runningStep = steps.find((step) => step.status === "running") ?? null;

  useEffect(() => {
    if (jobId === null) {
      return;
    }
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ["curriculum-job", jobId] });
      void queryClient.invalidateQueries({ queryKey: ["curriculum-jobs-recent"] });
    };
    const channel = supabase
      .channel(`curriculum-job-${jobId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs", filter: `id=eq.${jobId}` },
        invalidate,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "job_steps", filter: `job_id=eq.${jobId}` },
        invalidate,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [jobId, queryClient]);

  /* ----- Announce terminal transitions once ----- */

  const lastStatusRef = useRef<JobStatus | null>(null);
  useEffect(() => {
    const status = job?.status ?? null;
    if (status === null || status === lastStatusRef.current) {
      return;
    }
    const previous = lastStatusRef.current;
    lastStatusRef.current = status;
    if (previous === null) {
      return;
    }
    if (status === "completed") {
      toast.show({
        title: "Curriculum draft ready",
        description: "Review the generated syllabus before publishing.",
        type: "success",
      });
    } else if (status === "failed") {
      toast.show({
        title: "Generation failed",
        description: job?.error_message ?? "The runner did not report a reason.",
        type: "error",
      });
    } else if (status === "cancelled") {
      toast.show({ title: "Generation cancelled", type: "warning" });
    }
  }, [job?.status, job?.error_message, toast]);

  /* ----- Review reads ----- */

  const syllabusQuery = useQuery({
    queryKey: ["curriculum-syllabus", jobId, job?.completed_at],
    enabled: job !== null && job.status === "completed",
    queryFn: async () => {
      const snapshot = jobQuery.data;
      if (snapshot === undefined) {
        throw new Error("The generation job is not loaded yet.");
      }
      return loadSyllabus(snapshot.job);
    },
    staleTime: 30000,
  });

  const recentQuery = useQuery({
    queryKey: ["curriculum-jobs-recent"],
    queryFn: fetchRecentJobs,
    staleTime: 15000,
  });

  /* ----- Writes ----- */

  const dispatchMutation = useMutation({
    mutationFn: async (input: GenerationInput) => {
      const created = await createCurriculumJob(input);
      const kick = await kickJobRunner(created.id);
      return { job: created, kick };
    },
    onSuccess: ({ job: created, kick }) => {
      setKickResult(kick);
      setConfirmingCancel(false);
      setSearchParams({ job: created.id });
      void queryClient.invalidateQueries({ queryKey: ["curriculum-jobs-recent"] });
      if (kick.notified) {
        toast.show({
          title: "Generation started",
          description: "The draft appears here as soon as the runner finishes.",
          type: "success",
        });
      } else {
        toast.show({
          title: "Job queued",
          description: "The background runner will pick it up shortly.",
          type: "info",
        });
      }
    },
    onError: (error) => {
      toast.show({
        title: "Could not start generation",
        description: errorMessageOf(error),
        type: "error",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelCurriculumJob,
    onSuccess: () => {
      setConfirmingCancel(false);
      toast.show({
        title: "Generation cancelled",
        description: "No further steps will run for this job.",
        type: "warning",
      });
      if (jobId !== null) {
        void queryClient.invalidateQueries({ queryKey: ["curriculum-job", jobId] });
      }
      void queryClient.invalidateQueries({ queryKey: ["curriculum-jobs-recent"] });
    },
    onError: (error) => {
      setConfirmingCancel(false);
      toast.show({
        title: "Could not cancel the job",
        description: errorMessageOf(error),
        type: "error",
      });
    },
  });

  const kickMutation = useMutation({
    mutationFn: async () => {
      if (jobId === null) {
        throw new Error("No generation job selected.");
      }
      return kickJobRunner(jobId);
    },
    onSuccess: (result) => {
      setKickResult(result);
      if (result.notified) {
        toast.show({ title: "Worker notified", type: "success" });
      } else {
        toast.show({
          title: "Worker not notified",
          description: result.detail ?? "The runner declined the request.",
          type: "warning",
        });
      }
    },
    onError: (error) => {
      toast.show({
        title: "Could not reach the worker",
        description: errorMessageOf(error),
        type: "error",
      });
    },
  });

  /* ----- Handlers ----- */

  const handleGradeChange = (value: number) => {
    setGrade(value);
    const recommended = CEFR_BY_GRADE[value];
    if (recommended !== undefined) {
      const parsed = cefrSchema.safeParse(recommended);
      if (parsed.success) {
        setCefr(parsed.data);
      }
    }
  };

  const toggleTheme = (theme: CoreTheme) => {
    setThemes((current) =>
      current.includes(theme) ? current.filter((item) => item !== theme) : [...current, theme],
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = generationFormSchema.safeParse({
      grade,
      weeks: weeksInput,
      cefr,
      themes,
    });
    if (!parsed.success) {
      setFormIssues(
        parsed.error.issues.map((issue) => ({
          field: String(issue.path[0] ?? "form"),
          message: issue.message,
        })),
      );
      return;
    }
    setFormIssues([]);
    dispatchMutation.mutate(parsed.data);
  };

  const openJob = (id: string) => {
    setKickResult(null);
    setConfirmingCancel(false);
    setSearchParams({ job: id });
  };

  const backToPlan = () => {
    setKickResult(null);
    setConfirmingCancel(false);
    setSearchParams({});
  };

  const handleCancelClick = () => {
    if (jobId === null) {
      return;
    }
    if (!confirmingCancel) {
      setConfirmingCancel(true);
      return;
    }
    cancelMutation.mutate(jobId);
  };

  const fieldIssue = (field: string) => formIssues.find((issue) => issue.field === field)?.message;

  const previewWeeks = Number.isFinite(Number(weeksInput))
    ? clamp(Math.round(Number(weeksInput)), MIN_WEEKS, MAX_WEEKS)
    : 34;
  const previewLessonsPerUnit = lessonsPerUnitFor(previewWeeks);
  const syllabus = syllabusQuery.data ?? null;

  const controlClass =
    "w-full rounded-xl border-2 border-stroke bg-surface-0 px-3 py-2 text-sm font-semibold text-ink-900 shadow-retro-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke";
  const errorTextClass = "text-xs font-semibold text-world-rose-700";
  const secondaryButtonClass =
    "inline-flex items-center gap-2 rounded-xl border-2 border-stroke bg-surface-0 px-3 py-2 text-sm font-bold shadow-retro-sm transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none";

  return (
    <main
      data-world="amber"
      className="min-h-screen bg-world-amber-50 px-4 py-8 font-body text-ink-900 sm:px-6 lg:px-10"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="rounded-2xl border-2 border-stroke bg-world-amber-200 p-6 shadow-retro-md">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex max-w-2xl flex-col gap-2">
              <Link
                to="/admin/curriculum"
                className="inline-flex w-fit items-center gap-1 text-sm font-bold text-muted transition-colors hover:text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Curriculum repository
              </Link>
              <h1 className="font-heading text-3xl font-bold text-ink-900">
                Generate official curriculum
              </h1>
              <p className="text-sm text-muted">
                Draft a year-long, CEFR-aligned English curriculum with {UNITS_PER_COURSE} units, a
                weekly lesson breakdown and milestone assessment checkpoints. Generated content
                stays in draft and remains invisible to students until an admin publishes it.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border-2 border-stroke bg-surface-0 px-3 py-1 text-xs font-bold shadow-retro-sm">
              <Sparkles className="h-4 w-4 text-world-amber-600" aria-hidden="true" />
              AI official curriculum wizard
            </span>
          </div>
          <div className="mt-6">
            <StepRail stage={stage} />
          </div>
        </header>

        {stage === "plan" ? (
          <>
            <section className="rounded-2xl border-2 border-stroke bg-surface-0 p-6 shadow-retro-sm">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-world-amber-600" aria-hidden="true" />
                <h2 className="font-heading text-lg font-bold">1. Plan the academic year</h2>
              </div>
              <p className="mt-1 text-sm text-muted">
                Choose the scope, then dispatch the generation job. The wizard expands it into{" "}
                {UNITS_PER_COURSE} units with weekly lessons and a milestone checkpoint per unit.
              </p>

              <form className="mt-5 flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label htmlFor={gradeFieldId} className="text-sm font-bold">
                      Grade level
                    </label>
                    <select
                      id={gradeFieldId}
                      value={grade}
                      onChange={(event) => handleGradeChange(Number(event.target.value))}
                      className={controlClass}
                      aria-invalid={fieldIssue("grade") !== undefined}
                    >
                      {GRADE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          Grade {option}
                        </option>
                      ))}
                    </select>
                    {fieldIssue("grade") !== undefined ? (
                      <p className={errorTextClass}>{fieldIssue("grade")}</p>
                    ) : (
                      <p className="text-xs text-muted">
                        Secondary grades {MIN_GRADE}–{MAX_GRADE} are served by this platform.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor={weeksFieldId}
                      className="flex items-center gap-1.5 text-sm font-bold"
                    >
                      <CalendarDays className="h-4 w-4 text-world-amber-600" aria-hidden="true" />
                      Academic weeks
                    </label>
                    <input
                      id={weeksFieldId}
                      type="number"
                      inputMode="numeric"
                      min={MIN_WEEKS}
                      max={MAX_WEEKS}
                      step={1}
                      value={weeksInput}
                      onChange={(event) => setWeeksInput(event.target.value)}
                      className={controlClass}
                      aria-invalid={fieldIssue("weeks") !== undefined}
                    />
                    {fieldIssue("weeks") !== undefined ? (
                      <p className={errorTextClass}>{fieldIssue("weeks")}</p>
                    ) : (
                      <p className="text-xs text-muted">
                        {MIN_WEEKS}–{MAX_WEEKS} teaching weeks; six units are distributed across the
                        year.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor={cefrFieldId}
                      className="flex items-center gap-1.5 text-sm font-bold"
                    >
                      <BookOpen className="h-4 w-4 text-world-amber-600" aria-hidden="true" />
                      CEFR target
                    </label>
                    <select
                      id={cefrFieldId}
                      value={cefr}
                      onChange={(event) => {
                        const parsed = cefrSchema.safeParse(event.target.value);
                        if (parsed.success) {
                          setCefr(parsed.data);
                        }
                      }}
                      className={controlClass}
                    >
                      {CEFR_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted">
                      Recommended for Grade {grade}: {CEFR_BY_GRADE[grade] ?? "—"}.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="flex items-center gap-1.5 text-sm font-bold">
                      <Layers className="h-4 w-4 text-world-amber-600" aria-hidden="true" />
                      Official course shape
                    </span>
                    <div className="rounded-xl border-2 border-stroke bg-surface-100 px-3 py-2 text-sm font-semibold">
                      {UNITS_PER_COURSE} units · {previewLessonsPerUnit} lessons per unit ·{" "}
                      {UNITS_PER_COURSE} milestone checkpoints
                    </div>
                    <p className="text-xs text-muted">
                      Fixed by the official curriculum template for a {previewWeeks}-week year.
                    </p>
                  </div>
                </div>

                <fieldset className="flex flex-col gap-3">
                  <legend className="text-sm font-bold">Core themes</legend>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {THEME_OPTIONS.map((option) => {
                      const checked = themes.includes(option.value);
                      return (
                        <label
                          key={option.value}
                          className={`grid cursor-pointer grid-cols-[auto_1fr] items-start gap-x-3 gap-y-0.5 rounded-xl border-2 border-stroke px-3 py-2 shadow-retro-sm transition-colors ${
                            checked ? "bg-world-amber-100" : "bg-surface-0"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTheme(option.value)}
                            className="row-span-2 mt-0.5 h-5 w-5 shrink-0 accent-world-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke"
                          />
                          <span className="text-sm font-bold">{option.label}</span>
                          <span className="text-xs text-muted">{option.hint}</span>
                        </label>
                      );
                    })}
                  </div>
                  {fieldIssue("themes") !== undefined ? (
                    <p className={errorTextClass}>{fieldIssue("themes")}</p>
                  ) : null}
                </fieldset>

                <div className="rounded-xl border-2 border-dashed border-stroke bg-surface-100 p-4">
                  <p className="text-sm font-bold">Generation plan</p>
                  <p className="mt-1 text-sm text-muted">
                    Grade {grade} · {previewWeeks} academic weeks · CEFR {cefr} · {UNITS_PER_COURSE}{" "}
                    units · about {previewLessonsPerUnit} lessons per unit · a milestone quiz per
                    unit.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {themes.map((theme) => (
                      <span
                        key={theme}
                        className="rounded-full border-2 border-stroke bg-surface-0 px-2.5 py-0.5 text-xs font-bold"
                      >
                        {themeLabel(theme)}
                      </span>
                    ))}
                  </div>
                </div>

                {formIssues.length > 0 ? (
                  <div
                    role="alert"
                    className="rounded-xl border-2 border-stroke bg-world-rose-100 p-4 text-sm"
                  >
                    <p className="font-bold">Please fix the following before generating:</p>
                    <ul className="mt-1 list-disc pl-5">
                      {formIssues.map((issue) => (
                        <li key={`${issue.field}:${issue.message}`}>{issue.message}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted">
                    Generation runs in the background — you can leave this page and come back.
                  </p>
                  <button
                    type="submit"
                    disabled={dispatchMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-xl border-2 border-stroke bg-world-amber-400 px-4 py-2 font-heading text-sm font-bold shadow-retro-sm transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
                  >
                    {dispatchMutation.isPending ? (
                      <Loader2
                        className="h-4 w-4 animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                    ) : (
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                    )}
                    {dispatchMutation.isPending ? "Dispatching…" : "Generate curriculum draft"}
                  </button>
                </div>
              </form>
            </section>

            {recentQuery.data !== undefined && recentQuery.data.length > 0 ? (
              <section className="rounded-2xl border-2 border-stroke bg-surface-0 p-6 shadow-retro-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-world-amber-600" aria-hidden="true" />
                  <h2 className="font-heading text-lg font-bold">Recent generations</h2>
                </div>
                <ul className="mt-4 flex flex-col gap-2">
                  {recentQuery.data.map((recent) => {
                    const recentScope = parseJobScope(recent);
                    return (
                      <li
                        key={recent.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-stroke bg-surface-100 px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <JobStatusBadge status={recent.status} />
                          <span className="font-bold">
                            {recentScope.grade === null
                              ? "Curriculum job"
                              : `Grade ${recentScope.grade}`}
                          </span>
                          {recentScope.cefr !== null ? (
                            <span className="text-muted">CEFR {recentScope.cefr}</span>
                          ) : null}
                          <span className="text-xs text-muted">
                            {formatRelative(recent.created_at)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => openJob(recent.id)}
                          className="rounded-lg border-2 border-stroke bg-surface-0 px-3 py-1 text-xs font-bold shadow-retro-sm transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke motion-reduce:transition-none"
                        >
                          Track
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
          </>
        ) : null}

        {stage === "generate" ? (
          <>
            <section className="rounded-2xl border-2 border-stroke bg-surface-0 p-6 shadow-retro-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-heading text-lg font-bold">2. Generate the draft</h2>
                <div className="flex flex-wrap items-center gap-2">
                  {job !== null ? <JobStatusBadge status={job.status} /> : null}
                  <button
                    type="button"
                    onClick={() => void jobQuery.refetch()}
                    disabled={jobQuery.isFetching}
                    className={secondaryButtonClass}
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${
                        jobQuery.isFetching ? "animate-spin motion-reduce:animate-none" : ""
                      }`}
                      aria-hidden="true"
                    />
                    Refresh
                  </button>
                </div>
              </div>

              {jobQuery.isLoading ? (
                <p className="mt-4 text-sm text-muted" role="status">
                  Loading generation status…
                </p>
              ) : null}

              {jobQuery.isError ? (
                <div
                  role="alert"
                  className="mt-4 rounded-xl border-2 border-stroke bg-world-rose-100 p-4"
                >
                  <p className="flex items-center gap-2 text-sm font-bold">
                    <AlertTriangle className="h-4 w-4 text-world-rose-700" aria-hidden="true" />
                    Could not read the generation job
                  </p>
                  <p className="mt-2 text-sm">{errorMessageOf(jobQuery.error)}</p>
                  <button
                    type="button"
                    onClick={() => void jobQuery.refetch()}
                    className={`mt-3 ${secondaryButtonClass}`}
                  >
                    Try again
                  </button>
                </div>
              ) : null}

              {job !== null ? (
                <div className="mt-4 flex flex-col gap-4">
                  <p
                    id="generation-status"
                    role="status"
                    aria-live="polite"
                    className="text-sm text-muted"
                  >
                    {jobStatusLine(job, runningStep)} {totalPercent}% complete.
                  </p>
                  <ProgressBar percent={totalPercent} label="Overall generation progress" />
                  <dl className="grid gap-2 text-xs text-muted sm:grid-cols-2">
                    <div className="flex gap-2">
                      <dt className="font-bold">Job</dt>
                      <dd className="truncate font-mono" title={job.id}>
                        {job.id}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="font-bold">Dispatched</dt>
                      <dd>{formatDateTime(job.created_at)}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="font-bold">Started</dt>
                      <dd>{formatDateTime(job.started_at)}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="font-bold">Finished</dt>
                      <dd>{formatDateTime(job.completed_at)}</dd>
                    </div>
                  </dl>

                  {job.status === "queued" || job.status === "running" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {!confirmingCancel ? (
                        <button
                          type="button"
                          onClick={handleCancelClick}
                          className={secondaryButtonClass}
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                          Cancel generation
                        </button>
                      ) : (
                        <>
                          <span className="text-sm font-bold">Cancel this generation?</span>
                          <button
                            type="button"
                            onClick={handleCancelClick}
                            disabled={cancelMutation.isPending}
                            className="inline-flex items-center gap-2 rounded-xl border-2 border-stroke bg-world-rose-200 px-3 py-2 text-sm font-bold shadow-retro-sm transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
                          >
                            {cancelMutation.isPending ? (
                              <Loader2
                                className="h-4 w-4 animate-spin motion-reduce:animate-none"
                                aria-hidden="true"
                              />
                            ) : (
                              <X className="h-4 w-4" aria-hidden="true" />
                            )}
                            Yes, cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingCancel(false)}
                            className={secondaryButtonClass}
                          >
                            Keep running
                          </button>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>

            {job?.status === "queued" ? (
              <section className="rounded-2xl border-2 border-stroke bg-surface-0 p-4 text-sm shadow-retro-sm">
                <p className="font-bold">Waiting for the background runner</p>
                <p className="mt-1 text-muted">
                  The job is queued and starts automatically when the runner picks it up. You can
                  also ask the platform to run it now.
                </p>
                {kickResult !== null && !kickResult.notified && kickResult.detail !== null ? (
                  <p className="mt-1 break-words text-xs text-muted">
                    Worker response: {kickResult.detail}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => kickMutation.mutate()}
                  disabled={kickMutation.isPending}
                  className={`mt-3 ${secondaryButtonClass}`}
                >
                  {kickMutation.isPending ? (
                    <Loader2
                      className="h-4 w-4 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  ) : (
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  )}
                  Ask the platform to run it now
                </button>
              </section>
            ) : null}

            {steps.length > 0 ? (
              <section className="rounded-2xl border-2 border-stroke bg-surface-0 p-6 shadow-retro-sm">
                <h2 className="font-heading text-lg font-bold">Progress steps</h2>
                <ol className="mt-4 flex flex-col gap-3">
                  {steps.map((step) => {
                    const stepPercent = step.status === "completed" ? 100 : step.progress_percent;
                    return (
                      <li
                        key={step.id}
                        className="rounded-xl border-2 border-stroke bg-surface-100 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="flex items-center gap-2 text-sm font-bold">
                            <StepStatusIcon status={step.status} />
                            {stepLabel(step.name)}
                          </p>
                          <span className="text-xs font-bold text-muted">{stepPercent}%</span>
                        </div>
                        <div className="mt-2">
                          <ProgressBar
                            percent={stepPercent}
                            label={`${stepLabel(step.name)} progress`}
                          />
                        </div>
                        {step.log !== null && step.log.length > 0 ? (
                          <p className="mt-2 break-words text-xs text-muted">{step.log}</p>
                        ) : null}
                        <p className="mt-2 text-xs text-muted">
                          Started {formatDateTime(step.started_at)}
                          {step.completed_at !== null
                            ? ` · finished ${formatDateTime(step.completed_at)}`
                            : ""}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ) : null}

            {job?.status === "failed" ? (
              <section
                role="alert"
                className="rounded-2xl border-2 border-stroke bg-world-rose-100 p-6 shadow-retro-sm"
              >
                <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
                  <AlertTriangle className="h-5 w-5 text-world-rose-700" aria-hidden="true" />
                  The generation job failed
                </h2>
                <p className="mt-2 text-sm">
                  {job.error_message ?? "The runner did not report a reason."}
                </p>
                <p className="mt-2 text-sm text-muted">
                  Common causes: the AI provider rejected the prompt, or the runner has not
                  registered the ai_curriculum handler yet. Adjust the plan and dispatch a new job.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={backToPlan} className={secondaryButtonClass}>
                    Adjust plan and retry
                  </button>
                  <button
                    type="button"
                    onClick={() => void jobQuery.refetch()}
                    className={secondaryButtonClass}
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    Refresh status
                  </button>
                </div>
              </section>
            ) : null}

            {job?.status === "cancelled" ? (
              <section className="rounded-2xl border-2 border-dashed border-stroke bg-surface-0 p-6 shadow-retro-sm">
                <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
                  <XCircle className="h-5 w-5 text-muted" aria-hidden="true" />
                  Generation cancelled
                </h2>
                <p className="mt-2 text-sm text-muted">
                  No further steps will run. You can dispatch a new job with the same or adjusted
                  scope.
                </p>
                <button
                  type="button"
                  onClick={backToPlan}
                  className={`mt-4 ${secondaryButtonClass}`}
                >
                  Back to the plan
                </button>
              </section>
            ) : null}
          </>
        ) : null}

        {stage === "review" ? (
          <>
            <section className="rounded-2xl border-2 border-stroke bg-world-mint-100 p-6 shadow-retro-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-heading text-lg font-bold">3. Review the draft</h2>
                  <p className="mt-1 text-sm text-muted">
                    Finished {formatDateTime(job?.completed_at ?? null)}. Generated items stay in
                    draft until an admin publishes the curriculum.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void syllabusQuery.refetch()}
                    disabled={syllabusQuery.isFetching}
                    className={secondaryButtonClass}
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${
                        syllabusQuery.isFetching ? "animate-spin motion-reduce:animate-none" : ""
                      }`}
                      aria-hidden="true"
                    />
                    Refresh
                  </button>
                  <button type="button" onClick={backToPlan} className={secondaryButtonClass}>
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    Create another
                  </button>
                </div>
              </div>
            </section>

            {syllabusQuery.isLoading ? (
              <p className="text-sm text-muted" role="status">
                Loading the generated syllabus…
              </p>
            ) : null}

            {syllabusQuery.isError ? (
              <section
                role="alert"
                className="rounded-2xl border-2 border-stroke bg-world-rose-100 p-6 shadow-retro-sm"
              >
                <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
                  <AlertTriangle className="h-5 w-5 text-world-rose-700" aria-hidden="true" />
                  Could not load the generated draft
                </h2>
                <p className="mt-2 text-sm">{errorMessageOf(syllabusQuery.error)}</p>
                <button
                  type="button"
                  onClick={() => void syllabusQuery.refetch()}
                  className={`mt-4 ${secondaryButtonClass}`}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Try again
                </button>
              </section>
            ) : null}

            {syllabus === null && !syllabusQuery.isLoading && !syllabusQuery.isError ? (
              <section className="rounded-2xl border-2 border-dashed border-stroke bg-surface-0 p-6 shadow-retro-sm">
                <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
                  <AlertTriangle className="h-5 w-5 text-muted" aria-hidden="true" />
                  No draft course linked yet
                </h2>
                <p className="mt-2 text-sm text-muted">
                  The job finished without reporting a course. Open the curriculum repository to
                  check for a freshly created draft, or dispatch a new generation.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to="/admin/curriculum" className={secondaryButtonClass}>
                    Open curriculum repository
                  </Link>
                  <button type="button" onClick={backToPlan} className={secondaryButtonClass}>
                    Back to the plan
                  </button>
                </div>
              </section>
            ) : null}

            {syllabus !== null ? (
              <>
                <section className="rounded-2xl border-2 border-stroke bg-surface-0 p-6 shadow-retro-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                        <span className="rounded-full border-2 border-stroke bg-world-amber-200 px-2.5 py-0.5 capitalize">
                          {syllabus.course.status}
                        </span>
                        {syllabus.course.is_official ? (
                          <span className="rounded-full border-2 border-stroke bg-world-sky-200 px-2.5 py-0.5">
                            Official
                          </span>
                        ) : null}
                        <span className="rounded-full border-2 border-stroke bg-surface-100 px-2.5 py-0.5">
                          Created with AI
                        </span>
                      </div>
                      <h2 className="font-heading text-xl font-bold">{syllabus.course.title}</h2>
                      <p
                        className="truncate font-mono text-xs text-muted"
                        title={syllabus.course.slug}
                      >
                        {syllabus.course.slug}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 text-xs font-bold">
                      <span className="rounded-full border-2 border-stroke bg-surface-0 px-2.5 py-0.5 shadow-retro-sm">
                        {gradeLabel(syllabus.course.grade_level, scope?.grade ?? null)}
                      </span>
                      {scope !== null && scope.cefr !== null ? (
                        <span className="rounded-full border-2 border-stroke bg-surface-0 px-2.5 py-0.5 shadow-retro-sm">
                          Planned CEFR {scope.cefr}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {syllabus.course.description !== null &&
                  syllabus.course.description.length > 0 ? (
                    <p className="mt-3 whitespace-pre-line text-sm text-muted">
                      {syllabus.course.description}
                    </p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link to="/admin/curriculum" className={secondaryButtonClass}>
                      Open curriculum repository
                    </Link>
                  </div>
                </section>

                <section className="rounded-2xl border-2 border-stroke bg-surface-0 p-6 shadow-retro-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Layers className="h-5 w-5 text-world-amber-600" aria-hidden="true" />
                      <h2 className="font-heading text-lg font-bold">
                        Unit and weekly lesson breakdown
                      </h2>
                    </div>
                    <span className="text-xs font-bold text-muted">
                      {syllabus.units.length} of {UNITS_PER_COURSE} units readable
                    </span>
                  </div>
                  {syllabus.units.length === 0 ? (
                    <p className="mt-4 rounded-xl border-2 border-dashed border-stroke bg-surface-100 p-4 text-sm text-muted">
                      No units are readable for this draft yet. Generation may still be finalizing
                      in the background, or curriculum read access for admins has not been granted
                      in this environment.
                    </p>
                  ) : (
                    <ol className="mt-4 flex flex-col gap-4">
                      {syllabus.units.map((unit, unitIndex) => {
                        const range =
                          scope !== null && scope.weeks !== null
                            ? unitWeekRange(unitIndex, scope.weeks)
                            : null;
                        return (
                          <li
                            key={unit.id}
                            className="rounded-xl border-2 border-stroke bg-surface-100 p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h3 className="font-heading text-base font-bold">
                                {unitIndex + 1}. {unit.title}
                              </h3>
                              {range !== null ? (
                                <span className="rounded-full border-2 border-stroke bg-surface-0 px-2.5 py-0.5 text-xs font-bold">
                                  Planned weeks {range.start}–{range.end}
                                </span>
                              ) : null}
                            </div>
                            {unit.description !== null && unit.description.length > 0 ? (
                              <p className="mt-2 whitespace-pre-line text-sm text-muted">
                                {unit.description}
                              </p>
                            ) : null}
                            {unit.lessons.length > 0 ? (
                              <ul className="mt-3 flex flex-col gap-2">
                                {unit.lessons.map((lesson, lessonIndex) => (
                                  <li
                                    key={lesson.id}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 border-stroke bg-surface-0 px-3 py-2 text-sm"
                                  >
                                    <span className="font-semibold">
                                      {unitIndex + 1}.{lessonIndex + 1} {lesson.title}
                                    </span>
                                    <span className="text-xs text-muted">
                                      +{lesson.xp_reward} XP · +{lesson.coin_reward} coins
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-3 text-sm text-muted">
                                No lessons readable for this unit yet.
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </section>

                <section className="rounded-2xl border-2 border-stroke bg-surface-0 p-6 shadow-retro-sm">
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-5 w-5 text-world-amber-600" aria-hidden="true" />
                    <h2 className="font-heading text-lg font-bold">Milestone checkpoints</h2>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    Draft quizzes registered while this job ran — one checkpoint per unit is
                    expected.
                  </p>
                  {syllabus.checkpoints.length === 0 ? (
                    <p className="mt-4 rounded-xl border-2 border-dashed border-stroke bg-surface-100 p-4 text-sm text-muted">
                      No milestone quizzes are registered for this job yet.
                    </p>
                  ) : (
                    <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                      {syllabus.checkpoints.map((checkpoint) => (
                        <li
                          key={checkpoint.id}
                          className="rounded-xl border-2 border-stroke bg-surface-100 p-3 text-sm"
                        >
                          <p className="font-bold">{checkpoint.title}</p>
                          <p className="mt-1 text-xs capitalize text-muted">
                            {checkpoint.kind} · {checkpoint.status} ·{" "}
                            {formatDateTime(checkpoint.created_at)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            ) : null}

            <section className="rounded-2xl border-2 border-dashed border-stroke bg-surface-0 p-6 shadow-retro-sm">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-world-amber-600" aria-hidden="true" />
                <h2 className="font-heading text-lg font-bold">Before publishing</h2>
              </div>
              <ul className="mt-3 list-disc pl-5 text-sm text-muted">
                <li>Reading level matches the planned CEFR target for this grade.</li>
                <li>Weekly lessons flow from vocabulary to reading and writing practice.</li>
                <li>Milestone checkpoints cover every unit before students move on.</li>
                <li>
                  Nothing is published automatically — publish from the curriculum repository when
                  ready.
                </li>
              </ul>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------------ */
/* Module-level helpers used by the JSX above                               */
/* ------------------------------------------------------------------------ */

function jobStatusLine(job: CurriculumJobRow, runningStep: CurriculumJobStepRow | null): string {
  if (job.status === "queued") {
    return "Queued — waiting for the background runner.";
  }
  if (job.status === "running") {
    return runningStep === null
      ? "Running — the runner is working through the syllabus."
      : `Running: ${stepLabel(runningStep.name)}.`;
  }
  if (job.status === "completed") {
    return "Completed — the draft is ready for review.";
  }
  if (job.status === "failed") {
    return "The runner reported a failure.";
  }
  return "Cancelled before completion.";
}

function gradeLabel(courseGrade: string | null, scopeGrade: number | null): string {
  if (courseGrade !== null && courseGrade.length > 0) {
    return /^\d+$/.test(courseGrade) ? `Grade ${courseGrade}` : courseGrade;
  }
  return scopeGrade === null ? "Grade —" : `Grade ${scopeGrade}`;
}
