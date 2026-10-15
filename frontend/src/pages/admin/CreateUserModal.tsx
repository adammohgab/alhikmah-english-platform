import { useEffect, useId, useState } from "react";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Printer,
  RefreshCw,
  UserCheck,
  UserPlus,
  XCircle,
} from "lucide-react";
import { supabase } from "@/shared/api/supabase";
import { Dialog } from "@/shared/components/ui/Dialog";
import { Input } from "@/shared/components/ui/Input";
import { Select } from "@/shared/components/ui/Select";
import { Switch } from "@/shared/components/ui/Switch";
import { Button } from "@/shared/components/ui/Button";
import { useToast } from "@/shared/hooks/useToast";

export interface CreateUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (user: { id: string; username: string; role: string }) => void;
}

export type UserRole = "student" | "teacher" | "admin";

const UNAMBIGUOUS_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
function generateRandomPassword(length = 10): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += UNAMBIGUOUS_CHARS.charAt(Math.floor(Math.random() * UNAMBIGUOUS_CHARS.length));
  }
  return result;
}

const ROLE_OPTIONS = [
  { value: "student", label: "Student" },
  { value: "teacher", label: "Teacher" },
  { value: "admin", label: "Administrator" },
];

const GRADE_OPTIONS = [
  { value: "7", label: "Grade 7" },
  { value: "8", label: "Grade 8" },
  { value: "9", label: "Grade 9" },
  { value: "10", label: "Grade 10" },
  { value: "11", label: "Grade 11" },
  { value: "12", label: "Grade 12" },
];

