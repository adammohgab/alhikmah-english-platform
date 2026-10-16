import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { CircleAlert, Info, TriangleAlert } from "lucide-react";
import logo from "@/shared/assets/logo.png";
import { getRoleHomePath } from "@/app/guards/guard-utils";
import { useAuth } from "@/app/providers/auth-context";
import { Button } from "@/shared/components/ui/Button";
import { Checkbox } from "@/shared/components/ui/Checkbox";
import { Input } from "@/shared/components/ui/Input";
import { Sticker } from "@/shared/components/ui/Sticker";
import { usePlatformSettings } from "@/shared/hooks/usePlatformSettings";
import { cn } from "@/shared/lib/utils/cn";
import {
  ACCOUNT_NOT_ACTIVE_PATH,
  LOGIN_MESSAGES,
  SET_NEW_PASSWORD_PATH,
  signInWithUsername,
  validateLogin,
  type LoginErrors,
  type LoginField,
  type LoginValues,
  type SignInOutcome,
} from "./login-logic";
import { PasswordField } from "./PasswordField";

/* ========================================
   LoginPage: SH-02 "/login" (SHARED-SPEC §5, PUB-04)

   Split screen on desktop: an art panel on the left (about 55 percent) and the sign-in card on
   the right. On mobile the art is a short band above the card.

   Behavior (SH-02):
     - Required fields, with messages on blur and on submit. The username is trimmed and
       lowercased; the password needs 6 characters. Validation is Zod, in `login-logic.ts`.
     - The form is a real <form>, so Enter in either field submits. While a sign-in runs the
       fields are disabled and the button shows its spinner (and a hidden "Signing in" status).
     - Failures show in one alert above the fields. The wrong username and the wrong password
       give the same message, and the password field is cleared and focused for another try.
     - After a successful sign-in: locked or inactive accounts go to /account-not-active, a
       temporary password goes to /set-new-password, and everyone else goes to the page in the
       "redirect" or "next" value when it is inside their role area, else to /student,
       /teacher or /admin.
     - Already signed in: the page redirects at once to the person's dashboard.
     - Arrival alerts: `?reason=expired` and `?reason=signed-out` show the SH-02 info messages.
     - A maintenance warning shows while Platform settings have maintenance on. The button stays
       enabled, because the server decides by role (admins can still sign in).

   Left out on purpose:
     - "Demo accounts" (SH-02 item 8): it lists mock usernames and passwords, and the repo rule
       is no mock data or credentials in source.
     - React Hook Form: it is not a dependency of the project and adding one needs approval.
       The form uses plain React state with the same behavior.

   The page does not update the app-wide AuthContext: the session lives in the Supabase client,
   and the provider that mirrors it into AuthContext is not part of this task.
   Class strings live in constants so the Tailwind class sorter treats them as plain data.
   ======================================== */

const PAGE_TITLE = "Sign in | Al Hikmah English Platform";
const MAIN_ID = "main-content";
const HOME_PATH = "/";
const FORGOT_PASSWORD_PATH = "/forgot-password";
const HELP_PATH = "/help";

const INITIAL_VALUES: LoginValues = { username: "", password: "", remember: false };

const REASON_MESSAGES: Record<string, string> = {
  expired: "You were signed out for security. Sign in again to continue.",
  "signed-out": "You have signed out.",
};

const FAILURE_MESSAGES: Record<
  Exclude<SignInOutcome["kind"], "success" | "must-change-password" | "not-active">,
  string
> = {
  "invalid-credentials": LOGIN_MESSAGES.invalidCredentials,
  "rate-limited": LOGIN_MESSAGES.rateLimited,
  network: LOGIN_MESSAGES.network,
  "profile-error": LOGIN_MESSAGES.profile,
};

const PAGE_CLASS = "grid min-h-screen grid-cols-1 bg-surface-100 lg:grid-cols-[55fr_45fr]";
const ART_CLASS =
  "relative flex h-32 items-center overflow-hidden border-b-2 border-stroke bg-[var(--world-main,#4db8ff)] px-6 sm:h-40 lg:h-auto lg:min-h-screen lg:justify-center lg:border-b-0 lg:border-r-2 lg:px-12";
const ART_DISC_CLASS =
  "absolute -right-10 -top-10 h-40 w-40 rounded-full border-2 border-stroke bg-[var(--world-soft,#bce4ff)] shadow-retro-md lg:-right-24 lg:top-16 lg:h-96 lg:w-96";
const ART_PAGE_CLASS =
  "absolute -bottom-6 left-6 hidden h-48 w-40 -rotate-6 rounded-[12px] border-2 border-stroke bg-surface-0 shadow-retro-md lg:block";
