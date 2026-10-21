import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { CircleAlert, CircleCheck, Clock, ExternalLink, Mail, MapPin, Phone } from "lucide-react";
import { getRoleHomePath } from "@/app/guards/guard-utils";
import { useAuth } from "@/app/providers/auth-context";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { Sticker } from "@/shared/components/ui/Sticker";
import { Textarea } from "@/shared/components/ui/Textarea";
import { SCHOOL_LOGO_SRC } from "@/shared/config/branding";
import { cn } from "@/shared/lib/utils/cn";
import { useSchoolContact } from "../HelpContactPage/school-contact";
import type { SchoolContact } from "../HelpContactPage/school-contact";
import {
  EMPTY_RESET,
  GRADE_CLASS_MAX,
  NOTE_MAX,
  RESET_MESSAGES,
  USERNAME_MAX,
  submitResetRequest,
  validateField,
  validateReset,
  type ResetErrors,
  type ResetField,
  type ResetValues,
} from "./forgot-password-logic";

/* ========================================
   ForgotPasswordPage: SH-03 "/forgot-password" (SHARED-SPEC §5, PUB-05)

   The same split layout as SH-02: an art panel on the left and a wider card on the right. The
   card has two parts side by side (stacked on mobile): "Request a reset" and "Contact your
   school".

   Behavior (SH-03):
     - Fields: Username and Full name (required), Grade and class (optional) and a Note of up to
       200 characters (optional). Messages show on blur and on submit.
     - The request goes to `request_password_reset`. The success text is the same whether or not
       the username exists. The success banner replaces the form and keeps a "Back to sign in"
       link to /login.
     - At most 3 requests per hour from one device. The device count is kept in local storage and
       the server applies its own limit. Both show the same "several requests" message.
     - Failures (network, server) show in one alert above the fields and keep what was typed.
     - Signed-in visitors skip the page and go to their dashboard.
     - The contact card reads office hours, phone, location and the help email from the public
       `get_public_state` call. A detail that is not set is left out, and nothing is invented.
   Class strings live in constants so the Tailwind class sorter treats them as plain data.
   ======================================== */

const PAGE_TITLE = "Forgot password | Al Hikmah English Platform";
const MAIN_ID = "main-content";
const HOME_PATH = "/";
const LOGIN_PATH = "/login";
const HELP_PATH = "/help";

const SUCCESS_MESSAGE =
  "Request sent. Your school will contact you with a temporary password. This can take up to 2 school days.";

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
  "flex w-full max-w-3xl flex-col gap-6 rounded-[24px] border-2 border-stroke bg-surface-0 p-6 shadow-retro-md sm:p-8";
const BRAND_CLASS = "flex items-center gap-3";
const LOGO_LINK_CLASS = "inline-flex shrink-0 rounded-[8px] bg-surface-0 p-2";
const WORDMARK_CLASS = "font-heading text-[18px] font-semibold leading-tight text-stroke";
const HEADING_CLASS = "font-heading text-3xl font-bold leading-tight text-stroke";
const PARTS_CLASS = "grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8";
const PART_CLASS = "flex min-w-0 flex-col gap-4";
const PART_HEADING_CLASS = "font-heading text-xl font-bold text-stroke";
const BODY_CLASS = "font-body text-base font-medium text-muted";
const FORM_CLASS = "flex flex-col gap-5";
const FIELDS_CLASS = "flex flex-col gap-4";
const ALERT_BASE_CLASS =
  "flex items-start gap-3 rounded-[12px] border-2 border-stroke p-3 font-body text-[15px] font-semibold text-stroke";
const ALERT_ICON_CLASS = "mt-0.5 h-5 w-5 shrink-0 [stroke-width:2.5]";
const DETAILS_CLASS =
  "flex flex-col gap-3 rounded-[16px] border-2 border-stroke bg-surface-100 p-4";
const DETAIL_ROW_CLASS = "flex items-start gap-3";
const DETAIL_ICON_CLASS = "mt-0.5 h-[18px] w-[18px] shrink-0 text-stroke [stroke-width:2.5]";
const DETAIL_LABEL_CLASS = "font-body text-sm font-bold text-stroke";
const DETAIL_VALUE_CLASS = "break-words font-body text-[15px] font-medium text-stroke";
const GUIDE_CLASS = "flex flex-col gap-1 font-body text-[15px] font-medium text-stroke";
const LINK_CLASS =
  "rounded-[6px] font-body text-[15px] font-semibold text-stroke underline underline-offset-4 hover:decoration-2";
const LINKS_CLASS = "flex flex-wrap items-center gap-x-4 gap-y-2";
const SR_ONLY_CLASS = "sr-only";

type AlertTone = "error" | "success";

const ALERT_TONE_CLASS: Record<AlertTone, string> = {
  error: "bg-danger-100",
  success: "bg-success-100",
};

/** The form-level alert: errors interrupt, the success banner waits to be read. */
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

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className={DETAIL_ROW_CLASS}>
      {icon}
      <div className="flex min-w-0 flex-col">
        <dt className={DETAIL_LABEL_CLASS}>{label}</dt>
        <dd className={DETAIL_VALUE_CLASS}>{children}</dd>
      </div>
    </div>
  );
}

