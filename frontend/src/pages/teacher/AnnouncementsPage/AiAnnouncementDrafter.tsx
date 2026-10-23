import { useEffect, useMemo, useRef, useState } from "react";
import { Languages, Sparkles, Square } from "lucide-react";
import { supabase } from "@/shared/api/supabase";
import { env } from "@/shared/config/env";
import { Button } from "@/shared/components/ui/Button";
import { Chip } from "@/shared/components/ui/Chip";
import { Textarea } from "@/shared/components/ui/Textarea";
import { cn } from "@/shared/lib/utils/cn";
import { TITLE_MAX, sanitizeAnnouncementHtml } from "./rules";

/* ========================================
   AI announcement drafter and tone adjuster (TASKS TCH-AI-18, TEACHER-SPEC TC-27 AI touchpoint)
   Sits above the Announcement composer form. The teacher types a few keywords, picks a tone
   (Encouraging, Urgent / Reminder, Celebratory, Formal) and gets a streamed draft with emoji and
   arcade-style formatting (a bold game banner, short lines, emoji bullets, a closing call to
   action). Changing the tone and pressing "Rewrite" restyles the same facts in the new tone.
   "Translate to Arabic" produces an Arabic version for a side-by-side bilingual parent preview.

   Transport: the `ai-copilot` Edge Function (teacher and admin only, Server-Sent Events). Its
   system prompt is the Teacher Copilot, so every request here states the output format and asks
   for the announcement text only. The model never returns HTML: the reply is a small Markdown
   subset (bold, italic, bullet and numbered lists) that is escaped and converted here, then run
   through the same sanitizer the composer uses before anything is shown or inserted.
   Nothing reaches students automatically: "Use this draft" only fills the composer fields, and
   the teacher still reviews and sends.
   ======================================== */

const TONES = ["encouraging", "urgent", "celebratory", "formal"] as const;
type Tone = (typeof TONES)[number];

const TONE_LABEL: Record<Tone, string> = {
  encouraging: "Encouraging",
  urgent: "Urgent / Reminder",
  celebratory: "Celebratory",
  formal: "Formal",
};

const TONE_ICON: Record<Tone, string> = {
  encouraging: "💪",
  urgent: "⏰",
  celebratory: "🎉",
  formal: "📝",
};

const TONE_GUIDE: Record<Tone, string> = {
  encouraging:
    "Warm, supportive and motivating. Praise effort and progress, not only results, and make every student feel able to improve. Up to 5 emoji.",
  urgent:
    "Clear, calm and direct reminder. The action and the deadline come first, in short sentences. No panic and no all-caps except one short banner. Up to 3 emoji.",
  celebratory:
    "Joyful and proud. Cheer the milestone with game-style victory language (level up, new high score, quest complete). Up to 6 emoji.",
  formal:
    "Polite, professional and respectful, suitable for parents. Complete sentences, a quieter banner, at most 2 emoji.",
};

/** Same limits as the Copilot edge function (`MAX_COPILOT_MESSAGE_CHARS`). */
const COPILOT_MESSAGE_MAX = 2000;
const KEYWORDS_MIN = 3;
const KEYWORDS_MAX = 400;

const PANEL = "rounded-[20px] border-2 border-stroke bg-surface-0 p-4 shadow-retro-sm";
const PREVIEW_BODY =
  "break-words text-sm text-stroke [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5";

export interface AnnouncementDraft {
  title: string;
  bodyHtml: string;
}

interface AiAnnouncementDrafterProps {
  /** Called with the chosen draft; the composer puts it in the title and message fields. */
  onUseDraft: (draft: AnnouncementDraft) => void;
  className?: string | undefined;
}

/** A draft as the model wrote it: Markdown source plus the title line. */
interface DraftText {
  title: string;
  body: string;
}

type Phase = "idle" | "drafting" | "translating";

/* ---- Prompts ------------------------------------------------------------------------------ */

