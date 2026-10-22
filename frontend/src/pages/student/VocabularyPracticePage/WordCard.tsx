import { useState } from "react";
import { Star, Volume2 } from "lucide-react";
import { IconButton } from "@/shared/components/ui/IconButton";
import { canSpeak, speakWord } from "./speech";
import { MASTERY_LABEL, type Mastery } from "./rules";

/* One word in the library list or in a lesson group (ST-15 "Word card"): word, part of speech,
   pronunciation text, play button, meaning, example, and the Arabic meaning on tap (only that text
   is right to left). In the library it also shows the mastery level and a star toggle. */

export interface WordCardProps {
  word: string;
  partOfSpeech: string | null;
  pronunciation: string | null;
  meaning: string;
  arabicMeaning: string | null;
  example: string | null;
  level: string | null;
  /** Library words only. */
  mastery?: Mastery | undefined;
  starred?: boolean | undefined;
  onToggleStar?: (() => void) | undefined;
}

const MASTERY_STYLE: Record<Mastery, string> = {
  new: "bg-surface-0",
  learning: "bg-[var(--world-soft,#ffd93d)]",
  mastered: "bg-[var(--world-main,#ffb84d)]",
};

export function WordCard({
  word,
  partOfSpeech,
  pronunciation,
  meaning,
  arabicMeaning,
  example,
  level,
  mastery,
  starred,
  onToggleStar,
}: WordCardProps) {
  const [showArabic, setShowArabic] = useState(false);
  const hasArabic = arabicMeaning !== null && arabicMeaning !== "";

  return (
    <article className="flex flex-col gap-2 rounded-[16px] border-2 border-stroke bg-surface-0 p-4 shadow-retro-sm">
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[22px] leading-tight text-stroke">{word}</h3>
          <p className="flex flex-wrap items-center gap-x-2 font-body text-[14px] text-muted">
            {partOfSpeech !== null && <span className="italic">{partOfSpeech}</span>}
            {pronunciation !== null && <span>{pronunciation}</span>}
            {level !== null && (
              <span className="rounded-full border-2 border-stroke px-1.5 text-[12px] font-bold text-stroke">{level}</span>
            )}
          </p>
        </div>
        {canSpeak() && (
          <IconButton variant="ghost" size="sm" aria-label={`Pronounce ${word}`} onClick={() => speakWord(word)}>
            <Volume2 aria-hidden="true" size={18} />
          </IconButton>
        )}
        {onToggleStar !== undefined && (
          <IconButton
            variant="ghost"
            size="sm"
            aria-label={starred === true ? `Remove ${word} from starred` : `Star ${word}`}
            aria-pressed={starred === true}
            onClick={onToggleStar}
          >
            <Star aria-hidden="true" size={18} fill={starred === true ? "currentColor" : "none"} />
          </IconButton>
        )}
      </header>

      <p className="font-body text-[16px] text-stroke">{meaning}</p>
      {example !== null && example !== "" && <p className="font-body text-[15px] italic text-muted">“{example}”</p>}

      <footer className="mt-1 flex flex-wrap items-center gap-2">
        {hasArabic && (
          <button
            type="button"
            aria-expanded={showArabic}
            onClick={() => setShowArabic((open) => !open)}
            className="rounded-full border-2 border-stroke px-3 py-0.5 font-body text-[13px] font-bold text-stroke outline-none focus-visible:ring-2 focus-visible:ring-stroke focus-visible:ring-offset-2"
          >
            {showArabic ? "Hide Arabic" : "Show Arabic"}
          </button>
        )}
        {hasArabic && showArabic && (
          <span dir="rtl" lang="ar" className="font-display text-[20px] text-stroke">
            {arabicMeaning}
          </span>
        )}
        {mastery !== undefined && (
          <span
            className={`ml-auto rounded-full border-2 border-stroke px-2 text-[12px] font-bold text-stroke ${MASTERY_STYLE[mastery]}`}
          >
            {MASTERY_LABEL[mastery]}
          </span>
        )}
      </footer>
    </article>
  );
}
