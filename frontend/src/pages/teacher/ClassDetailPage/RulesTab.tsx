import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";
import { Button } from "@/shared/components/ui/Button";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { Switch } from "@/shared/components/ui/Switch";
import { useToast } from "@/shared/hooks/useToast";
import { classDetailKey, fetchRoster, fetchRules, type ClassRules } from "./api";

/* ========================================
   Class rules tab (TEACHER-SPEC TC-05, task TCH-CORE-05)

   Class-wide switches for arcade games and the AI Tutor, the late-work policy (allow late
   submissions and a 0 to 50 percent penalty) and per-student accommodations (extra time x1.5,
   late penalty waiver). Class rules are one `class_rules` row saved from a fixed bar with
   Save and Discard. Accommodations save the moment a switch is flipped, one student at a time.

   Class rules are written straight to `class_rules` (RLS allows the class's teachers).
   Accommodations are stored in `class_accommodations`
   (class_id, student_id, extra_time_multiplier, late_penalty_waived).
   ======================================== */

const PANEL = "rounded-[20px] border-2 border-stroke bg-surface-0 p-5 shadow-retro-sm";
const MAX_PENALTY = 50;
const EXTRA_TIME = 1.5;

interface DbError {
  message: string;
  code?: string;
}
interface LooseResult {
  data: unknown;
  error: DbError | null;
}
interface LooseTable {
  select: (columns: string) => { eq: (column: string, value: string) => PromiseLike<LooseResult> };
  update: (values: Record<string, unknown>) => {
    eq: (column: string, value: string) => PromiseLike<LooseResult>;
  };
  upsert: (
    values: Record<string, unknown>,
    options: { onConflict: string },
  ) => PromiseLike<LooseResult>;
  delete: () => {
    eq: (
      column: string,
      value: string,
    ) => { eq: (column: string, value: string) => PromiseLike<LooseResult> };
  };
}
const table = (name: string) =>
  (supabase as unknown as { from: (n: string) => LooseTable }).from(name);

const accommodationRow = z.object({
  student_id: z.string(),
  extra_time_multiplier: z.coerce.number(),
  late_penalty_waived: z.boolean(),
});
interface Accommodation {
  extraTime: boolean;
  waiveLate: boolean;
}

async function fetchAccommodations(classId: string): Promise<Map<string, Accommodation>> {
  const { data, error } = await table("class_accommodations")
    .select("student_id, extra_time_multiplier, late_penalty_waived")
    .eq("class_id", classId);
  if (error) throw new Error(normalizeApiError(error).message);
  const rows = z.array(accommodationRow).parse(data);
  return new Map(
    rows.map((row) => [
      row.student_id,
      { extraTime: row.extra_time_multiplier > 1, waiveLate: row.late_penalty_waived },
    ]),
  );
}

async function saveAccommodation(
  classId: string,
  studentId: string,
  value: Accommodation,
): Promise<void> {
  const result =
    value.extraTime || value.waiveLate
      ? await table("class_accommodations").upsert(
          {
            class_id: classId,
            student_id: studentId,
            extra_time_multiplier: value.extraTime ? EXTRA_TIME : 1,
            late_penalty_waived: value.waiveLate,
          },
          { onConflict: "class_id,student_id" },
        )
      : await table("class_accommodations")
          .delete()
          .eq("class_id", classId)
          .eq("student_id", studentId);
  if (result.error) throw new Error(normalizeApiError(result.error).message);
}

async function saveRules(classId: string, rules: ClassRules): Promise<void> {
  const { error } = await table("class_rules")
    .update({
      games_enabled: rules.games_enabled,
      ai_tutor_enabled: rules.ai_tutor_enabled,
      late_submission_allowed: rules.late_submission_allowed,
      late_penalty_percent: rules.late_penalty_percent,
    })
    .eq("class_id", classId);
  if (error) throw new Error(normalizeApiError(error).message);
}

const same = (a: ClassRules, b: ClassRules) =>
  a.games_enabled === b.games_enabled &&
  a.ai_tutor_enabled === b.ai_tutor_enabled &&
  a.late_submission_allowed === b.late_submission_allowed &&
  a.late_penalty_percent === b.late_penalty_percent;

