import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { z } from "zod";
import { Award, Coins, Flag, Gift, Plus } from "lucide-react";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";
import { useAuth } from "@/shared/hooks/useAuth";
import { useToast } from "@/shared/hooks/useToast";
import { Button } from "@/shared/components/ui/Button";
import { Checkbox } from "@/shared/components/ui/Checkbox";
import { Chip } from "@/shared/components/ui/Chip";
import { Dialog } from "@/shared/components/ui/Dialog";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { Input } from "@/shared/components/ui/Input";
import { ProgressBar } from "@/shared/components/ui/ProgressBar";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { Textarea } from "@/shared/components/ui/Textarea";
import { classDetailKey, fetchRoster } from "./api";
import type { RosterRow } from "./api";
import { formatDate } from "./rules";

/* ========================================
   Class rewards (TEACHER-SPEC TC-06, task TCH-CORE-06)

   Two things a teacher controls for the whole class:
   1. Class goals: a milestone with a target amount of class XP and a reward the class earns
      ("Pizza party at 10,000 XP"). Stored in `class_quests` as a quest whose target is
      `{ type: "class_xp", value }`. Progress is the class XP earned since the goal was launched:
      the baseline (total class XP at launch) is kept in the target JSON, and the final figure is
      kept when the goal ends so an ended goal stops moving.
   2. Bonus coins: 50 to 200 coins per student with a required reason, paid through the
      `award_coins` RPC (BE-OPS-06), which checks that the caller teaches the student and updates
      the balance in the same transaction. The reason is written to `coin_ledger.source`, behind a
      fixed prefix, so the feed can find teacher bonuses again. Ledger rows cannot be edited.

   The feed merges recent bonus coins with badges the class has earned.
   ======================================== */

/* ---------- Rules (pure) ---------- */

const BONUS_PREFIX = "Teacher bonus: ";
const COIN_MIN = 50;
const COIN_MAX = 200;
const COIN_PRESETS = [50, 100, 150, 200] as const;
/** `coin_ledger.source` allows 100 characters; the prefix takes 15 of them. */
const REASON_MAX = 100 - BONUS_PREFIX.length;
const GOAL_TITLE_MAX = 80;
const GOAL_REWARD_MAX = 200;
const GOAL_XP_MIN = 100;
const GOAL_XP_MAX = 1_000_000;

function bonusSource(reason: string): string {
  return `${BONUS_PREFIX}${reason.trim()}`;
}

function reasonFromSource(source: string): string {
  return source.startsWith(BONUS_PREFIX) ? source.slice(BONUS_PREFIX.length) : source;
}

interface AwardValues {
  studentIds: readonly string[];
  amount: string;
  reason: string;
}
type AwardErrors = Partial<Record<"students" | "amount" | "reason", string>>;

function validateAward(values: AwardValues): AwardErrors {
  const errors: AwardErrors = {};
  if (values.studentIds.length === 0) errors.students = "Choose at least one student.";
  const amount = Number(values.amount);
  if (
    values.amount.trim() === "" ||
    !Number.isInteger(amount) ||
    amount < COIN_MIN ||
    amount > COIN_MAX
  ) {
    errors.amount = `Enter a whole number from ${COIN_MIN} to ${COIN_MAX}.`;
  }
  const reason = values.reason.trim();
  if (reason === "") errors.reason = "Say why they earned it. Students see this reason.";
  else if (reason.length > REASON_MAX)
    errors.reason = `Keep the reason under ${REASON_MAX + 1} characters.`;
  return errors;
}

interface GoalValues {
  title: string;
  reward: string;
  target: string;
  endDate: string;
}
type GoalErrors = Partial<Record<keyof GoalValues, string>>;

