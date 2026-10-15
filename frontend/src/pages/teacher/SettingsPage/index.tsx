import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/auth-context";
import { Button } from "@/shared/components/ui/Button";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { Input } from "@/shared/components/ui/Input";
import { SegmentedControl } from "@/shared/components/ui/SegmentedControl";
import { Select } from "@/shared/components/ui/Select";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { Switch } from "@/shared/components/ui/Switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/Tabs";
import { Textarea } from "@/shared/components/ui/Textarea";
import { useToast } from "@/shared/hooks/useToast";
import { PasswordDialog } from "./PasswordDialog";
import {
  formatGrade,
  saveDisplayName,
  saveTeacherSettings,
  teacherSettingsKey,
  useTeacherPrefs,
} from "./prefs";
import type { GradingScale, TeacherSettings } from "./prefs";

/* ========================================
   Teacher settings (TEACHER-SPEC TC-29, task TCH-CORE-19)
   Tabs: Profile, Notifications, Grading defaults, Security. One draft, one Save bar.
   Saved to `user_settings` (teacher_prefs / notification_prefs); the display name goes to the
   teacher's profile. Builders read the default grading scale via `useTeacherPrefs`.
   ======================================== */

const PANEL = "rounded-[20px] border-2 border-stroke bg-surface-0 p-5 shadow-retro-sm";

const MODE_OPTIONS = [
  { value: "review_each", label: "Review each answer" },
  { value: "overall", label: "Overall grade with AI suggestions" },
  { value: "bulk_approve", label: "Bulk approve" },
  { value: "manual", label: "Manual only" },
];
const RELEASE_OPTIONS = [
  { value: "manual", label: "I release grades myself" },
  { value: "immediate", label: "Release when I confirm" },
];
const DIGEST_OPTIONS = [
  { value: "off", label: "No digest" },
  { value: "daily", label: "Daily digest" },
  { value: "weekly", label: "Weekly digest" },
];

interface Draft {
  settings: TeacherSettings;
  displayName: string;
}

