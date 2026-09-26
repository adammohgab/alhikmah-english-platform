import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";
import logo from "@/shared/assets/logo.png";

const NAV_LINKS = [
  { label: "Courses", to: "/courses" },
  { label: "Practice", to: "/skills-practice" },
  { label: "Games", to: "/games" },
  { label: "Magazine", to: "/magazine" },
  { label: "AI Tutor", to: "/ai-tutor" },
];

interface NavbarProps {
  hidden: boolean;
  solid: boolean;
}

/**
 * Site navbar. Transparent over the hero, part of the hero — no heavy
 * background until the user scrolls past the hero. Hides on scroll-down,
 * slides back on scroll-up. Never appears/disappears abruptly.
 */
export function Navbar({ hidden, solid }: NavbarProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-transform duration-300 ease-out",
        hidden ? "-translate-y-full" : "translate-y-0",
      )}
    >
      <nav
        aria-label="Primary"
        className={cn(
          "transition-all duration-300 ease-out",
          solid
            ? "bg-navy-900/95 text-white shadow-elevation-1 backdrop-blur-sm"
            : "bg-transparent text-white",
        )}
      >
        <div className="mx-auto flex h-20 w-full max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center" aria-label="Al Hikmah Private School home">
            <img
              src={logo}
              alt="Al Hikmah Private School"
              className="h-11 w-auto sm:h-12"
              draggable={false}
            />
          </Link>

          <ul className="hidden items-center gap-7 lg:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <Link
                  to={link.to}
                  className="relative rounded-sm font-sans text-[15px] font-medium text-white/90 transition-colors duration-100 hover:text-gold-500 after:absolute after:bottom-[-2px] after:left-0 after:h-[2px] after:w-0 after:bg-gold-500 after:rounded-full after:transition-all after:duration-300 after:ease-out hover:after:w-full"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden items-center gap-3 lg:flex">
            <Link
              to="/login"
              className="relative rounded-sm font-sans text-[15px] font-medium text-white/90 transition-colors duration-100 hover:text-gold-500 after:absolute after:bottom-[-2px] after:left-0 after:h-[2px] after:w-0 after:bg-gold-500 after:rounded-full after:transition-all after:duration-300 after:ease-out hover:after:w-full"
            >
              Sign in
            </Link>
            <Link
              to="/"
              className="relative inline-flex min-h-[40px] items-center rounded-md border border-white/25 bg-white/10 px-4 font-sans text-[14px] font-semibold text-white transition-all duration-200 ease-out hover:bg-white hover:border-white hover:text-navy-900 hover:shadow-lg hover:shadow-gold-500/20"
            >
              <span className="relative z-10">Profile / Menu</span>
              <span className="absolute inset-0 bg-white rounded-md scale-x-0 origin-left transition-transform duration-200 ease-out group-hover:scale-x-100" aria-hidden="true" />
            </Link>
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-white lg:hidden transition-colors duration-100 hover:bg-white/10"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
          </button>
        </div>

        {open && (
          <div className="border-t border-white/10 bg-navy-900/98 px-4 pb-5 pt-3 lg:hidden">
            <ul className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    onClick={() => setOpen(false)}
                    className="relative block rounded-md px-3 py-2.5 font-sans text-[15px] font-medium text-white/90 hover:bg-white/10 hover:text-gold-500 before:absolute before:bottom-0 before:left-0 before:h-[2px] before:w-0 before:bg-gold-500 before:rounded-full before:transition-all before:duration-300 hover:before:w-full"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li className="mt-2 flex gap-2 px-3">
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="relative inline-flex min-h-[40px] flex-1 items-center justify-center rounded-md border border-white/25 font-sans text-[14px] font-semibold text-white hover:bg-white/10 hover:text-gold-500 transition-all duration-200"
                >
                  Sign in
                </Link>
                <Link
                  to="/"
                  onClick={() => setOpen(false)}
                  className="relative inline-flex min-h-[40px] flex-1 items-center justify-center rounded-md bg-gold-500 font-sans text-[14px] font-semibold text-navy-900 hover:bg-gold-600 hover:shadow-lg hover:shadow-gold-500/30 transition-all duration-200"
                >
                  Profile / Menu
                </Link>
              </li>
            </ul>
          </div>
        )}
      </nav>
    </header>
  );
}