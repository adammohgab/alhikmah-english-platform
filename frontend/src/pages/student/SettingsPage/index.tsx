import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Check, KeyRound, Sparkles, Volume2 } from "lucide-react";
import { useAuth } from "@/app/providers/auth-context";
import { Button } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { SegmentedControl } from "@/shared/components/ui/SegmentedControl";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { Switch } from "@/shared/components/ui/Switch";
import { PasswordField } from "@/pages/public/LoginPage/PasswordField";
import {
  PASSWORD_MESSAGES,
  PASSWORD_RULES,
  checkRules,
  measureStrength,
} from "@/pages/public/SetNewPasswordPage/set-password-logic";
import { useEffectsTier, EFFECTS_TIERS, type EffectsTier } from "@/shared/hooks/useEffectsTier";
import { useSound } from "@/shared/hooks/useSound";
import { useToast } from "@/shared/hooks/useToast";
import { cn } from "@/shared/lib/utils/cn";
import {
  DEFAULT_REMINDER_TIME,
  fetchSettings,
  isReminderTime,
  saveSettings,
  type NotificationKey,
  type NotificationPrefs,
  type SettingsPatch,
  type StudentSettings,
} from "./api";
import {
  CHANGE_MESSAGES,
  changePassword,
  validateChangeAll,
  validateChangeField,
  type ChangePasswordErrors,
  type ChangePasswordField,
  type ChangePasswordValues,
} from "./change-password";

/* ========================================
   Student settings (STUDENT-SPEC ST-31, task ST-31)

   Cards, top to bottom: Sound, Motion and effects, Notifications, Change password.
   Sound and motion choices go to SoundProvider and EffectsProvider first, so they apply across
   the app the moment they change, then are saved to `user_settings` in the background. A failed
   save puts the controls back to what is saved and says so in a toast. Volume saves once the
   slider rests. Account facts (name, username) are read-only: the school manages them.
   ======================================== */

const SETTINGS_KEY = "student-settings";
const VOLUME_SAVE_DELAY_MS = 600;

const TIER_LABEL: Record<EffectsTier, string> = { low: "Low", balanced: "Balanced", high: "High" };
const TIER_HINT: Record<EffectsTier, string> = {
  low: "Simple fades only. Best for older phones and saving battery.",
  balanced: "Light bursts and standard motion.",
  high: "Full celebrations, 3D scenes and playful extras.",
};

const NOTIFICATION_ROWS: readonly { key: NotificationKey; label: string; hint: string }[] = [
  { key: "streakReminders", label: "Streak reminders", hint: "A nudge before your streak ends." },
  {
    key: "deadlineReminders",
    label: "Deadline reminders",
    hint: "Assignments and quizzes due soon.",
  },
  { key: "announcements", label: "Announcements", hint: "News from your teachers and school." },
  { key: "newBadges", label: "New badges", hint: "When you earn a badge." },
  { key: "leaderboardChanges", label: "Leaderboard changes", hint: "When your rank moves." },
];

function SettingsCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <Card as="section" aria-labelledby={headingId} padding="lg" shadow="sm">
      <div className="mb-4 flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-stroke bg-[var(--world-soft,#ffd93d)]"
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h2 id={headingId} className="font-display text-xl font-bold text-stroke">
            {title}
          </h2>
          <p className="text-sm text-muted">{description}</p>
        </div>
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </Card>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-1.5">{children}</div>;
}

function Hint({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="text-sm text-muted">
      {children}
    </p>
  );
}

/* ---------- Sound ---------- */

