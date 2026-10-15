import { memo, type ReactNode } from "react";

/* A small, safe Markdown renderer for chat. It builds React elements (never HTML strings), so
   model output cannot inject markup. Links are limited to http(s) and mailto.

   Supported: paragraphs, line breaks, # headings (rendered as bold lines), bullet and numbered
   lists, > quotes, fenced code blocks, `code`, **bold**, *italic*, [links](url).

   Streaming-safe: incomplete syntax (an unclosed ** or a code fence still being written) stays
   plain text or an open code block until it completes, so partial tokens do not flash odd
   markup. Output is a pure function of `content`, and the component is memoized. */

const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\[[^\]\n]+\]\([^)\s]+\))|(\*[^*\s][^*\n]*\*)/g;

function safeHref(url: string): string | null {
  return /^(https?:\/\/|mailto:)/i.test(url) ? url : null;
}

function renderInline(text: string, depth = 0): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    const token = match[0];
    if (index > last) nodes.push(text.slice(last, index));
    if (match[1]) {
      nodes.push(
        <code
          key={key++}
          className="rounded-[6px] border border-stroke bg-surface-200 px-1 py-0.5 text-[0.9em]"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (match[2]) {
      const inner = token.slice(2, -2);
      nodes.push(<strong key={key++}>{depth < 2 ? renderInline(inner, depth + 1) : inner}</strong>);
    } else if (match[3]) {
      const parts = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      const label = parts?.[1] ?? token;
      const href = parts?.[2] ? safeHref(parts[2]) : null;
      nodes.push(
        href ? (
          <a
            key={key++}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline underline-offset-2"
          >
            {label}
          </a>
        ) : (
          label
        ),
      );
    } else {
      nodes.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
    last = index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

type Block =
  | { kind: "p" | "quote"; lines: string[] }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "h" | "code"; text: string };

const BULLET = /^\s*[-*]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;
const HEADING = /^#{1,6}\s+(.*)$/;
const QUOTE = /^>\s?/;

function startsBlock(line: string): boolean {
  return (
    line.startsWith("```") ||
    BULLET.test(line) ||
    NUMBERED.test(line) ||
    HEADING.test(line) ||
    QUOTE.test(line)
  );
}

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.startsWith("```")) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? "").startsWith("```")) {
        body.push(lines[i] ?? "");
        i += 1;
      }
      i += 1; // closing fence (absent while still streaming)
      blocks.push({ kind: "code", text: body.join("\n") });
    } else if (line.trim() === "") {
      i += 1;
    } else if (HEADING.test(line)) {
      blocks.push({ kind: "h", text: HEADING.exec(line)?.[1] ?? "" });
      i += 1;
    } else if (BULLET.test(line) || NUMBERED.test(line)) {
      const ordered = NUMBERED.test(line);
      const pattern = ordered ? NUMBERED : BULLET;
      const items: string[] = [];
      while (i < lines.length && pattern.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(pattern, ""));
        i += 1;
      }
      blocks.push({ kind: ordered ? "ol" : "ul", items });
    } else if (QUOTE.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i] ?? "")) {
        quoted.push((lines[i] ?? "").replace(QUOTE, ""));
        i += 1;
      }
      blocks.push({ kind: "quote", lines: quoted });
    } else {
      const para: string[] = [];
      while (i < lines.length && (lines[i] ?? "").trim() !== "" && !startsBlock(lines[i] ?? "")) {
        para.push(lines[i] ?? "");
        i += 1;
      }
      blocks.push({ kind: "p", lines: para });
    }
  }
  return blocks;
}

function renderLines(lines: string[]): ReactNode[] {
  return lines.flatMap((line, index) => [
    index > 0 ? <br key={`br-${index}`} /> : null,
    ...renderInline(line),
  ]);
}

export const Markdown = memo(function Markdown({ content }: { content: string }) {
  return (
    <div className="flex flex-col gap-2 text-[16px] leading-relaxed [overflow-wrap:anywhere]">
      {parseBlocks(content).map((block, index) => {
        switch (block.kind) {
          case "code":
            return (
              <pre
                key={index}
                className="overflow-x-auto rounded-[12px] border-2 border-stroke bg-surface-200 p-3 text-[14px] leading-snug"
              >
                <code>{block.text}</code>
              </pre>
            );
          case "h":
            return (
              <p key={index} className="font-heading text-[17px] font-bold">
                {renderInline(block.text)}
              </p>
            );
          case "ul":
            return (
              <ul key={index} className="list-disc pl-5">
                {block.items.map((item, i) => (
                  <li key={i}>{renderInline(item)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={index} className="list-decimal pl-5">
                {block.items.map((item, i) => (
                  <li key={i}>{renderInline(item)}</li>
                ))}
              </ol>
            );
          case "quote":
            return (
              <blockquote key={index} className="border-l-4 border-stroke pl-3 text-muted">
                {renderLines(block.lines)}
              </blockquote>
            );
          default:
            return <p key={index}>{renderLines(block.lines)}</p>;
        }
      })}
    </div>
  );
});
