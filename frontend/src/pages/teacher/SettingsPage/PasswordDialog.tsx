import { useState } from "react";
import type { FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { Button } from "@/shared/components/ui/Button";
import { Dialog } from "@/shared/components/ui/Dialog";
import { Input } from "@/shared/components/ui/Input";
import { useToast } from "@/shared/hooks/useToast";

/* Password change (API-CONTRACT: Edge `auth_change_password {current_password, new_password}`).
   The server verifies the current password and enforces the password rules; any rules it
   reports as failed are listed under the form. Nothing is logged or kept after closing. */

const errorBody = z.object({
  details: z
    .object({ rules_failed: z.array(z.string()) })
    .partial()
    .optional(),
  message: z.string().optional(),
});

async function changePassword(current: string, next: string): Promise<string[] | null> {
  const result: { error: unknown } = await supabase.functions.invoke("auth_change_password", {
    body: { current_password: current, new_password: next },
  });
  const error = result.error;
  if (!error) return null;

  const response = (error as { context?: unknown }).context;
  const body =
    response instanceof Response
      ? errorBody.safeParse(await response.json().catch(() => null))
      : null;
  if (body?.success) {
    const rules = body.data.details?.rules_failed;
    if (rules && rules.length > 0) return rules;
    if (body.data.message) return [body.data.message];
  }
  return ["The password could not be changed. Check your current password and try again."];
}

export function PasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setProblems([]);
  };

  const close = (value: boolean) => {
    if (!value) reset();
    onOpenChange(value);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!current || !next) return setProblems(["Enter your current and new password."]);
    if (next !== confirm) return setProblems(["The new passwords do not match."]);
    if (next === current) return setProblems(["Choose a password different from the current one."]);

    setBusy(true);
    try {
      const failed = await changePassword(current, next);
      if (failed) return setProblems(failed);
      toast.show({ type: "success", title: "Password changed" });
      close(false);
    } catch (error) {
      setProblems([error instanceof Error ? error.message : "The password could not be changed."]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      size="sm"
      title="Change password"
      description="You will stay signed in on this device."
    >
      <form onSubmit={(event) => void submit(event)} className="space-y-4" noValidate>
        <Input
          type="password"
          label="Current password"
          autoComplete="current-password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
        />
        <Input
          type="password"
          label="New password"
          autoComplete="new-password"
          value={next}
          onChange={(event) => setNext(event.target.value)}
        />
        <Input
          type="password"
          label="Confirm new password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
        {problems.length > 0 && (
          <ul role="alert" className="list-inside list-disc text-sm font-semibold text-danger-600">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Change password
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
