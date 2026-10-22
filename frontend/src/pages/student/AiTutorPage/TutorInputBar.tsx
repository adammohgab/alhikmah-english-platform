import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { ChatInput } from "@/shared/components/ai";
import { Button } from "@/shared/components/ui/Button";
import { cn } from "@/shared/lib/utils/cn";

export interface TutorInputBarProps {
  remaining: number;
  onSend: (value: string) => void;
  disabled?: boolean | undefined;
}

const SUGGESTIONS = [
  "Explain this rule",
  "Give me an example",
  "Test my knowledge",
  "Check my writing",
];

export function TutorInputBar({ remaining, onSend, disabled = false }: TutorInputBarProps) {
  const [listening, setListening] = useState(false);
  const [speechReady, setSpeechReady] = useState(false);

  useEffect(() => {
    const hasSpeechRecognition =
      typeof window !== "undefined" &&
      (!!(window as typeof window & { SpeechRecognition?: unknown }).SpeechRecognition ||
        !!(window as typeof window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);
    setSpeechReady(hasSpeechRecognition);
  }, []);

  const handleToggleVoice = () => {
    if (!speechReady) return;
    setListening((current) => !current);
  };

  const used = Math.max(0, 12 - remaining);
  const percent = Math.min(100, Math.max(0, (used / 12) * 100));

  return (
    <div className="flex flex-col gap-3 rounded-[20px] border-2 border-stroke bg-surface-0 p-3 shadow-retro-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-heading text-sm font-bold uppercase tracking-[0.12em] text-muted">
            Daily limit
          </p>
          <p className="font-body text-sm font-semibold text-stroke">
            {remaining} of 12 messages left
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant={listening ? "danger" : "secondary"}
          sound={false}
          onClick={() => setListening((current) => !current)}
          className="gap-2"
          aria-pressed={listening}
        >
          {listening ? <VolumeX size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
          {listening ? "Listening" : "Audio"}
        </Button>
      </div>

      <div
        role="progressbar"
        aria-label="Daily AI Tutor usage"
        aria-valuemin={0}
        aria-valuemax={12}
        aria-valuenow={used}
        className="h-3 overflow-hidden rounded-full border-2 border-stroke bg-surface-100"
      >
        <div
          className={cn(
            "h-full rounded-full bg-[var(--world-main,#ffb84d)] transition-[width] duration-300",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>

      <ChatInput
        onSend={onSend}
        disabled={disabled || remaining <= 0}
        suggestions={SUGGESTIONS}
        voice={speechReady ? { listening, onToggle: handleToggleVoice } : undefined}
        placeholder="Ask Pip about this lesson…"
      />
    </div>
  );
}
