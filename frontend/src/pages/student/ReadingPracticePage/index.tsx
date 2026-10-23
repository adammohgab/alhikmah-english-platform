import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Headphones,
  LoaderCircle,
  Pause,
  Play,
  Volume2,
} from "lucide-react";
import { supabase } from "@/shared/api/supabase";
import { StudentAppShell } from "@/shared/components/layout/StudentAppShell";
import type { StudentShellStats } from "@/shared/components/layout/StudentTopBar";
import { Button } from "@/shared/components/ui/Button";
import { useToast } from "@/shared/hooks/useToast";

type Question = { question: string; options: string[]; answer: number; explanation: string };
type Passage = {
  id: string;
  level: "A1" | "A2" | "B1" | "B2";
  title: string;
  topic: string;
  minutes: number;
  sentences: string[];
  questions: Question[];
};

const passages: Passage[] = [
  {
    id: "a1-morning",
    level: "A1",
    title: "A Busy Morning",
    topic: "Daily life",
    minutes: 2,
    sentences: [
      "Maya wakes up at seven o’clock every morning.",
      "She opens the window and lets the fresh air into her room.",
      "After breakfast, she walks to school with her brother.",
      "They talk about their plans and laugh on the way.",
      "Maya likes mornings because she feels ready for a new day.",
    ],
    questions: [
      {
        question: "What time does Maya wake up?",
        options: ["At six", "At seven", "At eight"],
        answer: 1,
        explanation: "The first sentence says Maya wakes up at seven o’clock.",
      },
      {
        question: "Who walks to school with Maya?",
        options: ["Her friend", "Her mother", "Her brother"],
        answer: 2,
        explanation: "She walks to school with her brother.",
      },
      {
        question: "Why does Maya like mornings?",
        options: ["She feels ready for a new day", "She has no school", "She sleeps late"],
        answer: 0,
        explanation: "Maya feels ready for a new day.",
      },
    ],
  },
  {
    id: "a2-community",
    level: "A2",
    title: "The Community Garden",
    topic: "Community",
    minutes: 3,
    sentences: [
      "Last spring, a group of neighbours decided to turn an empty piece of land into a garden.",
      "At first, the soil was dry and full of stones, so everyone worked together to prepare it.",
      "Some people planted tomatoes and beans, while others grew flowers that attracted bees and butterflies.",
      "The garden soon became a friendly place where children learned about plants and adults shared advice.",
      "By the end of summer, the neighbours had fresh vegetables and a stronger sense of community.",
    ],
    questions: [
      {
        question: "What did the neighbours create?",
        options: ["A playground", "A garden", "A shop"],
        answer: 1,
        explanation: "They turned empty land into a garden.",
      },
      {
        question: "Why were flowers useful?",
        options: [
          "They attracted bees and butterflies",
          "They made the soil dry",
          "They grew vegetables",
        ],
        answer: 0,
        explanation: "The flowers attracted bees and butterflies.",
      },
      {
        question: "What changed besides the land?",
        options: ["The weather", "The road", "The neighbours' sense of community"],
        answer: 2,
        explanation: "Working together gave them a stronger sense of community.",
      },
    ],
  },
  {
    id: "b1-learning",
    level: "B1",
    title: "Learning Beyond the Classroom",
    topic: "Learning",
    minutes: 4,
    sentences: [
      "When Sami joined a local science club, he expected to spend most of his time memorising facts.",
      "Instead, the club encouraged members to ask questions, test ideas, and learn from experiments that did not work as planned.",
      "One project involved designing a simple water filter from everyday materials, and the first version was far less effective than the team had hoped.",
      "Rather than giving up, they compared their results, changed the layers of material, and tested the filter again.",
      "Sami discovered that useful learning often comes from careful observation and persistence, not simply from getting the right answer immediately.",
    ],
    questions: [
      {
        question: "What surprised Sami about the club?",
        options: [
          "It focused on experiments and questions",
          "It had no projects",
          "It only used textbooks",
        ],
        answer: 0,
        explanation: "The club encouraged questions, testing, and learning from experiments.",
      },
      {
        question: "What did the team do when the filter did not work well?",
        options: [
          "They stopped the project",
          "They changed materials and tested again",
          "They bought a machine",
        ],
        answer: 1,
        explanation: "They compared results, changed the layers, and tested again.",
      },
      {
        question: "What lesson did Sami learn?",
        options: [
          "Speed matters most",
          "Mistakes should be ignored",
          "Observation and persistence help learning",
        ],
        answer: 2,
        explanation: "He learned the value of careful observation and persistence.",
      },
    ],
  },
  {
    id: "b2-cities",
    level: "B2",
    title: "Rethinking the Modern City",
    topic: "Environment",
    minutes: 5,
    sentences: [
      "As cities expand, planners face the challenge of making neighbourhoods both efficient and pleasant places to live.",
      "For decades, many urban areas prioritised private vehicles, often separating homes from workplaces and essential services.",
      "This approach can increase traffic, reduce opportunities for casual social contact, and make daily life more difficult for people who cannot drive.",
      "In response, some cities are investing in reliable public transport, safer cycling routes, and mixed-use neighbourhoods where shops, schools, and parks are within walking distance.",
      "Such changes require long-term planning and public support, yet they can reduce pollution while making streets more accessible and welcoming.",
      "Ultimately, a successful city is not measured only by how quickly people move through it, but also by how well it supports the people who live there.",
    ],
    questions: [
      {
        question: "What did many urban areas prioritise for decades?",
        options: ["Private vehicles", "Public gardens", "Walking routes"],
        answer: 0,
        explanation: "The passage says many areas prioritised private vehicles.",
      },
      {
        question: "What is one possible result of car-focused planning?",
        options: [
          "More casual social contact",
          "Less traffic everywhere",
          "Fewer opportunities for social contact",
        ],
        answer: 2,
        explanation: "The approach can reduce casual social contact.",
      },
      {
        question: "According to the passage, how should a city be judged?",
        options: [
          "Only by travel speed",
          "By how well it supports residents",
          "By the number of roads",
        ],
        answer: 1,
        explanation: "A successful city supports the people who live there.",
      },
    ],
  },
];

