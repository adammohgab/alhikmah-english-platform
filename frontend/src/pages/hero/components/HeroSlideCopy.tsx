import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";

interface HeroSlideCopyProps {
  eyebrow: string;
  heading: ReactNode;
  body?: ReactNode;
  ctaLabel: string;
  ctaHref: string;
  active: boolean;
}

/**
 * The one left-column treatment every hero slide shares: a quiet gold
 * eyebrow pill, a large serif headline, an optional line of supporting
 * copy, and the primary gold CTA with a small hover-nudge on the arrow.
 * Keeping this in one place is what keeps four very different slides from
 * each reading as a slightly different, slightly worse design.
 */
export function HeroSlideCopy({ eyebrow, heading, body, ctaLabel, ctaHref, active }: HeroSlideCopyProps) {
  const headingClass = cn(
    "font-serif text-[3rem] font-semibold leading-[1.02] tracking-tight text-white sm:text-[3.5rem] lg:text-[4rem] xl:text-[4.5rem]",
    eyebrow ? "mt-4" : "mt-0"
  );

  return (
    <div className="max-w-xl">
      {eyebrow && (
        <span className="inline-flex items-center rounded-full border border-gold-500/40 bg-gold-500/10 px-4 py-1.5 font-sans text-[12px] font-semibold uppercase tracking-[0.16em] text-gold-500">
          {eyebrow}
        </span>
      )}

      <h1 className={headingClass}>
        {heading}
      </h1>

      {body && (
        <p className="mt-4 max-w-lg font-sans text-[17px] leading-7 text-white/80 sm:text-[18px]">{body}</p>
      )}

      <Link
        to={ctaHref}
        tabIndex={active ? 0 : -1}
        className="group mt-6 inline-flex h-12 items-center gap-2.5 rounded-md bg-gold-500 px-6 font-sans text-[15px] font-semibold text-navy-900 transition-colors duration-150 hover:bg-gold-600"
      >
        {ctaLabel}
        <ArrowRight
          size={18}
          strokeWidth={2}
          aria-hidden="true"
          className="transition-transform duration-150 ease-out group-hover:translate-x-1"
        />
      </Link>
    </div>
  );
}