function SoundCard({ save }: { save: (patch: SettingsPatch) => void }) {
  const { volume, setVolume, muted, setMuted, play } = useSound();
  const sliderId = useId();
  const hintId = useId();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<number | null>(null);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  const flush = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    if (pending.current !== null) {
      saveRef.current({ volume: pending.current });
      pending.current = null;
    }
  }, []);

  // Leaving the page with an unsaved volume still saves it.
  useEffect(() => flush, [flush]);

  const onVolume = (value: number) => {
    setVolume(value);
    pending.current = value;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(flush, VOLUME_SAVE_DELAY_MS);
  };

  const percent = Math.round(volume * 100);

  return (
    <SettingsCard
      icon={<Volume2 size={20} />}
      title="Sound"
      description="Arcade sounds for taps, rewards and celebrations."
    >
      <Switch
        label="Sound effects"
        sound={false}
        checked={!muted}
        onCheckedChange={(on) => {
          setMuted(!on);
          save({ soundEnabled: on });
        }}
      />
      <Row>
        <label htmlFor={sliderId} className="flex items-center justify-between font-semibold">
          <span>Volume</span>
          <span aria-hidden="true" className="tabular-nums text-muted">
            {percent}%
          </span>
        </label>
        <input
          id={sliderId}
          type="range"
          min={0}
          max={100}
          step={5}
          value={percent}
          disabled={muted}
          aria-describedby={hintId}
          aria-valuetext={`${percent} percent`}
          onChange={(event) => {
            onVolume(Number(event.target.value) / 100);
          }}
          onPointerUp={() => {
            flush();
            play("pop");
          }}
          onKeyUp={() => {
            flush();
            play("pop");
          }}
          className="h-3 w-full cursor-pointer accent-[var(--world-main,#ffb84d)] disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Hint id={hintId}>
          {muted ? "Turn sound effects on to change the volume." : "Release the slider to hear it."}
        </Hint>
      </Row>
    </SettingsCard>
  );
}

/* ---------- Motion and effects ---------- */

function MotionCard({ save }: { save: (patch: SettingsPatch) => void }) {
  const { tier, preferences, prefersReducedMotion, setPreferences } = useEffectsTier();
  const deviceAsksToReduce = prefersReducedMotion && !preferences.reducedMotion;
  const locked = prefersReducedMotion;

  return (
    <SettingsCard
      icon={<Sparkles size={20} />}
      title="Motion and effects"
      description="Choose how lively the app feels. Changes apply right away."
    >
      <Row>
        <Switch
          label="Reduce motion"
          checked={preferences.reducedMotion}
          onCheckedChange={(on) => {
            setPreferences({ reducedMotion: on });
            save({ reducedMotion: on });
          }}
        />
        <Hint>
          {deviceAsksToReduce
            ? "Your device already asks for reduced motion, so effects stay on Low."
            : "Fewer animations, no confetti, and simple fades."}
        </Hint>
      </Row>
      <Row>
        <span id="effects-tier-label" className="font-semibold">
          Visual effects
        </span>
        <SegmentedControl
          aria-labelledby="effects-tier-label"
          size="md"
          fullWidth
          value={tier}
          options={EFFECTS_TIERS.map((value) => ({
            value,
            label: TIER_LABEL[value],
            disabled: locked,
          }))}
          onValueChange={(value) => {
            const picked = EFFECTS_TIERS.find((candidate) => candidate === value);
            if (picked === undefined) return;
            setPreferences({ tier: picked });
            save({ effectsTier: picked });
          }}
        />
        <Hint>
          {locked
            ? "Reduce motion is on, so effects stay on Low."
            : `${TIER_LABEL[tier]}: ${TIER_HINT[tier]}`}
        </Hint>
      </Row>
    </SettingsCard>
  );
}

/* ---------- Notifications ---------- */

function NotificationsCard({
  settings,
  save,
}: {
  settings: StudentSettings;
  save: (patch: SettingsPatch) => void;
}) {
  const timeId = useId();
  const timeHintId = useId();
  const prefs = settings.notifications;
  const [time, setTime] = useState(prefs.reminderTime);

  // Follows the saved value when it changes from outside (a reload, a revert after a failed save).
  useEffect(() => {
    setTime(prefs.reminderTime);
  }, [prefs.reminderTime]);

  return (
    <SettingsCard
      icon={<BellRing size={20} />}
      title="Notifications"
      description="Pick the reminders you want from Al Hikmah."
    >
      <ul className="flex flex-col gap-4">
        {NOTIFICATION_ROWS.map((row) => (
          <li key={row.key} className="flex flex-col gap-1">
            <Switch
              label={row.label}
              checked={prefs[row.key]}
              onCheckedChange={(on) => {
                const change: Partial<NotificationPrefs> = {};
                change[row.key] = on;
                save({ notifications: change });
              }}
            />
            <Hint>{row.hint}</Hint>
          </li>
        ))}
      </ul>
      <Row>
        <label htmlFor={timeId} className="font-semibold">
          Reminder time
        </label>
        <input
          id={timeId}
          type="time"
          value={time}
          aria-describedby={timeHintId}
          onChange={(event) => {
            setTime(event.target.value);
          }}
          onBlur={() => {
            if (isReminderTime(time)) {
              if (time !== prefs.reminderTime) save({ notifications: { reminderTime: time } });
            } else {
              setTime(prefs.reminderTime || DEFAULT_REMINDER_TIME);
            }
          }}
          className="h-11 w-40 rounded-[12px] border-2 border-stroke bg-surface-0 px-3 font-body text-base"
        />
        <Hint id={timeHintId}>When streak and deadline reminders should arrive.</Hint>
      </Row>
    </SettingsCard>
  );
}

