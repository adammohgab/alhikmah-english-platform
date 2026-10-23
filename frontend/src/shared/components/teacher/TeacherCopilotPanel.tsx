import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowUp, BookOpen, GraduationCap, Lightbulb, LoaderCircle, Sparkles, Square, X } from "lucide-react";
import { env } from "@/shared/config/env";
import { supabase } from "@/shared/api/supabase";
import { cn } from "@/shared/lib/utils/cn";

export type CopilotWorkspaceState = {
  page?: string;
  class_id?: string;
  course_id?: string;
  lesson_id?: string;
  quiz_id?: string;
  assignment_id?: string;
  grade_level?: string;
  subject?: string;
};

export interface CopilotContext {
  type: "course" | "quiz" | "rubric" | "assignment" | "class" | "page";
  id?: string;
  title: string;
  content?: string;
  workspaceState?: CopilotWorkspaceState;
}

export interface CopilotMessage {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  context: CopilotContext | null;
}

const shortcuts = [
  { label: "Discussion questions", prompt: "Suggest 3 discussion questions for the current lesson.", icon: Lightbulb },
  { label: "Simplify for Grade 5", prompt: "Simplify this passage for Grade 5 while preserving the key learning objectives.", icon: BookOpen },
  { label: "Create a rubric", prompt: "Create a clear, student-friendly rubric for the current prompt.", icon: GraduationCap },
];

function parseSseEvent(block: string): { event: string; data: Record<string, unknown> } | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (!dataLines.length) return null;
  try {
    const data = JSON.parse(dataLines.join("\n")) as Record<string, unknown>;
    return { event, data };
  } catch {
    return null;
  }
}

