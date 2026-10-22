import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Check, CircleAlert, CircleCheck, X } from "lucide-react";
import { getRoleHomePath } from "@/app/guards/guard-utils";
import { useAuth } from "@/app/providers/auth-context";
import { Button } from "@/shared/components/ui/Button";
import { SCHOOL_LOGO_SRC } from "@/shared/config/branding";
import { cn } from "@/shared/lib/utils/cn";
import { PasswordField } from "../LoginPage/PasswordField";
import {
  PASSWORD_MESSAGES,
  PASSWORD_RULES,
  checkRules,
  measureStrength,
  saveNewPassword,
  validateAll,
  validateField,
  type NewPasswordErrors,
  type NewPasswordField,
  type NewPasswordValues,
  type StrengthLevel,
} from "./set-password-logic";

/* ========================================
   SetNewPasswordPage: SH-04 "/set-new-password" (SHARED-SPEC §5, PUB-06)

   An AuthCard centered on a plain background, with no header navigation. The only exit is
   "Sign out".

   Behavior (SH-04):
     - Reachable only for a signed-in account that must change its password. A visitor who is
       not signed in goes to /login. An account that does not need the change goes to its
       dashboard.
     - Two fields: New password and Confirm new password, both with show/hide.
     - A live checklist of the rules (8 characters, a number, a symbol, not the username) and a
       strength meter (Weak, Good, Strong) that both update on every keystroke. The bar moves
       with a transform, and the motion stops under reduced motion.
     - Submit is blocked until every rule passes and the two passwords match. Messages show on
       blur and on submit, and focus goes to the first field with a problem.
     - Success: a brief confirmation, then the person's dashboard. The session is refreshed so
       the app reads the profile again and drops the old "must change password" flag. If that
       does not happen within a few seconds, the dashboard is loaded afresh.
     - Failure: "We could not save your password. Try again." and the form stays as it is.

   Left out on purpose:
     - The recovery-link flow. Accounts use internal addresses that cannot receive email, so a
       recovery link cannot reach anyone. Resets go through the school (SH-03).
   Class strings live in constants so the Tailwind class sorter treats them as plain data.
   ======================================== */

const PAGE_TITLE = "Set a new password | Al Hikmah English Platform";
const MAIN_ID = "main-content";
const LOGIN_PATH = "/login";
const REDIRECT_DELAY_MS = 1500;
const FALLBACK_DELAY_MS = 5000;

const INITIAL_VALUES: NewPasswordValues = { password: "", confirm: "" };

const PAGE_CLASS = "flex min-h-screen items-start justify-center bg-surface-100 px-4 py-8 sm:py-12";
const CARD_CLASS =
  "flex w-full max-w-md flex-col gap-6 rounded-[24px] border-2 border-stroke bg-surface-0 p-6 shadow-retro-md sm:p-8";
const BRAND_CLASS = "flex items-center gap-3";
const LOGO_CLASS = "inline-flex shrink-0 rounded-[8px] bg-surface-0 p-2";
const WORDMARK_CLASS = "font-heading text-[18px] font-semibold leading-tight text-stroke";
const HEADING_CLASS = "font-heading text-3xl font-bold leading-tight text-stroke";
const INTRO_CLASS = "font-body text-base font-medium text-muted";
const FORM_CLASS = "flex flex-col gap-5";
const FIELDS_CLASS = "flex flex-col gap-4";
const ALERT_BASE_CLASS =
  "flex items-start gap-3 rounded-[12px] border-2 border-stroke p-3 font-body text-[15px] font-semibold text-stroke";
const ALERT_ICON_CLASS = "mt-0.5 h-5 w-5 shrink-0 [stroke-width:2.5]";
const METER_WRAP_CLASS = "flex flex-col gap-2";
const METER_ROW_CLASS = "flex items-center justify-between gap-3";
const METER_LABEL_CLASS = "font-body text-sm font-bold text-stroke";
const METER_TRACK_CLASS =
  "h-3 w-full overflow-hidden rounded-full border-2 border-stroke bg-surface-100";
const METER_BAR_BASE_CLASS =
  "h-full w-full origin-left transition-transform duration-300 ease-out motion-reduce:transition-none [[data-effects-tier=low]_&]:transition-none";
const RULES_CLASS = "flex flex-col gap-2 rounded-[16px] border-2 border-stroke bg-surface-100 p-4";
const RULES_HEADING_CLASS = "font-body text-sm font-bold text-stroke";
const RULE_CLASS = "flex items-center gap-2 font-body text-[15px] font-medium text-stroke";
const RULE_ICON_CLASS = "h-4 w-4 shrink-0 [stroke-width:3]";
const SIGN_OUT_CLASS =
  "self-start rounded-[6px] font-body text-[15px] font-semibold text-stroke underline underline-offset-4 hover:decoration-2";
