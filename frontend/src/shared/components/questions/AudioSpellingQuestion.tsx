import { useEffect, useId, useRef, useState } from "react";
import { Delete, Volume2 } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";
import {
  Explanation,
  FOCUS_RING,
  isLocked,
  matchesAny,
  PromptText,
  VERDICT_STYLE,
  Verdict,
  type QuestionProps,
} from "./shared";
import type { AudioSpellingQuestionData, AudioSpellingValue } from "./types";

/* Listen, then spell the word with letter tiles. Tap a tile in the bank to place it, tap a placed
   tile to send it back. Tiles are ids (not letters) so repeated letters work. The audio player is
   plain UI state; the URL is resolved by the page, so the component stays pure. */

const TILE =
  "grid h-12 min-w-12 place-items-center rounded-[12px] border-2 border-stroke px-2 text-[22px] font-bold uppercase text-stroke";

export function AudioSpellingQuestion({
  question,
  value,
  onChange,
  readOnly,
  showSolution,
  className,
}: QuestionProps<AudioSpellingQuestionData, AudioSpellingValue>) {
  const promptId = useId();
  const locked = isLocked({ readOnly, showSolution, onChange });
  const tiles = question.options.tiles;
  const tileIds = tiles.map((tile) => tile.id);
  const placed = (value?.tiles ?? []).filter(
    (id, i, all) => tileIds.includes(id) && all.indexOf(id) === i,
  );
  const letterOf = (id: string) => tiles.find((tile) => tile.id === id)?.text ?? "";
  const typed = placed.map(letterOf).join("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const { audioUrl } = question;

  useEffect(() => {
    setPlaying(false);
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [audioUrl]);

  const play = () => {
    if (!audioUrl) return;
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio(audioUrl);
      audio.addEventListener("ended", () => setPlaying(false));
      audio.addEventListener("pause", () => setPlaying(false));
      audioRef.current = audio;
    }
    audio.currentTime = 0;
    setPlaying(true);
    audio.play().catch(() => setPlaying(false));
  };

  const emit = (next: string[]) => onChange?.({ tiles: next });
  const key = question.answer;
  const graded = Boolean(showSolution) && key !== undefined;
  const correct = graded && matchesAny(typed, [key.word, ...(key.accepted ?? [])]);

  return (
    <div role="group" aria-labelledby={promptId} className={cn("flex flex-col gap-4", className)}>
      <PromptText id={promptId} prompt={question.prompt} />

      <div>
        <button
          type="button"
          disabled={!audioUrl}
          aria-label={playing ? "Playing audio" : "Play audio"}
          onClick={play}
          className={cn(
            "inline-flex h-11 items-center justify-center gap-2 rounded-[12px] border-2 border-stroke bg-surface-0 px-5 font-heading text-[15px] font-semibold leading-none text-stroke shadow-[2px_2px_0_0_var(--stroke,#1a1530)]",
            FOCUS_RING,
            "disabled:cursor-not-allowed disabled:border-dashed disabled:bg-surface-200 disabled:text-muted disabled:shadow-none",
          )}
        >
          <Volume2 size={20} aria-hidden="true" />
          <span>{playing ? "Playing…" : "Listen"}</span>
        </button>
        {!audioUrl && <p className="mt-2 text-[14px] text-muted">Audio is not available.</p>}
      </div>

      <div
        role="group"
        aria-label="Your spelling"
        className={cn(
          "flex min-h-[64px] flex-wrap items-center gap-2 rounded-[16px] border-2 px-3 py-2",
          graded
            ? correct
              ? VERDICT_STYLE.correct
              : VERDICT_STYLE.wrong
            : "border-dashed border-stroke bg-surface-0",
        )}
      >
        {placed.length === 0 && (
          <span className="text-[14px] text-muted">Tap the letters to spell the word.</span>
        )}
        {placed.map((id) => (
          <button
            key={id}
            type="button"
            disabled={locked}
            aria-label={`Remove letter ${letterOf(id)}`}
            onClick={() => emit(placed.filter((entry) => entry !== id))}
            className={cn(
              TILE,
              "bg-[var(--world-main,#ffb84d)] shadow-[0_3px_0_0_#000]",
              FOCUS_RING,
            )}
          >
            {letterOf(id)}
          </button>
        ))}
        {!locked && placed.length > 0 && (
          <button
            type="button"
            aria-label="Remove last letter"
            onClick={() => emit(placed.slice(0, -1))}
            className={cn(
              "ml-auto grid h-10 w-10 place-items-center rounded-full border-2 border-stroke bg-surface-0",
              FOCUS_RING,
            )}
          >
            <Delete size={20} aria-hidden="true" />
          </button>
        )}
      </div>

      <div role="group" aria-label="Letters" className="flex flex-wrap gap-2">
        {tiles.map((tile) => {
          const used = placed.includes(tile.id);
          return (
            <button
              key={tile.id}
              type="button"
              disabled={locked || used}
              aria-label={`Letter ${tile.text}`}
              onClick={() => emit([...placed, tile.id])}
              className={cn(
                TILE,
                used
                  ? "border-dashed bg-surface-200 text-muted"
                  : "bg-[var(--world-soft,#ffd93d)] shadow-[0_3px_0_0_#000] active:translate-y-[3px] active:shadow-none",
                FOCUS_RING,
              )}
            >
              {tile.text}
            </button>
          );
        })}
      </div>

      {graded && (
        <div className="flex flex-col gap-1 text-[15px] text-stroke">
          <Verdict correct={correct}>{correct ? "Correct" : "Incorrect"}</Verdict>
          {!correct && (
            <p>
              Correct spelling: <strong>{key.word}</strong>
            </p>
          )}
        </div>
      )}
      {showSolution && <Explanation text={question.explanation} />}
    </div>
  );
}
