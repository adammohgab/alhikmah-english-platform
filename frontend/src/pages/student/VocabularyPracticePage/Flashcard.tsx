import { Volume2 } from "lucide-react";
import { IconButton } from "@/shared/components/ui/IconButton";
import { canSpeak, speakWord } from "./speech";
import type { LibraryWord } from "./rules";

/* 3D flip flashcard (ST-15). Front: the word, part of speech, CEFR level and pronunciation text.
   Back: the Arabic meaning (right to left, only this text), the English meaning and an example.
   The card is one button, so click, Enter and Space flip it; the audio button sits beside it
   (a button cannot nest inside a button). Only the visible face is exposed to assistive tech, and
   a polite live region reads the face that was just revealed. The turn is a CSS transition, which
   the global reduced-motion rule in base.css turns into an instant swap. */

export interface FlashcardProps {
  word: LibraryWord;
  flipped: boolean;
  onFlip: () => void;
}

const FACE =
  "absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[20px] border-2 border-stroke bg-surface-0 p-6 text-center shadow-retro-sm [backface-visibility:hidden] [-webkit-backface-visibility:hidden]";

export function Flashcard({ word, flipped, onFlip }: FlashcardProps) {
  return (
    <div className="relative [perspective:1200px]">
      <button
        type="button"
        onClick={onFlip}
        aria-pressed={flipped}
        aria-label="Flip card"
        className="relative block h-[320px] w-full rounded-[20px] outline-none focus-visible:ring-2 focus-visible:ring-stroke focus-visible:ring-offset-2 sm:h-[360px]"
      >
        <span
          className="absolute inset-0 block transition-transform duration-500 ease-out [transform-style:preserve-3d]"
          style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
        >
          <span className={FACE} aria-hidden={flipped} data-face="front">
            <span className="font-display text-[40px] leading-tight text-stroke sm:text-[48px]">
              {word.word}
            </span>
            <span className="flex flex-wrap items-center justify-center gap-2 font-body text-[15px] text-muted">
              {word.partOfSpeech !== null && <span className="italic">{word.partOfSpeech}</span>}
              {word.level !== null && (
                <span className="rounded-full border-2 border-stroke bg-[var(--world-soft,#ffd93d)] px-2 text-[13px] font-bold text-stroke">
                  {word.level}
                </span>
              )}
            </span>
            {word.pronunciation !== null && (
              <span className="font-body text-[15px] text-muted">{word.pronunciation}</span>
            )}
            <span className="mt-2 font-body text-[13px] text-muted">
              Tap the card or press Space to flip
            </span>
          </span>

          <span
            className={`${FACE} [transform:rotateY(180deg)]`}
            aria-hidden={!flipped}
            data-face="back"
          >
            {word.arabicMeaning !== null && word.arabicMeaning !== "" && (
              <span
                dir="rtl"
                lang="ar"
                className="font-display text-[34px] leading-snug text-stroke"
              >
                {word.arabicMeaning}
              </span>
            )}
            <span className="font-body text-[18px] font-semibold text-stroke">{word.meaning}</span>
            {word.example !== null && word.example !== "" && (
              <span className="font-body text-[16px] italic text-muted">“{word.example}”</span>
            )}
          </span>
        </span>
      </button>

      {canSpeak() && (
        <IconButton
          variant="secondary"
          size="sm"
          aria-label={`Pronounce ${word.word}`}
          className="absolute right-3 top-3 z-10"
          onClick={() => speakWord(word.word)}
        >
          <Volume2 aria-hidden="true" size={18} />
        </IconButton>
      )}

      <p className="sr-only" aria-live="polite">
        {flipped
          ? `${word.word}. ${word.arabicMeaning ?? ""} ${word.meaning}. ${word.example ?? ""}`
          : `${word.word}${word.partOfSpeech !== null ? `, ${word.partOfSpeech}` : ""}${
              word.level !== null ? `, level ${word.level}` : ""
            }`}
      </p>
    </div>
  );
}