/** `endDate` is a `YYYY-MM-DD` string from a date input; today is allowed, earlier days are not. */
function validateGoal(values: GoalValues, today: Date): GoalErrors {
  const errors: GoalErrors = {};
  const title = values.title.trim();
  if (title === "") errors.title = "Give the goal a name.";
  else if (title.length > GOAL_TITLE_MAX)
    errors.title = `Keep the name under ${GOAL_TITLE_MAX + 1} characters.`;
  const reward = values.reward.trim();
  if (reward === "") errors.reward = "Describe what the class earns.";
  else if (reward.length > GOAL_REWARD_MAX)
    errors.reward = `Keep this under ${GOAL_REWARD_MAX + 1} characters.`;
  const target = Number(values.target);
  if (
    values.target.trim() === "" ||
    !Number.isInteger(target) ||
    target < GOAL_XP_MIN ||
    target > GOAL_XP_MAX
  ) {
    errors.target = `Enter a whole number from ${GOAL_XP_MIN.toLocaleString()} to ${GOAL_XP_MAX.toLocaleString()} XP.`;
  }
  if (values.endDate !== "") {
    const end = new Date(`${values.endDate}T23:59:59`);
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (Number.isNaN(end.getTime()) || end < startOfToday)
      errors.endDate = "Pick today or a later day.";
  }
  return errors;
}

type GoalStatus = "draft" | "active" | "ended";

/** Class XP earned toward a goal: nothing before launch, a frozen figure after it ends. */
function goalProgress(
  goal: {
    status: GoalStatus;
    target: { baseline?: number | null | undefined; final?: number | null | undefined };
  },
  classXp: number,
): number {
  if (goal.status === "draft") return 0;
  if (goal.status === "ended" && goal.target.final != null) return goal.target.final;
  if (goal.target.baseline == null) return 0;
  return Math.max(0, classXp - goal.target.baseline);
}

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function endOfDayIso(day: string): string | null {
  if (day === "") return null;
  const date = new Date(`${day}T23:59:59`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const formatNumber = (value: number) => value.toLocaleString();

/* ---------- Data ---------- */

const partKey = (classId: string, part: string) => classDetailKey(classId, `rewards-${part}`);

const goalTarget = z.looseObject({
  type: z.string(),
  value: z.number(),
  baseline: z.number().nullish(),
  final: z.number().nullish(),
});
const goalRow = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullish(),
  target: goalTarget,
  starts_at: z.string().nullish(),
  ends_at: z.string().nullish(),
  status: z.enum(["draft", "active", "ended"]),
});
const goalRows = z.array(goalRow);
type ClassGoal = z.infer<typeof goalRow>;

const statsRows = z.array(
  z.object({ student_id: z.string(), total_xp: z.number(), current_coins: z.number() }),
);
const bonusRows = z.array(
  z.object({
    id: z.string(),
    student_id: z.string(),
    amount: z.number(),
    source: z.string(),
    created_at: z.string(),
  }),
);
const badgeName = z.object({ name: z.string() });
const badgeRows = z.array(
  z.object({
    student_id: z.string(),
    awarded_at: z.string().nullish(),
    badge_definitions: z.union([badgeName, z.array(badgeName)]).nullish(),
  }),
);
const awardResult = z.object({
  student_id: z.string(),
  amount_awarded: z.number(),
  balance: z.number(),
});

interface DbError {
  message: string;
  code?: string;
}
interface Builder extends PromiseLike<{ data: unknown; error: DbError | null }> {
  select: (columns: string) => Builder;
  eq: (column: string, value: string) => Builder;
  in: (column: string, values: readonly string[]) => Builder;
  like: (column: string, pattern: string) => Builder;
  order: (column: string, options: { ascending: boolean }) => Builder;
  limit: (count: number) => Builder;
}
interface LooseTable extends Builder {
  insert: (row: Record<string, unknown>) => Builder;
  update: (row: Record<string, unknown>) => Builder;
}
const table = (name: string) =>
  (supabase as unknown as { from: (n: string) => LooseTable }).from(name);
type LooseRpc = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: DbError | null }>;

function parse<T>(label: string, data: unknown, schema: z.ZodType<T>): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error(`${label} returned data in an unexpected shape.`);
  return parsed.data;
}

async function run(query: Builder): Promise<unknown> {
  const { data, error } = await query;
  if (error) throw new Error(normalizeApiError(error).message);
  return data;
}

async function fetchGoals(classId: string): Promise<ClassGoal[]> {
  const data = await run(
    table("class_quests")
      .select("id, title, description, target, starts_at, ends_at, status")
      .eq("class_id", classId)
      .eq("target->>type", "class_xp")
      .order("starts_at", { ascending: false })
      .limit(50),
  );
  return parse("class_quests", data ?? [], goalRows);
}