/* ---------- Change password ---------- */

const EMPTY_VALUES: ChangePasswordValues = { current: "", password: "", confirm: "" };

function PasswordCard({ username }: { username: string }) {
  const toast = useToast();
  const [values, setValues] = useState<ChangePasswordValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<ChangePasswordErrors>({});
  const [busy, setBusy] = useState(false);
  const formId = useId();

  const rules = checkRules(values.password, username);
  const strength = measureStrength(values.password, username);

  const setField = (field: ChangePasswordField, value: string) => {
    const next = { ...values, [field]: value };
    setValues(next);
    // An error clears as soon as the field is fixed, and the confirm field follows the new one.
    setErrors((prev) => {
      const updated = { ...prev };
      for (const name of ["current", "password", "confirm"] as const) {
        if (prev[name] === undefined) continue;
        const message = validateChangeField(name, next, username);
        if (message === undefined) delete updated[name];
        else updated[name] = message;
      }
      return updated;
    });
  };

  const blurField = (field: ChangePasswordField) => {
    if (values[field] === "") return;
    const message = validateChangeField(field, values, username);
    setErrors((prev) => {
      const updated = { ...prev };
      if (message === undefined) delete updated[field];
      else updated[field] = message;
      return updated;
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const found = validateChangeAll(values, username);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      const outcome = await changePassword(username, values);
      switch (outcome.kind) {
        case "changed":
          setValues(EMPTY_VALUES);
          setErrors({});
          toast.show({
            type: "success",
            title: "Password changed",
            description: "Use your new password the next time you sign in.",
          });
          break;
        case "wrong-current":
          setErrors({ current: CHANGE_MESSAGES.currentWrong });
          break;
        case "session-expired":
          toast.show({ type: "error", title: PASSWORD_MESSAGES.expired });
          break;
        case "network":
          toast.show({ type: "error", title: PASSWORD_MESSAGES.network });
          break;
        case "rejected":
          setErrors({ password: outcome.message });
          break;
        default:
          toast.show({ type: "error", title: PASSWORD_MESSAGES.failed });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsCard
      icon={<KeyRound size={20} />}
      title="Change password"
      description="Pick a password only you know."
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void submit(event)}
        className="flex flex-col gap-4"
      >
        <PasswordField
          id={`${formId}-current`}
          name="current-password"
          label="Current password"
          autoComplete="current-password"
          value={values.current}
          error={errors.current}
          disabled={busy}
          onValueChange={(value) => {
            setField("current", value);
          }}
          onBlur={() => {
            blurField("current");
          }}
        />
        <PasswordField
          id={`${formId}-new`}
          name="new-password"
          label="New password"
          autoComplete="new-password"
          value={values.password}
          error={errors.password}
          disabled={busy}
          onValueChange={(value) => {
            setField("password", value);
          }}
          onBlur={() => {
            blurField("password");
          }}
        />
        <ul aria-label="Password rules" className="flex flex-col gap-1 text-sm">
          {PASSWORD_RULES.map((rule) => (
            <li
              key={rule.id}
              className={cn(
                "flex items-center gap-2",
                rules[rule.id] ? "text-stroke" : "text-muted",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "grid h-4 w-4 place-items-center rounded-full border-2 border-stroke",
                  rules[rule.id] && "bg-[#1FBF7A]",
                )}
              >
                {rules[rule.id] && <Check size={10} strokeWidth={4} />}
              </span>
              {rule.label}
              <span className="sr-only">{rules[rule.id] ? ": met" : ": not met yet"}</span>
            </li>
          ))}
        </ul>
        {strength.label !== "" && (
          <p className="text-sm font-semibold" aria-live="polite">
            Strength: {strength.label}
          </p>
        )}
        <PasswordField
          id={`${formId}-confirm`}
          name="confirm-password"
          label="Confirm new password"
          autoComplete="new-password"
          value={values.confirm}
          error={errors.confirm}
          disabled={busy}
          onValueChange={(value) => {
            setField("confirm", value);
          }}
          onBlur={() => {
            blurField("confirm");
          }}
        />
        <div>
          <Button type="submit" loading={busy}>
            Change password
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}

/* ---------- Page ---------- */

export default function SettingsPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const toast = useToast();
  const queryClient = useQueryClient();
  const sound = useSound();
  const effects = useEffectsTier();

  const query = useQuery({
    queryKey: [SETTINGS_KEY, userId],
    queryFn: () => fetchSettings(userId!),
    enabled: Boolean(userId),
  });
  const saved = query.data;

  // The saved row is applied to the app once, so a new device picks up the same choices.
  const hydratedFor = useRef<string | undefined>(undefined);
  const { setMuted, setVolume } = sound;
  const { setPreferences } = effects;
  const applySaved = useCallback(
    (settings: StudentSettings) => {
      if (!settings.exists) return;
      setMuted(!settings.soundEnabled);
      if (settings.volume !== null) setVolume(settings.volume);
      setPreferences({ tier: settings.effectsTier ?? "balanced", reducedMotion: settings.reducedMotion });
    },
    [setMuted, setVolume, setPreferences],
  );
  useEffect(() => {
    if (saved === undefined || userId === undefined || hydratedFor.current === userId) return;
    hydratedFor.current = userId;
    applySaved(saved);
  }, [saved, userId, applySaved]);

  const mutation = useMutation({
    mutationFn: (patch: SettingsPatch) => saveSettings(userId!, patch),
    onSuccess: (next) => {
      queryClient.setQueryData([SETTINGS_KEY, userId], next);
    },
    onError: () => {
      // Put the controls back to what is saved, so the screen never claims a save that failed.
      void queryClient
        .fetchQuery({
          queryKey: [SETTINGS_KEY, userId],
          queryFn: () => fetchSettings(userId!),
          staleTime: 0,
        })
        .then(applySaved, () => undefined);
      toast.show({
        type: "error",
        title: "We could not save your settings",
        description: "Check your connection and try again.",
      });
    },
  });

  // Saves run one after another, so a quick second change never overwrites the first.
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const { mutateAsync } = mutation;
  const save = useCallback(
    (patch: SettingsPatch) => {
      if (userId === undefined) return;
      if (patch.notifications !== undefined) {
        // Notification switches show the new value at once; a failed save puts them back.
        queryClient.setQueryData<StudentSettings>([SETTINGS_KEY, userId], (old) =>
          old === undefined
            ? old
            : { ...old, notifications: { ...old.notifications, ...patch.notifications } },
        );
      }
      chain.current = chain.current.then(() => mutateAsync(patch).catch(() => undefined));
    },
    [mutateAsync, queryClient, userId],
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6">
      <header>
        <h1 className="font-display text-3xl font-bold text-stroke">Settings</h1>
        {user && (
          <p className="text-muted">
            {user.fullName} · <span className="font-semibold">@{user.username}</span>. Your name and
            class are managed by your school.
          </p>
        )}
      </header>

      {query.isError ? (
        <ErrorState
          title="We could not load your settings"
          description="Your choices are safe. Check your connection and try again."
          onRetry={() => void query.refetch()}
        />
      ) : query.isPending || saved === undefined ? (
        <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading settings">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : (
        <>
          <SoundCard save={save} />
          <MotionCard save={save} />
          <NotificationsCard settings={saved} save={save} />
        </>
      )}

      {user && <PasswordCard username={user.username} />}
    </main>
  );
}
