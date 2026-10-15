import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Check, ListTree, Printer } from "lucide-react";
import { PublicFooter } from "@/shared/components/layout/PublicFooter";
import { PublicHeader } from "@/shared/components/layout/PublicHeader";
import { Button } from "@/shared/components/ui/Button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/Tabs";
import { cn } from "@/shared/lib/utils/cn";
import {
  LEGAL_DOCUMENTS,
  LEGAL_UPDATED_AT,
  LEGAL_VERSION,
  STUDENT_DATA_PROMISES,
  type LegalDocument,
  type LegalKind,
} from "./legal-content";
import "./legal.css";

/* ========================================
   LegalPage: SH-08 Terms of use and Privacy notice (SHARED-SPEC §5, PUB-10)

   Two tabs, "Last updated" at the top, a Print button, and for each document a table of
   contents beside the article (sticky on desktop, a "Sections" toggle on small screens)
   whose links jump to the sections. The article text is capped at 65ch.

   The tab comes from `?tab=terms|privacy`, else from the path (/privacy opens Privacy,
   anything else opens Terms). Register the page on /terms and /privacy (and /legal) in the
   router; switching tabs only changes the query string, so every one of those paths works.

   Print: legal.css removes the site header and footer, the tabs, the table of contents and
   the buttons, for a clean paper copy of the open document.
   ======================================================== */

const PAGE_TITLE = "Terms and Privacy | Wordland";

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function isKind(value: string | null): value is LegalKind {
  return value === "terms" || value === "privacy";
}

function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

/** Id of the section currently nearest the top of the viewport, for the contents highlight. */
function useActiveSection(ids: readonly string[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join("|");

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return undefined;
    const elements = key
      .split("|")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((entry) => entry.isIntersecting);
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: "-90px 0px -65% 0px" },
    );
    elements.forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
    };
  }, [key]);

  return active;
}

function LegalArticle({ doc }: { doc: LegalDocument }) {
  const ids = doc.sections.map((section) => `${doc.kind}-${section.id}`);
  const active = useActiveSection(ids);
  const [tocOpen, setTocOpen] = useState(false);
  const tocId = `toc-${doc.kind}`;

  return (
    <div className="legal-shell grid gap-8 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-14">
      <aside className="legal-print-hide lg:sticky lg:top-24 lg:self-start">
        <button
          type="button"
          aria-expanded={tocOpen}
          aria-controls={tocId}
          onClick={() => setTocOpen((value) => !value)}
          className="flex min-h-11 w-full items-center gap-2 rounded-[12px] border-2 border-stroke bg-surface-0 px-4 font-heading text-[15px] font-semibold text-stroke shadow-retro-sm lg:hidden"
        >
          <ListTree aria-hidden="true" size={18} strokeWidth={2.5} />
          Sections
        </button>
        <nav
          id={tocId}
          aria-label={`${doc.title}: sections`}
          className={cn("mt-3 lg:mt-0 lg:block", tocOpen ? "block" : "hidden")}
        >
          <p className="mb-2 hidden font-heading text-[14px] font-bold uppercase tracking-wide text-muted lg:block">
            On this page
          </p>
          <ol className="space-y-1 border-l-2 border-stroke pl-3">
            {doc.sections.map((section, index) => {
              const id = `${doc.kind}-${section.id}`;
              const isActive = active === id;
              return (
                <li key={section.id}>
                  <a
                    href={`#${id}`}
                    aria-current={isActive ? "location" : undefined}
                    onClick={() => setTocOpen(false)}
                    className={cn(
                      "block rounded-[6px] px-2 py-1.5 text-[14px] leading-snug text-muted hover:text-stroke hover:underline",
                      isActive && "bg-[var(--world-soft,#ffd93d)] font-semibold text-stroke",
                    )}
                  >
                    {index + 1}. {section.title}
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>
      </aside>

      <article className="legal-article max-w-[65ch] font-body text-[17px] leading-[1.7] text-stroke">
        <h2 className="font-heading text-[30px] font-bold leading-tight md:text-[36px]">
          {doc.title}
        </h2>
        <p className="mt-3 text-[17px] text-muted">{doc.intro}</p>

        {doc.kind === "privacy" && (
          <section
            aria-labelledby="privacy-promises"
            className="legal-promises mt-8 rounded-[16px] border-2 border-stroke bg-world-mint-100 p-5 shadow-retro-sm"
          >
            <h3 id="privacy-promises" className="font-heading text-[20px] font-bold">
              Our student data promises
            </h3>
            <ul className="mt-3 space-y-2">
              {STUDENT_DATA_PROMISES.map((promise) => (
                <li key={promise} className="flex gap-3 text-[16px] leading-snug">
                  <Check
                    aria-hidden="true"
                    size={20}
                    strokeWidth={3}
                    className="mt-0.5 shrink-0 text-stroke"
                  />
                  <span>{promise}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {doc.sections.map((section, index) => (
          <section
            key={section.id}
            id={`${doc.kind}-${section.id}`}
            aria-labelledby={`${doc.kind}-${section.id}-title`}
            className="mt-10 scroll-mt-24"
          >
            <h3
              id={`${doc.kind}-${section.id}-title`}
              className="font-heading text-[22px] font-bold leading-snug"
            >
              {index + 1}. {section.title}
            </h3>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="mt-3">
                {paragraph}
              </p>
            ))}
            {section.bullets && (
              <ul className="mt-3 list-disc space-y-1.5 pl-6">
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            )}
            {section.id === "contact" && (
              <p className="mt-3">
                <Link to="/help" className="font-semibold underline underline-offset-2">
                  Help and contact
                </Link>
              </p>
            )}
          </section>
        ))}
      </article>
    </div>
  );
}

export default function LegalPage() {
  useDocumentTitle(PAGE_TITLE);

  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const fromQuery = searchParams.get("tab");
  const fromPath: LegalKind = location.pathname.endsWith("/privacy") ? "privacy" : "terms";
  const current: LegalKind = isKind(fromQuery) ? fromQuery : fromPath;

  const handleTabChange = (value: string) => {
    if (!isKind(value)) return;
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <>
      <PublicHeader mainId="main-content" className="legal-print-hide" />
      <main id="main-content" className="legal-page bg-surface-100">
        <div className="mx-auto w-full max-w-[1100px] px-6 py-12 md:py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-heading text-[36px] font-bold leading-tight text-stroke md:text-[48px]">
                Terms and Privacy
              </h1>
              <p className="mt-2 text-[15px] text-muted">
                Last updated{" "}
                <time dateTime={LEGAL_UPDATED_AT}>
                  {DATE_FORMAT.format(new Date(LEGAL_UPDATED_AT))}
                </time>{" "}
                &middot; Version {LEGAL_VERSION}
              </p>
            </div>
            <Button variant="secondary" onClick={() => window.print()} className="legal-print-hide">
              <Printer aria-hidden="true" size={18} />
              Print
            </Button>
          </div>

          <Tabs value={current} onValueChange={handleTabChange} className="mt-8">
            <TabsList aria-label="Legal documents" className="legal-print-hide self-start">
              <TabsTrigger value="terms">Terms of use</TabsTrigger>
              <TabsTrigger value="privacy">Privacy notice</TabsTrigger>
            </TabsList>
            <TabsContent value="terms" className="mt-10">
              <LegalArticle doc={LEGAL_DOCUMENTS.terms} />
            </TabsContent>
            <TabsContent value="privacy" className="mt-10">
              <LegalArticle doc={LEGAL_DOCUMENTS.privacy} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <PublicFooter className="legal-print-hide" />
    </>
  );
}

export { LegalPage };