async function fetchStats(studentIds: readonly string[]) {
  if (studentIds.length === 0) return [];
  const data = await run(
    table("student_stats")
      .select("student_id, total_xp, current_coins")
      .in("student_id", studentIds),
  );
  return parse("student_stats", data ?? [], statsRows);
}

interface FeedItem {
  key: string;
  kind: "bonus" | "badge";
  studentId: string;
  at: string;
  /** Coins for a bonus, the badge name for a badge. */
  amount?: number;
  label: string;
}

async function fetchFeed(studentIds: readonly string[]): Promise<FeedItem[]> {
  if (studentIds.length === 0) return [];
  const [bonusData, badgeData] = await Promise.all([
    run(
      table("coin_ledger")
        .select("id, student_id, amount, source, created_at")
        .in("student_id", studentIds)
        .like("source", `${BONUS_PREFIX}%`)
        .order("created_at", { ascending: false })
        .limit(20),
    ),
    run(
      table("user_badges")
        .select("student_id, awarded_at, badge_definitions(name)")
        .in("student_id", studentIds)
        .order("awarded_at", { ascending: false })
        .limit(20),
    ),
  ]);
  const bonuses: FeedItem[] = parse("coin_ledger", bonusData ?? [], bonusRows).map((row) => ({
    key: `bonus-${row.id}`,
    kind: "bonus",
    studentId: row.student_id,
    at: row.created_at,
    amount: row.amount,
    label: reasonFromSource(row.source),
  }));
  const badges: FeedItem[] = [];
  parse("user_badges", badgeData ?? [], badgeRows).forEach((row, index) => {
    const def = Array.isArray(row.badge_definitions)
      ? row.badge_definitions[0]
      : row.badge_definitions;
    if (!def || !row.awarded_at) return;
    badges.push({
      key: `badge-${row.student_id}-${row.awarded_at}-${index}`,
      kind: "badge",
      studentId: row.student_id,
      at: row.awarded_at,
      label: def.name,
    });
  });
  return [...bonuses, ...badges].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 25);
}

interface SaveGoalInput {
  existing: ClassGoal | null;
  values: GoalValues;
  launch: boolean;
  classXp: number;
  classId: string;
  userId: string;
}

async function saveGoal(input: SaveGoalInput): Promise<void> {
  const { existing, values, launch, classXp, classId, userId } = input;
  const value = Number(values.target);
  const endsAt = endOfDayIso(values.endDate);
  const nowIso = new Date().toISOString();
  const base = { title: values.title.trim(), description: values.reward.trim(), ends_at: endsAt };

  if (existing?.status === "active") {
    await run(
      table("class_quests")
        .update({ ...base, target: { ...existing.target, value } })
        .eq("id", existing.id),
    );
    return;
  }
  const launching = launch;
  const target = {
    ...(existing?.target ?? {}),
    type: "class_xp",
    value,
    baseline: launching ? classXp : null,
    final: null,
  };
  const row = {
    ...base,
    target,
    status: launching ? "active" : "draft",
    starts_at: nowIso,
  };
  if (existing) {
    await run(table("class_quests").update(row).eq("id", existing.id));
    return;
  }
  await run(
    table("class_quests").insert({
      ...row,
      class_id: classId,
      reward_xp: 0,
      reward_coins: 0,
      created_by: userId,
    }),
  );
}

async function launchGoal(goal: ClassGoal, classXp: number): Promise<void> {
  await run(
    table("class_quests")
      .update({
        status: "active",
        starts_at: new Date().toISOString(),
        target: { ...goal.target, baseline: classXp, final: null },
      })
      .eq("id", goal.id),
  );
}

async function endGoal(goal: ClassGoal, classXp: number): Promise<void> {
  await run(
    table("class_quests")
      .update({
        status: "ended",
        target: { ...goal.target, final: goalProgress(goal, classXp) },
      })
      .eq("id", goal.id),
  );
}

interface AwardOutcome {
  succeeded: string[];
  failed: { studentId: string; message: string }[];
}

