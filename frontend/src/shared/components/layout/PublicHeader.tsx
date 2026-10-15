import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import logo from "@/shared/assets/logo.png";
import { getRoleHomePath } from "@/app/guards/guard-utils";
import { useAuth } from "@/app/providers/auth-context";
import { Button } from "@/shared/components/ui/Button";
import { IconButton } from "@/shared/components/ui/IconButton";
import { cn } from "@/shared/lib/utils/cn";

/* ========================================
   PublicHeader (SHARED-SPEC §4 SH-00, §2 public-page rules)

   A layout piece for the public pages. It does NOT wrap an <Outlet />: the page layout that
   uses it renders the header, then its own <main id="main-content">, then <PublicFooter />.

   - Sticky 64px bar with a subtle backdrop blur (plain surface where blur is unsupported).
   - Skip link is the first focusable element and jumps to `#${mainId}`.
   - Desktop (>= 768px): logo, About / Curriculum / FAQ / Contact, and the primary button.
   - Mobile: a menu button opens a slide-out drawer with the same links and a large button.
     The drawer traps focus, closes on Escape, backdrop click or navigation, locks page
     scroll while open and returns focus to the menu button when dismissed.
   - The primary button reads "Open my dashboard" when someone is already signed in.
   - The logo is shown unchanged at h-8: the bar leaves 16px (half the logo height) of clear
     space above and below it, on a plain light surface (spec §2 logo rule).
   - The drawer is rendered next to the header, not inside it: `backdrop-filter` would turn
     the header into the containing block of a fixed child and shrink the drawer to 64px.
   ======================================== */

interface PublicNavLink {
  id: string;
  label: string;
  to: string;
}

const NAV_LINKS: readonly PublicNavLink[] = [
  { id: "about", label: "About", to: "/about" },
  { id: "curriculum", label: "Curriculum", to: "/#curriculum" },
  { id: "faq", label: "FAQ", to: "/faq" },
  { id: "contact", label: "Contact", to: "/help" },
];

export interface PublicHeaderProps {
  /** `id` of the page's <main> element, the target of the skip link. Default `main-content`. */
  mainId?: string | undefined;
  className?: string | undefined;
}

function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => {
        list.removeEventListener("change", onChange);
      };
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")).filter(
    (element) => element.closest("[aria-hidden='true']") === null,
  );
}

function isLinkActive(link: PublicNavLink, pathname: string): boolean {
  // Hash links point inside a page, so they never mark a "current page".
  return !link.to.includes("#") && pathname === link.to;
}

export function PublicHeader({ mainId = "main-content", className }: PublicHeaderProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const drawerId = useId();

  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const drawerOpen = open && !isDesktop;
  const homePath = isAuthenticated && user !== null ? getRoleHomePath(user.role) : null;
  const ctaLabel = homePath === null ? "Sign in" : "Open my dashboard";

  useEffect(() => {
    if (isDesktop) setOpen(false);
  }, [isDesktop]);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  const dismiss = useCallback(() => {
    setOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  const handleCta = () => {
    setOpen(false);
    void navigate(homePath ?? "/login");
  };

  const handleDrawerKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      dismiss();
      return;
    }
    if (event.key !== "Tab" || panelRef.current === null) return;
    const focusable = getFocusable(panelRef.current);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (first === undefined || last === undefined) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const logoLink = (
    <Link
      to="/"
      aria-label="Al Hikmah Private School, home page"
      className="flex shrink-0 items-center rounded-[8px] bg-surface-0"
    >
      <img src={logo} alt="" width={147} height={32} className="h-8 w-auto" />
    </Link>
  );

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 h-16 border-b-2 border-stroke bg-surface-0 supports-[backdrop-filter]:bg-surface-0/80 supports-[backdrop-filter]:backdrop-blur-md",
          className,
        )}
      >
        <a
          href={`#${mainId}`}
          className="sr-only font-body text-[14px] font-bold focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-[10px] focus:border-2 focus:border-stroke focus:bg-surface-0 focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <div className="mx-auto flex h-full w-full max-w-[1200px] items-center gap-6 px-4 sm:px-6">
          {logoLink}
          {isDesktop ? (
            <>
              <nav aria-label="Main" className="flex flex-1 items-center justify-center gap-1">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.id}
                    to={link.to}
                    aria-current={isLinkActive(link, pathname) ? "page" : undefined}
                    className={cn(
                      "rounded-[10px] border-2 px-3 py-1.5 font-body text-[15px] font-semibold",
                      isLinkActive(link, pathname)
                        ? "border-stroke bg-[var(--world-soft,#ffd93d)] text-stroke"
                        : "border-transparent text-muted hover:bg-surface-200 hover:text-stroke",
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
              <Button loading={isLoading} onClick={handleCta}>
                {ctaLabel}
              </Button>
            </>
          ) : (
            <IconButton
              ref={menuButtonRef}
              aria-label="Open menu"
              aria-expanded={drawerOpen}
              aria-controls={drawerId}
              variant="secondary"
              className="ml-auto"
              onClick={() => {
                setOpen(true);
              }}
            >
              <Menu className="h-5 w-5" />
            </IconButton>
          )}
        </div>
      </header>

      {!isDesktop && (
        <div
          id={drawerId}
          aria-hidden={!drawerOpen}
          className={cn(
            "fixed inset-0 z-50",
            // Opening shows it at once (so focus can move in); closing keeps it visible for the slide-out.
            drawerOpen ? "visible" : "invisible transition-[visibility] duration-200",
          )}
        >
          <div
            aria-hidden="true"
            onClick={dismiss}
            className={cn(
              "absolute inset-0 bg-stroke/40 transition-opacity duration-200",
              drawerOpen ? "opacity-100" : "opacity-0",
            )}
          />
          {/* The dialog key handler traps focus within the navigation drawer. */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Main menu"
            tabIndex={-1}
            onKeyDown={handleDrawerKeyDown}
            className={cn(
              "absolute inset-y-0 right-0 flex w-[min(88vw,360px)] flex-col border-l-2 border-stroke bg-surface-0 transition-transform duration-200",
              drawerOpen ? "translate-x-0" : "translate-x-full",
            )}
          >
            <div className="flex h-16 shrink-0 items-center justify-between gap-4 border-b-2 border-stroke px-4">
              {logoLink}
              <IconButton
                ref={closeButtonRef}
                aria-label="Close menu"
                variant="secondary"
                onClick={dismiss}
              >
                <X className="h-5 w-5" />
              </IconButton>
            </div>
            <nav aria-label="Main menu" className="min-h-0 flex-1 overflow-y-auto p-4">
              <ul className="space-y-1">
                {NAV_LINKS.map((link) => (
                  <li key={link.id}>
                    <Link
                      to={link.to}
                      onClick={() => {
                        setOpen(false);
                      }}
                      aria-current={isLinkActive(link, pathname) ? "page" : undefined}
                      className={cn(
                        "flex h-12 items-center rounded-[12px] border-2 px-4 font-heading text-[20px] font-semibold",
                        isLinkActive(link, pathname)
                          ? "border-stroke bg-[var(--world-soft,#ffd93d)] text-stroke"
                          : "border-transparent text-stroke hover:bg-surface-200",
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="shrink-0 space-y-3 border-t-2 border-stroke p-4">
              <Button size="lg" loading={isLoading} onClick={handleCta} className="w-full">
                {ctaLabel}
              </Button>
              <p className="text-center font-body text-[13px] font-medium text-muted">
                Accounts are created by your school.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
