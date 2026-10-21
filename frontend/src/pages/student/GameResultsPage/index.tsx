import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import confetti from "canvas-confetti";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Coins,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  Star,
  Trophy,
  Zap,
} from "lucide-react";
import { useAuth } from "@/app/providers/auth-context";
import { recordGameResult, type RecordedGameResult } from "./api";
import { formatDuration, formatGameName, gameResultInputSchema, mergeResultState } from "./rules";

const RESULT_STORAGE_KEY = "student-game-last-result";
const inFlightRequests = new Map<string, Promise<RecordedGameResult>>();

type SubmissionState =
  | { status: "loading" }
  | { status: "success"; result: RecordedGameResult }
  | { status: "error"; message: string };

function readStoredResult(): unknown {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(RESULT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function removeStoredResult(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(RESULT_STORAGE_KEY);
  } catch {
    // Navigation state remains available when session storage is blocked.
  }
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

export default function GameResultsPage() {
  const { gameSlug = "" } = useParams<{ gameSlug: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const reducedMotion = usePrefersReducedMotion();
  const [displayedScore, setDisplayedScore] = useState(0);
  const [submission, setSubmission] = useState<SubmissionState>({ status: "loading" });
  const [retryCount, setRetryCount] = useState(0);
  const resultInput = useMemo(
    () => gameResultInputSchema.safeParse(mergeResultState(readStoredResult(), location.state)),
    [location.state],
  );
  const result = resultInput.success ? resultInput.data : null;
  const requestKey = result
    ? `${gameSlug}:${user?.id ?? "anonymous"}:${JSON.stringify(result)}:${retryCount}`
    : "";
  const formattedGameName = formatGameName(gameSlug);
  const gameName = result?.gameName ?? (formattedGameName || "Arcade Game");

  useEffect(() => {
    if (!result) {
      setSubmission({
        status: "error",
        message: "Your completed round could not be found. Return to the arcade and start a game.",
      });
      return;
    }
    if (!gameSlug) {
      setSubmission({
        status: "error",
        message: "This game result is missing a game ID. Return to the arcade and try again.",
      });
      return;
    }
    if (!user?.id) {
      setSubmission({
        status: "error",
        message: "Your session has ended. Please sign in again to save this result.",
      });
      return;
    }
    let active = true;
    setSubmission({ status: "loading" });
    let request = inFlightRequests.get(requestKey);
    if (!request) {
      request = recordGameResult(gameSlug, user.id, result);
      inFlightRequests.set(requestKey, request);
      const requestToRemove = request;
      void requestToRemove.then(
        () => {
          if (inFlightRequests.get(requestKey) === requestToRemove) {
            inFlightRequests.delete(requestKey);
          }
        },
        () => {
          if (inFlightRequests.get(requestKey) === requestToRemove) {
            inFlightRequests.delete(requestKey);
          }
        },
      );
    }
    void request
      .then((recorded) => {
        if (!active) return;
        removeStoredResult();
        setSubmission({ status: "success", result: recorded });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setSubmission({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Could not save this game result. Please try again.",
        });
      });

    return () => {
      active = false;
    };
  }, [gameSlug, requestKey, result, user?.id]);

  useEffect(() => {
    if (!result) {
      setDisplayedScore(0);
      return;
    }
    if (reducedMotion) {
      setDisplayedScore(result.score);
      return;
    }

    const start = performance.now();
    const animationDuration = 1050;
    let frame = 0;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - start) / animationDuration);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplayedScore(Math.round(result.score * eased));
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [reducedMotion, result]);

  const isNewHighScore =
    submission.status === "success" && submission.result.score > submission.result.previousBest;
  const displayedGameName =
    submission.status === "success" ? submission.result.gameTitle : gameName;

  useEffect(() => {
    if (!isNewHighScore || reducedMotion) return;
    void confetti({
      particleCount: 110,
      spread: 76,
      origin: { y: 0.58 },
      colors: ["#ffd23f", "#ff5a4f", "#4db8ff", "#d26bff"],
    });
  }, [isNewHighScore, reducedMotion]);

  const retrySubmission = useCallback(() => {
    setRetryCount((count) => count + 1);
  }, []);

  const playAgain = () => navigate(`/student/games/${encodeURIComponent(gameSlug)}/play`);
  const backToArcade = () => navigate("/student/games");

  return (
    <main
      data-world="coral"
      className="min-h-screen bg-world-coral-50 px-4 py-8 text-stroke sm:px-6"
    >
      <div className="mx-auto max-w-4xl">
        <Link
          to="/student/games"
          className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-stroke bg-surface-0 px-4 font-heading font-bold shadow-retro-sm transition-transform hover:-translate-y-0.5 hover:shadow-retro-md focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#a3150c] motion-reduce:transition-none"
        >
          <ArrowLeft size={18} aria-hidden="true" /> Back to Arcade
        </Link>

        <section
          aria-labelledby="results-title"
          className="relative overflow-hidden rounded-[28px] border-2 border-stroke bg-surface-0 p-5 text-center shadow-retro-lg sm:p-8"
        >
          <div aria-hidden="true" className="absolute right-5 top-5 -rotate-6 text-world-coral-700">
            <Sparkles size={34} strokeWidth={2.5} />
          </div>
          <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-[24px] border-2 border-stroke bg-world-amber-300 shadow-retro-md">
            <Trophy size={42} aria-hidden="true" />
          </div>
          <p className="font-heading text-sm font-bold uppercase tracking-[0.2em] text-world-coral-700">
            Round complete
          </p>
          <h1 id="results-title" className="mt-2 font-heading text-3xl font-bold sm:text-5xl">
            {displayedGameName} Results
          </h1>
          <p className="mt-2 text-muted">Every round is a chance to level up your skills.</p>

          {isNewHighScore && (
            <div
              role="status"
              className="mx-auto mt-6 inline-flex -rotate-2 items-center gap-2 rounded-[12px] border-2 border-stroke bg-world-amber-300 px-4 py-2 font-heading font-bold uppercase shadow-retro-sm"
            >
              <Sparkles size={18} aria-hidden="true" /> New High Score!
              <Sparkles size={18} aria-hidden="true" />
            </div>
          )}

          <div className="mx-auto mt-7 max-w-2xl rounded-[24px] border-2 border-stroke bg-world-coral-100 px-4 py-6 shadow-retro-md sm:px-8">
            <p className="font-heading text-sm font-bold uppercase tracking-[0.2em] text-muted">
              Final score
            </p>
            <div className="mt-1 flex items-center justify-center gap-2 tabular-nums">
              <span
                aria-label={`Final score ${formatCount(result?.score ?? 0)}`}
                aria-live="polite"
                aria-atomic="true"
                className="font-heading text-6xl font-bold sm:text-8xl"
              >
                {formatCount(displayedScore)}
              </span>
              <Zap className="mt-3 text-world-amber-700" size={28} aria-hidden="true" />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-left sm:grid-cols-4">
              <div className="rounded-[14px] border-2 border-stroke bg-surface-0 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Correct</p>
                <p className="mt-1 text-xl font-bold">
                  {result?.correctAnswers !== undefined && result.totalQuestions !== undefined
                    ? `${result.correctAnswers}/${result.totalQuestions}`
                    : "—"}
                </p>
              </div>
              <div className="rounded-[14px] border-2 border-stroke bg-surface-0 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Accuracy</p>
                <p className="mt-1 text-xl font-bold">{Math.round(result?.accuracy ?? 0)}%</p>
              </div>
              <div className="rounded-[14px] border-2 border-stroke bg-surface-0 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Time played</p>
                <p className="mt-1 text-xl font-bold">
                  {formatDuration(result?.durationSeconds ?? 0)}
                </p>
              </div>
              <div className="rounded-[14px] border-2 border-stroke bg-surface-0 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Best combo</p>
                <p className="mt-1 text-xl font-bold">{result?.bestCombo ?? "—"}</p>
              </div>
            </div>
          </div>

          {result?.missedItems && result.missedItems.length > 0 && (
            <section
              aria-labelledby="missed-items-title"
              className="mx-auto mt-5 max-w-2xl rounded-[20px] border-2 border-stroke bg-world-amber-100 p-4 text-left shadow-retro-sm"
            >
              <h2 id="missed-items-title" className="font-heading text-xl font-bold">
                Review these answers
              </h2>
              <ul className="mt-3 space-y-2">
                {result.missedItems.map((item, index) => (
                  <li
                    key={`${item.prompt}-${index}`}
                    className="rounded-[12px] border-2 border-stroke bg-surface-0 p-3"
                  >
                    <p className="font-semibold">{item.prompt}</p>
                    <p className="mt-1 text-sm text-muted">
                      Correct answer: <strong className="text-stroke">{item.correctAnswer}</strong>
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {submission.status === "success" && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[18px] border-2 border-stroke bg-world-amber-100 p-4 shadow-retro-sm">
                <Coins className="mx-auto text-world-amber-700" size={25} aria-hidden="true" />
                <p className="mt-2 text-xs font-bold uppercase tracking-wide text-muted">
                  Coins earned
                </p>
                <p className="mt-1 font-heading text-2xl font-bold">
                  +{submission.result.coinsAwarded}
                </p>
              </div>
              <div className="rounded-[18px] border-2 border-stroke bg-world-violet-100 p-4 shadow-retro-sm">
                <Star className="mx-auto text-world-violet-700" size={25} aria-hidden="true" />
                <p className="mt-2 text-xs font-bold uppercase tracking-wide text-muted">
                  XP earned
                </p>
                <p className="mt-1 font-heading text-2xl font-bold">
                  +{submission.result.xpAwarded}
                </p>
              </div>
              <div className="rounded-[18px] border-2 border-stroke bg-world-coral-100 p-4 shadow-retro-sm sm:col-span-2">
                <Award className="mx-auto text-world-coral-700" size={25} aria-hidden="true" />
                <p className="mt-2 text-xs font-bold uppercase tracking-wide text-muted">
                  Personal best
                </p>
                <p className="mt-1 font-heading text-2xl font-bold">
                  {formatCount(Math.max(submission.result.previousBest, submission.result.score))}
                </p>
              </div>
            </div>
          )}

          {submission.status === "loading" && (
            <p className="mt-5 inline-flex items-center gap-2 font-semibold" role="status">
              <LoaderCircle
                className="animate-spin motion-reduce:animate-none"
                size={18}
                aria-hidden="true"
              />
              Saving your score and rewards…
            </p>
          )}
          {submission.status === "success" && (
            <p
              className="mt-5 inline-flex items-center gap-2 font-semibold text-[#0b6b45]"
              role="status"
            >
              <CheckCircle2 size={18} aria-hidden="true" /> Score saved and rewards added to your
              account.
            </p>
          )}
          {submission.status === "error" && (
            <div
              className="mx-auto mt-5 max-w-xl rounded-[16px] border-2 border-stroke bg-world-coral-100 p-4 text-left"
              role="alert"
            >
              <p className="font-heading font-bold">We couldn’t save your rewards.</p>
              <p className="mt-1 text-sm">{submission.message}</p>
              {result && gameSlug && user?.id && (
                <button
                  type="button"
                  onClick={retrySubmission}
                  className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-stroke bg-world-coral-300 px-4 font-heading font-bold shadow-retro-sm focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#a3150c]"
                >
                  <RotateCcw size={16} aria-hidden="true" /> Try saving again
                </button>
              )}
            </div>
          )}

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={playAgain}
              disabled={!gameSlug}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-stroke bg-world-coral-300 px-6 font-heading font-bold shadow-retro-md transition-transform hover:-translate-y-0.5 hover:shadow-retro-lg focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#a3150c] active:translate-y-0 active:shadow-retro-sm disabled:opacity-50 motion-reduce:transition-none"
            >
              <RotateCcw size={18} aria-hidden="true" /> Play Again
            </button>
            <button
              type="button"
              onClick={backToArcade}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-stroke bg-surface-0 px-6 font-heading font-bold shadow-retro-sm transition-transform hover:-translate-y-0.5 hover:shadow-retro-md focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#a3150c] motion-reduce:transition-none"
            >
              <ArrowLeft size={18} aria-hidden="true" /> Change game
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
