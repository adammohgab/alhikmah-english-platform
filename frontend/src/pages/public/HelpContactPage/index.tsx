import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Clock, ExternalLink, ListTree, Mail, MapPin, Phone } from "lucide-react";
import { PublicFooter } from "@/shared/components/layout/PublicFooter";
import { PublicHeader } from "@/shared/components/layout/PublicHeader";
import { cn } from "@/shared/lib/utils/cn";
import { ContactForm } from "./ContactForm";
import type { InquiryValues } from "./inquiry";
import { useSchoolContact, type SchoolContact } from "./school-contact";

/* ========================================
   HelpContactPage: SH-06 "/help" (SHARED-SPEC §5, PUB-08)

   Reading layout (720px) with a table of contents beside it on desktop (a "Sections" toggle on
   small screens). Sections: Contact (school details from Platform settings, plus a campus card),
   Send a message (inquiry form), Who should I ask, Common problems, Browser and device tips.

   Contact details come from the public `get_public_state` RPC. A line the school has not filled
   in is left out; if nothing is set, the card says to ask a teacher or the school office.

   Deep link: `/help?errorId=ERR-...` (the "Report issue" link on the error page) opens the form
   with the topic "Report a problem" and the Error ID already in the message.
   ======================================================== */

const PAGE_TITLE = "Help and contact | Wordland";
const FALLBACK_SCHOOL_NAME = "Al Hikmah Private School";
const ERROR_ID_PATTERN = /^ERR-[0-9A-Z]{1,6}-[0-9A-Z]{4}$/;

function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

const SECTIONS = [
  { id: "contact", title: "Contact the school" },
  { id: "message", title: "Send a message" },
  { id: "who-to-ask", title: "Who should I ask?" },
  { id: "common-problems", title: "Common problems" },
  { id: "browsers", title: "Browser and device tips" },
] as const;

