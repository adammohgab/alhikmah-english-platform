import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { EFFECTS_TIERS, type EffectsTier } from "@/shared/hooks/useEffectsTier";
import { clampVolume } from "@/shared/hooks/useSound";

/* ========================================
   Student settings data layer (STUDENT-SPEC ST-31)
   One row per person in `user_settings` (migration 002, own-row RLS in 039):
     sound_enabled           the sound effects switch
     effects_tier            low, balanced or high
     prefers_reduced_motion  the person's own reduce-motion switch
     notifications_json      a JSON bag with two keys this page owns:
                               notifications  the reminder switches and the reminder time
                               audio          { volume } (the table has no volume column)
   Other keys in the bag are kept as they are when this page saves.
   ======================================== */

export const NOTIFICATION_KEYS = [
  "streakReminders",
  "deadlineReminders",
  "announcements",
  "newBadges",
  "leaderboardChanges",
] as const;
export type NotificationKey = (typeof NOTIFICATION_KEYS)[number];

export interface NotificationPrefs {
  streakReminders: boolean;
  deadlineReminders: boolean;
  announcements: boolean;
  newBadges: boolean;
  leaderboardChanges: boolean;
  /** Preferred reminder time as "HH:MM", 24 hour. */
  reminderTime: string;
}

export const DEFAULT_REMINDER_TIME = "18:00";

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  streakReminders: true,
  deadlineReminders: true,
  announcements: true,
  newBadges: true,
  leaderboardChanges: true,
  reminderTime: DEFAULT_REMINDER_TIME,
};

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isReminderTime(value: unknown): value is string {
  return typeof value === "string" && TIME_PATTERN.test(value);
}

/** What the page knows about the person's saved settings. `exists` is false before the first save. */
export interface StudentSettings {
  exists: boolean;
  soundEnabled: boolean;
  /** Null until the person picks a tier, so the automatic choice stays in charge. */
  effectsTier: EffectsTier | null;
  reducedMotion: boolean;
  /** Null until the person moves the slider. */
  volume: number | null;
  notifications: NotificationPrefs;
}

export const DEFAULT_SETTINGS: StudentSettings = {
  exists: false,
  soundEnabled: true,
  effectsTier: null,
  reducedMotion: false,
  volume: null,
  notifications: DEFAULT_NOTIFICATION_PREFS,
};

const settingsRow = z.object({
  sound_enabled: z.boolean().nullish(),
  effects_tier: z.string().nullish(),
  prefers_reduced_motion: z.boolean().nullish(),
  notifications_json: z.unknown().nullish(),
});

const COLUMNS = "sound_enabled, effects_tier, prefers_reduced_motion, notifications_json";

interface DbError {
  message: string;
  code?: string;
}

/** The generated Database type does not list `user_settings` yet, so rows are checked by zod. */
interface LooseSelect extends PromiseLike<{ data: unknown; error: DbError | null }> {
  eq(column: string, value: string): LooseSelect;
  maybeSingle(): LooseSelect;
}

interface LooseTable {
  select(columns: string): LooseSelect;
  upsert(
    values: Record<string, unknown>,
    options: { onConflict: string },
  ): PromiseLike<{ error: DbError | null }>;
}

const settingsTable = () =>
  (supabase as unknown as { from(table: string): LooseTable }).from("user_settings");

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Reads the notification switches, keeping the default for anything missing or malformed. */
export function parseNotificationPrefs(json: unknown): NotificationPrefs {
  const stored = asRecord(asRecord(json).notifications);
  const prefs: NotificationPrefs = { ...DEFAULT_NOTIFICATION_PREFS };
  for (const key of NOTIFICATION_KEYS) {
    const value = stored[key];
    if (typeof value === "boolean") prefs[key] = value;
  }
  if (isReminderTime(stored.reminderTime)) prefs.reminderTime = stored.reminderTime;
  return prefs;
}

function parseVolume(json: unknown): number | null {
  const volume = asRecord(asRecord(json).audio).volume;
  return typeof volume === "number" && Number.isFinite(volume) ? clampVolume(volume) : null;
}

export function toSettings(row: unknown): StudentSettings {
  const parsed = settingsRow.safeParse(row);
  if (!parsed.success) return DEFAULT_SETTINGS;
  const data = parsed.data;
  const tier = (EFFECTS_TIERS as readonly string[]).includes(data.effects_tier ?? "")
    ? (data.effects_tier as EffectsTier)
    : null;
  return {
    exists: true,
    soundEnabled: data.sound_enabled ?? true,
    effectsTier: tier,
    reducedMotion: data.prefers_reduced_motion ?? false,
    volume: parseVolume(data.notifications_json),
    notifications: parseNotificationPrefs(data.notifications_json),
  };
}

export async function fetchSettings(userId: string): Promise<StudentSettings> {
  const { data, error } = await settingsTable()
    .select(COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data === null ? DEFAULT_SETTINGS : toSettings(data);
}

export interface SettingsPatch {
  soundEnabled?: boolean;
  effectsTier?: EffectsTier;
  reducedMotion?: boolean;
  volume?: number;
  notifications?: Partial<NotificationPrefs>;
}

/**
 * Saves part of the settings. The JSON bag is read first and merged, so keys this page does not
 * own (and the half of the bag the patch does not touch) survive. Creates the row on first save.
 */
export async function saveSettings(userId: string, patch: SettingsPatch): Promise<StudentSettings> {
  const current = await settingsTable()
    .select("notifications_json")
    .eq("user_id", userId)
    .maybeSingle();
  if (current.error) throw new Error(current.error.message);
  const hasRow = current.data !== null;

  const row: Record<string, unknown> = { user_id: userId };
  if (patch.soundEnabled !== undefined) row.sound_enabled = patch.soundEnabled;
  if (patch.reducedMotion !== undefined) row.prefers_reduced_motion = patch.reducedMotion;
  if (patch.effectsTier !== undefined) {
    row.effects_tier = patch.effectsTier;
  } else if (!hasRow) {
    // The column defaults to "balanced". Without a pick, keep the automatic tier in charge.
    row.effects_tier = null;
  }

  if (patch.volume !== undefined || patch.notifications !== undefined) {
    const bag = { ...asRecord(asRecord(current.data).notifications_json) };
    if (patch.notifications !== undefined) {
      bag.notifications = { ...parseNotificationPrefs(bag), ...patch.notifications };
    }
    if (patch.volume !== undefined) {
      bag.audio = { ...asRecord(bag.audio), volume: clampVolume(patch.volume) };
    }
    row.notifications_json = bag;
  }

  const { error } = await settingsTable().upsert(row, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
  return fetchSettings(userId);
}