const OUTPUT_FORMAT = [
  "Reply with the announcement text only: no commentary, no notes and no action card.",
  "Format: the first line is `TITLE: <title, max 80 characters>`, the second line is exactly `---`, then the body.",
  "Body formatting: only **bold**, *italic*, bullet lines starting with `- ` and numbered lines starting with `1. `. No # headings, no tables, no HTML and no links.",
].join("\n");

function draftPrompt(keywords: string, tone: Tone, existing: DraftText | null): string {
  const lines = [
    "Write a class announcement for the parents and students of an English class (Grades 7-12) at Al Hikmah school.",
    `Topic keywords from the teacher: ${keywords}`,
    `Tone: ${TONE_LABEL[tone]}. ${TONE_GUIDE[tone]}`,
    "Arcade style: open the body with a bold game-style banner line (for example **🎮 LEVEL UP!** or **⏰ QUEST ALERT**), keep lines short, put the key details in a bullet list with an emoji at the start of each bullet, and end with a one-line call to action.",
    "Length: 40 to 120 words in clear, simple English.",
    "Use only facts that appear in the keywords. If a date, time or place is missing, write around it and do not invent one.",
    "Never include personal names, phone numbers or emails. Say \"our class\" or \"a student\" instead.",
  ];
  if (existing) {
    lines.push(
      "Rewrite the draft below in the tone above. Keep every fact the same and change only the voice, the banner and the emoji.",
      `Current draft:\nTITLE: ${existing.title}\n${existing.body}`,
    );
  }
  lines.push(OUTPUT_FORMAT);
  return lines.join("\n");
}

function translationPrompt(draft: DraftText): string {
  return [
    "Translate this school announcement from English into Modern Standard Arabic for parents.",
    "Keep the same emoji, the same **bold** markers and the same bullet and numbered line structure, line for line. Use a respectful, natural tone, not a word-for-word one.",
    OUTPUT_FORMAT,
    `Announcement to translate:\nTITLE: ${draft.title}\n${draft.body}`,
  ].join("\n");
}

/* ---- Output parsing and conversion ------------------------------------------------------- */