async function grantBonusCoins(
  studentIds: readonly string[],
  amount: number,
  reason: string,
): Promise<AwardOutcome> {
  const rpc = supabase.rpc.bind(supabase) as unknown as LooseRpc;
  const results = await Promise.allSettled(
    studentIds.map(async (studentId) => {
      const { data, error } = await rpc("award_coins", {
        student_id: studentId,
        amount,
        source: bonusSource(reason),
        ref_id: null,
      });
      if (error) throw new Error(normalizeApiError(error).message);
      return parse("award_coins", data, awardResult);
    }),
  );
  const outcome: AwardOutcome = { succeeded: [], failed: [] };
  results.forEach((result, index) => {
    const studentId = studentIds[index] ?? "";
    if (result.status === "fulfilled") outcome.succeeded.push(studentId);
    else {
      const message = result.reason instanceof Error ? result.reason.message : "The award failed.";
      outcome.failed.push({ studentId, message });
    }
  });
  return outcome;
}

/* ---------- Pieces ---------- */

const PANEL = "rounded-[20px] border-2 border-stroke bg-surface-0 p-5 shadow-retro-sm";

function Loaded<T>({
  query,
  title,
  children,
}: {
  query: UseQueryResult<T>;
  title: string;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <Skeleton className="h-40 w-full" label="Loading…" />;
  if (query.isError) {
    return (
      <ErrorState
        size="sm"
        title={title}
        description={query.error instanceof Error ? query.error.message : undefined}
        onRetry={() => void query.refetch()}
      />
    );
  }
  return <>{children(query.data)}</>;
}

function GoalCard({
  goal,
  classXp,
  busy,
  onEdit,
  onLaunch,
  onEnd,
}: {
  goal: ClassGoal;
  classXp: number;
  busy: boolean;
  onEdit: () => void;
  onLaunch: () => void;
  onEnd: () => void;
}) {
  const target = goal.target.value;
  const progress = goalProgress(goal, classXp);
  const reached = goal.status !== "draft" && progress >= target;
  const pct = target > 0 ? Math.min(100, Math.floor((progress / target) * 100)) : 0;
  const dates =
    goal.status === "draft"
      ? "Not launched yet"
      : `Started ${formatDate(goal.starts_at)}${goal.ends_at ? ` · ends ${formatDate(goal.ends_at)}` : ""}`;

  return (
    <li className={PANEL}>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-display text-lg font-extrabold">{goal.title}</h3>
        <div className="flex items-center gap-2">
          {reached && (
            <Chip size="sm" icon={<Award size={14} />}>
              Goal reached
            </Chip>
          )}
          <Chip size="sm">
            {goal.status === "draft" ? "Draft" : goal.status === "active" ? "Active" : "Ended"}
          </Chip>
        </div>
      </div>
      <p className="mb-3 flex items-start gap-2 text-sm">
        <Gift size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          <span className="font-bold">Reward: </span>
          {goal.description}
        </span>
      </p>
      <ProgressBar
        value={progress}
        max={target}
        label={`${goal.title} progress`}
        valueText={`${formatNumber(progress)} of ${formatNumber(target)} XP`}
      />
      <p className="mt-1.5 text-sm text-muted">
        {goal.status === "draft"
          ? `Target ${formatNumber(target)} XP`
          : `${formatNumber(progress)} of ${formatNumber(target)} XP (${pct}%)`}
        {" · "}
        {dates}
      </p>
      {goal.status !== "ended" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {goal.status === "draft" && (
            <Button size="sm" onClick={onLaunch} loading={busy}>
              <Flag size={16} />
              Launch goal
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={onEdit} disabled={busy}>
            Edit
          </Button>
          {goal.status === "active" && (
            <Button size="sm" variant="secondary" onClick={onEnd} disabled={busy}>
              {reached ? "Finish goal" : "End goal"}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

function GoalDialog({
  goal,
  classXp,
  classId,
  onClose,
}: {
  goal: ClassGoal | null;
  classXp: number;
  classId: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<GoalValues>({
    title: goal?.title ?? "",
    reward: goal?.description ?? "",
    target: goal ? String(goal.target.value) : "",
    endDate: toDateInput(goal?.ends_at),
  });
  const [errors, setErrors] = useState<GoalErrors>({});
  const isActive = goal?.status === "active";

  const save = useMutation({
    mutationFn: saveGoal,
    onSuccess: (_result, input) => {
      toast.show({
        type: "success",
        title: input.launch ? "Goal launched" : isActive ? "Goal updated" : "Draft saved",
      });
      void queryClient.invalidateQueries({ queryKey: partKey(classId, "goals") });
      onClose();
    },
    onError: (error: Error) => {
      toast.show({ type: "error", title: "The goal was not saved", description: error.message });
    },
  });

  const patch = (change: Partial<GoalValues>) => {
    setValues((current) => ({ ...current, ...change }));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(change)) delete next[key as keyof GoalValues];
      return next;
    });
  };

  const submit = (launch: boolean) => {
    const found = validateGoal(values, new Date());
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (!user) {
      toast.show({
        type: "error",
        title: "You are signed out",
        description: "Sign in again to save this goal.",
      });
      return;
    }
    save.mutate({ existing: goal, values, launch, classXp, classId, userId: user.id });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="md"
      title={goal ? "Edit class goal" : "New class goal"}
      description="The class works toward the XP target together. Every student's XP counts."
    >
      <form
        className="space-y-4"
        noValidate
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          submit(false);
        }}
      >
        <Input
          label="Goal name"
          value={values.title}
          maxLength={GOAL_TITLE_MAX}
          error={errors.title}
          onChange={(event) => patch({ title: event.target.value })}
        />
        <Textarea
          label="Reward the class earns"
          helperText="For example: pizza party on Friday, or 10 minutes of extra game time."
          value={values.reward}
          maxLength={GOAL_REWARD_MAX}
          error={errors.reward}
          rows={2}
          onChange={(event) => patch({ reward: event.target.value })}
        />
        <Input
          label="Target class XP"
          type="number"
          inputMode="numeric"
          min={GOAL_XP_MIN}
          step={100}
          value={values.target}
          error={errors.target}
          onChange={(event) => patch({ target: event.target.value })}
        />
        <Input
          label="End date (optional)"
          type="date"
          value={values.endDate}
          error={errors.endDate}
          onChange={(event) => patch({ endDate: event.target.value })}
        />
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          {isActive ? (
            <Button type="submit" loading={save.isPending}>
              Save changes
            </Button>
          ) : (
            <>
              <Button type="submit" variant="secondary" disabled={save.isPending}>
                Save as draft
              </Button>
              <Button type="button" loading={save.isPending} onClick={() => submit(true)}>
                <Flag size={16} />
                Launch goal
              </Button>
            </>
          )}
        </div>
      </form>
    </Dialog>
  );
}

function AwardDialog({
  students,
  coins,
  classId,
  onClose,
}: {
  students: readonly RosterRow[];
  coins: ReadonlyMap<string, number>;
  classId: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [amount, setAmount] = useState<string>(String(COIN_PRESETS[0]));
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<AwardErrors>({});
  const clearError = (key: keyof AwardErrors) =>
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });

  const award = useMutation({
    mutationFn: (input: { ids: string[]; amount: number; reason: string }) =>
      grantBonusCoins(input.ids, input.amount, input.reason),
    onSuccess: (outcome, input) => {
      void queryClient.invalidateQueries({ queryKey: partKey(classId, "feed") });
      void queryClient.invalidateQueries({ queryKey: partKey(classId, "stats") });
      const nameOf = (id: string) =>
        students.find((row) => row.student.id === id)?.student.full_name ?? "A student";
      if (outcome.failed.length === 0) {
        toast.show({
          type: "success",
          title: `${formatNumber(input.amount)} coins sent to ${outcome.succeeded.length} student${outcome.succeeded.length === 1 ? "" : "s"}`,
        });
        onClose();
        return;
      }
      setStudentIds(outcome.failed.map((item) => item.studentId));
      const first = outcome.failed[0];
      toast.show({
        type: "error",
        title: `${outcome.failed.length} award${outcome.failed.length === 1 ? "" : "s"} failed`,
        description:
          `${first ? nameOf(first.studentId) : "A student"}: ${first?.message ?? "The award failed."} ${
            outcome.succeeded.length > 0
              ? `${outcome.succeeded.length} other award${outcome.succeeded.length === 1 ? " was" : "s were"} sent.`
              : ""
          }`.trim(),
      });
    },
    onError: (error: Error) => {
      toast.show({ type: "error", title: "No coins were sent", description: error.message });
    },
  });

  const allSelected = students.length > 0 && studentIds.length === students.length;
  const toggle = (id: string, on: boolean) => {
    setStudentIds((current) => (on ? [...current, id] : current.filter((value) => value !== id)));
    clearError("students");
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = validateAward({ studentIds, amount, reason });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    award.mutate({ ids: studentIds, amount: Number(amount), reason: reason.trim() });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="md"
      title="Grant bonus coins"
      description={`Give ${COIN_MIN} to ${COIN_MAX} coins for great work in class. Each student sees your reason.`}
    >
      <form className="space-y-4" noValidate onSubmit={submit}>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-bold">Students</legend>
          <Checkbox
            label="Whole class"
            checked={allSelected}
            onCheckedChange={(on) => {
              setStudentIds(on === true ? students.map((row) => row.student.id) : []);
              clearError("students");
            }}
          />
          <ul className="max-h-48 space-y-1.5 overflow-y-auto rounded-[12px] border-2 border-stroke p-2">
            {students.map((row) => (
              <li key={row.student.id} className="flex items-center justify-between gap-2">
                <Checkbox
                  label={row.student.full_name}
                  checked={studentIds.includes(row.student.id)}
                  onCheckedChange={(on) => toggle(row.student.id, on === true)}
                />
                <span className="text-sm text-muted">
                  {coins.has(row.student.id)
                    ? `${formatNumber(coins.get(row.student.id) ?? 0)} coins`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
          {errors.students && (
            <p className="text-sm font-semibold text-danger-600">{errors.students}</p>
          )}
        </fieldset>
        <div className="space-y-2">
          <p id="bonus-amount-label" className="text-sm font-bold">
            Coins per student
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="bonus-amount-label">
            {COIN_PRESETS.map((preset) => (
              <Chip
                key={preset}
                selected={amount === String(preset)}
                onClick={() => {
                  setAmount(String(preset));
                  clearError("amount");
                }}
              >
                {String(preset)}
              </Chip>
            ))}
          </div>
          <Input
            aria-labelledby="bonus-amount-label"
            type="number"
            inputMode="numeric"
            min={COIN_MIN}
            max={COIN_MAX}
            step={10}
            value={amount}
            error={errors.amount}
            onChange={(event) => {
              setAmount(event.target.value);
              clearError("amount");
            }}
          />
        </div>
        <Input
          label="Reason"
          helperText="For example: helped a classmate with the reading task."
          value={reason}
          maxLength={REASON_MAX}
          showCount
          error={errors.reason}
          onChange={(event) => {
            setReason(event.target.value);
            clearError("reason");
          }}
        />
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={award.isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={award.isPending}>
            <Coins size={16} />
            Send coins
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/* ---------- Tab ---------- */

type GoalDialogState = { goal: ClassGoal | null } | null;

export default function RewardsTab({ classId }: { classId: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [goalDialog, setGoalDialog] = useState<GoalDialogState>(null);
  const [awardOpen, setAwardOpen] = useState(false);

  const roster = useQuery({
    queryKey: classDetailKey(classId, "roster"),
    queryFn: () => fetchRoster(classId),
  });
  const activeStudents = useMemo(
    () => (roster.data?.rows ?? []).filter((row) => row.status.toLowerCase() === "active"),
    [roster.data],
  );
  const studentIds = useMemo(() => activeStudents.map((row) => row.student.id), [activeStudents]);
  const idsKey = studentIds.join(",");

  const goals = useQuery({
    queryKey: partKey(classId, "goals"),
    queryFn: () => fetchGoals(classId),
  });
  const stats = useQuery({
    queryKey: [...partKey(classId, "stats"), idsKey],
    queryFn: () => fetchStats(studentIds),
    enabled: roster.isSuccess,
  });
  const feed = useQuery({
    queryKey: [...partKey(classId, "feed"), idsKey],
    queryFn: () => fetchFeed(studentIds),
    enabled: roster.isSuccess,
  });

  const classXp = useMemo(
    () => (stats.data ?? []).reduce((sum, row) => sum + row.total_xp, 0),
    [stats.data],
  );
  const coins = useMemo(
    () => new Map((stats.data ?? []).map((row) => [row.student_id, row.current_coins] as const)),
    [stats.data],
  );
  const names = useMemo(
    () => new Map(activeStudents.map((row) => [row.student.id, row.student.full_name] as const)),
    [activeStudents],
  );

  const change = useMutation({
    mutationFn: (input: { kind: "launch" | "end"; goal: ClassGoal }) =>
      input.kind === "launch" ? launchGoal(input.goal, classXp) : endGoal(input.goal, classXp),
    onSuccess: (_result, input) => {
      toast.show({
        type: "success",
        title: input.kind === "launch" ? "Goal launched" : "Goal ended",
      });
      void queryClient.invalidateQueries({ queryKey: partKey(classId, "goals") });
    },
    onError: (error: Error) => {
      toast.show({ type: "error", title: "The goal was not changed", description: error.message });
    },
  });

  if (roster.isPending) {
    return (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-40 w-full" label="Loading rewards…" />
        <Skeleton className="h-40 w-full" label={null} />
      </div>
    );
  }
  if (roster.isError) {
    return (
      <ErrorState
        title="Could not load this class"
        description={roster.error instanceof Error ? roster.error.message : undefined}
        onRetry={() => void roster.refetch()}
      />
    );
  }

  const statsReady = stats.isSuccess;
  const busyId = change.isPending ? change.variables.goal.id : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section aria-labelledby="class-goals-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="class-goals-heading" className="font-display text-xl font-extrabold">
            Class goals
          </h2>
          <Button size="sm" onClick={() => setGoalDialog({ goal: null })} disabled={!statsReady}>
            <Plus size={16} />
            New goal
          </Button>
        </div>
        {stats.isError && (
          <ErrorState
            size="sm"
            title="Could not load class XP"
            description={stats.error instanceof Error ? stats.error.message : undefined}
            onRetry={() => void stats.refetch()}
          />
        )}
        <Loaded query={goals} title="Could not load class goals">
          {(items) =>
            items.length === 0 ? (
              <EmptyState
                size="sm"
                title="No class goals yet"
                description="Set an XP target and a reward, and the whole class works toward it together."
                actionLabel="Create a goal"
                onAction={() => setGoalDialog({ goal: null })}
              />
            ) : (
              <ul className="space-y-3">
                {items.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    classXp={classXp}
                    busy={busyId === goal.id}
                    onEdit={() => setGoalDialog({ goal })}
                    onLaunch={() => change.mutate({ kind: "launch", goal })}
                    onEnd={() => change.mutate({ kind: "end", goal })}
                  />
                ))}
              </ul>
            )
          }
        </Loaded>
      </section>

      <section aria-labelledby="bonus-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="bonus-heading" className="font-display text-xl font-extrabold">
            Bonuses and achievements
          </h2>
          <Button
            size="sm"
            onClick={() => setAwardOpen(true)}
            disabled={activeStudents.length === 0}
          >
            <Coins size={16} />
            Grant bonus coins
          </Button>
        </div>
        {activeStudents.length === 0 ? (
          <EmptyState
            size="sm"
            title="No active students"
            description="Add students to the class to give them bonus coins."
          />
        ) : (
          <Loaded query={feed} title="Could not load the feed">
            {(items) =>
              items.length === 0 ? (
                <EmptyState
                  size="sm"
                  title="Nothing yet"
                  description="Bonus coins you give and badges your students earn show up here."
                />
              ) : (
                <ol
                  className={`${PANEL} space-y-3 !p-4`}
                  aria-label="Recent bonuses and achievements"
                >
                  {items.map((item) => {
                    const who = names.get(item.studentId) ?? "A student";
                    return (
                      <li key={item.key} className="flex items-start gap-3">
                        {item.kind === "bonus" ? (
                          <Coins size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                        ) : (
                          <Award size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">
                            <span className="font-bold">{who}</span>
                            {item.kind === "bonus"
                              ? ` received ${formatNumber(item.amount ?? 0)} coins`
                              : ` earned the ${item.label} badge`}
                          </p>
                          {item.kind === "bonus" && (
                            <p className="break-words text-sm text-muted">{item.label}</p>
                          )}
                        </div>
                        <time className="shrink-0 text-xs text-muted" dateTime={item.at}>
                          {formatDate(item.at)}
                        </time>
                      </li>
                    );
                  })}
                </ol>
              )
            }
          </Loaded>
        )}
      </section>

      {goalDialog && (
        <GoalDialog
          key={goalDialog.goal?.id ?? "new"}
          goal={goalDialog.goal}
          classXp={classXp}
          classId={classId}
          onClose={() => setGoalDialog(null)}
        />
      )}
      {awardOpen && (
        <AwardDialog
          students={activeStudents}
          coins={coins}
          classId={classId}
          onClose={() => setAwardOpen(false)}
        />
      )}
    </div>
  );
}