const LINK = "font-semibold text-stroke underline underline-offset-2";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-title`} id={id} className="scroll-mt-24 py-8 first:pt-0">
      <h2
        id={`${id}-title`}
        className="font-heading text-[26px] font-bold leading-tight text-stroke md:text-[30px]"
      >
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-[16px] leading-[1.65] text-stroke">{children}</div>
    </section>
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
    <div className="flex gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-stroke bg-surface-0"
      >
        {icon}
      </span>
      <div>
        <dt className="text-[13px] font-bold uppercase tracking-wide text-muted">{label}</dt>
        <dd className="mt-0.5 whitespace-pre-line text-[16px] text-stroke">{children}</dd>
      </div>
    </div>
  );
}

function CampusIllustration() {
  return (
    <svg
      viewBox="0 0 240 120"
      aria-hidden="true"
      focusable="false"
      className="h-auto w-full rounded-[12px] border-2 border-stroke bg-world-sky-50"
    >
      <path
        d="M0 78 C50 62 90 96 150 70 S210 62 240 76"
        fill="none"
        stroke="#4DB8FF"
        strokeWidth="10"
        opacity="0.5"
      />
      <path d="M20 0 V120 M120 0 V120 M0 40 H240" stroke="#1A1530" strokeWidth="2" opacity="0.15" />
      <rect
        x="140"
        y="30"
        width="56"
        height="34"
        rx="4"
        fill="#FFF1E3"
        stroke="#1A1530"
        strokeWidth="3"
      />
      <path
        d="M134 32 L168 12 L202 32"
        fill="#FFB84D"
        stroke="#1A1530"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <rect x="162" y="44" width="12" height="20" fill="#1A1530" />
      <path
        d="M70 100 C70 100 52 76 52 62 a18 18 0 0 1 36 0 C88 76 70 100 70 100 Z"
        fill="#F2566A"
        stroke="#1A1530"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <circle cx="70" cy="62" r="6.5" fill="#fff" stroke="#1A1530" strokeWidth="2.5" />
    </svg>
  );
}

function ContactCards({
  contact,
  loading,
}: {
  contact: SchoolContact | undefined;
  loading: boolean;
}) {
  const name = contact?.schoolName ?? FALLBACK_SCHOOL_NAME;
  const rows: ReactNode[] = [];

  if (contact?.officeHours)
    rows.push(
      <DetailRow key="hours" icon={<Clock size={18} strokeWidth={2.5} />} label="Office hours">
        {contact.officeHours}
      </DetailRow>,
    );
  if (contact?.phone)
    rows.push(
      <DetailRow key="phone" icon={<Phone size={18} strokeWidth={2.5} />} label="Phone">
        {contact.phone}
      </DetailRow>,
    );
  if (contact?.contactEmail)
    rows.push(
      <DetailRow key="email" icon={<Mail size={18} strokeWidth={2.5} />} label="Email">
        {contact.contactEmail}
      </DetailRow>,
    );
  if (contact?.supportLink)
    rows.push(
      <DetailRow
        key="support"
        icon={<ExternalLink size={18} strokeWidth={2.5} />}
        label="Support page"
      >
        <a href={contact.supportLink} target="_blank" rel="noopener noreferrer" className={LINK}>
          Open the school's support page
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </DetailRow>,
    );

  const mapsHref = contact?.location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.location)}`
    : undefined;

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="rounded-[18px] border-2 border-stroke bg-surface-0 p-5 shadow-retro-md">
        <h3 className="font-heading text-[20px] font-bold">{name}</h3>
        {loading ? (
          <p role="status" className="mt-3 text-[15px] text-muted">
            Loading contact details…
          </p>
        ) : rows.length > 0 ? (
          <dl className="mt-4 space-y-4">{rows}</dl>
        ) : (
          <p className="mt-3 text-[15px] text-muted">
            Contact details have not been added yet. Please ask your teacher or the school office.
          </p>
        )}
      </div>

      {contact?.location && (
        <div className="rounded-[18px] border-2 border-stroke bg-surface-0 p-5 shadow-retro-md">
          <h3 className="font-heading text-[20px] font-bold">Campus</h3>
          <div className="mt-4">
            <CampusIllustration />
          </div>
          <p className="mt-4 flex gap-2 text-[16px]">
            <MapPin aria-hidden="true" size={20} strokeWidth={2.5} className="mt-0.5 shrink-0" />
            <span className="whitespace-pre-line">{contact.location}</span>
          </p>
          {mapsHref && (
            <p className="mt-3">
              <a href={mapsHref} target="_blank" rel="noopener noreferrer" className={LINK}>
                Open in maps
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function initialValuesFrom(errorId: string | null): Partial<InquiryValues> | undefined {
  if (errorId === null || !ERROR_ID_PATTERN.test(errorId)) return undefined;
  return { category: "problem", message: `Error ID: ${errorId}\n\nWhat I was doing: ` };
}

export default function HelpContactPage() {
  useDocumentTitle(PAGE_TITLE);

  const [searchParams] = useSearchParams();
  const { data: contact, isLoading } = useSchoolContact();
  const [tocOpen, setTocOpen] = useState(false);
  const initialValues = initialValuesFrom(searchParams.get("errorId"));

  return (
    <>
      <PublicHeader mainId="main-content" />
      <main id="main-content" className="bg-surface-100">
        <div className="mx-auto w-full max-w-[1000px] px-6 py-12 md:py-16">
          <h1 className="font-heading text-[36px] font-bold leading-tight text-stroke md:text-[48px]">
            Help and contact
          </h1>
          <p className="mt-3 max-w-[720px] text-[17px] leading-snug text-muted">
            Help that does not need an account. Find out who to ask, fix common problems, or send
            the school a message.
          </p>

          <div className="mt-10 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14">
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <button
                type="button"
                aria-expanded={tocOpen}
                aria-controls="help-toc"
                onClick={() => setTocOpen((open) => !open)}
                className="flex min-h-11 w-full items-center gap-2 rounded-[12px] border-2 border-stroke bg-surface-0 px-4 font-heading text-[15px] font-semibold text-stroke shadow-retro-sm lg:hidden"
              >
                <ListTree aria-hidden="true" size={18} strokeWidth={2.5} />
                Sections
              </button>
              <nav
                id="help-toc"
                aria-label="Help sections"
                className={cn("mt-3 lg:mt-0 lg:block", tocOpen ? "block" : "hidden")}
              >
                <p className="mb-2 hidden font-heading text-[14px] font-bold uppercase tracking-wide text-muted lg:block">
                  On this page
                </p>
                <ul className="space-y-1 border-l-2 border-stroke pl-3">
                  {SECTIONS.map((section) => (
                    <li key={section.id}>
                      <a
                        href={`#${section.id}`}
                        onClick={() => setTocOpen(false)}
                        className="block rounded-[6px] px-2 py-1.5 text-[14px] leading-snug text-muted hover:text-stroke hover:underline"
                      >
                        {section.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>

            <div className="min-w-0 max-w-[720px] divide-y-2 divide-dashed divide-[rgba(26,21,48,0.2)]">
              <Section id="contact" title="Contact the school">
                <ContactCards contact={contact} loading={isLoading} />
              </Section>

              <Section id="message" title="Send a message">
                <p>
                  Tell the school what you need. For a forgotten password, use{" "}
                  <Link to="/forgot-password" className={LINK}>
                    the password reset request
                  </Link>{" "}
                  instead.
                </p>
                <ContactForm initialValues={initialValues} />
              </Section>

              <Section id="who-to-ask" title="Who should I ask?">
                <dl className="grid gap-4 sm:grid-cols-3">
                  {[
                    ["Students", "Your teacher first, then the school office."],
                    ["Teachers", "Your school admin."],
                    ["Admins", "The platform owner."],
                  ].map(([who, answer]) => (
                    <div
                      key={who}
                      className="rounded-[14px] border-2 border-stroke bg-surface-0 p-4 shadow-retro-sm"
                    >
                      <dt className="font-heading text-[17px] font-bold">{who}</dt>
                      <dd className="mt-1 text-[15px] leading-snug">{answer}</dd>
                    </div>
                  ))}
                </dl>
              </Section>

              <Section id="common-problems" title="Common problems">
                <ul className="space-y-5">
                  <li>
                    <h3 className="font-heading text-[18px] font-bold">I cannot sign in</h3>
                    <ul className="mt-1 list-disc space-y-1 pl-6 text-[15px]">
                      <li>Check the spelling of your username.</li>
                      <li>Check that Caps Lock is off.</li>
                      <li>After too many tries the account locks. Ask your school to unlock it.</li>
                    </ul>
                    <p className="mt-2 text-[15px]">
                      <Link to="/login" className={LINK}>
                        Go to sign in
                      </Link>
                    </p>
                  </li>
                  <li>
                    <h3 className="font-heading text-[18px] font-bold">I forgot my password</h3>
                    <p className="mt-1 text-[15px]">
                      <Link to="/forgot-password" className={LINK}>
                        Request a password reset
                      </Link>
                    </p>
                  </li>
                  <li>
                    <h3 className="font-heading text-[18px] font-bold">My account is not active</h3>
                    <p className="mt-1 text-[15px]">
                      Your account may have been archived or turned off.{" "}
                      <Link to="/account-not-active" className={LINK}>
                        See what to do
                      </Link>
                    </p>
                  </li>
                  <li>
                    <h3 className="font-heading text-[18px] font-bold">
                      I cannot see my class or course
                    </h3>
                    <p className="mt-1 text-[15px]">
                      Ask your teacher to check that you are in the class.
                    </p>
                  </li>
                  <li>
                    <h3 className="font-heading text-[18px] font-bold">
                      The AI Tutor is not answering
                    </h3>
                    <p className="mt-1 text-[15px]">
                      It may be switched off, or you may have reached today's limit. The limit
                      resets at midnight.
                    </p>
                  </li>
                  <li>
                    <h3 className="font-heading text-[18px] font-bold">
                      I want to report a problem
                    </h3>
                    <p className="mt-1 text-[15px]">
                      Sign in, then use “Report a problem” next to the item. If you cannot sign in,
                      send a message above.
                    </p>
                  </li>
                </ul>
              </Section>

              <Section id="browsers" title="Browser and device tips">
                <ul className="list-disc space-y-1.5 pl-6">
                  <li>Use the latest version of Chrome, Edge, Safari or Firefox.</li>
                  <li>It works on computers, tablets and phones.</li>
                  <li>If a page looks wrong, refresh it or update your browser.</li>
                </ul>
              </Section>
            </div>
          </div>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}

export { HelpContactPage };
