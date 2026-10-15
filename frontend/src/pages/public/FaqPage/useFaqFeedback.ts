import { useCallback, useState } from "react";

/* "Did this answer your question?" votes. There is no feedback table in the backend yet, so a
   vote is remembered on this device only (to stop asking twice) and is not sent anywhere. */

export type FaqVote = "yes" | "no";

const STORAGE_KEY = "alhikmah.faq-feedback";

function read(): Record<string, FaqVote> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return {};
    const votes: Record<string, FaqVote> = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (value === "yes" || value === "no") votes[id] = value;
    }
    return votes;
  } catch {
    // Storage blocked or corrupt: start with no votes.
    return {};
  }
}

function write(votes: Record<string, FaqVote>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(votes));
  } catch {
    // Storage blocked or full: the vote still shows for this visit.
  }
}

export function useFaqFeedback() {
  const [votes, setVotes] = useState<Record<string, FaqVote>>(read);

  const vote = useCallback((id: string, value: FaqVote) => {
    setVotes((current) => {
      const next = { ...current, [id]: value };
      write(next);
      return next;
    });
  }, []);

  return { votes, vote };
}