const SR_ONLY_CLASS = "sr-only";

const BAR_COLOR_CLASS: Record<StrengthLevel, string> = {
  none: "bg-transparent",
  weak: "bg-danger-600",
  good: "bg-warning-600",
  strong: "bg-success-600",
};

type AlertTone = "error" | "success";

const ALERT_TONE_CLASS: Record<AlertTone, string> = {
  error: "bg-danger-100",
  success: "bg-success-100",
};

function InlineAlert({ tone, children }: { tone: AlertTone; children: ReactNode }) {
  const Icon = tone === "error" ? CircleAlert : CircleCheck;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(ALERT_BASE_CLASS, ALERT_TONE_CLASS[tone])}
    >
      <Icon aria-hidden="true" focusable="false" className={ALERT_ICON_CLASS} />
      <p>{children}</p>
    </div>
  );
}

function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

function withFieldError(
  errors: NewPasswordErrors,
  field: NewPasswordField,
  message: string | undefined,
): NewPasswordErrors {
  const next: NewPasswordErrors = { ...errors };
  if (message === undefined) delete next[field];
  else next[field] = message;
  return next;
}

/** Loads a page with a full navigation, so the session profile is read again. */
function loadPage(path: string): void {
  window.location.replace(path);
}

export default function SetNewPasswordPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, user, signOut } = useAuth();

  const [values, setValues] = useState<NewPasswordValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<NewPasswordErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  const submittingRef = useRef(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const idBase = useId();
  const passwordId = `${idBase}-password`;
  const confirmId = `${idBase}-confirm`;
  const headingId = `${idBase}-heading`;
  const rulesId = `${idBase}-rules`;

  useDocumentTitle(PAGE_TITLE);

  const username = user?.username ?? "";
  const homePath = user === null ? LOGIN_PATH : getRoleHomePath(user.role);
  const ruleResults = checkRules(values.password, username);
  const strength = measureStrength(values.password, username);

  // After saving, show the confirmation for a moment and then open the dashboard. The app-wide
  // profile is read again after the session refresh. Once it no longer holds the flag, the page
  // moves on inside the app. If it still does after a few seconds, the dashboard is loaded
  // afresh so the person is never left here.
  const flagCleared = user !== null && !user.mustChangePassword;
  useEffect(() => {
    if (!saved || !flagCleared) return undefined;
    const timer = window.setTimeout(() => {
      void navigate(homePath, { replace: true });
    }, REDIRECT_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [saved, flagCleared, homePath, navigate]);

  useEffect(() => {
    if (!saved) return undefined;
    const timer = window.setTimeout(() => {
      loadPage(homePath);
    }, FALLBACK_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [saved, homePath]);

  const checkField = (field: NewPasswordField, next: NewPasswordValues) => {
    setErrors((current) => withFieldError(current, field, validateField(field, next, username)));
  };

  const changeField = (field: NewPasswordField, value: string) => {
    const next: NewPasswordValues = { ...values, [field]: value };
    setValues(next);
    // Once a message is showing, keep it in step with what is typed. Typing a new password can
    // also settle or break the match with the confirmation.
    if (errors[field] !== undefined) checkField(field, next);
    if (field === "password" && errors.confirm !== undefined) checkField("confirm", next);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      void navigate(LOGIN_PATH, { replace: true });
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current || user === null) return;

    const found = validateAll(values, username);
    if (found.password !== undefined || found.confirm !== undefined) {
      setErrors(found);
      setFailure(null);
      if (found.password !== undefined) passwordRef.current?.focus();
      else confirmRef.current?.focus();
      return;
    }

    setErrors({});
    setFailure(null);
    submittingRef.current = true;
    setSubmitting(true);

    const outcome = await saveNewPassword(values.password);
    switch (outcome.kind) {
      case "saved":
        setSaved(true);
        return;
      case "session-expired":
        void navigate(`${LOGIN_PATH}?reason=expired`, { replace: true });
        return;
      case "rejected":
        setFailure(outcome.message);
        break;
      case "network":
        setFailure(PASSWORD_MESSAGES.network);
        break;
      default:
        setFailure(PASSWORD_MESSAGES.failed);
    }
    submittingRef.current = false;
    setSubmitting(false);
  };

  if (isLoading) {
    return (
      <main id={MAIN_ID} className={PAGE_CLASS}>
        <p role="status" className={INTRO_CLASS}>
          Loading your account…
        </p>
      </main>
    );
  }

  // Only a signed-in account that must change its password belongs here (SH-04, "Access").
  if (!isAuthenticated || user === null) {
    return <Navigate to={LOGIN_PATH} replace />;
  }
  // While saving, the session refresh can drop the flag before the confirmation shows, so a save
  // in progress also keeps the person here.
  if (!user.mustChangePassword && !saved && !submitting) {
    return <Navigate to={getRoleHomePath(user.role)} replace />;
  }

  return (
    <main id={MAIN_ID} className={PAGE_CLASS}>
      <section aria-labelledby={headingId} className={CARD_CLASS}>
        <div className={BRAND_CLASS}>
          {SCHOOL_LOGO_SRC !== null && (
            <span className={LOGO_CLASS}>
              <img src={SCHOOL_LOGO_SRC} alt="" width={147} height={32} className="h-8 w-auto" />
            </span>
          )}
          <span className={WORDMARK_CLASS}>English Platform</span>
        </div>

        <div className="flex flex-col gap-2">
          <h1 id={headingId} className={HEADING_CLASS}>
            Set a new password
          </h1>
          <p className={INTRO_CLASS}>
            Your school gave you a temporary password. Choose your own to continue.
          </p>
        </div>

        {saved ? (
          <InlineAlert tone="success">Password saved. Taking you to your dashboard.</InlineAlert>
        ) : (
          <form
            noValidate
            aria-labelledby={headingId}
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
            className={FORM_CLASS}
          >
            {failure !== null && <InlineAlert tone="error">{failure}</InlineAlert>}

            <div className={FIELDS_CLASS}>
              <PasswordField
                ref={passwordRef}
                id={passwordId}
                label="New password"
                name="new_password"
                autoComplete="new-password"
                value={values.password}
                error={errors.password}
                disabled={submitting}
                onValueChange={(value) => {
                  changeField("password", value);
                }}
                onBlur={() => {
                  checkField("password", values);
                }}
              />

              <div className={METER_WRAP_CLASS}>
                <div className={METER_ROW_CLASS}>
                  <span className={METER_LABEL_CLASS}>Password strength</span>
                  <span
                    data-testid="strength-label"
                    role="status"
                    aria-live="polite"
                    className={METER_LABEL_CLASS}
                  >
                    {strength.label === "" ? (
                      <span className={SR_ONLY_CLASS}>Not set yet</span>
                    ) : (
                      strength.label
                    )}
                  </span>
                </div>
                <div aria-hidden="true" className={METER_TRACK_CLASS}>
                  <div
                    data-testid="strength-bar"
                    data-level={strength.level}
                    className={cn(METER_BAR_BASE_CLASS, BAR_COLOR_CLASS[strength.level])}
                    style={{ transform: `scaleX(${strength.fill.toFixed(3)})` }}
                  />
                </div>
              </div>

              <PasswordField
                ref={confirmRef}
                id={confirmId}
                label="Confirm new password"
                name="confirm_password"
                autoComplete="new-password"
                value={values.confirm}
                error={errors.confirm}
                disabled={submitting}
                onValueChange={(value) => {
                  changeField("confirm", value);
                }}
                onBlur={() => {
                  checkField("confirm", values);
                }}
              />
            </div>

            <div aria-labelledby={rulesId} role="group" className={RULES_CLASS}>
              <p id={rulesId} className={RULES_HEADING_CLASS}>
                Your password needs
              </p>
              <ul className="flex flex-col gap-2">
                {PASSWORD_RULES.map((rule) => {
                  const met = ruleResults[rule.id];
                  const Icon = met ? Check : X;
                  return (
                    <li key={rule.id} data-met={met} className={RULE_CLASS}>
                      <Icon aria-hidden="true" focusable="false" className={RULE_ICON_CLASS} />
                      <span>
                        {rule.label}
                        <span className={SR_ONLY_CLASS}>{met ? ". Done." : ". Not done yet."}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <Button type="submit" size="lg" loading={submitting} className="w-full">
              Set password and continue
            </Button>
            {submitting && (
              <span role="status" className={SR_ONLY_CLASS}>
                Saving your password
              </span>
            )}
          </form>
        )}

        <button
          type="button"
          className={SIGN_OUT_CLASS}
          onClick={() => {
            void handleSignOut();
          }}
        >
          Sign out
        </button>
      </section>
    </main>
  );
}

export { SetNewPasswordPage };