const definitions: Record<string, string> = {
  fresh: "Clean, cool, or pleasant; newly made or experienced.",
  neighbours: "People who live near you.",
  soil: "The top layer of earth where plants grow.",
  attracted: "Made someone or something interested in coming closer.",
  persistence: "Continuing to try even when something is difficult.",
  observation: "The act of watching something carefully to learn about it.",
  efficient: "Working well without wasting time or resources.",
  prioritised: "Treated something as more important than other things.",
  accessible: "Easy to reach, enter, use, or understand.",
  welcoming: "Friendly and making people feel comfortable.",
};

export default function ReadingPracticePage() {
  const toast = useToast();
  const [level, setLevel] = useState<Passage["level"]>("A1");
  const [passageId, setPassageId] = useState("a1-morning");
  const [activeSentence, setActiveSentence] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [selectedWord, setSelectedWord] = useState<{ word: string; meaning: string } | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [awarding, setAwarding] = useState(false);
  const [earnedXp, setEarnedXp] = useState<number | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const passage = useMemo(
    () => passages.find((p) => p.id === passageId) ?? passages[0]!,
    [passageId],
  );
  const score = passage.questions.reduce(
    (total, q, i) => total + (answers[i] === q.answer ? 1 : 0),
    0,
  );

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const stopAudio = () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setPlaying(false);
  };
  const playSentence = (index: number) => {
    if (!("speechSynthesis" in window)) {
      toast.show({
        title: "Audio is not supported",
        description: "Try a modern browser with speech enabled.",
        type: "error",
      });
      return;
    }
    if (index >= passage.sentences.length) {
      setPlaying(false);
      setActiveSentence(-1);
      return;
    }
    setActiveSentence(index);
    const utterance = new SpeechSynthesisUtterance(passage.sentences[index]);
    utterance.lang = "en-US";
    utterance.rate = 0.88;
    utteranceRef.current = utterance;
    utterance.onend = () => {
      if (utteranceRef.current === utterance) playSentence(index + 1);
    };
    utterance.onerror = () => {
      setPlaying(false);
      setActiveSentence(-1);
    };
    window.speechSynthesis.speak(utterance);
  };
  const startAudio = (from = 0) => {
    stopAudio();
    setPlaying(true);
    // Let cancel finish before queueing the first sentence.
    window.setTimeout(() => playSentence(from), 30);
  };
  const chooseLevel = (next: Passage["level"]) => {
    stopAudio();
    setLevel(next);
    setPassageId(passages.find((p) => p.level === next)?.id ?? passages[0].id);
    setAnswers({});
    setSubmitted(false);
    setEarnedXp(null);
    setSelectedWord(null);
  };
  const choosePassage = (id: string) => {
    stopAudio();
    setPassageId(id);
    setAnswers({});
    setSubmitted(false);
    setEarnedXp(null);
    setSelectedWord(null);
  };
  const openDefinition = (raw: string) => {
    const word = raw.replace(/[^a-z'-]/gi, "");
    if (!word) return;
    const meaning =
      definitions[word.toLowerCase()] ??
      `A word used in this passage. Read the surrounding sentence for context, or look up “${word}” in a dictionary.`;
    setSelectedWord({ word, meaning });
  };
  const submitQuiz = async () => {
    if (Object.keys(answers).length < passage.questions.length) {
      toast.show({
        title: "Finish every question",
        description: "Choose an answer for each checkpoint first.",
        type: "error",
      });
      return;
    }
    setSubmitted(true);
    if (earnedXp !== null) return;
    setAwarding(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Please sign in again to save your progress.");
      const refId = globalThis.crypto?.randomUUID?.();
      if (!refId) throw new Error("This browser cannot create a secure progress reference.");
      const { data, error } = await supabase.rpc("award_xp", {
        student_id: user.id,
        amount: score === passage.questions.length ? 20 : score > 0 ? 10 : 5,
        source: "reading_comprehension",
        ref_id: refId,
      });
      if (error) throw error;
      const payout = data as { awarded?: number; xp_awarded?: number } | null;
      const amount =
        typeof payout?.awarded === "number"
          ? payout.awarded
          : typeof payout?.xp_awarded === "number"
            ? payout.xp_awarded
            : score === passage.questions.length
              ? 20
              : score > 0
                ? 10
                : 5;
      setEarnedXp(amount);
      toast.show({
        title: "Reading checkpoint complete",
        description: `You earned ${amount} XP.`,
        type: "success",
      });
    } catch (e) {
      toast.show({
        title: "Quiz scored, XP not saved",
        description: e instanceof Error ? e.message : "Please try again.",
        type: "error",
      });
    } finally {
      setAwarding(false);
    }
  };

  const stats: StudentShellStats = {
    xpTotal: 0,
    level: 1,
    xpInLevel: 0,
    xpToNext: 100,
    coins: 0,
    streakDays: 0,
  };

  return (
    <StudentAppShell stats={stats}>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-8">
        <header className="flex items-start gap-3">
          <div className="text-ink rounded-2xl bg-[var(--skill-reading,#e1e9ff)] p-3">
            <BookOpen size={25} />
          </div>
          <div>
            <p className="text-sm font-semibold text-muted">Student practice</p>
            <h1 className="font-display text-ink text-3xl font-bold md:text-4xl">Reading room</h1>
            <p className="mt-2 max-w-2xl text-muted">
              Read at your level, listen sentence by sentence, explore new words, and check your
              understanding.
            </p>
          </div>
        </header>

        <section className="rounded-2xl border border-stroke bg-surface-0 p-4 md:p-5">
          <p className="text-ink mb-3 text-sm font-semibold">Choose your CEFR level</p>
          <div className="flex flex-wrap gap-2">
            {(["A1", "A2", "B1", "B2"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => chooseLevel(item)}
                aria-pressed={level === item}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition ${level === item ? "bg-primary text-white" : "bg-surface-1 text-ink hover:border-primary border border-stroke"}`}
              >
                {item}
                <span className="ml-2 text-xs font-normal opacity-80">
                  {
                    {
                      A1: "Beginner",
                      A2: "Elementary",
                      B1: "Intermediate",
                      B2: "Upper intermediate",
                    }[item]
                  }
                </span>
              </button>
            ))}
          </div>
          <label
            htmlFor="reading-passage"
            className="text-ink mb-2 mt-4 block text-sm font-semibold"
          >
            Reading passage
          </label>
          <select
            id="reading-passage"
            value={passageId}
            onChange={(e) => choosePassage(e.target.value)}
            className="text-ink focus:ring-primary w-full rounded-xl border border-stroke bg-surface-0 px-3 py-3 outline-none focus:ring-2"
          >
            {passages
              .filter((p) => p.level === level)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} · {p.minutes} min
                </option>
              ))}
          </select>
        </section>

        <section className="overflow-hidden rounded-2xl border border-stroke bg-surface-0">
          <div className="bg-surface-1/50 flex flex-wrap items-center justify-between gap-3 border-b border-stroke p-5 md:px-7">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-bold">
                  CEFR {passage.level}
                </span>
                <span className="text-sm text-muted">{passage.topic}</span>
                <span className="text-sm text-muted">· {passage.minutes} min read</span>
              </div>
              <h2 className="font-display text-ink mt-2 text-2xl font-bold">{passage.title}</h2>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  playing ? stopAudio() : startAudio(activeSentence >= 0 ? activeSentence : 0)
                }
              >
                {playing ? (
                  <Pause size={16} className="mr-2" />
                ) : (
                  <Play size={16} className="mr-2" />
                )}
                {playing ? "Pause audio" : "Read aloud"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  stopAudio();
                  startAudio(0);
                }}
                aria-label="Restart narration"
              >
                <Volume2 size={16} />
              </Button>
            </div>
          </div>
          <div className="p-5 md:p-7">
            <div className="mb-4 flex items-center gap-2 text-xs text-muted">
              <Headphones size={15} /> Select any sentence to hear it; the active sentence is
              highlighted during narration.
            </div>
            <div className="text-ink space-y-3 text-lg leading-8 md:text-xl">
              {passage.sentences.map((sentence, i) => (
                <span key={`${passage.id}-${i}`} className="inline">
                  <button
                    type="button"
                    onClick={() => startAudio(i)}
                    aria-label={`Read sentence ${i + 1}`}
                    className={`rounded-md px-1 py-0.5 text-left leading-8 transition ${activeSentence === i ? "bg-amber-200 text-slate-900 ring-2 ring-amber-400" : "hover:bg-surface-1"}`}
                  >
                    {sentence}
                  </button>{" "}
                </span>
              ))}
            </div>
            <div className="bg-surface-1/40 mt-5 rounded-xl border border-dashed border-stroke p-4">
              <p className="text-ink text-sm font-semibold">Explore a word</p>
              <p className="mt-1 text-sm text-muted">
                Click a word below to see a short definition.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {Array.from(new Set(passage.sentences.join(" ").match(/[A-Za-z'-]+/g) ?? []))
                  .filter((word) => definitions[word.toLowerCase()])
                  .map((word) => (
                    <button
                      type="button"
                      key={word}
                      onClick={() => openDefinition(word)}
                      className="text-ink hover:border-primary rounded-full border border-stroke bg-surface-0 px-3 py-1.5 text-sm"
                    >
                      {word}
                    </button>
                  ))}
              </div>
              {selectedWord && (
                <div
                  role="status"
                  className="border-primary/30 bg-primary/5 mt-3 rounded-lg border p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-ink font-semibold">{selectedWord.word}</p>
                      <p className="text-ink mt-1 text-sm">{selectedWord.meaning}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedWord(null)}
                      className="text-sm text-muted underline"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-stroke bg-surface-0 p-5 md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-primary text-sm font-semibold">Comprehension checkpoint</p>
              <h2 className="font-display text-ink mt-1 text-2xl font-bold">
                Check what you understood
              </h2>
              <p className="mt-1 text-sm text-muted">
                Answer all {passage.questions.length} questions to finish this reading.
              </p>
            </div>
            <span className="bg-surface-1 text-ink rounded-full px-3 py-1 text-sm font-semibold">
              {Object.keys(answers).length}/{passage.questions.length} answered
            </span>
          </div>
          <div className="mt-5 space-y-5">
            {passage.questions.map((q, i) => (
              <fieldset key={`${passage.id}-q${i}`} className="rounded-xl border border-stroke p-4">
                <legend className="text-ink px-1 font-semibold">
                  {i + 1}. {q.question}
                </legend>
                <div className="mt-2 grid gap-2">
                  {q.options.map((option, oi) => (
                    <label
                      key={option}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${answers[i] === oi ? "border-primary bg-primary/5 text-ink" : "text-ink hover:bg-surface-1 border-stroke"}`}
                    >
                      <input
                        type="radio"
                        name={`question-${i}`}
                        checked={answers[i] === oi}
                        disabled={submitted}
                        onChange={() => setAnswers((prev) => ({ ...prev, [i]: oi }))}
                        className="mt-0.5 accent-[var(--color-primary)]"
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
                {submitted && (
                  <div className="bg-surface-1 mt-3 rounded-lg p-3 text-sm">
                    <p
                      className={`font-semibold ${answers[i] === q.answer ? "text-emerald-700" : "text-ink"}`}
                    >
                      {answers[i] === q.answer
                        ? "Correct!"
                        : `Correct answer: ${q.options[q.answer]}`}
                    </p>
                    <p className="mt-1 text-muted">{q.explanation}</p>
                  </div>
                )}
              </fieldset>
            ))}
          </div>
          {!submitted ? (
            <div className="mt-5">
              <Button onClick={() => void submitQuiz()} disabled={awarding}>
                {awarding && <LoaderCircle size={16} className="mr-2 animate-spin" />}Submit answers{" "}
                <ChevronRight size={16} className="ml-1" />
              </Button>
            </div>
          ) : (
            <div className="bg-surface-1 mt-5 rounded-xl border border-stroke p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-primary" size={22} />
                <h3 className="font-display text-ink text-xl font-bold">
                  Score: {score}/{passage.questions.length}
                </h3>
              </div>
              <p className="mt-1 text-sm text-muted">
                {score === passage.questions.length
                  ? "Excellent work — every answer is correct."
                  : "Review the explanations, then try another passage to keep improving."}
              </p>
              {earnedXp !== null && (
                <p className="text-primary mt-3 font-semibold">+{earnedXp} XP earned</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setAnswers({});
                    setSubmitted(false);
                    setEarnedXp(null);
                  }}
                >
                  Try again
                </Button>
                <Button
                  onClick={() => {
                    const next = passages.find((p) => p.level === level && p.id !== passage.id);
                    if (next) choosePassage(next.id);
                    else {
                      const idx = ["A1", "A2", "B1", "B2"].indexOf(level);
                      chooseLevel(["A1", "A2", "B1", "B2"][(idx + 1) % 4] as Passage["level"]);
                    }
                  }}
                >
                  Next reading
                </Button>
              </div>
            </div>
          )}
        </section>
      </main>
    </StudentAppShell>
  );
}