const ART_STICKER_CLASS = "absolute bottom-10 right-16 hidden lg:block";
const ART_STICKER_FACE_CLASS =
  "flex h-16 w-28 items-center justify-center bg-[var(--world-soft,#bce4ff)] font-accent text-3xl font-bold text-stroke";
const ART_TEXT_CLASS = "relative flex flex-col gap-2";
const ART_WORDMARK_CLASS = "font-body text-base font-bold text-stroke";
const ART_HEADING_CLASS =
  "font-heading text-4xl font-bold leading-tight text-stroke sm:text-5xl lg:text-7xl";
const CARD_COLUMN_CLASS =
  "flex items-start justify-center px-4 py-8 sm:px-6 lg:items-center lg:py-12";
const CARD_CLASS =
  "flex w-full max-w-md flex-col gap-6 rounded-[24px] border-2 border-stroke bg-surface-0 p-6 shadow-retro-md sm:p-8";
const BRAND_CLASS = "flex items-center gap-3";
const LOGO_LINK_CLASS = "inline-flex shrink-0 rounded-[8px] bg-surface-0 p-2";
const WORDMARK_CLASS = "font-heading text-[18px] font-semibold leading-tight text-stroke";
const HEADING_CLASS = "font-heading text-3xl font-bold leading-tight text-stroke";
const INTRO_CLASS = "font-body text-base font-medium text-muted";
const FORM_CLASS = "flex flex-col gap-5";
const FIELDS_CLASS = "flex flex-col gap-4";
const ALERTS_CLASS = "flex flex-col gap-3";
const ALERT_BASE_CLASS =
  "flex items-start gap-3 rounded-[12px] border-2 border-stroke p-3 font-body text-[15px] font-semibold text-stroke";
const ALERT_ICON_CLASS = "mt-0.5 h-5 w-5 shrink-0 [stroke-width:2.5]";
const LINKS_CLASS = "flex flex-wrap items-center justify-between gap-x-4 gap-y-2";
const LINK_CLASS =
  "rounded-[6px] font-body text-[15px] font-semibold text-stroke underline underline-offset-4 hover:decoration-2";
const QUIET_CLASS = "font-body text-[15px] font-medium text-muted";
const SR_ONLY_CLASS = "sr-only";

type AlertTone = "error" | "warning" | "info";

const ALERT_TONE_CLASS: Record<AlertTone, string> = {
  error: "bg-danger-100",
  warning: "bg-warning-100",
  info: "bg-info-100",
};

