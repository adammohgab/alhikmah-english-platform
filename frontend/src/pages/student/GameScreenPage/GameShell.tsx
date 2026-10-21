import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Clock3, Pause, Volume2, VolumeX } from "lucide-react";
import PauseOverlay from "./PauseOverlay";

export interface GameShellProps {
  gameName: string;
  children: ReactNode;
  /** Round duration in seconds. Omit or pass null for an untimed round. */
  durationSeconds?: number | null;
  /** Current score from the game play area. */
  score?: number;
  /** Number of consecutive correct answers. */
  comboStreak?: number;
  /** Called when the player confirms exiting the game. */
  onExit: () => void;
  /** Optional callback when the round timer reaches zero. */
  onTimeUp?: () => void;
  /** Receives whether the shell is paused or in its intro countdown. */
  onGameStateChange?: (state: "countdown" | "playing" | "paused" | "finished") => void;
  /** Set false to start paused instead of showing the intro countdown. */
  autoStart?: boolean;
}

type GameState = "countdown" | "playing" | "paused" | "finished";

function formatTime(totalSeconds: number) {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

/** Small synthesized arcade tones; no audio files or extra dependencies required. */
function playArcadeTone(muted: boolean, notes: number[] = [523, 659, 784]) {
  if (muted || typeof window === "undefined") return;
  const AudioContextClass =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    const context = new AudioContextClass();
    const startAt = context.currentTime;
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = startAt + index * 0.13;
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.14);
    });
    window.setTimeout(() => void context.close(), notes.length * 140 + 250);
  } catch (error) {
    // Audio is an enhancement; browser/device audio restrictions must not block gameplay.
    console.warn("Arcade sound could not be played.", error);
  }
}