/** Part 2: office, hours, phone, location and email as plain text, plus who to ask. */
function ContactPart({
  contact,
  loading,
  failed,
}: {
  contact: SchoolContact | undefined;
  loading: boolean;
  failed: boolean;
}) {
  const rows: ReactNode[] = [];
  if (contact?.officeHours !== undefined)
    rows.push(
      <DetailRow
        key="hours"
        icon={<Clock aria-hidden="true" className={DETAIL_ICON_CLASS} />}
        label="Office hours"
      >
        {contact.officeHours}
      </DetailRow>,
    );
  if (contact?.contactEmail !== undefined)
    rows.push(
      <DetailRow
        key="email"
        icon={<Mail aria-hidden="true" className={DETAIL_ICON_CLASS} />}
        label="Helpdesk email"
      >
        {contact.contactEmail}
      </DetailRow>,
    );
  if (contact?.phone !== undefined)
    rows.push(
      <DetailRow
        key="phone"
        icon={<Phone aria-hidden="true" className={DETAIL_ICON_CLASS} />}
        label="Phone"
      >
        {contact.phone}
      </DetailRow>,
    );
  if (contact?.location !== undefined)
    rows.push(
      <DetailRow
        key="location"
        icon={<MapPin aria-hidden="true" className={DETAIL_ICON_CLASS} />}
        label="Where to go in person"
      >
        {contact.location}
      </DetailRow>,
    );
  if (contact?.supportLink !== undefined)
    rows.push(
      <DetailRow
        key="support"
        icon={<ExternalLink aria-hidden="true" className={DETAIL_ICON_CLASS} />}
        label="Support page"
      >
        <a
          href={contact.supportLink}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASS}
        >
          Open the school's support page
          <span className={SR_ONLY_CLASS}> (opens in a new tab)</span>
        </a>
      </DetailRow>,
    );

  return (
    <section aria-labelledby="forgot-contact-heading" className={PART_CLASS}>
      <h2 id="forgot-contact-heading" className={PART_HEADING_CLASS}>
        Contact your school
      </h2>
      <div className={DETAILS_CLASS}>
        {contact?.schoolName !== undefined && (
          <p className="font-heading text-lg font-bold text-stroke">{contact.schoolName}</p>
        )}
        {loading ? (
          <p role="status" className={BODY_CLASS}>
            Loading contact details…
          </p>
        ) : rows.length > 0 ? (
          <dl className="flex flex-col gap-3">{rows}</dl>
        ) : (
          <p className={BODY_CLASS}>
            {failed
              ? "We could not load the school contact details. Ask your teacher or go to the school office."
              : "Contact details have not been added yet. Ask your teacher or go to the school office."}
          </p>
        )}
      </div>
      <div className={GUIDE_CLASS}>
        <p>
          <span className="font-bold">Students</span> ask your teacher.
        </p>
        <p>
          <span className="font-bold">Teachers</span> ask your school admin.
        </p>
        <p>If you need help in person, visit the school office during office hours.</p>
      </div>
    </section>
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
  errors: ResetErrors,
  field: ResetField,
  message: string | undefined,
): ResetErrors {
  const next: ResetErrors = { ...errors };
  if (message === undefined) delete next[field];
  else next[field] = message;
  return next;
}

