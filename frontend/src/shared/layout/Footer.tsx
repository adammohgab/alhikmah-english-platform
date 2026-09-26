import { Link } from "react-router-dom";

const PRIMARY_LINKS = [
  "Courses",
  "Lessons",
  "Practice",
  "Tests",
  "Assignments",
  "AI Tutor",
  "Games",
  "Magazine",
];

const SECONDARY_LINKS = ["Support", "Privacy", "Terms"];

/** Minimal site footer. No visual complexity. */
export function Footer() {
  return (
    <footer className="bg-navy-900 text-white">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
        <p className="font-serif text-lg font-semibold tracking-wide">ENGLISH PLATFORM</p>
        <nav aria-label="Footer" className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          {PRIMARY_LINKS.map((label) => (
            <Link
              key={label}
              to="/"
              className="font-sans text-[13px] text-white/70 transition-colors duration-100 hover:text-white"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 pt-4">
          {SECONDARY_LINKS.map((label) => (
            <Link
              key={label}
              to="/"
              className="font-sans text-[13px] text-white/60 transition-colors duration-100 hover:text-white"
            >
              {label}
            </Link>
          ))}
          <span className="ms-auto font-sans text-[13px] text-white/50">© 2026 School</span>
        </div>
      </div>
    </footer>
  );
}