export function GameShell({
  gameName,
  children,
  durationSeconds = 60,
  score = 0,
  comboStreak = 0,
  onExit,
  onTimeUp,
  onGameStateChange,
  autoStart = true,
}: GameShellProps) {
  const [gameState, setGameState] = useState<GameState>(autoStart ? "countdown" : "paused");
  const [countdown, setCountdown] = useState(autoStart ? 3 : 0);
  const [remainingSeconds, setRemainingSeconds] = useState(durationSeconds ?? 0);
  const [muted, setMuted] = useState(true);
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const stayButtonRef = useRef<HTMLButtonElement>(null);
  const countdownSounded = useRef<number | null>(null);
  const timeUpCalled = useRef(false);
  const onGameStateChangeRef = useRef(onGameStateChange);

  const changeState = useCallback((next: GameState) => {
    setGameState(next);
  }, []);

  useEffect(() => {
    onGameStateChangeRef.current = onGameStateChange;
  }, [onGameStateChange]);

  useEffect(() => {
    onGameStateChangeRef.current?.(gameState);
  }, [gameState]);

  useEffect(() => {
    const gameArea = gameAreaRef.current;
    if (!gameArea) return;
    gameArea.toggleAttribute("inert", gameState !== "playing");
  }, [gameState]);

  useEffect(() => {
    if (showExitConfirmation) stayButtonRef.current?.focus();
  }, [showExitConfirmation]);

  useEffect(() => {
    if (gameState !== "countdown") return;
    if (countdown <= 0) {
      const timeout = window.setTimeout(() => {
        changeState("playing");
        playArcadeTone(muted, [659, 784, 1047, 1319]);
      }, 650);
      return () => window.clearTimeout(timeout);
    }
    if (countdownSounded.current !== countdown) {
      countdownSounded.current = countdown;
      playArcadeTone(muted, [countdown === 1 ? 784 : 523]);
    }
    const timeout = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timeout);
  }, [changeState, countdown, gameState, muted]);

  useEffect(() => {
    if (gameState !== "playing" || durationSeconds == null) return;
    const interval = window.setInterval(() => {
      setRemainingSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [durationSeconds, gameState]);

  useEffect(() => {
    if (gameState !== "playing" || durationSeconds == null || remainingSeconds > 0) return;
    if (timeUpCalled.current) return;
    timeUpCalled.current = true;
    changeState("finished");
    onTimeUp?.();
  }, [changeState, durationSeconds, gameState, onTimeUp, remainingSeconds]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest('input, textarea, select, [contenteditable="true"]'))
      ) {
        return;
      }
      if (event.key.toLowerCase() === "p" && gameState === "playing") changeState("paused");
      if (event.key.toLowerCase() === "p" && gameState === "paused") changeState("playing");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [changeState, gameState]);

  const resumeGame = useCallback(() => changeState("playing"), [changeState]);

  const exitGame = () => {
    setShowExitConfirmation(false);
    onExit();
  };

  const progress =
    durationSeconds == null || durationSeconds <= 0
      ? 100
      : Math.max(0, Math.min(100, (remainingSeconds / durationSeconds) * 100));
  const multiplier = comboStreak >= 10 ? 3 : comboStreak >= 5 ? 2 : comboStreak >= 2 ? 1.5 : 1;

  return (
    <main className="min-h-[70vh] bg-[#FFF7D6] p-3 text-[#1A1530] sm:p-5">
      <section className="relative mx-auto flex min-h-[70vh] max-w-6xl flex-col overflow-hidden border-2 border-[#1A1530] bg-white shadow-[6px_6px_0_#1A1530]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#1A1530] bg-[#B9F27C] px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setShowExitConfirmation(true)}
              aria-label="Exit game"
              className="grid h-10 w-10 shrink-0 place-items-center border-2 border-[#1A1530] bg-white shadow-[2px_2px_0_#1A1530] hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#315D13]"
            >
              <ArrowLeft size={19} aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em]">Arcade round</p>
              <h1 className="truncate text-xl font-black sm:text-2xl">{gameName}</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="border-2 border-[#1A1530] bg-white px-3 py-2 shadow-[2px_2px_0_#1A1530]"
              aria-label={`Current score: ${score}`}
            >
              <span className="mr-2 text-[10px] font-black uppercase tracking-wide text-[#4A4566]">
                Score
              </span>
              <span className="text-lg font-black tabular-nums">
                {Math.max(0, score).toLocaleString()}
              </span>
            </div>
            <div
              className="border-2 border-[#1A1530] bg-[#FFE27A] px-3 py-2 shadow-[2px_2px_0_#1A1530]"
              aria-label={`Combo streak ${comboStreak}, multiplier ${multiplier} times`}
            >
              <span className="mr-2 text-[10px] font-black uppercase tracking-wide">Combo</span>
              <span className="text-lg font-black">{comboStreak}×</span>
              <span className="ml-1 text-xs font-black">({multiplier}x)</span>
            </div>
            {durationSeconds != null && (
              <div
                className={`flex items-center gap-2 border-2 border-[#1A1530] px-3 py-2 shadow-[2px_2px_0_#1A1530] ${remainingSeconds <= 10 ? "bg-[#FFD8D8]" : "bg-white"}`}
                aria-live="off"
                aria-label={`Time remaining ${formatTime(remainingSeconds)}`}
              >
                <Clock3 size={17} aria-hidden="true" />
                <span className="text-lg font-black tabular-nums">
                  {formatTime(remainingSeconds)}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setMuted((value) => !value)}
              aria-label={muted ? "Turn sound on" : "Mute sound"}
              aria-pressed={!muted}
              className="grid h-11 w-11 place-items-center border-2 border-[#1A1530] bg-white shadow-[2px_2px_0_#1A1530] hover:bg-[#F3F0FF] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#5B4ACB]"
            >
              {muted ? (
                <VolumeX size={19} aria-hidden="true" />
              ) : (
                <Volume2 size={19} aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={() => changeState("paused")}
              disabled={gameState !== "playing"}
              className="inline-flex min-h-11 items-center gap-2 border-2 border-[#1A1530] bg-[#FFE27A] px-3 font-black shadow-[2px_2px_0_#1A1530] hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#8A6500] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Pause size={17} aria-hidden="true" /> Pause
            </button>
          </div>
        </header>

        {durationSeconds != null && (
          <div
            className="h-2 border-b border-[#1A1530] bg-[#F3F0FF]"
            role="progressbar"
            aria-label="Round time remaining"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
          >
            <div
              className="h-full bg-[#5B4ACB] transition-[width] duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <div className="relative flex flex-1 flex-col">
          <div
            ref={gameAreaRef}
            className={`flex-1 p-4 sm:p-6 ${gameState !== "playing" ? "pointer-events-none select-none" : ""}`}
            aria-hidden={gameState !== "playing"}
          >
            {children}
          </div>

          {gameState === "countdown" && (
            <div
              className="absolute inset-0 z-20 grid place-items-center bg-[#FFF7D6]/95"
              role="status"
              aria-live="assertive"
            >
              <div key={countdown} className="text-center">
                <p className="mb-2 text-sm font-black uppercase tracking-[0.25em]">Get ready!</p>
                <div className="countdown-pop mx-auto grid h-40 w-40 place-items-center border-4 border-[#1A1530] bg-[#FFE27A] text-8xl font-black shadow-[8px_8px_0_#1A1530] sm:h-52 sm:w-52 sm:text-9xl">
                  {countdown > 0 ? countdown : "GO!"}
                </div>
              </div>
            </div>
          )}

          {gameState === "paused" && (
            <PauseOverlay
              gameName={gameName}
              muted={muted}
              onResume={resumeGame}
              onExit={() => setShowExitConfirmation(true)}
              onToggleMute={() => setMuted((value) => !value)}
            />
          )}

          {gameState === "finished" && (
            <div
              className="absolute inset-0 z-20 grid place-items-center bg-[#FFF7D6]/95 p-5"
              role="status"
            >
              <div className="max-w-sm text-center">
                <p className="mb-2 text-sm font-black uppercase tracking-[0.2em]">Round complete</p>
                <h2 className="text-5xl font-black">Time’s up!</h2>
                <p className="my-3 text-[#4A4566]">
                  Final score:{" "}
                  <strong className="text-[#1A1530]">{Math.max(0, score).toLocaleString()}</strong>
                </p>
                <button
                  type="button"
                  onClick={onExit}
                  className="mt-2 min-h-12 border-2 border-[#1A1530] bg-[#B9F27C] px-6 font-black shadow-[3px_3px_0_#1A1530] hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#315D13]"
                >
                  View results
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {showExitConfirmation && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#14112A]/80 p-4">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="exit-game-title"
            aria-describedby="exit-game-description"
            className="w-full max-w-sm border-2 border-[#1A1530] bg-white p-6 text-[#1A1530] shadow-[6px_6px_0_#0B0919]"
          >
            <h2 id="exit-game-title" className="text-2xl font-black">
              Leave this round?
            </h2>
            <p id="exit-game-description" className="my-3 text-sm text-[#4A4566]">
              Your current round may not be saved. Are you sure you want to exit?
            </p>
            <div className="flex flex-wrap justify-end gap-3">
              <button
                ref={stayButtonRef}
                type="button"
                onClick={() => setShowExitConfirmation(false)}
                className="min-h-11 border-2 border-[#1A1530] bg-white px-4 font-bold focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={exitGame}
                className="min-h-11 border-2 border-[#1A1530] bg-[#FFD8D8] px-4 font-black shadow-[2px_2px_0_#1A1530] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2"
              >
                Exit game
              </button>
            </div>
          </section>
        </div>
      )}

      <style>{`
        @keyframes countdown-pop {
          0% { transform: scale(.55) rotate(-8deg); opacity: .25; }
          65% { transform: scale(1.08) rotate(3deg); opacity: 1; }
          100% { transform: scale(1) rotate(0); }
        }
        .countdown-pop { animation: countdown-pop 650ms cubic-bezier(.2,.8,.2,1) both; }
        @media (prefers-reduced-motion: reduce) { .countdown-pop { animation: none; } }
      `}</style>
    </main>
  );
}

export default GameShell;