const FOCUS_ORDER: readonly ResetField[] = ["username", "fullName", "gradeClass", "note"];

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { data: contact, isLoading: contactLoading, isError: contactFailed } = useSchoolContact();

  const [values, setValues] = useState<ResetValues>(EMPTY_RESET);
  const [errors, setErrors] = useState<ResetErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submittingRef = useRef(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const fullNameRef = useRef<HTMLInputElement>(null);
  const gradeClassRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  const idBase = useId();
  const usernameId = `${idBase}-username`;
  const fullNameId = `${idBase}-full-name`;
  const gradeClassId = `${idBase}-grade-class`;
  const noteId = `${idBase}-note`;
  const headingId = `${idBase}-heading`;
  const requestHeadingId = `${idBase}-request-heading`;

  useDocumentTitle(PAGE_TITLE);

  // The banner replaces the form, so move focus to it for keyboard and screen reader users.
  useEffect(() => {
    if (sent) bannerRef.current?.focus();
  }, [sent]);

  const checkField = (field: ResetField, next: ResetValues) => {
    setErrors((current) => withFieldError(current, field, validateField(field, next)));
  };

  const changeField = (field: ResetField, value: string) => {
    const next: ResetValues = { ...values, [field]: value };
    setValues(next);
    // Once a message is showing, keep it in step with what is typed.
    if (errors[field] !== undefined) checkField(field, next);
  };

  const focusField = (field: ResetField) => {
    const refs: Record<ResetField, { current: HTMLElement | null }> = {
      username: usernameRef,
      fullName: fullNameRef,
      gradeClass: gradeClassRef,
      note: noteRef,
    };
    refs[field].current?.focus();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;

    const found = validateReset(values);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setFailure(null);
      const first = FOCUS_ORDER.find((field) => found[field] !== undefined);
      if (first !== undefined) focusField(first);
      return;
    }

    setErrors({});
    setFailure(null);
    submittingRef.current = true;
    setSubmitting(true);

    try {
      const outcome = await submitResetRequest(values);
      switch (outcome.kind) {
        case "sent":
          setSent(true);
          return;
        case "rate-limited":
          setFailure(RESET_MESSAGES.rateLimited);
          return;
        case "network":
          setFailure(RESET_MESSAGES.network);
          return;
        default:
          setFailure(RESET_MESSAGES.failed);
      }
    } catch {
      setFailure(RESET_MESSAGES.failed);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  // Signed-in visitors skip the page (SH-03 follows SH-02, "Already signed in").
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
            <span className={ART_STICKER_FACE_CLASS}>Help!</span>
          </Sticker>
        </div>
        <div className={ART_TEXT_CLASS}>
          <p className={ART_WORDMARK_CLASS}>Al Hikmah English Platform</p>
          <p className={ART_HEADING_CLASS}>We can help.</p>
        </div>
      </div>

      <div className={CARD_COLUMN_CLASS}>
        <div className={CARD_CLASS}>
          <div className={BRAND_CLASS}>
            {SCHOOL_LOGO_SRC !== null && (
              <Link to={HOME_PATH} aria-label="Go to the home page" className={LOGO_LINK_CLASS}>
                <img src={SCHOOL_LOGO_SRC} alt="" width={147} height={32} className="h-8 w-auto" />
              </Link>
            )}
            <span className={WORDMARK_CLASS}>English Platform</span>
          </div>

          <h1 id={headingId} className={HEADING_CLASS}>
            Forgot your password?
          </h1>

          <div className={PARTS_CLASS}>
            <section aria-labelledby={requestHeadingId} className={PART_CLASS}>
              <h2 id={requestHeadingId} className={PART_HEADING_CLASS}>
                Request a reset
              </h2>

              {sent ? (
                <div className="flex flex-col gap-4">
                  <div ref={bannerRef} tabIndex={-1} className="outline-none">
                    <InlineAlert tone="success">{SUCCESS_MESSAGE}</InlineAlert>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    className="w-full"
                    onClick={() => {
                      void navigate(LOGIN_PATH);
                    }}
                  >
                    Back to sign in
                  </Button>
                </div>
              ) : (
                <form
                  noValidate
                  aria-labelledby={requestHeadingId}
                  onSubmit={(event) => {
                    void handleSubmit(event);
                  }}
                  className={FORM_CLASS}
                >
                  <p className={BODY_CLASS}>
                    Tell us who you are. Your school will give you a temporary password.
                  </p>

                  {failure !== null && <InlineAlert tone="error">{failure}</InlineAlert>}

                  <div className={FIELDS_CLASS}>
                    <Input
                      ref={usernameRef}
                      id={usernameId}
                      name="username"
                      label="Username"
                      required
                      value={values.username}
                      error={errors.username}
                      disabled={submitting}
                      maxLength={USERNAME_MAX + 16}
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
                    <Input
                      ref={fullNameRef}
                      id={fullNameId}
                      name="full_name"
                      label="Full name"
                      required
                      value={values.fullName}
                      error={errors.fullName}
                      disabled={submitting}
                      autoComplete="name"
                      onChange={(event) => {
                        changeField("fullName", event.target.value);
                      }}
                      onBlur={() => {
                        checkField("fullName", values);
                      }}
                    />
                    <Input
                      ref={gradeClassRef}
                      id={gradeClassId}
                      name="grade_class"
                      label="Grade and class (students)"
                      helperText="Optional. For example 8B."
                      value={values.gradeClass}
                      error={errors.gradeClass}
                      disabled={submitting}
                      maxLength={GRADE_CLASS_MAX + 16}
                      autoComplete="off"
                      onChange={(event) => {
                        changeField("gradeClass", event.target.value);
                      }}
                      onBlur={() => {
                        checkField("gradeClass", values);
                      }}
                    />
                    <Textarea
                      ref={noteRef}
                      id={noteId}
                      name="note"
                      label="Note"
                      helperText="Optional."
                      rows={3}
                      showCount
                      maxLength={NOTE_MAX}
                      value={values.note}
                      error={errors.note}
                      disabled={submitting}
                      onChange={(event) => {
                        changeField("note", event.target.value);
                      }}
                      onBlur={() => {
                        checkField("note", values);
                      }}
                    />
                  </div>

                  <Button type="submit" size="lg" loading={submitting} className="w-full">
                    Send request
                  </Button>
                  {submitting && (
                    <span role="status" className={SR_ONLY_CLASS}>
                      Sending your request
                    </span>
                  )}

                  <div className={LINKS_CLASS}>
                    <Link to={LOGIN_PATH} className={LINK_CLASS}>
                      Back to sign in
                    </Link>
                    <Link to={HELP_PATH} className={LINK_CLASS}>
                      Need help?
                    </Link>
                  </div>
                </form>
              )}
            </section>

            <ContactPart contact={contact} loading={contactLoading} failed={contactFailed} />
          </div>
        </div>
      </div>
    </main>
  );
}

export { ForgotPasswordPage };
