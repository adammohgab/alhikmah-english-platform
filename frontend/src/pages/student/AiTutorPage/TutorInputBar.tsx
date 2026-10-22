import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Brain, Lightbulb, Mic, MicOff, Send, Sparkles } from "lucide-react";

export interface TutorInputBarProps {
  /** Called when the learner sends a message or chooses a suggestion. */
  onSend: (message: string) => void;
  /** Number of AI interactions the learner can still send today. */
  remainingMessages?: number | undefined;
  /** Daily allowance used to describe the quota to the learner. */
  dailyMessageLimit?: number | undefined;
  /** Backwards-compatible quota prop used by the existing AI Tutor page. */
  remaining?: number | undefined;
  /** Optional lesson or conversation context for tailored suggestions. */
  contextTitle?: string | undefined;
  placeholder?: string | undefined;
  /** Disable while the tutor is processing a previous message. */
  isSending?: boolean | undefined;
  /** Disable input while a parent action is unavailable. */
  disabled?: boolean | undefined;
  /** Override the browser speech recognition language, e.g. en-GB. */
  speechLanguage?: string | undefined;
  className?: string | undefined;
}

const DEFAULT_SUGGESTIONS = [
  { label: "Explain this rule", icon: Lightbulb },
  { label: "Give me an example", icon: Sparkles },
  { label: "Test my knowledge", icon: Brain },
] as const;

interface SpeechResult {
  transcript: string;
}

<<<<<<< HEAD
interface SpeechEvent {
  results: ArrayLike<ArrayLike<SpeechResult>>;
}
=======
  useEffect(() => {
    const hasSpeechRecognition =
      typeof window !== "undefined" &&
      (!!(window as typeof window & { SpeechRecognition?: unknown }).SpeechRecognition ||
        !!(window as typeof window & { webkitSpeechRecognition?: unknown })
          .webkitSpeechRecognition);
    setSpeechReady(hasSpeechRecognition);
  }, []);
>>>>>>> 396e3f56b4bb9fc3d6568f7fba82333a823da2b2

