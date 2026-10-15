import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { getRoleHomePath } from "@/app/guards/guard-utils";
import { useAuth } from "@/app/providers/auth-context";
import { PipAvatar } from "@/shared/components/ai/PipAvatar";
import { Button } from "@/shared/components/ui/Button";
import { useSound } from "@/shared/hooks/useSound";
import "./notFound.css";

/* ========================================
   NotFoundPage: SH-10 "Not found (404)" (SHARED-SPEC §5)

   ErrorPageTemplate layout: a motif (Pip the owl, puzzled, holding a map), the title
   "We could not find that page.", one sentence, and the way back:
   - signed in:  "Go to my dashboard" (primary) + "Return to home" (secondary)
   - signed out: "Return to the home page" (primary)
   - "Go back" (ghost) when the browser has history to return to.

   Easter egg (PUB-12): pressing Pip three times in a row plays a celebration sound and
   pops a few coins that bounce once. The count resets after a pause, so only a quick
   triple press counts. Sound goes through `useSound`, which already honors the mute
   preference and the rate limit. Motion follows reduced motion and the low effects tier
   (see notFound.css).
   ======================================== */

const PLATFORM_NAME = "Wordland";
const PAGE_TITLE = `Page not found | ${PLATFORM_NAME}`;

/** Presses further apart than this start a new count. */
const CLICK_WINDOW_MS = 1800;
const CLICKS_NEEDED = 3;
/** How long the coins stay mounted: the longest delay plus the 1.5s animation. */
const COIN_SHOW_MS = 2200;

interface CoinSpec {
  id: number;
  dx: number;
  rise: number;
  delay: number;
}

const COINS: readonly CoinSpec[] = [
  { id: 0, dx: -96, rise: 120, delay: 0 },
  { id: 1, dx: -44, rise: 150, delay: 90 },
  { id: 2, dx: 8, rise: 170, delay: 40 },
  { id: 3, dx: 58, rise: 140, delay: 140 },
  { id: 4, dx: 104, rise: 110, delay: 70 },
];

function Coin() {
  return (
    <svg viewBox="0 0 28 28" width={28} height={28} aria-hidden="true" focusable="false">
      <circle cx="14" cy="14" r="11.5" fill="#FFD93D" stroke="#1A1530" strokeWidth="2.5" />
      <circle cx="14" cy="14" r="6.5" fill="none" stroke="#1A1530" strokeWidth="2" opacity="0.55" />
      <path d="M14 10.5 V17.5" stroke="#1A1530" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** A folded paper map with a dashed trail that ends nowhere. Pip holds it. */
function ConfusedMap() {
  return (
    <svg
      viewBox="0 0 96 76"
      width={96}
      height={76}
      aria-hidden="true"
      focusable="false"
      className="absolute -bottom-2 -right-8 -rotate-6"
    >
      <path
        d="M6 14 L32 8 L64 16 L90 10 L90 62 L64 68 L32 60 L6 66 Z"
        fill="#FFF1E3"
        stroke="#1A1530"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M32 8 V60 M64 16 V68" stroke="#1A1530" strokeWidth="2" opacity="0.35" />
      <path
        d="M14 52 C 24 30, 40 52, 48 36 S 60 24, 70 34"
        fill="none"
        stroke="#F2566A"
        strokeWidth="2.5"
        strokeDasharray="5 5"
        strokeLinecap="round"
      />
      <path
        d="M72 30 L82 40 M82 30 L72 40"
        stroke="#F2566A"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function QuestionMarks() {
  return (
    <>
      <span
        aria-hidden="true"
        className="absolute -left-6 top-2 -rotate-12 font-heading text-[40px] font-bold leading-none text-world-violet-600"
      >
        ?
      </span>
      <span
        aria-hidden="true"
        className="absolute -right-4 -top-4 rotate-12 font-heading text-[28px] font-bold leading-none text-world-rose-600"
      >
        ?
      </span>
    </>
  );
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

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { play } = useSound();

  useDocumentTitle(PAGE_TITLE);

  const [coinsVisible, setCoinsVisible] = useState(false);
  const [hopKey, setHopKey] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  const clicksRef = useRef(0);
  const lastClickRef = useRef(0);
  const coinTimerRef = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(coinTimerRef.current);
    },
    [],
  );

  const handlePipPress = useCallback(() => {
    const now = Date.now();
    clicksRef.current = now - lastClickRef.current > CLICK_WINDOW_MS ? 1 : clicksRef.current + 1;
    lastClickRef.current = now;
    setHopKey((key) => key + 1);

    if (clicksRef.current < CLICKS_NEEDED) {
      play("pop");
      return;
    }

    clicksRef.current = 0;
    play("success");
    setAnnouncement("Pip found some coins!");
    setCoinsVisible(true);
    window.clearTimeout(coinTimerRef.current);
    coinTimerRef.current = window.setTimeout(() => {
      setCoinsVisible(false);
      setAnnouncement("");
    }, COIN_SHOW_MS);
  }, [play]);

  const signedIn = isAuthenticated && user !== null;
  const homePath = signedIn ? getRoleHomePath(user.role) : "/";
  const canGoBack = typeof window !== "undefined" && window.history.length > 1;

  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center bg-surface-100 px-6 py-16 text-center"
    >
      <div className="relative mb-8 h-[220px] w-[220px]">
        <button
          type="button"
          onClick={handlePipPress}
          aria-label="Pip the owl looks lost. Press three times for a surprise."
          className="relative flex h-full w-full items-center justify-center rounded-full"
        >
          <span
            key={hopKey}
            className={hopKey > 0 ? "nf-pip-hop inline-block -rotate-6" : "inline-block -rotate-6"}
          >
            <PipAvatar size={180} />
          </span>
        </button>
        <ConfusedMap />
        <QuestionMarks />
        {coinsVisible &&
          COINS.map((coin) => (
            <span
              key={coin.id}
              className="nf-coin"
              style={
                {
                  "--nf-dx": `${coin.dx}px`,
                  "--nf-rise": `${coin.rise}px`,
                  "--nf-delay": `${coin.delay}ms`,
                } as CSSProperties
              }
            >
              <Coin />
            </span>
          ))}
      </div>

      <p className="font-accent text-[28px] leading-none text-world-rose-600" aria-hidden="true">
        404
      </p>
      <h1 className="mt-2 max-w-xl font-heading text-[32px] font-bold leading-tight text-stroke md:text-[44px]">
        We could not find that page.
      </h1>
      <p className="mt-3 max-w-md text-[16px] leading-snug text-muted">
        The link may be wrong or the page may have moved.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        {signedIn ? (
          <>
            <Button size="lg" onClick={() => void navigate(homePath, { replace: true })}>
              Go to my dashboard
            </Button>
            <Button size="lg" variant="secondary" onClick={() => void navigate("/")}>
              Return to home
            </Button>
          </>
        ) : (
          <Button size="lg" onClick={() => void navigate("/", { replace: true })}>
            Return to the home page
          </Button>
        )}
        {canGoBack && (
          <Button size="lg" variant="ghost" onClick={() => void navigate(-1)}>
            Go back
          </Button>
        )}
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </main>
  );
}

export { NotFoundPage };
