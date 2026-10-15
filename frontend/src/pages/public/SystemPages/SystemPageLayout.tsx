import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils/cn";

/* ErrorPageTemplate for the system pages (SHARED-SPEC §4 SH-00): a centered column with a
   motif, a short title, one sentence of explanation and up to two buttons. */

export interface SystemPageLayoutProps {
  /** Illustration shown above the title. Decorative: the title carries the meaning. */
  motif: ReactNode;
  /** Small label above the title, e.g. "403 Forbidden". */
  eyebrow?: string | undefined;
  title: string;
  /** Body content under the title (sentences, status lines, extra cards). */
  children?: ReactNode;
  /** The page's buttons. */
  actions?: ReactNode;
  /** Calm tinted background for pages that are expected to last a while (maintenance). */
  calm?: boolean | undefined;
}

export function SystemPageLayout({
  motif,
  eyebrow,
  title,
  children,
  actions,
  calm = false,
}: SystemPageLayoutProps) {
  return (
    <main
      id="main-content"
      className={cn(
        "relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-16 text-center",
        calm ? "bg-world-sky-50" : "bg-surface-100",
      )}
    >
      {calm && (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full border-2 border-stroke bg-world-sky-100 opacity-70"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full border-2 border-stroke bg-world-mint-100 opacity-70"
          />
        </>
      )}
      <div className="relative flex flex-col items-center">
        {motif}
        {eyebrow && (
          <p className="mt-4 font-accent text-[28px] leading-none text-world-rose-600">{eyebrow}</p>
        )}
        <h1 className="mt-3 max-w-xl font-heading text-[32px] font-bold leading-tight text-stroke md:text-[44px]">
          {title}
        </h1>
        {children}
        {actions && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">{actions}</div>
        )}
      </div>
    </main>
  );
}
