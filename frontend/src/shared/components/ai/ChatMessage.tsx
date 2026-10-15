import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";
import { IconButton } from "../ui/IconButton";
import { Markdown } from "./Markdown";
import { PipAvatar } from "./PipAvatar";
import { TypingIndicator } from "./TypingIndicator";

/* One chat message bubble, used by the AI Tutor and the Teacher Copilot.
   - assistant: Pip avatar (or your own `avatar`), Markdown, copy button once the reply is done.
   - user: plain text (never parsed as Markdown), aligned right.
   Streaming: pass the text so far and `streaming`. While streaming the bubble only ever grows
   at the bottom, the copy button is not rendered (so nothing shifts when it finishes) and an
   empty reply shows the typing dots. Wrap messages in ChatThread for jitter-free scrolling. */

export interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  /** The assistant is still producing this message. */
  streaming?: boolean | undefined;
  /** Replaces the Pip avatar (for example another persona). */
  avatar?: ReactNode;
  /** Spoken label for assistant messages. Default "Pip". */
  assistantName?: string | undefined;
  /** Spoken label for user messages. Default "You". */
  userName?: string | undefined;
  /** Content under the bubble, for example an ActionCardDisplay. */
  children?: ReactNode;
  className?: string | undefined;
}

const COPIED_MS = 2000;

export function ChatMessage({
  role,
  content,
  streaming = false,
  avatar,
  assistantName = "Pip",
  userName = "You",
  children,
  className,
}: ChatMessageProps) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      setCopied(false);
      setCopyFailed(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopyFailed(false), COPIED_MS);
      return; // Keep the failure visible in the status announcement.
    }
    setCopied(true);
    setCopyFailed(false);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
  };

  const showCopy = !isUser && !streaming && content.trim() !== "";

  return (
    <article
      aria-busy={streaming || undefined}
      className={cn("flex items-end gap-3", isUser && "flex-row-reverse", className)}
    >
      {!isUser && (avatar ?? <PipAvatar />)}
      <div className={cn("flex min-w-0 max-w-[85%] flex-col gap-2", isUser && "items-end")}>
        <div
          className={cn(
            "min-w-0 max-w-full rounded-[20px] border-2 border-stroke px-4 py-3 text-stroke",
            isUser
              ? "rounded-br-[6px] bg-[var(--world-main,#ffb84d)] shadow-[0_3px_0_0_#000]"
              : "rounded-bl-[6px] bg-surface-0 shadow-[0_3px_0_0_#000]",
          )}
        >
          <span className="sr-only">{isUser ? `${userName}: ` : `${assistantName}: `}</span>
          {isUser ? (
            <p className="whitespace-pre-wrap text-[16px] leading-relaxed [overflow-wrap:anywhere]">
              {content}
            </p>
          ) : content === "" && streaming ? (
            <TypingIndicator label={`${assistantName} is thinking`} />
          ) : (
            <Markdown content={content} />
          )}
        </div>
        {children}
        {!isUser && (showCopy || streaming) && (
          <div className="flex items-center gap-1">
            {showCopy ? (
              <>
                <IconButton
                  variant="secondary"
                  size="sm"
                  sound={false}
                  aria-label={copied ? "Copied" : copyFailed ? "Copy failed" : "Copy message"}
                  onClick={() => void copy()}
                >
                  {copied ? (
                    <Check size={18} aria-hidden="true" />
                  ) : (
                    <Copy size={18} aria-hidden="true" />
                  )}
                </IconButton>
                <span role="status" className="sr-only">
                  {copied ? "Copied to clipboard" : copyFailed ? "Could not copy message" : ""}
                </span>
              </>
            ) : (
              <span aria-hidden="true" className="h-9 w-9" />
            )}
          </div>
        )}
      </div>
    </article>
  );
}
