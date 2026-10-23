import { useEffect, useRef, useState } from "react";
import TeacherActionCardContainer, { type TeacherActionCardRecord } from "./TeacherActionCardContainer";

export interface CopilotContext {
  type: "course" | "quiz" | "rubric";
  id: string;
  title: string;
  content?: string;
}

export interface CopilotMessage {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  context: CopilotContext | null;
  streamReply: (input: {
    messages: CopilotMessage[];
    context: CopilotContext | null;
    signal: AbortSignal;
  }) => AsyncIterable<string>;
  /** Persisted cards emitted by the Copilot stream; render them in the review area. */
  actionCards?: TeacherActionCardRecord[];
  onActionCardResolved?: (result: { id: string; status: "approved" | "edited" | "discarded"; result?: unknown }) => void;
}

const shortcuts = [
  "Suggest 3 discussion questions",
  "Simplify this passage for Grade 5",
  "Create a rubric for this prompt",
];

export default function TeacherCopilotPanel({ open, onClose, context, streamReply, actionCards = [], onActionCardResolved }: Props) {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function send(text = input) {
    const prompt = text.trim();
    if (!prompt || streaming) return;

    setInput("");
    setError("");

    const history: CopilotMessage[] = [...messages, { role: "user", content: prompt }];

    setMessages([...history, { role: "assistant", content: "" }]);

    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);

    try {
      let answer = "";
      for await (const chunk of streamReply({
        messages: history,
        context,
        signal: controller.signal,
      })) {
        answer += chunk;
        setMessages([...history, { role: "assistant", content: answer }]);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setError(error instanceof Error ? error.message : "Copilot request failed.");
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  if (!open) return null;

  return (
    <>
      <button
        onClick={() => setExpanded((value) => !value)}
        aria-label="Toggle Copilot panel"
        style={{ position: "fixed", right: expanded ? 400 : 0, top: "45%", zIndex: 21 }}
      >
        AI Copilot
      </button>

      <aside
        aria-label="Teacher AI Copilot"
        style={{
          position: "fixed",
          zIndex: 20,
          top: 0,
          right: 0,
          height: "100vh",
          width: expanded ? 400 : 0,
          maxWidth: "95vw",
          background: "white",
          boxShadow: "-4px 0 18px #0002",
          display: "flex",
          flexDirection: "column",
          transition: "width .2s",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            padding: 16,
            borderBottom: "1px solid #ddd",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <div>
            <strong>Teacher Copilot</strong>
            <div>
              <small>
                {context
                  ? `Context: ${context.type} · ${context.title}`
                  : "No active workspace context"}
              </small>
            </div>
          </div>
          <button onClick={onClose}>Close</button>
        </header>

        <div style={{ padding: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {shortcuts.map((text) => (
            <button key={text} disabled={streaming} onClick={() => void send(text)}>
              {text}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {messages.map((message, index) => (
            <article
              key={index}
              style={{
                margin: "12px 0",
                padding: 12,
                borderRadius: 8,
                background: message.role === "user" ? "#eef2ff" : "#f3f4f6",
              }}
            >
              <strong>{message.role === "user" ? "You" : "Copilot"}</strong>
              <p style={{ whiteSpace: "pre-wrap" }}>
                {message.content || (streaming ? "Thinking…" : "")}
              </p>
            </article>
          ))}
          {actionCards.length > 0 && (
            <section className="mt-4 space-y-3" aria-label="Copilot proposed changes">
              <h3 className="font-heading text-lg font-bold">Proposed curriculum changes</h3>
              {actionCards.map((card) => (
                <TeacherActionCardContainer key={card.id} card={card} onResolved={onActionCardResolved} />
              ))}
            </section>
          )}
          <div ref={bottomRef} />
        </div>

        {error && (
          <p role="alert" style={{ color: "#b22", padding: "0 16px" }}>
            {error}
          </p>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
          style={{ padding: 12, borderTop: "1px solid #ddd", display: "flex", gap: 8 }}
        >
          <textarea
            aria-label="Message Copilot"
            rows={2}
            style={{ flex: 1 }}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask for teaching or authoring help…"
          />
          <button disabled={streaming || !input.trim()}>{streaming ? "…" : "Send"}</button>
          {streaming && (
            <button type="button" onClick={() => abortRef.current?.abort()}>
              Stop
            </button>
          )}
        </form>
      </aside>
    </>
  );
}