/** Removes any action-card block the Copilot appends, including one that is still streaming. */
function stripActionCard(text: string): string {
  return text.replace(/```(?:action_card|json:action_card|card)[\s\S]*$/i, "").trim();
}

/** Splits `TITLE: ...` / `---` / body. While streaming, a partial reply still yields a draft. */
function parseDraft(raw: string): DraftText {
  const text = stripActionCard(raw).replace(/\r\n/g, "\n");
  const match = /^\s*TITLE:[ \t]*(.*)$/im.exec(text);
  if (!match) return { title: "", body: text.trim() };
  const after = text.slice(match.index + match[0].length);
  const body = after.replace(/^\s*---[ \t]*(?:\n|$)/, "").trim();
  return {
    title: (match[1] ?? "").replace(/\*\*/g, "").trim(),
    // A lone "-" or "--" is the divider still arriving, not content.
    body: /^-{1,3}$/.test(body) ? "" : body,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineMarkdown(escaped: string): string {
  return escaped
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*\n]*)\*(?!\*)/g, "$1<em>$2</em>");
}

/**
 * Converts the allowed Markdown subset to the HTML the composer stores. Everything is escaped
 * first, so model output can never add markup of its own.
 */
function markdownToHtml(markdown: string): string {
  const html: string[] = [];
  const state: { paragraph: string[]; list: { tag: "ul" | "ol"; items: string[] } | null } = {
    paragraph: [],
    list: null,
  };

  const flushParagraph = () => {
    if (state.paragraph.length > 0) html.push(`<p>${state.paragraph.join("<br>")}</p>`);
    state.paragraph = [];
  };
  const flushList = () => {
    if (state.list) {
      const items = state.list.items.map((item) => `<li><p>${item}</p></li>`).join("");
      html.push(`<${state.list.tag}>${items}</${state.list.tag}>`);
    }
    state.list = null;
  };

  for (const line of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") {
      flushParagraph();
      flushList();
      continue;
    }
    const bullet = /^[-*•]\s+(.*)$/.exec(trimmed);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    const item = bullet ?? numbered;
    if (item) {
      const tag = bullet ? "ul" : "ol";
      flushParagraph();
      if (state.list && state.list.tag !== tag) flushList();
      state.list ??= { tag, items: [] };
      state.list.items.push(inlineMarkdown(escapeHtml(item[1] ?? "")));
      continue;
    }
    flushList();
    state.paragraph.push(inlineMarkdown(escapeHtml(trimmed.replace(/^#{1,6}\s+/, ""))));
  }
  flushParagraph();
  flushList();
  return sanitizeAnnouncementHtml(html.join(""));
}

/** The message published for a bilingual announcement: English first, then Arabic. */
function bilingualHtml(english: DraftText, arabic: DraftText): string {
  const arabicBlock = `<p><strong>${escapeHtml(arabic.title)}</strong></p>${markdownToHtml(arabic.body)}`;
  return `${markdownToHtml(english.body)}<p>━━━━━━━━━━</p>${sanitizeAnnouncementHtml(arabicBlock)}`;
}

/* ---- Copilot transport (Server-Sent Events) ----------------------------------------------- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function errorMessageFrom(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback;
  const error = payload["error"];
  if (typeof error === "string") return error;
  if (isRecord(error)) return readString(error, "message") ?? fallback;
  return fallback;
}

async function openCopilotStream(message: string, signal: AbortSignal): Promise<Response> {
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new Error("Your session has expired. Sign in again to use AI drafting.");

  const response = await fetch(`${env.VITE_SUPABASE_URL.replace(/\/$/, "")}/functions/v1/ai-copilot`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: `Bearer ${token}`,
      apikey: env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ message, workspace_state: { page: "announcements" } }),
  });

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // Not JSON: the status fallback below is the message.
    }
    throw new Error(errorMessageFrom(payload, `The AI assistant could not be reached (${response.status}).`));
  }
  if (!response.body) throw new Error("The AI assistant returned an empty response.");
  return response;
}

/** Applies one SSE block to the running text. Returns the new text. */
function applySseBlock(block: string, text: string): string {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return text;

  let payload: unknown;
  try {
    payload = JSON.parse(dataLines.join("\n"));
  } catch {
    throw new Error("The AI assistant sent a reply that could not be read. Try again.");
  }
  if (!isRecord(payload)) return text;

  if (event === "delta") return text + (readString(payload, "delta") ?? "");
  if (event === "safety" && payload["blocked"] === true) {
    throw new Error(
      readString(payload, "message") ?? "This request cannot be drafted. Reword the keywords and try again.",
    );
  }
  if (event === "error") {
    throw new Error(readString(payload, "message") ?? "The AI assistant ran into a problem. Try again.");
  }
  return text;
}

/** Streams a Copilot reply, calling `onText` with the full text so far. Resolves to the final text. */
async function runCopilot(
  message: string,
  signal: AbortSignal,
  onText: (text: string) => void,
): Promise<string> {
  const response = await openCopilotStream(message, signal);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The AI assistant returned an empty response.");

  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      text = applySseBlock(buffer.slice(0, boundary), text);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");
    }
    onText(text);
  }
  if (buffer.trim() !== "") text = applySseBlock(buffer, text);
  onText(text);
  return text;
}

/* ---- Component ---------------------------------------------------------------------------- */

export function AiAnnouncementDrafter({ onUseDraft, className }: AiAnnouncementDrafterProps) {
  const [open, setOpen] = useState(false);
  const [keywords, setKeywords] = useState("");
  const [tone, setTone] = useState<Tone>("encouraging");
  const [draftedTone, setDraftedTone] = useState<Tone | null>(null);
  const [draft, setDraft] = useState<DraftText | null>(null);
  const [arabic, setArabic] = useState<DraftText | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [keywordsError, setKeywordsError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const busy = phase !== "idle";
  const englishHtml = useMemo(() => (draft ? markdownToHtml(draft.body) : ""), [draft]);
  const arabicHtml = useMemo(() => (arabic ? markdownToHtml(arabic.body) : ""), [arabic]);
  const hasDraft = draft !== null && draft.body !== "" && phase !== "drafting";
  const toneChanged = hasDraft && draftedTone !== null && draftedTone !== tone;

  const start = (next: Phase): AbortController => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase(next);
    setError("");
    return controller;
  };

  const finish = (controller: AbortController) => {
    if (abortRef.current === controller) {
      abortRef.current = null;
      setPhase("idle");
    }
  };

  const generate = async (rewrite: boolean) => {
    const topic = keywords.trim().replace(/\s+/g, " ");
    if (topic.length < KEYWORDS_MIN) {
      setKeywordsError("Add a few keywords, for example: quiz Tuesday, unit 3, bring pencils.");
      return;
    }
    setKeywordsError("");

    const base = rewrite && draft ? draft : null;
    const message = draftPrompt(topic, tone, base);
    if (message.length > COPILOT_MESSAGE_MAX) {
      setError(
        base
          ? "This draft is too long to restyle in one go. Use Regenerate to start from your keywords."
          : "Those keywords are too long. Shorten them and try again.",
      );
      return;
    }

    const previous = draft;
    const controller = start("drafting");
    try {
      const text = await runCopilot(message, controller.signal, (partial) => {
        if (!controller.signal.aborted) setDraft(parseDraft(partial));
      });
      if (controller.signal.aborted) return;
      const parsed = parseDraft(text);
      if (parsed.body === "") throw new Error("The AI returned an empty draft. Try again.");
      setDraft({ title: parsed.title.slice(0, TITLE_MAX), body: parsed.body });
      setDraftedTone(tone);
      setArabic(null);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setDraft(previous);
      setError(caught instanceof Error ? caught.message : "The draft could not be created. Try again.");
    } finally {
      finish(controller);
    }
  };

  const translate = async () => {
    if (!draft || draft.body === "") return;
    const message = translationPrompt(draft);
    if (message.length > COPILOT_MESSAGE_MAX) {
      setError("This draft is too long to translate in one go. Shorten it and try again.");
      return;
    }

    const controller = start("translating");
    try {
      const text = await runCopilot(message, controller.signal, (partial) => {
        if (!controller.signal.aborted) setArabic(parseDraft(partial));
      });
      if (controller.signal.aborted) return;
      const parsed = parseDraft(text);
      if (parsed.body === "") throw new Error("The AI returned an empty translation. Try again.");
      setArabic({ title: parsed.title.slice(0, TITLE_MAX), body: parsed.body });
    } catch (caught) {
      if (controller.signal.aborted) return;
      setArabic(null);
      setError(caught instanceof Error ? caught.message : "The translation could not be created. Try again.");
    } finally {
      finish(controller);
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase("idle");
  };

  const useEnglish = () => {
    if (!draft) return;
    onUseDraft({ title: draft.title.slice(0, TITLE_MAX), bodyHtml: markdownToHtml(draft.body) });
  };

  const useBilingual = () => {
    if (!draft || !arabic) return;
    const combined = `${draft.title} | ${arabic.title}`;
    onUseDraft({
      title: (combined.length <= TITLE_MAX ? combined : draft.title).slice(0, TITLE_MAX),
      bodyHtml: bilingualHtml(draft, arabic),
    });
  };

  return (
    <section aria-labelledby="ai-drafter-title" className={cn(PANEL, "space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3
          id="ai-drafter-title"
          className="flex items-center gap-2 font-heading text-base font-bold text-stroke"
        >
          <Sparkles size={18} aria-hidden="true" />
          AI draft assistant
        </h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-expanded={open}
          aria-controls="ai-drafter-body"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Hide" : "Draft with AI"}
        </Button>
      </div>

      {open && (
        <div id="ai-drafter-body" className="space-y-4">
          <Textarea
            label="What is it about?"
            rows={2}
            maxLength={KEYWORDS_MAX}
            showCount
            value={keywords}
            error={keywordsError || undefined}
            helperText="A few keywords are enough. Leave out student names."
            placeholder="quiz Tuesday, unit 3, bring pencils"
            disabled={busy}
            onChange={(event) => {
              setKeywords(event.target.value);
              if (keywordsError) setKeywordsError("");
            }}
          />

          <div className="space-y-1.5">
            <p id="ai-drafter-tone-label" className="text-sm font-bold">
              Tone
            </p>
            <div role="group" aria-labelledby="ai-drafter-tone-label" className="flex flex-wrap gap-2">
              {TONES.map((item) => (
                <Chip
                  key={item}
                  size="md"
                  selected={tone === item}
                  disabled={busy}
                  icon={<span>{TONE_ICON[item]}</span>}
                  onClick={() => setTone(item)}
                >
                  {TONE_LABEL[item]}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {hasDraft ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => void generate(true)}
                >
                  {toneChanged ? `Rewrite in ${TONE_LABEL[tone]} tone` : "Rewrite"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void generate(false)}
                >
                  Regenerate
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                loading={phase === "drafting"}
                disabled={busy}
                onClick={() => void generate(false)}
              >
                Generate draft
              </Button>
            )}
            {busy && (
              <Button type="button" size="sm" variant="ghost" onClick={stop}>
                <Square size={14} aria-hidden="true" /> Stop
              </Button>
            )}
          </div>

          <p role="status" aria-live="polite" className="sr-only">
            {phase === "drafting" && "Writing your draft."}
            {phase === "translating" && "Translating to Arabic."}
          </p>

          {error && (
            <p role="alert" className="text-sm font-semibold text-danger-600">
              {error}
            </p>
          )}

          {draft && (draft.body !== "" || draft.title !== "") && (
            <div className="space-y-3">
              <div className={cn("grid gap-3", arabic && "md:grid-cols-2")}>
                <article
                  aria-label="English draft"
                  className="space-y-2 rounded-[14px] border-2 border-stroke bg-surface-0 p-3"
                >
                  <p className="text-xs font-extrabold uppercase tracking-wide text-muted">English</p>
                  <h4 className="break-words font-heading text-base font-bold text-stroke">
                    {draft.title || "…"}
                  </h4>
                  <div className={PREVIEW_BODY} dangerouslySetInnerHTML={{ __html: englishHtml }} />
                </article>

                {arabic && (
                  <article
                    aria-label="Arabic draft"
                    lang="ar"
                    dir="rtl"
                    className="space-y-2 rounded-[14px] border-2 border-stroke bg-surface-0 p-3"
                  >
                    <p className="text-xs font-extrabold tracking-wide text-muted">العربية</p>
                    <h4 className="break-words font-heading text-base font-bold text-stroke">
                      {arabic.title || "…"}
                    </h4>
                    <div className={PREVIEW_BODY} dangerouslySetInnerHTML={{ __html: arabicHtml }} />
                  </article>
                )}
              </div>

              <p className="text-sm font-semibold text-muted">
                AI draft. Check the facts, dates and wording before you send it.
              </p>

              {hasDraft && (
                <div className="flex flex-wrap gap-3">
                  <Button type="button" size="sm" disabled={busy} onClick={useEnglish}>
                    Use this draft
                  </Button>
                  {arabic ? (
                    <Button type="button" size="sm" disabled={busy} onClick={useBilingual}>
                      Use English + Arabic
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    loading={phase === "translating"}
                    disabled={busy}
                    onClick={() => void translate()}
                  >
                    <Languages size={16} aria-hidden="true" />
                    {arabic ? "Translate again" : "Translate to Arabic"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