/** The form-level alert area (SH-02 item 3): errors and warnings interrupt, info waits. */
function InlineAlert({ tone, children }: { tone: AlertTone; children: ReactNode }) {
  const Icon = tone === "error" ? CircleAlert : tone === "warning" ? TriangleAlert : Info;
  return (
    <div
      role={tone === "info" ? "status" : "alert"}
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
  errors: LoginErrors,
  field: LoginField,
  message: string | undefined,
): LoginErrors {
  const next: LoginErrors = { ...errors };
  if (message === undefined) delete next[field];
  else next[field] = message;
  return next;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { settings } = usePlatformSettings();
  const [searchParams] = useSearchParams();

  const [values, setValues] = useState<LoginValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submittingRef = useRef(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const idBase = useId();
  const usernameId = `${idBase}-username`;
  const passwordId = `${idBase}-password`;
  const headingId = `${idBase}-heading`;

  useDocumentTitle(PAGE_TITLE);

  const redirectParam = searchParams.get("redirect") ?? searchParams.get("next");
  const reason = searchParams.get("reason");
  const arrivalMessage = reason === null ? undefined : REASON_MESSAGES[reason];
  const maintenance = settings.maintenance;

  const checkField = (field: LoginField, next: LoginValues) => {
    const result = validateLogin(next);
    setErrors((current) =>
      withFieldError(current, field, result.success ? undefined : result.errors[field]),
    );
  };

  const changeField = (field: LoginField, value: string) => {
    const next: LoginValues = { ...values, [field]: value };
    setValues(next);
    // Once a message is showing, keep it in step with what is typed.
    if (errors[field] !== undefined) checkField(field, next);
  };

  const focusPasswordSoon = () => {
    // The fields are disabled while signing in, so focus returns after they are enabled again.
    window.requestAnimationFrame(() => {
      passwordRef.current?.focus();
    });
  };

  const handleOutcome = (outcome: SignInOutcome) => {
    switch (outcome.kind) {
      case "success":
        void navigate(outcome.destination, { replace: true });
        return;
      case "must-change-password":
        void navigate(SET_NEW_PASSWORD_PATH, { replace: true });
        return;
      case "not-active":
        void navigate(ACCOUNT_NOT_ACTIVE_PATH, { replace: true });
        return;
      default:
        setFailure(FAILURE_MESSAGES[outcome.kind]);
        setValues((current) => ({ ...current, password: "" }));
        setSubmitting(false);
        submittingRef.current = false;
        focusPasswordSoon();
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;

    const result = validateLogin(values);
    if (!result.success) {
      setErrors(result.errors);
      setFailure(null);
      if (result.errors.username !== undefined) usernameRef.current?.focus();
      else passwordRef.current?.focus();
      return;
    }

    setErrors({});
    setFailure(null);
    submittingRef.current = true;
    setSubmitting(true);

    let outcome: SignInOutcome;
    try {
      outcome = await signInWithUsername(result.data, redirectParam);
    } catch {
      setFailure(LOGIN_MESSAGES.unexpected);
      setSubmitting(false);
      submittingRef.current = false;
      focusPasswordSoon();
      return;
    }
    handleOutcome(outcome);
  };

  // Signed-in visitors skip the page (SH-02, "Already signed in").
  if (isAuthenticated && user !== null) {
    return <Navigate to={getRoleHomePath(user.role)} replace />;
  }

  return (
    <main id={MAIN_ID} className={PAGE_CLASS}>
      <div data-world="sky" aria-hidden="true" className={ART_CLASS}>
        <div className={ART_DISC_CLASS} />
        <div className={ART_PAGE_CLASS} />
        <div className={ART_STICKER_CLASS}>
          <Sticker rotate={4} shape="pill">
            <span className={ART_STICKER_FACE_CLASS}>Hello!</span>
          </Sticker>
        </div>
        <div className={ART_TEXT_CLASS}>
          <p className={ART_WORDMARK_CLASS}>Al Hikmah English Platform</p>
          <p className={ART_HEADING_CLASS}>Welcome back.</p>
        </div>
      </div>

      <div className={CARD_COLUMN_CLASS}>
        <section aria-labelledby={headingId} className={CARD_CLASS}>
          <div className={BRAND_CLASS}>
            <Link to={HOME_PATH} aria-label="Go to the home page" className={LOGO_LINK_CLASS}>
              <img src={logo} alt="" width={147} height={32} className="h-8 w-auto" />
            </Link>
            <span className={WORDMARK_CLASS}>English Platform</span>
          </div>

          <div className="flex flex-col gap-2">
            <h1 id={headingId} className={HEADING_CLASS}>
              Sign in
            </h1>
            <p className={INTRO_CLASS}>Use the username and password from your school.</p>
          </div>

          <form
            noValidate
            aria-labelledby={headingId}
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
            className={FORM_CLASS}
          >
            <div className={ALERTS_CLASS}>
              {maintenance.enabled && (
                <InlineAlert tone="warning">
                  The platform is under maintenance. {maintenance.message}
                </InlineAlert>
              )}
              {failure !== null ? (
                <InlineAlert tone="error">{failure}</InlineAlert>
              ) : (
                arrivalMessage !== undefined && (
                  <InlineAlert tone="info">{arrivalMessage}</InlineAlert>
                )
              )}
            </div>

            <div className={FIELDS_CLASS}>
              <Input
                ref={usernameRef}
                id={usernameId}
                name="username"
                label="Username"
                size="lg"
                required
                value={values.username}
                error={errors.username}
                disabled={submitting}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onChange={(event) => {
                  changeField("username", event.target.value);
                }}
                onBlur={() => {
                  checkField("username", values);
                }}
              />
              <PasswordField
                ref={passwordRef}
                id={passwordId}
                label="Password"
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
            </div>

            <Checkbox
              label="Keep me signed in on this device"
              checked={values.remember}
              disabled={submitting}
              onCheckedChange={(checked) => {
                setValues((current) => ({ ...current, remember: checked === true }));
              }}
            />

            <Button type="submit" size="lg" loading={submitting} className="w-full">
              Sign in
            </Button>
            {submitting && (
              <span role="status" className={SR_ONLY_CLASS}>
                Signing in
              </span>
            )}

            <div className={LINKS_CLASS}>
              <Link to={FORGOT_PASSWORD_PATH} className={LINK_CLASS}>
                Forgot your password?
              </Link>
              <Link to={HELP_PATH} className={LINK_CLASS}>
                Need help?
              </Link>
            </div>
          </form>

          <p className={QUIET_CLASS}>Accounts are created by your school.</p>
        </section>
      </div>
    </main>
  );
}

export { LoginPage };
