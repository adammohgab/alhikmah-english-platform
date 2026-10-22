import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import logo from "@/shared/assets/logo.png";
import { getRoleHomePath } from "@/app/guards/guard-utils";
import { useAuth } from "@/app/providers/auth-context";
import { cn } from "@/shared/lib/utils/cn";

/* ========================================
   PublicFooter (SHARED-SPEC §4 SH-00)

   A layout piece for the public pages, rendered after the page's <main>. It never wraps
   an <Outlet />. It carries the unchanged school logo on a plain light surface with clear
   space of half the logo height on every side (spec §2), the school name, the school and
   legal links, the "accounts are created by your school" line and the copyright line.
   Accreditation: the repo holds no accreditation text, so none is invented. Pass it through
   `accreditation` (for example from Platform settings) and it is shown under the school name.
   ======================================== */

const SCHOOL_NAME = "Al Hikmah Private School";

interface FooterLink {
  id: string;
  label: string;
  to: string;
}

const PLATFORM_LINKS: readonly FooterLink[] = [
  { id: "about", label: "About", to: "/about" },
  { id: "faq", label: "FAQ", to: "/faq" },
  { id: "help", label: "Help and contact", to: "/help" },
];

const LEGAL_LINKS: readonly FooterLink[] = [
  { id: "terms", label: "Terms and Privacy", to: "/terms" },
];

const LINK_CLASS =
  "inline-block rounded-[6px] py-1 font-body text-[15px] font-semibold text-muted underline-offset-4 hover:text-stroke hover:underline";

export interface PublicFooterProps {
  /** Accreditation or affiliation text shown under the school name. Omitted when not given. */
  accreditation?: ReactNode | undefined;
  className?: string | undefined;
}

function FooterLinkList({ heading, links }: { heading: string; links: readonly FooterLink[] }) {
  return (
    <div>
      <h2 className="font-heading text-[16px] font-semibold">{heading}</h2>
      <ul className="mt-2 space-y-1">
        {links.map((link) => (
          <li key={link.id}>
            <Link to={link.to} className={LINK_CLASS}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PublicFooter({ accreditation, className }: PublicFooterProps) {
  const { isAuthenticated, user } = useAuth();
  const homePath = isAuthenticated && user !== null ? getRoleHomePath(user.role) : null;
  const accountLink: FooterLink =
    homePath === null
      ? { id: "sign-in", label: "Sign in", to: "/login" }
      : { id: "dashboard", label: "Open my dashboard", to: homePath };

  return (
    <footer className={cn("border-t-2 border-stroke bg-surface-0 text-stroke", className)}>
      <div className="mx-auto w-full max-w-[1200px] px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-sm">
            <div className="inline-block rounded-[12px] bg-surface-0 p-5">
              <img src={logo} alt={SCHOOL_NAME} width={221} height={48} className="h-12 w-auto" />
            </div>
            <p className="mt-2 font-heading text-[18px] font-semibold">{SCHOOL_NAME}</p>
            {accreditation !== undefined && accreditation !== null && (
              <p className="mt-1 font-body text-[14px] font-medium text-muted">{accreditation}</p>
            )}
            <p className="mt-3 font-body text-[14px] font-medium text-muted">
              Accounts are created by your school.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-16 gap-y-8">
            <FooterLinkList heading="Platform" links={[...PLATFORM_LINKS, accountLink]} />
            <FooterLinkList heading="Legal" links={LEGAL_LINKS} />
          </nav>
        </div>
        <p className="mt-10 border-t-2 border-line-200 pt-6 font-body text-[13px] font-medium text-muted">
          © {new Date().getFullYear()} {SCHOOL_NAME}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