interface SpeechErrorEvent {
  error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

/** Input controls for the student AI Tutor. Quota values are supplied by the caller. */
export function TutorInputBar({
  onSend,
  remainingMessages,
  dailyMessageLimit,
  remaining: legacyRemaining,
  contextTitle,
  placeholder = "Ask Pip anything about English…",
  isSending = false,
  disabled = false,
  speechLanguage = "en-GB",
  className = "",
}: TutorInputBarProps) {
  const [message, setMessage] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const dailyLimitValue = dailyMessageLimit ?? 12;
  const remainingValue = remainingMessages ?? legacyRemaining ?? dailyLimitValue;
  const remaining = Number.isFinite(remainingValue) ? Math.max(0, remainingValue) : 0;
  const dailyLimit = Number.isFinite(dailyLimitValue) ? Math.max(0, dailyLimitValue) : 0;
  const quotaReached = remaining <= 0;
  const inputDisabled = quotaReached || isSending || disabled;

  useEffect(
    () => () => {
      const recognition = recognitionRef.current;
      if (!recognition) return;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.stop();
      recognitionRef.current = null;
    },
    [],
  );

  const sendMessage = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || inputDisabled) return;
    onSend(trimmed);
    setMessage("");
    setVoiceError(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sendMessage(message);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(message);
    }
  };

  const toggleVoiceInput = () => {
    setVoiceError(null);
    if (isListening) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setIsListening(false);
      return;
    }
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setVoiceError(
        "Voice typing is not available in this browser. You can type your question instead.",
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = speechLanguage;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (transcript)
        setMessage((current) => `${current}${current.trim() ? " " : ""}${transcript}`);
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      recognitionRef.current = null;
      setVoiceError(
        event.error === "not-allowed"
          ? "Microphone access is blocked. Allow microphone access in your browser settings, or type your question."
          : "We couldn’t hear that clearly. Please try again or type your question.",
      );
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognitionRef.current = null;
      setIsListening(false);
      setVoiceError("The microphone couldn’t start. Please try again or type your question.");
    }
  };

  return (
    <section className={`w-full space-y-3 ${className}`} aria-label="AI Tutor message input">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-stroke">
          <span className="bg-world-soft flex h-7 w-7 items-center justify-center rounded-lg border-2 border-stroke">
            <Sparkles size={15} aria-hidden="true" />
          </span>
          <span>{contextTitle ? `Ask Pip about ${contextTitle}` : "Need a little help?"}</span>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full border-2 border-stroke px-3 py-1 text-xs font-extrabold ${quotaReached ? "bg-[#FFE0DF] text-stroke" : "bg-surface text-stroke"}`}
          aria-live="polite"
          aria-label={`${remaining} of ${dailyLimit} AI messages remaining today`}
        >
<<<<<<< HEAD
          {remaining} / {dailyLimit} messages left today
        </span>
=======
          {listening ? (
            <VolumeX size={16} aria-hidden="true" />
          ) : (
            <Volume2 size={16} aria-hidden="true" />
          )}
          {listening ? "Listening" : "Audio"}
        </Button>
>>>>>>> 396e3f56b4bb9fc3d6568f7fba82333a823da2b2
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Suggested prompts">
        {DEFAULT_SUGGESTIONS.map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            disabled={inputDisabled}
            onClick={() => sendMessage(label)}
            className="bg-surface inline-flex min-h-9 items-center gap-2 rounded-full border-2 border-stroke px-3 py-1.5 text-sm font-bold text-stroke shadow-[2px_2px_0px_var(--color-stroke)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            <Icon size={15} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-surface rounded-2xl border-2 border-stroke p-2 shadow-[3px_3px_0px_var(--color-stroke)]"
      >
        <label htmlFor="tutor-message" className="sr-only">
          Your message to Pip
        </label>
        <textarea
          id="tutor-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={quotaReached ? "Your daily message limit has been reached" : placeholder}
          disabled={inputDisabled}
          rows={2}
          maxLength={4000}
          className="w-full resize-y border-0 bg-transparent px-2 py-2 text-sm text-stroke outline-none placeholder:text-muted focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <div className="flex items-center justify-between gap-2 border-t-2 border-dashed border-stroke/20 pt-2">
          <button
            type="button"
            onClick={toggleVoiceInput}
            disabled={inputDisabled}
            aria-pressed={isListening}
            aria-label={isListening ? "Stop voice input" : "Start voice input"}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-stroke text-stroke transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${isListening ? "bg-[#FFE0DF]" : "bg-world-soft hover:bg-world-main"}`}
          >
            {isListening ? (
              <MicOff size={18} aria-hidden="true" />
            ) : (
              <Mic size={18} aria-hidden="true" />
            )}
          </button>
          <button
            type="submit"
            disabled={inputDisabled || !message.trim()}
            className="bg-world-main inline-flex min-h-10 items-center gap-2 rounded-xl border-2 border-stroke px-4 py-2 text-sm font-extrabold text-stroke shadow-[2px_2px_0px_var(--color-stroke)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {isSending ? "Sending…" : "Send"}
            <Send size={16} aria-hidden="true" />
          </button>
        </div>
      </form>

      {isListening ? (
        <p className="text-sm font-semibold text-stroke" role="status">
          Listening… speak your question now.
        </p>
      ) : null}
      {voiceError ? (
        <p
          className="rounded-xl border-2 border-stroke bg-[#FFE0DF] px-3 py-2 text-sm text-stroke"
          role="alert"
        >
          {voiceError}
        </p>
      ) : null}
      {quotaReached ? (
        <p
          className="bg-world-soft rounded-xl border-2 border-stroke px-3 py-2 text-sm font-semibold text-stroke"
          role="status"
        >
          You’ve used all your AI Tutor messages for today. Come back tomorrow to keep learning with
          Pip.
        </p>
      ) : (
        <p className="text-xs leading-relaxed text-muted">
          Pip helps you learn English. Press Enter to send, or Shift + Enter for a new line.
        </p>
      )}
    </section>
  );
}

export default TutorInputBar;
