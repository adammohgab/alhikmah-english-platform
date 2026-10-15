import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";

/* ========================================
   Teacher preferences (TEACHER-SPEC TC-29, API-CONTRACT §4.10, DATA-MODEL `user_settings`)

   Profile extras and grading defaults live in `user_settings.teacher_prefs`; notification
   toggles in `user_settings.notification_prefs`. Schemas are "loose": keys written by other
   tasks (needs-attention thresholds, AI preferences, ...) survive a save untouched.

   Builder workflows read the default grading scale through `useTeacherPrefs()` and show marks
   with `formatGrade()`, so changing it here changes it everywhere.
   ======================================== */

export const GRADING_SCALES = ["percentage", "letter"] as const;
export const GRADING_MODES = ["review_each", "overall", "bulk_approve", "manual"] as const;
export const GRADE_RELEASES = ["immediate", "manual"] as const;
export const DIGESTS = ["off", "daily", "weekly"] as const;

const teacherPrefsSchema = z.looseObject({
  profile: z
    .looseObject({
      title: z.string().prefault(""),
      bio: z.string().prefault(""),
    })
    .prefault({}),
  grading: z
    .looseObject({
      scale: z.enum(GRADING_SCALES).prefault("percentage"),
      default_mode: z.enum(GRADING_MODES).prefault("review_each"),
      default_release: z.enum(GRADE_RELEASES).prefault("manual"),
    })
    .prefault({}),
});

const notificationPrefsSchema = z.looseObject({
  submission_digest: z.enum(DIGESTS).prefault("off"),
  urgent_question_alerts: z.boolean().prefault(true),
});

const rowSchema = z
  .object({
    teacher_prefs: z.unknown().nullish(),
    notification_prefs: z.unknown().nullish(),
  })
  .nullable();

export type TeacherPrefs = z.infer<typeof teacherPrefsSchema>;
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;
export type GradingScale = (typeof GRADING_SCALES)[number];

export interface TeacherSettings {
  teacher: TeacherPrefs;
  notifications: NotificationPrefs;
}

/** Minimal shape of the query builder for the `user_settings` table, which the generated
 * Database type does not describe yet. Results are validated by zod. */
interface LooseTable {
  select(columns: string): {
    eq(
      column: string,
      value: string,
    ): {
      maybeSingle(): PromiseLike<{
        data: unknown;
        error: { message: string; code?: string } | null;
      }>;
    };
  };
  upsert(
    values: Record<string, unknown>,
    options: { onConflict: string },
  ): PromiseLike<{ error: { message: string; code?: string } | null }>;
}

const settingsTable = () =>
  (supabase as unknown as { from(table: string): LooseTable }).from("user_settings");

export async function fetchTeacherSettings(userId: string): Promise<TeacherSettings> {
  const { data, error } = await settingsTable()
    .select("teacher_prefs, notification_prefs")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(normalizeApiError(error).message);
  const row = rowSchema.safeParse(data);
  if (!row.success) throw new Error("Your settings were returned in an unexpected shape.");
  return {
    teacher: teacherPrefsSchema.parse(row.data?.teacher_prefs ?? {}),
    notifications: notificationPrefsSchema.parse(row.data?.notification_prefs ?? {}),
  };
}

/**
 * Saves the edited sections on top of the freshest stored row, so keys this page does not
 * know about (written by other screens) are preserved.
 */
export async function saveTeacherSettings(userId: string, next: TeacherSettings): Promise<void> {
  const current = await fetchTeacherSettings(userId);
  const merged = {
    teacher_prefs: {
      ...current.teacher,
      ...next.teacher,
      profile: { ...current.teacher.profile, ...next.teacher.profile },
      grading: { ...current.teacher.grading, ...next.teacher.grading },
    },
    notification_prefs: { ...current.notifications, ...next.notifications },
  };
  const { error } = await settingsTable().upsert(
    { user_id: userId, ...merged },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(normalizeApiError(error).message);
}

export async function saveDisplayName(userId: string, name: string): Promise<void> {
  const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", userId);
  if (error) throw new Error(normalizeApiError(error).message);
}

export const teacherSettingsKey = (userId: string | undefined) =>
  ["teacher-settings", userId] as const;

/** Current teacher preferences, for builders that prefill defaults (grading scale, mode). */
export function useTeacherPrefs(userId: string | undefined) {
  return useQuery({
    queryKey: teacherSettingsKey(userId),
    queryFn: () => fetchTeacherSettings(userId!),
    enabled: Boolean(userId),
  });
}

/** Letter for a percentage: A 90+, B 80+, C 70+, D 60+, otherwise F. */
export function toLetter(percent: number): string {
  if (percent >= 90) return "A";
  if (percent >= 80) return "B";
  if (percent >= 70) return "C";
  if (percent >= 60) return "D";
  return "F";
}

/** Renders a mark in the teacher's default scale: "85%" or "B". */
export function formatGrade(percent: number, scale: GradingScale): string {
  return scale === "letter" ? toLetter(percent) : `${Math.round(percent)}%`;
}
