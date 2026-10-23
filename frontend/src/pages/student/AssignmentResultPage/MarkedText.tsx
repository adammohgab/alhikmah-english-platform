import { useMemo } from "react";
import { Tooltip } from "@/shared/components/ui/Tooltip";
import type { InlineComment } from "./api";

/* Read-only student text with the teacher's inline comments highlighted. A comment is placed by
   its character range when it has one, otherwise by the first occurrence of its quoted text.
   Comments that cannot be placed are listed under the text so none are lost. Each highlight is a
   button, so the comment opens on hover, keyboard focus and tap. */

interface Placed {
  comment: InlineComment;
  start: number;
  end: number;
}

function place(text: string, comments: readonly InlineComment[]): Placed[] {
  const placed: Placed[] = [];
  for (const comment of comments) {
    let start = comment.start ?? -1;
    let end = comment.end ?? -1;
    if (!(start >= 0 && end > start && end <= text.length) && comment.quote) {
      start = text.indexOf(comment.quote);
      end = start >= 0 ? start + comment.quote.length : -1;
    }
    if (start >= 0 && end > start && end <= text.length) placed.push({ comment, start, end });
  }
  placed.sort((a, b) => a.start - b.start);
  // Overlapping ranges: keep the earlier one.
  const clean: Placed[] = [];
  for (const item of placed) {
    const last = clean[clean.length - 1];
    if (!last || item.start >= last.end) clean.push(item);
  }
  return clean;
}

export function MarkedText({
  text,
  comments,
}: {
  text: string;
  comments: readonly InlineComment[];
}) {
  const { placed, loose } = useMemo(() => {
    const placed = place(text, comments);
    const used = new Set(placed.map((item) => item.comment));
    return { placed, loose: comments.filter((item) => !used.has(item)) };
  }, [text, comments]);

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  placed.forEach((item, index) => {
    if (item.start > cursor) parts.push(text.slice(cursor, item.start));
    parts.push(
      <Tooltip key={`${item.start}-${index}`}>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            className="rounded bg-world-amber-300 px-0.5 underline decoration-2 underline-offset-2"
          >
            {text.slice(item.start, item.end)}
            <span className="sr-only"> (teacher comment: {item.comment.body})</span>
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content>
          {item.comment.author && <p className="font-bold">{item.comment.author}</p>}
          <p>{item.comment.body}</p>
          <Tooltip.Arrow />
        </Tooltip.Content>
      </Tooltip>,
    );
    cursor = item.end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));

  return (
    <Tooltip.Provider>
      <p className="whitespace-pre-wrap text-base leading-relaxed">{parts}</p>
      {loose.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 text-sm">
          {loose.map((item, index) => (
            <li key={item.id ?? index} className="rounded-xl bg-surface-100 p-2">
              {item.quote && <q className="font-semibold">{item.quote}</q>} {item.body}
            </li>
          ))}
        </ul>
      )}
    </Tooltip.Provider>
  );
}
