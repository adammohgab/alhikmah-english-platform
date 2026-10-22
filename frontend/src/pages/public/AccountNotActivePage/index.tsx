import { useEffect, useId, useState } from "react";
import type { ReactNode } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Clock, ExternalLink, Mail, MapPin, Phone } from "lucide-react";
import { getRoleHomePath } from "@/app/guards/guard-utils";
import { useAuth } from "@/app/providers/auth-context";
import { Button } from "@/shared/components/ui/Button";
import { SCHOOL_LOGO_SRC } from "@/shared/config/branding";
import { useSchoolContact } from "../HelpContactPage/school-contact";
import type { SchoolContact } from "../HelpContactPage/school-contact";
import {
  REASON_COPY,
  endSession,
  isBlockedStatus,
  parseReason,
  type InactiveReason,
} from "./account-status";

/* ========================================
   AccountNotActivePage: SH-05 "/account-not-active" (SHARED-SPEC §5, PUB-07)

   An AuthCard on a plain background. It says the account is not active, gives the reason in one
   plain sentence, says what to do next, and shows the school's contact details.

   The reason comes from the signed-in profile status when someone is signed in with a blocked
   account, otherwise from `?reason=` (set by the sign-in page, which ends the session first),
   otherwise the general SH-05 text. Nothing private is shown: no username, no counts, no dates.
   Wording and sources are in `account-status.ts`.

   Buttons:
     - Signed in: "Sign out" ends the session on this device completely and opens sign-in, so
       another account can be used.
     - Not signed in: "Back to sign in" (SH-05).
   A signed-in person whose account is active has no business here and goes to the dashboard.

   The contact card reads office hours, phone, location and the help email from the public
   `get_public_state` call. A detail that is not set is left out, and nothing is invented.
   Class strings live in constants so the Tailwind class sorter treats them as plain data.
   ======================================== */

const PAGE_TITLE = "This account is not active | Al Hikmah English Platform";
const MAIN_ID = "main-content";
const LOGIN_PATH = "/login";

const PAGE_CLASS = "flex min-h-screen items-start justify-center bg-surface-100 px-4 py-8 sm:py-12";
const CARD_CLASS =
  "flex w-full max-w-md flex-col gap-6 rounded-[24px] border-2 border-stroke bg-surface-0 p-6 shadow-retro-md sm:p-8";
const BRAND_CLASS = "flex items-center gap-3";
const LOGO_CLASS = "inline-flex shrink-0 rounded-[8px] bg-surface-0 p-2";
const WORDMARK_CLASS = "font-heading text-[18px] font-semibold leading-tight text-stroke";
const HEADING_CLASS = "font-heading text-3xl font-bold leading-tight text-stroke";
const BODY_CLASS = "font-body text-base font-medium text-muted";
const EXPLAIN_CLASS =
  "flex flex-col gap-2 rounded-[16px] border-2 border-stroke bg-info-100 p-4 font-body text-[16px] font-medium text-stroke";
const EXPLAIN_LEAD_CLASS = "font-body text-[17px] font-bold text-stroke";
const CONTACT_HEADING_CLASS = "font-heading text-xl font-bold text-stroke";
const DETAILS_CLASS =
  "flex flex-col gap-3 rounded-[16px] border-2 border-stroke bg-surface-100 p-4";
const DETAIL_ROW_CLASS = "flex items-start gap-3";
const DETAIL_ICON_CLASS = "mt-0.5 h-[18px] w-[18px] shrink-0 text-stroke [stroke-width:2.5]";
const DETAIL_LABEL_CLASS = "font-body text-sm font-bold text-stroke";
const DETAIL_VALUE_CLASS = "break-words font-body text-[15px] font-medium text-stroke";
const LINK_CLASS =
  "rounded-[6px] font-body text-[15px] font-semibold text-stroke underline underline-offset-4 hover:decoration-2";
const SR_ONLY_CLASS = "sr-only";

function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
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

/** The school's contact options (SH-05 ContactCard): hours, email, phone, place, support page. */
function ContactCard({
  contact,
  loading,
  failed,
  headingId,
}: {
  contact: SchoolContact | undefined;
  loading: boolean;
  failed: boolean;
  headingId: string;
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
        label="Email"
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
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className={CONTACT_HEADING_CLASS}>
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
    </section>
  );
}

export default function AccountNotActivePage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, user, signOut } = useAuth();
  const [searchParams] = useSearchParams();
  const { data: contact, isLoading: contactLoading, isError: contactFailed } = useSchoolContact();
  const [leaving, setLeaving] = useState(false);

  const idBase = useId();
  const headingId = `${idBase}-heading`;
  const contactHeadingId = `${idBase}-contact`;

  useDocumentTitle(PAGE_TITLE);

  const signedIn = isAuthenticated && user !== null;

  const leave = async () => {
    if (leaving) return;
    setLeaving(true);
    await endSession(signOut);
    void navigate(`${LOGIN_PATH}?reason=signed-out`, { replace: true });
  };

  if (isLoading) {
    return (
      <main id={MAIN_ID} className={PAGE_CLASS}>
        <p role="status" className={BODY_CLASS}>
          Loading your account…
        </p>
      </main>
    );
  }

  // An active account does not belong here. The session status always wins over the address, so
  // nobody can open this page for a working account by typing a reason.
  if (signedIn && !isBlockedStatus(user.status)) {
    return <Navigate to={getRoleHomePath(user.role)} replace />;
  }

  const reason: InactiveReason = signedIn
    ? parseReason(user.status)
    : parseReason(searchParams.get("reason"));
  const copy = REASON_COPY[reason];

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

        <h1 id={headingId} className={HEADING_CLASS}>
          This account is not active
        </h1>

        <div data-reason={reason} className={EXPLAIN_CLASS}>
          <p className={EXPLAIN_LEAD_CLASS}>{copy.summary}</p>
          <p>{copy.next}</p>
        </div>

        <ContactCard
          contact={contact}
          loading={contactLoading}
          failed={contactFailed}
          headingId={contactHeadingId}
        />

        {signedIn ? (
          <Button
            type="button"
            size="lg"
            loading={leaving}
            className="w-full"
            onClick={() => {
              void leave();
            }}
          >
            Sign out
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            className="w-full"
            onClick={() => {
              void navigate(LOGIN_PATH);
            }}
          >
            Back to sign in
          </Button>
        )}
        {leaving && (
          <span role="status" className={SR_ONLY_CLASS}>
            Signing you out
          </span>
        )}
      </section>
    </main>
  );
}

export { AccountNotActivePage };
