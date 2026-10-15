import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Mic, MicOff, Send, Square } from "lucide-react";
import { cn } from "@/shared/lib/utils/cn";
import { Chip } from "../ui/Chip";
import { IconButton } from "../ui/IconButton";

/* Composer for the AI Tutor and the Teacher Copilot.
   - Auto-expanding textarea (grows to ~6 lines, then scrolls). Enter sends, Shift+Enter adds a
     line, and Enter while an IME is composing never sends.
   - Send button (becomes Stop while a reply streams and `onStop` is given).
   - Suggested prompt chips. Choosing one calls `onSuggestionSelect`, or fills the textarea and
     focuses it when that is not provided.
   - Voice trigger: pure UI. The page owns speech recognition and passes `listening` and `onToggle`.
   Focus: after sending or choosing a suggestion, focus is returned to the textarea, so a
   keyboard or screen reader user never lands on a button that just went disabled. */

const MAX_HEIGHT_PX = 160;

export interface ChatInputVoice {
  listening: boolean;
  onToggle: () => void;
}

export interface ChatInputProps {
  onSend: (text: string) => void;
  /** Controlled draft. Leave out to let the component keep it. */
  value?: string | undefined;
  onValueChange?: ((value: string) => void) | undefined;
  /** A reply is streaming: sending is blocked and the send button becomes Stop. */
  streaming?: boolean | undefined;
  onStop?: (() => void) | undefined;
  /** Blocks all input (for example when the daily limit is reached). */
  disabled?: boolean | undefined;
  placeholder?: string | undefined;
  /** Accessible name of the textarea. Default "Message". */
  label?: string | undefined;
  suggestions?: readonly string[] | undefined;
  onSuggestionSelect?: ((suggestion: string) => void) | undefined;
  voice?: ChatInputVoice | undefined;
  className?: string | undefined;
}

export function ChatInput({
  onSend,
  value,
  onValueChange,
  streaming = false,
  onStop,
  disabled = false,
  placeholder = "Type your message…",
  label = "Message",
  suggestions,
  onSuggestionSelect,
  voice,
  className,
}: ChatInputProps) {
  const hintId = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState("");
  const text = value ?? draft;
  const setText = (next: string) => {
    if (value === undefined) setDraft(next);
    onValueChange?.(next);
  };

  // Grow with the content up to MAX_HEIGHT_PX.
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT_PX ? "auto" : "hidden";
  }, [text]);

  const canSend = !disabled && !streaming && text.trim() !== "";

  const submit = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText("");
    field.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };

  const choose = (suggestion: string) => {
    if (onSuggestionSelect) onSuggestionSelect(suggestion);
    else setText(suggestion);
    field.current?.focus();
  };

  const stopping = streaming && onStop !== undefined;

  return (
    <form
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        submit();
      }}
      className={cn("flex flex-col gap-3", className)}
    >
      {suggestions && suggestions.length > 0 && (
        <div role="group" aria-label="Suggested prompts" className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <Chip
              key={suggestion}
              size="md"
              disabled={disabled || streaming}
              onClick={() => choose(suggestion)}
            >
              {suggestion}
            </Chip>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 rounded-[20px] border-2 border-stroke bg-surface-0 p-2 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-stroke">
        {voice && (
          <IconButton
            type="button"
            variant={voice.listening ? "danger" : "ghost"}
            aria-label={voice.listening ? "Stop voice input" : "Start voice input"}
            aria-pressed={voice.listening}
            disabled={disabled}
            onClick={voice.onToggle}
          >
            {voice.listening ? (
              <MicOff size={20} aria-hidden="true" />
            ) : (
              <Mic size={20} aria-hidden="true" />
            )}
          </IconButton>
        )}

        <textarea
          ref={field}
          value={text}
          rows={1}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={label}
          aria-describedby={hintId}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          className="min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 font-body text-[16px] leading-snug text-stroke outline-none placeholder:text-muted disabled:cursor-not-allowed"
        />

        {stopping ? (
          <IconButton
            type="button"
            variant="secondary"
            aria-label="Stop generating"
            onClick={onStop}
          >
            <Square size={18} aria-hidden="true" />
          </IconButton>
        ) : (
          <IconButton type="submit" variant="primary" aria-label="Send message" disabled={!canSend}>
            <Send size={20} aria-hidden="true" />
          </IconButton>
        )}
      </div>

      <span id={hintId} className="sr-only">
        Press Enter to send, Shift plus Enter for a new line.
      </span>
      <span role="status" className="sr-only">
        {voice?.listening ? "Listening" : ""}
      </span>
    </form>
  );
}
