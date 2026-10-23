import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { supabase } from "@/shared/api/supabase";

export type CreatorQuestionType =
  "multiple_choice" | "fill_blank" | "matching" | "reorder" | "short_answer" | "audio_spelling";

interface PairRow {
  id: string;
  term: string;
  definition: string;
}
interface OptionRow {
  id: string;
  text: string;
}
export interface EditableQuestion {
  id: string;
  question_type: string;
  prompt: string;
  options?: Record<string, unknown> | unknown[] | null;
  correct_answer?: Record<string, unknown> | null;
  explanation?: string | null;
  points?: number | null;
  difficulty?: string | null;
  tags?: string[] | null;
}
interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Supply a saved question to edit; omit to create a new question. */
  question?: EditableQuestion | null;
  /** Called after the row has been successfully saved. */
  onSaved?: (question: EditableQuestion) => void;
}

const TYPES: Array<{ value: CreatorQuestionType; label: string }> = [
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "fill_blank", label: "Fill in the Blank" },
  { value: "matching", label: "Matching Pairs" },
  { value: "reorder", label: "Reorder" },
  { value: "short_answer", label: "Short Answer" },
  { value: "audio_spelling", label: "Audio Spelling" },
];
const newId = () => `item-${Math.random().toString(36).slice(2, 10)}`;
const textValue = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const obj = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const splitTags = (value: string) => [
  ...new Set(
    value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
  ),
];

function fromQuestion(question?: EditableQuestion | null) {
  const options = obj(question?.options);
  const answer = obj(question?.correct_answer);
  const type = TYPES.some((item) => item.value === question?.question_type)
    ? (question!.question_type as CreatorQuestionType)
    : "multiple_choice";
  const rawChoices = arr(question?.options);
  const choices = rawChoices.length ? rawChoices : arr(options.choices);
  const mc = choices.map((item) => ({
    id: textValue(obj(item).id, newId()),
    text: textValue(obj(item).text),
  }));
  const correct = arr(answer.correct).map(String);
  const left = arr(obj(question?.options).left);
  const right = arr(obj(question?.options).right);
  const pairs = arr(answer.pairs);
  const blanks = arr(answer.blanks).map((item) => arr(item).map(String)[0] ?? "");
  const reorderItems = arr(obj(question?.options).items).map((item) => ({
    id: textValue(obj(item).id, newId()),
    text: textValue(obj(item).text),
  }));
  const accepted = arr(answer.accepted).map(String);
  return {
    type,
    prompt: question?.prompt
      ? question.prompt.replace(
          /\{\{(\d+)\}\}/g,
          (_match, index: string) => `[${blanks[Number(index) - 1] ?? ""}]`,
        )
      : "",
    options:
      mc.length === 4 ? mc : [0, 1, 2, 3].map((index) => mc[index] ?? { id: newId(), text: "" }),
    correctId: correct[0] ?? mc[0]?.id ?? "",
    pairs: left.length
      ? left.map((item, index) => ({
          id: textValue(obj(item).id, newId()),
          term: textValue(obj(item).text),
          definition: textValue(obj(right[index]).text, textValue(arr(pairs[index])[1])),
        }))
      : [
          { id: newId(), term: "", definition: "" },
          { id: newId(), term: "", definition: "" },
        ],
    blanks: blanks.length ? blanks : [""],
    reorderItems: reorderItems.length
      ? reorderItems
      : [
          { id: newId(), text: "" },
          { id: newId(), text: "" },
        ],
    sampleAnswer: textValue(answer.sampleAnswer),
    acceptedAnswers: accepted.join(", "),
    audioUrl: textValue(options.audio_url),
    spellingWord: textValue(answer.word),
    explanation: question?.explanation ?? "",
    points: question?.points ?? 1,
    difficulty: question?.difficulty ?? "medium",
    tags: (question?.tags ?? []).join(", "),
  };
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  font: "inherit",
  background: "white",
  color: "#0f172a",
};
const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 14,
  fontWeight: 600,
  color: "#334155",
};