function RulesForm({ classId, saved }: { classId: string; saved: ClassRules }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ClassRules>(saved);

  // A fresh save (or a refetch from elsewhere) becomes the new starting point.
  useEffect(() => setDraft(saved), [saved]);
  const dirty = !same(draft, saved);

  const save = useMutation({
    mutationFn: () => saveRules(classId, draft),
    onSuccess: async () => {
      toast.show({ title: "Class rules saved", type: "success" });
      await queryClient.invalidateQueries({ queryKey: classDetailKey(classId, "rules") });
    },
    onError: (error: Error) =>
      toast.show({ title: "Could not save the rules", description: error.message, type: "error" }),
  });

  const patch = (change: Partial<ClassRules>) => setDraft((current) => ({ ...current, ...change }));
  const penaltyMax = Math.max(MAX_PENALTY, draft.late_penalty_percent);

  return (
    <div className="flex flex-col gap-4">
      <section className={PANEL} aria-labelledby="rules-features">
        <h3 id="rules-features" className="font-display mb-3 text-[20px]">
          Games and AI Tutor
        </h3>
        <div className="flex flex-col gap-3">
          <Switch
            label="Arcade minigames: students can play games"
            checked={draft.games_enabled}
            onCheckedChange={(checked) => patch({ games_enabled: checked })}
          />
          <Switch
            label="AI Tutor: students can chat with Pip"
            checked={draft.ai_tutor_enabled}
            onCheckedChange={(checked) => patch({ ai_tutor_enabled: checked })}
          />
        </div>
      </section>

      <section className={PANEL} aria-labelledby="rules-late">
        <h3 id="rules-late" className="font-display mb-3 text-[20px]">
          Late work
        </h3>
        <Switch
          label="Allow late submissions"
          checked={draft.late_submission_allowed}
          onCheckedChange={(checked) => patch({ late_submission_allowed: checked })}
        />
        <div className="mt-4 flex flex-col gap-1">
          <label htmlFor="late-penalty" className="text-[14px] font-bold">
            Late penalty: {draft.late_penalty_percent}%
          </label>
          <input
            id="late-penalty"
            type="range"
            min={0}
            max={penaltyMax}
            step={5}
            value={draft.late_penalty_percent}
            disabled={!draft.late_submission_allowed}
            aria-valuetext={`${draft.late_penalty_percent} percent`}
            onChange={(event) => patch({ late_penalty_percent: Number(event.target.value) })}
            className="w-full max-w-sm"
          />
          <p className="text-[14px] text-muted">
            Taken off the score of work handed in after the deadline. Individual assignments can
            override this.
          </p>
        </div>
      </section>

      <div
        className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border-2 border-stroke bg-surface-0 p-3 shadow-retro-sm"
        role="region"
        aria-label="Save class rules"
      >
        <p role="status" className="text-[14px] font-bold">
          {dirty ? "Unsaved changes" : "All changes saved"}
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={!dirty || save.isPending}
            onClick={() => setDraft(saved)}
          >
            Discard
          </Button>
          <Button disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function Accommodations({ classId }: { classId: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const roster = useQuery({
    queryKey: classDetailKey(classId, "roster"),
    queryFn: () => fetchRoster(classId),
  });
  const accommodations = useQuery({
    queryKey: classDetailKey(classId, "accommodations"),
    queryFn: () => fetchAccommodations(classId),
  });

  const save = useMutation({
    mutationFn: (input: { studentId: string; value: Accommodation }) =>
      saveAccommodation(classId, input.studentId, input.value),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: classDetailKey(classId, "accommodations") }),
    onError: (error: Error) =>
      toast.show({
        title: "Could not save that change",
        description: error.message,
        type: "error",
      }),
  });

  const students = useMemo(
    () => (roster.data?.rows ?? []).filter((row) => row.status === "active"),
    [roster.data],
  );

  return (
    <section className={PANEL} aria-labelledby="rules-accommodations">
      <h3 id="rules-accommodations" className="font-display text-[20px]">
        Student accommodations
      </h3>
      <p className="mb-3 text-[14px] text-muted">
        Extra time gives a student {EXTRA_TIME}x the time limit on quizzes. Waiving the penalty
        means late work from that student is not marked down. Changes here save right away.
      </p>
      {roster.isPending || accommodations.isPending ? (
        <Skeleton className="h-32 w-full" label="Loading…" />
      ) : roster.isError || accommodations.isError ? (
        <ErrorState
          size="sm"
          description="Accommodations could not load."
          onRetry={() => {
            void roster.refetch();
            void accommodations.refetch();
          }}
        />
      ) : students.length === 0 ? (
        <EmptyState size="sm" title="No students in this class yet." />
      ) : (
        <ul className="flex flex-col">
          {students.map((row) => {
            const current = accommodations.data.get(row.student.id) ?? {
              extraTime: false,
              waiveLate: false,
            };
            const busy = save.isPending && save.variables?.studentId === row.student.id;
            return (
              <li
                key={row.student.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-stroke/30 py-2"
              >
                <span className="min-w-0 font-bold [overflow-wrap:anywhere]">
                  {row.student.full_name}
                </span>
                <span className="flex flex-wrap gap-4">
                  <Switch
                    label={`Extra time x${EXTRA_TIME}`}
                    checked={current.extraTime}
                    disabled={busy}
                    onCheckedChange={(checked) =>
                      save.mutate({
                        studentId: row.student.id,
                        value: { ...current, extraTime: checked },
                      })
                    }
                  />
                  <Switch
                    label="Waive late penalty"
                    checked={current.waiveLate}
                    disabled={busy}
                    onCheckedChange={(checked) =>
                      save.mutate({
                        studentId: row.student.id,
                        value: { ...current, waiveLate: checked },
                      })
                    }
                  />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function RulesTab({ classId }: { classId: string }) {
  const rules = useQuery({
    queryKey: classDetailKey(classId, "rules"),
    queryFn: () => fetchRules(classId),
  });

  if (rules.isPending) return <Skeleton className="h-40 w-full" label="Loading…" />;
  if (rules.isError) {
    return (
      <ErrorState
        title="Could not load the class rules"
        description={rules.error instanceof Error ? rules.error.message : undefined}
        onRetry={() => void rules.refetch()}
      />
    );
  }
  if (rules.data === null) {
    return <EmptyState title="No rules set" description="Default rules apply to this class." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <RulesForm classId={classId} saved={rules.data} />
      <Accommodations classId={classId} />
    </div>
  );
}

export default RulesTab;