function SettingsForm({
  userId,
  initialName,
  saved,
}: {
  userId: string;
  initialName: string;
  saved: TeacherSettings;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>({ settings: saved, displayName: initialName });
  const [baseline, setBaseline] = useState<Draft>({ settings: saved, displayName: initialName });
  const [passwordOpen, setPasswordOpen] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const nameValid = draft.displayName.trim().length > 0;

  const save = useMutation({
    mutationFn: async (value: Draft) => {
      await saveTeacherSettings(userId, value.settings);
      if (value.displayName.trim() !== baseline.displayName) {
        await saveDisplayName(userId, value.displayName.trim());
      }
      return value;
    },
    onSuccess: (value) => {
      setBaseline(value);
      void queryClient.invalidateQueries({ queryKey: teacherSettingsKey(userId) });
      toast.show({ type: "success", title: "Settings saved" });
    },
    onError: (error: Error) => {
      toast.show({ type: "error", title: "Settings were not saved", description: error.message });
    },
  });

  const { teacher, notifications } = draft.settings;
  const patchTeacher = (patch: Partial<typeof teacher>) =>
    setDraft((d) => ({
      ...d,
      settings: { ...d.settings, teacher: { ...d.settings.teacher, ...patch } },
    }));
  const patchProfile = (patch: Partial<typeof teacher.profile>) =>
    patchTeacher({ profile: { ...teacher.profile, ...patch } });
  const patchGrading = (patch: Partial<typeof teacher.grading>) =>
    patchTeacher({ grading: { ...teacher.grading, ...patch } });
  const patchNotifications = (patch: Partial<typeof notifications>) =>
    setDraft((d) => ({
      ...d,
      settings: { ...d.settings, notifications: { ...d.settings.notifications, ...patch } },
    }));

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (dirty && nameValid) save.mutate(draft);
      }}
      className="space-y-6"
    >
      <Tabs defaultValue="profile">
        <TabsList aria-label="Settings sections">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="grading">Grading defaults</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className={`${PANEL} mt-4 space-y-4`}>
          <Input
            label="Display name"
            value={draft.displayName}
            error={nameValid ? undefined : "Enter a name."}
            onChange={(event) => setDraft((d) => ({ ...d, displayName: event.target.value }))}
          />
          <Input
            label="Title"
            helperText="For example, Head of English."
            maxLength={80}
            value={teacher.profile.title}
            onChange={(event) => patchProfile({ title: event.target.value })}
          />
          <Textarea
            label="Bio"
            maxLength={500}
            showCount
            value={teacher.profile.bio}
            onChange={(event) => patchProfile({ bio: event.target.value })}
          />
        </TabsContent>

        <TabsContent value="notifications" className={`${PANEL} mt-4 space-y-5`}>
          <div className="space-y-2">
            <p id="digest-label" className="font-bold">
              Submission digest
            </p>
            <Select
              aria-labelledby="digest-label"
              value={notifications.submission_digest}
              onValueChange={(value) =>
                patchNotifications({
                  submission_digest: value as typeof notifications.submission_digest,
                })
              }
              options={DIGEST_OPTIONS}
            />
          </div>
          <Switch
            label="Instant alerts when a student asks an urgent question"
            checked={notifications.urgent_question_alerts}
            onCheckedChange={(checked) => patchNotifications({ urgent_question_alerts: checked })}
          />
        </TabsContent>

        <TabsContent value="grading" className={`${PANEL} mt-4 space-y-5`}>
          <div className="space-y-2">
            <p id="scale-label" className="font-bold">
              Default grading scale
            </p>
            <SegmentedControl
              aria-labelledby="scale-label"
              size="md"
              value={teacher.grading.scale}
              onValueChange={(value) => patchGrading({ scale: value as GradingScale })}
              options={[
                { value: "percentage", label: "Percentage" },
                { value: "letter", label: "Letter grade (A-F)" },
              ]}
            />
            <p className="text-sm text-muted">
              Preview: 92 points shows as {formatGrade(92, teacher.grading.scale)}, 74 as{" "}
              {formatGrade(74, teacher.grading.scale)}. New assignments and quizzes start with this
              scale.
            </p>
          </div>
          <div className="space-y-2">
            <p id="mode-label" className="font-bold">
              Default grading mode
            </p>
            <Select
              aria-labelledby="mode-label"
              value={teacher.grading.default_mode}
              onValueChange={(value) =>
                patchGrading({ default_mode: value as typeof teacher.grading.default_mode })
              }
              options={MODE_OPTIONS}
            />
          </div>
          <div className="space-y-2">
            <p id="release-label" className="font-bold">
              Default grade release
            </p>
            <Select
              aria-labelledby="release-label"
              value={teacher.grading.default_release}
              onValueChange={(value) =>
                patchGrading({ default_release: value as typeof teacher.grading.default_release })
              }
              options={RELEASE_OPTIONS}
            />
          </div>
        </TabsContent>

        <TabsContent value="security" className={`${PANEL} mt-4 space-y-3`}>
          <p className="font-bold">Password</p>
          <p className="text-sm text-muted">Change the password you use to sign in.</p>
          <Button type="button" variant="outline" onClick={() => setPasswordOpen(true)}>
            Change password
          </Button>
        </TabsContent>
      </Tabs>

      <div className="flex items-center justify-end gap-3">
        {dirty && (
          <span className="text-sm font-semibold text-muted">You have unsaved changes.</span>
        )}
        <Button type="submit" disabled={!dirty || !nameValid} loading={save.isPending}>
          Save changes
        </Button>
      </div>

      <PasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </form>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const prefs = useTeacherPrefs(user?.id);

  return (
    <main data-world="coral" className="mx-auto w-full max-w-3xl space-y-6 text-stroke">
      <header>
        <h1 className="font-heading text-3xl font-bold sm:text-4xl">Settings</h1>
        <p className="font-medium text-muted">Your profile, notifications and grading defaults.</p>
      </header>

      {!user || prefs.isPending ? (
        <div role="status" aria-label="Loading" className="space-y-3">
          <Skeleton label={null} className="h-10 w-full" />
          <Skeleton label={null} className="h-48 w-full" />
        </div>
      ) : prefs.isError ? (
        <ErrorState
          title="Your settings could not be loaded"
          description="Check your connection and try again."
          onRetry={() => void prefs.refetch()}
        />
      ) : (
        <SettingsForm userId={user.id} initialName={user.fullName} saved={prefs.data} />
      )}
    </main>
  );
}
