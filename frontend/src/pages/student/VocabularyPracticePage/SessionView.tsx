import { useCallback, useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/shared/components/ui/Button";
import { ProgressBar } from "@/shared/components/ui/ProgressBar";
import { useToast } from "@/shared/hooks/useToast";
import { reviewWord, type ReviewOutcome } from "./api";
import { Flashcard } from "./Flashcard";
import { RATINGS, isFinished, rate, startSession, type LibraryWord, type Rating, type SessionState } from "./rules";

/* Flashcard practice set (ST-15). The student flips the card (click or Space), then rates it with
   one of three buttons, or with keys 1, 2 and 3. Each rating is saved with `review_word` before
   the next card appears; if saving fails the card stays so nothing is lost. "Need Practice"
   brings the card back once at the end. The set ends with a summary. */

export interface SessionViewProps {
  words: readonly LibraryWord[];
  onExit: () => void;
  /** Called with every saved review so the library list can show the new mastery. */
  onReviewed: (wordId: string, outcome: ReviewOutcome) => void;
}

function isInteractive(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest("button, a, input, textarea, select, [role='tab'], [contenteditable='true']") !== null
  );
}

export function SessionView({ words, onExit, onReviewed }: SessionViewProps) {
  const toast = useToast();
  const [state, setState] = useState<SessionState>(() => startSession(words));
  const [flipped, setFlipped] = useState(false);

  const current = state.queue[state.index];
  const finished = isFinished(state);

  const review = useMutation({
    mutationFn: ({ word, rating }: { word: LibraryWord; rating: Rating }) => {
      const option = RATINGS.find((item) => item.id === rating);
      return reviewWord(word.id, option?.correct ?? false);
    },
    onSuccess: (outcome, { word, rating }) => {
      onReviewed(word.id, outcome);
      setState((previous) => rate(previous, rating));
      setFlipped(false);
    },
    onError: (error: Error) =>
      toast.show({ title: "Could not save your answer", description: error.message, type: "error" }),
  });

  const submit = useCallback(
    (rating: Rating) => {
      if (current === undefined || !flipped || review.isPending) return;
      review.mutate({ word: current, rating });
    },
    [current, flipped, review],
  );

  /* Space flips from anywhere on the page except on a focused control (a focused card button
     already flips natively); 1, 2, 3 rate a revealed card. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (finished || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === " " && !isInteractive(event.target)) {
        event.preventDefault();
        setFlipped((open) => !open);
        return;
      }
      const option = RATINGS.find((item) => item.key === event.key);
      if (option !== undefined && !isInteractive(event.target)) submit(option.id);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [finished, submit]);

  if (finished) {
    const total = state.tally.need_practice + state.tally.almost + state.tally.mastered;
    return (
      <section aria-labelledby="vocab-result" className="mx-auto flex w-full max-w-xl flex-col gap-4 text-center">
        <h2 id="vocab-result" className="font-display text-[28px] text-stroke">
          Set complete
        </h2>
        <p className="font-body text-[16px] text-muted">
          You reviewed {total} {total === 1 ? "card" : "cards"}.
        </p>
        <dl className="grid grid-cols-3 gap-3">
          {RATINGS.map((option) => (
            <div key={option.id} className="rounded-[14px] border-2 border-stroke bg-surface-0 p-3 shadow-retro-sm">
              <dt className="font-body text-[13px] text-muted">{option.label}</dt>
              <dd className="font-display text-[28px] text-stroke">{state.tally[option.id]}</dd>
            </div>
          ))}
        </dl>
        <div className="flex justify-center">
          <Button onClick={onExit}>Back to my words</Button>
        </div>
      </section>
    );
  }

  if (current === undefined) return null;

  return (
    <section aria-label="Flashcard practice" className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onExit}>
          <ArrowLeft aria-hidden="true" size={16} /> Exit
        </Button>
        <ProgressBar
          className="flex-1"
          value={state.index}
          max={state.queue.length}
          label="Practice progress"
          valueText={`Card ${state.index + 1} of ${state.queue.length}`}
        />
        <span className="font-body text-[14px] tabular-nums text-muted">
          {state.index + 1}/{state.queue.length}
        </span>
      </div>

      <Flashcard word={current} flipped={flipped} onFlip={() => setFlipped((open) => !open)} />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label="How well did you know it?">
        {RATINGS.map((option) => (
          <Button
            key={option.id}
            variant={option.id === "mastered" ? "success" : option.id === "need_practice" ? "danger" : "secondary"}
            disabled={!flipped}
            loading={review.isPending && review.variables?.rating === option.id}
            onClick={() => submit(option.id)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      <p className="text-center font-body text-[13px] text-muted">
        {flipped ? "Rate it with the buttons or keys 1, 2 and 3." : "Flip the card to see the meaning, then rate it."}
      </p>
    </section>
  );
}
