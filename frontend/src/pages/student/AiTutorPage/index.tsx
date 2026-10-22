import { useState } from "react";
import { Sparkles } from "lucide-react";
import { PipAvatar } from "@/shared/components/ai";
import { StudentAppShell } from "@/shared/components/layout/StudentAppShell";
import type { StudentShellStats } from "@/shared/components/layout/StudentTopBar";
import { Button } from "@/shared/components/ui/Button";
import { MessageFeed, type TutorMessage } from "./MessageFeed";
import { TutorInputBar } from "./TutorInputBar";

const DAILY_LIMIT = 12;

const initialMessages: TutorMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    content:
      "Hi! I can explain a grammar rule, check a sentence, or quiz you on this lesson. What would you like to work on?",
  },
];

function buildTutorReply(question: string): string {
  const lower = question.toLowerCase();
  if (lower.includes("grammar") || lower.includes("rule")) {
    return "A good way to start is to spot the core pattern in the sentence. Try saying the rule in your own words, then check one example before you change anything else.";
  }
  if (lower.includes("example")) {
    return "Try this: 'I have finished my homework.' The tense tells us the action is complete. You can use a similar sentence in your own writing and compare it to the rule.";
  }
  if (lower.includes("write") || lower.includes("check")) {
    return "Read through your sentence slowly and focus on one idea at a time. Check the subject, verb, and final punctuation before you revise it.";
  }
  return "Let's narrow it down to one idea. Tell me the exact sentence or rule you want to understand, and I will guide you with a hint before giving the answer.";
}

export default function AiTutorPage() {
  const [messages, setMessages] = useState<TutorMessage[]>(initialMessages);
  const [streamingReply, setStreamingReply] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(DAILY_LIMIT);
  const [speechEnabled, setSpeechEnabled] = useState(true);

  const stats: StudentShellStats = {
    xpTotal: 2480,
    level: 9,
    xpInLevel: 360,
    xpToNext: 140,
    coins: 212,
    streakDays: 6,
    rankTitle: "Explorer",
  };

  const handleSend = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || remaining <= 0) return;

    const userMessage: TutorMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

    setMessages((current) => [...current, userMessage]);
    setRemaining((current) => Math.max(0, current - 1));

    const response = buildTutorReply(trimmed);
    setStreamingReply(response);
    window.setTimeout(() => {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response,
        },
      ]);
      setStreamingReply(null);
    }, 500);
  };

  return (
    <StudentAppShell stats={stats} fallbackTitle="AI Tutor">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 md:px-6 md:py-6">
        <header className="flex flex-col gap-4 rounded-[24px] border-2 border-stroke bg-[var(--world-ai,#0f172a)] p-4 text-surface-0 shadow-retro-md md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-[18px] border-2 border-white/70 bg-[var(--world-ai-soft,#1e293b)] shadow-retro-sm">
              <PipAvatar size={42} />
            </div>
            <div>
              <p className="font-heading text-sm font-bold uppercase tracking-[0.18em] text-[var(--world-main,#ffb84d)]">
                AI Tutor
              </p>
              <h1 className="font-heading text-3xl font-bold text-white">Pip is ready to help</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            <Button
              type="button"
              size="sm"
              variant={speechEnabled ? "secondary" : "ghost"}
              sound={false}
              onClick={() => setSpeechEnabled((current) => !current)}
              className="gap-2"
            >
              {speechEnabled ? "Voice on" : "Voice off"}
            </Button>
            <span className="inline-flex items-center gap-2 rounded-full border-2 border-white/70 bg-white/10 px-3 py-1.5 font-heading text-sm font-bold text-white">
              <Sparkles size={14} aria-hidden="true" />
              {remaining} left today
            </span>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_320px]">
          <section className="rounded-[24px] border-2 border-stroke bg-surface-0 p-3 shadow-retro-md">
            <MessageFeed messages={messages} streamingLabel={streamingReply ?? undefined} />
          </section>

          <aside className="flex flex-col gap-4">
            <div className="rounded-[20px] border-2 border-stroke bg-surface-0 p-4 shadow-retro-sm">
              <p className="font-heading text-sm font-bold uppercase tracking-[0.12em] text-muted">
                Lesson context
              </p>
              <h2 className="mt-2 font-heading text-2xl font-bold text-stroke">Present perfect</h2>
              <ul className="mt-3 space-y-2 text-sm font-semibold text-stroke">
                <li>• We use it for actions that started before now.</li>
                <li>• Add the past participle after have / has.</li>
                <li>• Compare it with the simple past for time clues.</li>
              </ul>
            </div>

            <div className="rounded-[20px] border-2 border-stroke bg-surface-100 p-4 shadow-retro-sm">
              <p className="font-heading text-sm font-bold uppercase tracking-[0.12em] text-muted">
                Quick prompts
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {["Explain this rule", "Give me an example", "Test my knowledge"].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleSend(prompt)}
                    className="rounded-full border-2 border-stroke bg-white px-3 py-1.5 font-body text-sm font-bold text-stroke transition-transform hover:-translate-y-0.5"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>

        <TutorInputBar remaining={remaining} onSend={handleSend} disabled={remaining <= 0} />
      </div>
    </StudentAppShell>
  );
}