export function CreateUserModal({ open, onOpenChange, onSuccess }: CreateUserModalProps) {
  const toast = useToast();
  const formId = useId();

  // Form states
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [gradeLevel, setGradeLevel] = useState("7");
  const [initialPassword, setInitialPassword] = useState(() => generateRandomPassword(10));
  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Validation & status states
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Created credentials panel
  const [createdCredentials, setCreatedCredentials] = useState<{
    fullName: string;
    username: string;
    password: string;
    role: string;
    gradeLevel?: string | undefined;
  } | null>(null);

  const [copied, setCopied] = useState(false);

  // Auto-generate username from fullName if user hasn't explicitly customized it
  const [usernameManuallyEdited, setUsernameManuallyEdited] = useState(false);

  useEffect(() => {
    if (!usernameManuallyEdited && fullName.trim()) {
      const parts = fullName.trim().toLowerCase().split(/\s+/);
      const generated =
        parts.length > 1 ? `${parts[0]}.${parts[parts.length - 1]}` : (parts[0] ?? "");
      const cleaned = generated.replace(/[^a-z0-9._-]/g, "").slice(0, 24);
      setUsername(cleaned);
    }
  }, [fullName, usernameManuallyEdited]);

  // Username validation & uniqueness check debounce
  useEffect(() => {
    const trimmed = username.trim().toLowerCase();
    if (!trimmed) {
      setUsernameAvailable(null);
      setUsernameError(null);
      return;
    }

    if (trimmed.length < 3) {
      setUsernameAvailable(false);
      setUsernameError("Username must be at least 3 characters");
      return;
    }

    if (!/^[a-z0-9._-]{3,32}$/.test(trimmed)) {
      setUsernameAvailable(false);
      setUsernameError("Letters, numbers, dots, dashes, and underscores only");
      return;
    }

    const timer = setTimeout(() => {
      void (async () => {
        setIsCheckingUsername(true);
        setUsernameError(null);
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("id")
            .eq("username", trimmed)
            .maybeSingle();

          if (error) {
            // If network / RLS issue, assume valid format but warn
            setUsernameAvailable(null);
          } else if (data) {
            setUsernameAvailable(false);
            setUsernameError("This username is already taken");
          } else {
            setUsernameAvailable(true);
            setUsernameError(null);
          }
        } catch {
          setUsernameAvailable(null);
        } finally {
          setIsCheckingUsername(false);
        }
      })();
    }, 350);

    return () => clearTimeout(timer);
  }, [username]);

  const handleReset = () => {
    setFullName("");
    setUsername("");
    setEmail("");
    setRole("student");
    setGradeLevel("7");
    setInitialPassword(generateRandomPassword(10));
    setMustChangePassword(true);
    setShowPassword(false);
    setUsernameManuallyEdited(false);
    setUsernameAvailable(null);
    setUsernameError(null);
    setSubmitError(null);
    setCreatedCredentials(null);
    setCopied(false);
  };

  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const trimmedFullName = fullName.trim();
    const trimmedUsername = username.trim().toLowerCase();
    const trimmedEmail = email.trim();

    if (!trimmedFullName) {
      setSubmitError("Full name is required.");
      return;
    }
    if (!trimmedUsername) {
      setSubmitError("Username is required.");
      return;
    }
    if (usernameAvailable === false) {
      setSubmitError(usernameError ?? "Please choose a different username.");
      return;
    }
    if (role === "teacher" && !trimmedEmail) {
      setSubmitError("Email is required for teacher accounts.");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Authenticate / register user via Supabase Auth
      // If no real email provided (optional for young students), construct standard synthetic account address
      const authEmail = trimmedEmail || `${trimmedUsername}@accounts.invalid`;

      // Supabase standard client sign-up (or Edge Function if admin API available)
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: authEmail,
        password: initialPassword,
        options: {
          data: {
            display_name: trimmedFullName,
            username: trimmedUsername,
            role,
            grade_level: role === "student" ? gradeLevel : undefined,
          },
        },
      });

      if (authErr) {
        throw new Error(authErr.message);
      }

      const userId = authData.user?.id;
      if (!userId) {
        throw new Error("Failed to create authentication user record.");
      }

      // 2. Ensure profile row exists / update status and must_change_password
      const { error: profileErr } = await supabase.from("profiles").upsert(
        {
          id: userId,
          username: trimmedUsername,
          full_name: trimmedFullName,
          role,
          status: "active",
          must_change_password: mustChangePassword,
        },
        { onConflict: "id" },
      );

      if (profileErr) {
        // Fallback: log warning if profiles table has strict constraint or trigger already auto-created it
        console.warn("Profile upsert notice:", profileErr.message);
      }

      // Success state: show credentials card
      setCreatedCredentials({
        fullName: trimmedFullName,
        username: trimmedUsername,
        password: initialPassword,
        role,
        gradeLevel: role === "student" ? gradeLevel : undefined,
      });

      toast.show({
        title: "User created",
        description: `Account for ${trimmedFullName} (@${trimmedUsername}) created successfully.`,
        type: "success",
      });

      onSuccess?.({
        id: userId,
        username: trimmedUsername,
        role,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setSubmitError(message);
      toast.show({
        title: "Creation failed",
        description: message,
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCredentials = async () => {
    if (!createdCredentials) return;
    const text = [
      `Al Hikmah English Platform - Account Credentials`,
      `Name: ${createdCredentials.fullName}`,
      `Username: ${createdCredentials.username}`,
      `Temporary Password: ${createdCredentials.password}`,
      `Role: ${createdCredentials.role}`,
      createdCredentials.gradeLevel ? `Grade: ${createdCredentials.gradeLevel}` : "",
      `URL: ${window.location.origin}/login`,
      `Note: You must change your password on first login.`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.show({
        title: "Copied to clipboard",
        description: "Student credentials copied and ready to share.",
        type: "success",
      });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.show({
        title: "Copy failed",
        description: "Please select and copy the text manually.",
        type: "warning",
      });
    }
  };

  const handlePrintCredentials = () => {
    if (!createdCredentials) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Student Credential Card - ${createdCredentials.username}</title>
          <style>
            body { font-family: 'Figtree', sans-serif; padding: 40px; color: #1e1b18; }
            .card {
              border: 2px solid #1e1b18;
              border-radius: 16px;
              padding: 24px;
              max-width: 450px;
              box-shadow: 4px 4px 0px #1e1b18;
            }
            h2 { margin: 0 0 16px 0; font-family: 'Fredoka', cursive; font-size: 20px; }
            .row { margin: 8px 0; font-size: 15px; }
            .label { font-weight: bold; width: 140px; display: inline-block; }
            .value { font-family: monospace; background: #f4efe6; padding: 2px 6px; border-radius: 4px; }
            .footer { margin-top: 20px; font-size: 12px; color: #71695f; border-top: 1px dashed #1e1b18; padding-top: 12px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Al Hikmah English Platform</h2>
            <div class="row"><span class="label">Full Name:</span> <span>${createdCredentials.fullName}</span></div>
            <div class="row"><span class="label">Username:</span> <span class="value">${createdCredentials.username}</span></div>
            <div class="row"><span class="label">Temporary Password:</span> <span class="value">${createdCredentials.password}</span></div>
            <div class="row"><span class="label">Role:</span> <span>${createdCredentials.role}</span></div>
            ${createdCredentials.gradeLevel ? `<div class="row"><span class="label">Grade:</span> <span>Grade ${createdCredentials.gradeLevel}</span></div>` : ""}
            <div class="footer">
              Store these credentials safely. You will be required to change your password upon your first sign in.
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={createdCredentials ? "Account Created Successfully" : "Create User Account"}
      description={
        createdCredentials
          ? "Credentials have been generated. Hand these out to the student or staff member."
          : "Add an individual student, teacher, or administrator account manually."
      }
      size="md"
    >
      {createdCredentials ? (
        <div className="space-y-6 py-2">
          {/* Success Credential Card */}
          <div className="rounded-2xl border-2 border-stroke bg-amber-50/50 p-5 shadow-retro-sm">
            <div className="mb-4 flex items-center gap-2">
              <div className="shadow-retro-xs flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-surface-0">
                <Check className="h-5 w-5" />
              </div>
              <h3 className="font-display text-ink text-lg font-bold">Login Credentials Card</h3>
            </div>

            <div className="space-y-3 font-body text-sm">
              <div className="flex items-center justify-between border-b border-stroke/20 py-1.5">
                <span className="font-medium text-muted">Full Name</span>
                <span className="text-ink font-semibold">{createdCredentials.fullName}</span>
              </div>
              <div className="flex items-center justify-between border-b border-stroke/20 py-1.5">
                <span className="font-medium text-muted">Username</span>
                <code className="text-ink rounded-md border border-stroke bg-surface-0 px-2.5 py-1 font-mono font-bold">
                  {createdCredentials.username}
                </code>
              </div>
              <div className="flex items-center justify-between border-b border-stroke/20 py-1.5">
                <span className="font-medium text-muted">Initial Password</span>
                <code className="text-ink rounded-md border border-stroke bg-surface-0 px-2.5 py-1 font-mono font-bold">
                  {createdCredentials.password}
                </code>
              </div>
              <div className="flex items-center justify-between border-b border-stroke/20 py-1.5">
                <span className="font-medium text-muted">Account Role</span>
                <span className="text-ink font-semibold capitalize">{createdCredentials.role}</span>
              </div>
              {createdCredentials.gradeLevel && (
                <div className="flex items-center justify-between py-1.5">
                  <span className="font-medium text-muted">Grade Level</span>
                  <span className="text-ink font-semibold">
                    Grade {createdCredentials.gradeLevel}
                  </span>
                </div>
              )}
            </div>

            <p className="mt-4 text-xs text-muted/80">
              * Temporary password must be changed by the user upon first sign-in.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Button
              type="button"
              variant="primary"
              className="w-full flex-1"
              onClick={() => {
                void handleCopyCredentials();
              }}
            >
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4 text-emerald-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Credentials
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={handlePrintCredentials}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full sm:w-auto"
              onClick={handleReset}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Add Another
            </Button>
          </div>
        </div>
      ) : (
        <form
          id={formId}
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="space-y-4 py-2"
        >
          {submitError && (
            <div className="border-danger-500 text-danger-700 flex items-center gap-2 rounded-xl border-2 bg-red-50 p-3 text-sm font-medium">
              <XCircle className="h-4 w-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Role selector */}
          <div>
            <label
              htmlFor={`${formId}-role`}
              className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted"
            >
              Account Role
            </label>
            <Select
              id={`${formId}-role`}
              aria-label="Account Role"
              value={role}
              onValueChange={(val) => setRole(val as UserRole)}
              options={ROLE_OPTIONS}
            />
          </div>

          {/* Full Name */}
          <div>
            <Input
              label="Full Name"
              placeholder="e.g. Fatima Ali Al-Mansouri"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          {/* Username with real-time validation */}
          <div>
            <Input
              label="Username"
              placeholder="e.g. fatima.mansouri"
              value={username}
              onChange={(e) => {
                setUsernameManuallyEdited(true);
                setUsername(e.target.value);
              }}
              error={usernameError ?? undefined}
              helperText={
                isCheckingUsername
                  ? "Checking username availability..."
                  : usernameAvailable === true
                    ? "✓ Username is available"
                    : "Used for system login (lowercase letters, numbers, dots, dashes)"
              }
              rightIcon={
                isCheckingUsername ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted" />
                ) : usernameAvailable === true ? (
                  <UserCheck className="h-4 w-4 text-emerald-600" />
                ) : usernameAvailable === false ? (
                  <XCircle className="text-danger-500 h-4 w-4" />
                ) : null
              }
              required
            />
          </div>

          {/* Email (Optional for students, Required for teachers) */}
          <div>
            <Input
              label={role === "student" ? "Email Address (Optional)" : "Email Address (Required)"}
              type="email"
              placeholder={
                role === "student"
                  ? "Leave blank if student has no email"
                  : "teacher@alhikmah.edu.ly"
              }
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required={role === "teacher"}
              helperText={
                role === "student"
                  ? "If empty, an institutional login alias will be assigned."
                  : undefined
              }
            />
          </div>

          {/* Grade level for students */}
          {role === "student" && (
            <div>
              <label
                htmlFor={`${formId}-grade`}
                className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted"
              >
                Grade Level
              </label>
              <Select
                id={`${formId}-grade`}
                aria-label="Grade Level"
                value={gradeLevel}
                onValueChange={setGradeLevel}
                options={GRADE_OPTIONS}
              />
            </div>
          )}

          {/* Temporary Password */}
          <div>
            <label
              htmlFor={`${formId}-password`}
              className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted"
            >
              Initial Temporary Password
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id={`${formId}-password`}
                  type={showPassword ? "text" : "password"}
                  value={initialPassword}
                  onChange={(e) => setInitialPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="hover:text-ink absolute right-3 top-3 text-muted transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setInitialPassword(generateRandomPassword(10))}
                title="Regenerate password"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Force password change toggle */}
          <div className="pt-2">
            <Switch
              label="Force password change on first login"
              checked={mustChangePassword}
              onCheckedChange={setMustChangePassword}
            />
          </div>

          {/* Form action footer */}
          <div className="flex justify-end gap-3 border-t border-stroke/20 pt-4">
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              disabled={isSubmitting || usernameAvailable === false}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Create Account
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