async function* streamCopilotReply(args: {
  message: string;
  history: CopilotMessage[];
  context: CopilotContext | null;
  signal: AbortSignal;
}): AsyncIterable<string> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Please sign in again to use Teacher Copilot.");

  // The Edge Function currently accepts one message per request, so include a short
  // conversation transcript while keeping the newest teacher request clearly marked.
  const historyText = args.history.slice(-8, -1).map((item) => `${item.role === "user" ? "Teacher" : "Copilot"}: ${item.content}`).join("\n");
  const message = historyText
    ? `Conversation so far:\n${historyText}\n\nTeacher's latest request:\n${args.message}`
    : args.message;

  const response = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/ai-copilot`, {
    method: "POST",
    signal: args.signal,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: env.VITE_SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ message, workspace_state: args.context?.workspaceState ?? { page: window.location.pathname } }),
  });

  if (!response.ok) {
    let detail = "The assistant could not complete that. Try rephrasing or breaking it into smaller steps.";
    try {
      const body = await response.json() as { error?: { message?: string }; message?: string };
      detail = body.error?.message || body.message || detail;
    } catch {
      // Keep the user-facing fallback for non-JSON gateway errors.
    }
    throw new Error(detail);
  }
  if (!response.body) throw new Error("The assistant returned an empty response. Please try again.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        const parsed = parseSseEvent(block);
        if (!parsed) continue;
        if (parsed.event === "delta") {
          const chunk = parsed.data.chunk ?? parsed.data.delta ?? parsed.data.text;
          if (typeof chunk === "string") yield chunk;
        } else if (parsed.event === "safety" && typeof parsed.data.message === "string") {
          yield parsed.data.message;
        } else if (parsed.event === "error") {
          throw new Error(typeof parsed.data.message === "string" ? parsed.data.message : "The assistant could not complete that request.");
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export default function TeacherCopilotPanel({ context }: Props) {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [contextVisible, setContextVisible] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const currentMessagesRef = useRef(messages);
  currentMessagesRef.current = messages;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(async (rawText = input) => {
    const prompt = rawText.trim();
    if (!prompt || streaming) return;
    setInput("");
    setError("");
    const history: CopilotMessage[] = [...currentMessagesRef.current, { role: "user", content: prompt }];
    setMessages([...history, { role: "assistant", content: "" }]);
    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);
    try {
      let answer = "";
      for await (const chunk of streamCopilotReply({ message: prompt, history, context, signal: controller.signal })) {
        answer += chunk;
        setMessages([...history, { role: "assistant", content: answer }]);
      }
      if (!answer.trim() && !controller.signal.aborted) {
        setMessages([...history, { role: "assistant", content: "I couldn't generate a response this time. Please try again." }]);
      }
    } catch (caught) {
      if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "The assistant could not complete that. Try again.");
      setMessages(history);
    } finally {
      setStreaming(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [context, input, streaming]);

  return (
    <section className="flex h-full min-h-0 flex-col bg-surface-0" aria-label="Teacher AI Copilot chat">
      <div className="border-b border-stroke/20 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-stroke">
          <Sparkles aria-hidden="true" size={17} /> Teaching assistant
          <span className="ml-auto rounded-full border border-stroke/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">AI</span>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted">Get help planning lessons, improving questions, and giving useful feedback.</p>
      </div>

      {contextVisible && context && (
        <div className="flex items-start gap-2 border-b border-stroke/15 px-4 py-3">
          <span className="mt-0.5 rounded-md bg-[var(--world-main,#7c8cff)]/15 p-1.5 text-stroke"><BookOpen size={15} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Active workspace</p>
            <p className="truncate text-sm font-semibold text-stroke">{context.title}</p>
            <p className="text-xs capitalize text-muted">{context.type}{context.id ? ` · ${context.id}` : ""}</p>
          </div>
          <button type="button" aria-label="Hide workspace context" className="rounded p-1 text-muted hover:bg-surface-1" onClick={() => setContextVisible(false)}><X size={14} /></button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex min-h-full flex-col justify-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-stroke/20 bg-[var(--world-main,#7c8cff)]/10 text-stroke"><Sparkles size={24} aria-hidden="true" /></div>
            <h3 className="text-center font-heading text-lg font-semibold text-stroke">What are you working on?</h3>
            <p className="mx-auto mt-1 max-w-[280px] text-center text-sm leading-5 text-muted">Choose a starter prompt or ask a question in your own words.</p>
            <div className="mt-5 grid gap-2">
              {shortcuts.map(({ label, prompt, icon: Icon }) => (
                <button key={label} type="button" disabled={streaming} onClick={() => void send(prompt)} className="flex items-center gap-3 rounded-xl border border-stroke/20 bg-surface-0 p-3 text-left text-sm font-medium text-stroke transition hover:bg-surface-1 disabled:opacity-50">
                  <Icon size={17} className="shrink-0 text-muted" aria-hidden="true" /><span>{label}</span><ArrowUp size={15} className="ml-auto rotate-45 text-muted" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message, index) => (
              <article key={`${index}-${message.role}`} className={cn("rounded-xl p-3 text-sm leading-6", message.role === "user" ? "ml-5 bg-[var(--world-main,#7c8cff)]/15 text-stroke" : "mr-3 border border-stroke/10 bg-surface-1 text-stroke")}>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">{message.role === "user" ? "You" : "Copilot"}</p>
                <p className="whitespace-pre-wrap break-words">{message.content || (streaming ? <span className="inline-flex items-center gap-2 text-muted"><LoaderCircle size={14} className="animate-spin" />Thinking…</span> : "")}</p>
              </article>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {error && <p role="alert" className="mx-4 mb-2 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-xs leading-5 text-red-800"><AlertCircle size={15} className="mt-0.5 shrink-0" />{error}</p>}
      {messages.length > 0 && (
        <div className="border-t border-stroke/15 px-3 py-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {shortcuts.map(({ label, prompt }) => <button key={label} type="button" disabled={streaming} onClick={() => void send(prompt)} className="shrink-0 rounded-full border border-stroke/20 px-3 py-1.5 text-[11px] font-medium text-muted hover:bg-surface-1 disabled:opacity-50">{label}</button>)}
          </div>
        </div>
      )}
      <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="border-t-2 border-stroke/15 p-3">
        <div className="flex items-end gap-2 rounded-xl border-2 border-stroke/20 bg-surface-0 p-2 focus-within:border-stroke">
          <textarea aria-label="Message Copilot" rows={2} maxLength={2000} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Ask for teaching or authoring help…" className="max-h-32 min-h-[44px] flex-1 resize-y bg-transparent px-1 py-2 text-sm text-stroke outline-none placeholder:text-muted" />
          {streaming ? (
            <button type="button" aria-label="Stop response" onClick={() => abortRef.current?.abort()} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-1 text-stroke"><Square size={16} aria-hidden="true" /></button>
          ) : (
            <button type="submit" aria-label="Send message" disabled={!input.trim()} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--world-main,#7c8cff)] text-stroke disabled:cursor-not-allowed disabled:opacity-40"><ArrowUp size={18} aria-hidden="true" /></button>
          )}
        </div>
        <p className="mt-2 text-center text-[10px] text-muted">AI suggestions can be wrong. Review content before using it with students.</p>
      </form>
    </section>
  );
}