export default function QuestionCreatorModal({ isOpen, onClose, question, onSaved }: Props) {
  const initial = useMemo(() => fromQuestion(question), [question]);
  const [type, setType] = useState<CreatorQuestionType>(initial.type);
  const [prompt, setPrompt] = useState(initial.prompt);
  const [options, setOptions] = useState<OptionRow[]>(initial.options);
  const [correctId, setCorrectId] = useState(initial.correctId);
  const [pairs, setPairs] = useState<PairRow[]>(initial.pairs);
  const [reorderItems, setReorderItems] = useState<OptionRow[]>(initial.reorderItems);
  const [sampleAnswer, setSampleAnswer] = useState(initial.sampleAnswer);
  const [acceptedAnswers, setAcceptedAnswers] = useState(initial.acceptedAnswers);
  const [audioUrl, setAudioUrl] = useState(initial.audioUrl);
  const [spellingWord, setSpellingWord] = useState(initial.spellingWord);
  const [explanation, setExplanation] = useState(initial.explanation);
  const [points, setPoints] = useState(initial.points);
  const [difficulty, setDifficulty] = useState(initial.difficulty);
  const [tags, setTags] = useState(initial.tags);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const value = fromQuestion(question);
    setType(value.type);
    setPrompt(value.prompt);
    setOptions(value.options);
    setCorrectId(value.correctId);
    setPairs(value.pairs);
    setReorderItems(value.reorderItems);
    setSampleAnswer(value.sampleAnswer);
    setAcceptedAnswers(value.acceptedAnswers);
    setAudioUrl(value.audioUrl);
    setSpellingWord(value.spellingWord);
    setExplanation(value.explanation);
    setPoints(value.points);
    setDifficulty(value.difficulty);
    setTags(value.tags);
    setError("");
  }, [isOpen, question]);

  if (!isOpen) return null;

  function validate() {
    if (!prompt.trim()) return "Enter the question prompt.";
    if (!Number.isFinite(points) || points < 0) return "Points must be zero or greater.";
    if (type === "multiple_choice") {
      if (options.some((option) => !option.text.trim())) return "Fill in all four answer options.";
      if (!options.some((option) => option.id === correctId)) return "Select the correct answer.";
    }
    if (
      type === "matching" &&
      (pairs.length < 2 || pairs.some((pair) => !pair.term.trim() || !pair.definition.trim()))
    )
      return "Add at least two complete matching pairs.";
    if (type === "fill_blank") {
      const marked = [...prompt.matchAll(/\[([^\]]+)\]/g)].map((match) => match[1].trim());
      if (!marked.length) return "Mark at least one answer in the sentence with [square brackets].";
      if (marked.some((word) => !word)) return "Each bracket must contain an answer word.";
    }
    if (
      type === "reorder" &&
      (reorderItems.length < 2 || reorderItems.some((item) => !item.text.trim()))
    )
      return "Add at least two non-empty items in the correct order.";
    if (type === "short_answer" && !sampleAnswer.trim() && !acceptedAnswers.trim())
      return "Add a sample answer or at least one accepted answer.";
    if (type === "audio_spelling" && (!spellingWord.trim() || !audioUrl.trim()))
      return "Enter the spelling answer and an audio URL.";
    return "";
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error("Please sign in again before saving a question.");
      let savedOptions: Record<string, unknown> | unknown[] = {};
      let correctAnswer: Record<string, unknown> = {};
      if (type === "multiple_choice") {
        savedOptions = options.map((item) => ({ id: item.id, text: item.text.trim() }));
        correctAnswer = { correct: [correctId] };
      } else if (type === "matching") {
        const left = pairs.map((pair) => ({ id: pair.id, text: pair.term.trim() }));
        const right = pairs.map((pair, index) => ({
          id: `right-${pair.id}`,
          text: pair.definition.trim(),
          sourceIndex: index,
        }));
        savedOptions = { left, right };
        correctAnswer = { pairs: pairs.map((pair) => [pair.id, `right-${pair.id}`]) };
      } else if (type === "fill_blank") {
        const marked = [...prompt.matchAll(/\[([^\]]+)\]/g)].map((match) => match[1].trim());
        savedOptions = {};
        correctAnswer = { blanks: marked.map((word) => [word]), case_sensitive: false };
      } else if (type === "reorder") {
        savedOptions = {
          items: reorderItems.map((item) => ({ id: item.id, text: item.text.trim() })),
        };
        correctAnswer = { order: reorderItems.map((item) => item.id) };
      } else if (type === "short_answer") {
        savedOptions = { sample_answer: sampleAnswer.trim() };
        correctAnswer = {
          accepted: [
            ...new Set(
              acceptedAnswers
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
            ),
          ],
          sampleAnswer: sampleAnswer.trim(),
        };
      } else {
        savedOptions = { audio_url: audioUrl.trim() };
        correctAnswer = { word: spellingWord.trim(), accepted: [spellingWord.trim()] };
      }
      const payload = {
        author_id: authData.user.id,
        question_type: type,
        prompt:
          type === "fill_blank"
            ? prompt
                .trim()
                .replace(
                  /\[([^\]]+)\]/g,
                  (_match, _word: string, offset: number, source: string) =>
                    `{{${[...source.slice(0, offset).matchAll(/\[[^\]]+\]/g)].length + 1}}`,
                )
            : prompt.trim(),
        options: savedOptions,
        correct_answer: correctAnswer,
        explanation: explanation.trim() || null,
        points,
        difficulty,
        tags: splitTags(tags),
      };
      // Database-generated types in older project snapshots do not yet include `questions`.
      const table = supabase.from("questions" as never) as unknown as {
        insert: (value: typeof payload) => {
          select: (columns: string) => {
            single: () => Promise<{
              data: EditableQuestion | null;
              error: { message: string } | null;
            }>;
          };
        };
        update: (value: typeof payload) => {
          eq: (
            column: string,
            id: string,
          ) => {
            select: (columns: string) => {
              single: () => Promise<{
                data: EditableQuestion | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
      };
      const result = question?.id
        ? await table.update(payload).eq("id", question.id).select("*").single()
        : await table.insert(payload).select("*").single();
      if (result.error) throw new Error(result.error.message);
      if (!result.data) throw new Error("The question was saved, but no saved row was returned.");
      onSaved?.(result.data);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the question.");
    } finally {
      setSaving(false);
    }
  }

  const updateOption = (id: string, text: string) =>
    setOptions((current) => current.map((item) => (item.id === id ? { ...item, text } : item)));
  const updateReorder = (id: string, text: string) =>
    setReorderItems((current) =>
      current.map((item) => (item.id === id ? { ...item, text } : item)),
    );
  const input = (value: string, onChange: (value: string) => void, placeholder = "") => (
    <input
      style={fieldStyle}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
    />
  );
  const section = (title: string, children: ReactNode) => (
    <section
      style={{
        display: "grid",
        gap: 12,
        padding: 16,
        border: "1px solid #e2e8f0",
        borderRadius: 12,
      }}
    >
      <h3 style={{ margin: 0, fontSize: 15, color: "#0f172a" }}>{title}</h3>
      {children}
    </section>
  );

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(15,23,42,.58)",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="question-creator-title"
        style={{
          width: "min(760px, 100%)",
          maxHeight: "min(92vh, 900px)",
          overflowY: "auto",
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 24px 80px rgba(0,0,0,.25)",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "start",
            justifyContent: "space-between",
            gap: 16,
            padding: "20px 24px",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <div>
            <h2 id="question-creator-title" style={{ margin: 0, fontSize: 21, color: "#0f172a" }}>
              {question ? "Edit question" : "Create a question"}
            </h2>
            <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>
              Build a question, set its answer key, and save it to your Question Bank.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close question editor"
            onClick={onClose}
            disabled={saving}
            style={{
              border: 0,
              background: "transparent",
              fontSize: 24,
              cursor: "pointer",
              color: "#64748b",
            }}
          >
            ×
          </button>
        </header>
        <form
          onSubmit={(event) => void save(event)}
          style={{ padding: 24, display: "grid", gap: 16 }}
        >
          <label style={labelStyle}>
            Question type
            <select
              style={fieldStyle}
              value={type}
              onChange={(event) => {
                setType(event.target.value as CreatorQuestionType);
                setError("");
              }}
            >
              {TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Prompt
            <textarea
              id="question-creator-prompt"
              style={{ ...fieldStyle, minHeight: 92, resize: "vertical" }}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={
                type === "fill_blank"
                  ? "Example: The [sun] rises in the east."
                  : "Write the question prompt…"
              }
              required
            />
            {type === "fill_blank" && (
              <span style={{ fontWeight: 400, color: "#64748b" }}>
                Put the correct word in square brackets, e.g. The [sun] rises in the east.
              </span>
            )}
          </label>
          {type === "multiple_choice" &&
            section(
              "Answer options · select the correct answer",
              <div style={{ display: "grid", gap: 10 }}>
                {options.map((option, index) => (
                  <div
                    key={option.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "24px 1fr",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <input
                      aria-label={`Option ${index + 1} is correct`}
                      type="radio"
                      name="correct-option"
                      checked={correctId === option.id}
                      onChange={() => setCorrectId(option.id)}
                    />
                    {input(
                      option.text,
                      (value) => updateOption(option.id, value),
                      `Option ${index + 1}`,
                    )}
                  </div>
                ))}
              </div>,
            )}
          {type === "matching" &&
            section(
              "Matching pairs",
              <>
                <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
                  Each term is matched to the definition on the same row.
                </p>
                {pairs.map((pair, index) => (
                  <div
                    key={pair.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr auto",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    {input(
                      pair.term,
                      (value) =>
                        setPairs((current) =>
                          current.map((item) =>
                            item.id === pair.id ? { ...item, term: value } : item,
                          ),
                        ),
                      `Term ${index + 1}`,
                    )}
                    {input(
                      pair.definition,
                      (value) =>
                        setPairs((current) =>
                          current.map((item) =>
                            item.id === pair.id ? { ...item, definition: value } : item,
                          ),
                        ),
                      `Definition ${index + 1}`,
                    )}
                    <button
                      type="button"
                      aria-label={`Remove pair ${index + 1}`}
                      onClick={() =>
                        setPairs((current) =>
                          current.length > 2
                            ? current.filter((item) => item.id !== pair.id)
                            : current,
                        )
                      }
                      disabled={pairs.length <= 2}
                      style={{
                        border: "1px solid #cbd5e1",
                        borderRadius: 8,
                        padding: 8,
                        background: "white",
                      }}
                    >
                      −
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setPairs((current) => [...current, { id: newId(), term: "", definition: "" }])
                  }
                  style={{ justifySelf: "start" }}
                >
                  + Add pair
                </button>
              </>,
            )}
          {type === "reorder" &&
            section(
              "Correct sequence",
              <>
                <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
                  Enter the items in the correct order. Students will be asked to rearrange them.
                </p>
                {reorderItems.map((item, index) => (
                  <div
                    key={item.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "32px 1fr auto",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <span style={{ color: "#64748b" }}>{index + 1}.</span>
                    {input(
                      item.text,
                      (value) => updateReorder(item.id, value),
                      `Step or item ${index + 1}`,
                    )}
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() =>
                          setReorderItems((current) => {
                            const next = [...current];
                            [next[index - 1], next[index]] = [next[index], next[index - 1]];
                            return next;
                          })
                        }
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={index === reorderItems.length - 1}
                        onClick={() =>
                          setReorderItems((current) => {
                            const next = [...current];
                            [next[index], next[index + 1]] = [next[index + 1], next[index]];
                            return next;
                          })
                        }
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        disabled={reorderItems.length <= 2}
                        onClick={() =>
                          setReorderItems((current) =>
                            current.length > 2
                              ? current.filter((row) => row.id !== item.id)
                              : current,
                          )
                        }
                      >
                        −
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setReorderItems((current) => [...current, { id: newId(), text: "" }])
                  }
                  style={{ justifySelf: "start" }}
                >
                  + Add item
                </button>
              </>,
            )}
          {type === "short_answer" &&
            section(
              "Expected answer",
              <>
                <label style={labelStyle}>
                  Sample answer
                  {input(sampleAnswer, setSampleAnswer, "A model answer for students to review")}
                </label>
                <label style={labelStyle}>
                  Accepted answers (comma-separated)
                  {input(acceptedAnswers, setAcceptedAnswers, "Optional: answer one, answer two")}
                </label>
                <span style={{ fontWeight: 400, color: "#64748b" }}>
                  Provide a sample answer, accepted answers, or both. Accepted answers can be used
                  for automatic checking.
                </span>
              </>,
            )}
          {type === "audio_spelling" &&
            section(
              "Audio and spelling key",
              <>
                <label style={labelStyle}>
                  Audio URL{input(audioUrl, setAudioUrl, "https://…/audio.mp3")}
                </label>
                <label style={labelStyle}>
                  Correct spelling{input(spellingWord, setSpellingWord, "Word students hear")}
                </label>
                <span style={{ fontWeight: 400, color: "#64748b" }}>
                  Use a publicly accessible audio file URL supported by your course setup.
                </span>
              </>,
            )}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 120px", gap: 12 }}>
            {section(
              "Student review explanation",
              <label style={labelStyle}>
                Explanation notes
                <textarea
                  style={{ ...fieldStyle, minHeight: 76, resize: "vertical" }}
                  value={explanation}
                  onChange={(event) => setExplanation(event.target.value)}
                  placeholder="Explain why the answer is correct…"
                />
              </label>,
            )}
            <label style={labelStyle}>
              Points
              <input
                style={fieldStyle}
                type="number"
                min="0"
                step="0.5"
                value={points}
                onChange={(event) => setPoints(Number(event.target.value))}
              />
            </label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={labelStyle}>
              Difficulty
              <select
                style={fieldStyle}
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value)}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>
            <label style={labelStyle}>
              Tags
              <input
                style={fieldStyle}
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="grammar, vocabulary, unit 2"
              />
              <span style={{ fontWeight: 400, color: "#64748b" }}>Separate tags with commas.</span>
            </label>
          </div>
          {error && (
            <p
              role="alert"
              style={{
                margin: 0,
                padding: 12,
                background: "#fff1f2",
                color: "#be123c",
                borderRadius: 8,
                fontSize: 14,
              }}
            >
              {error}
            </p>
          )}
          <footer
            style={{
              display: "flex",
              justifyContent: "end",
              gap: 10,
              borderTop: "1px solid #e2e8f0",
              paddingTop: 16,
            }}
          >
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "white",
                color: "#334155",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "10px 18px",
                borderRadius: 8,
                border: 0,
                background: saving ? "#94a3b8" : "#1d4ed8",
                color: "white",
                fontWeight: 700,
                cursor: saving ? "wait" : "pointer",
              }}
            >
              {saving ? "Saving…" : question ? "Save changes" : "Save question"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
