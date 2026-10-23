import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, BookMarked, Languages, LoaderCircle, Search, Volume2 } from "lucide-react";
import { supabase } from "@/shared/api/supabase";
import { StudentAppShell } from "@/shared/components/layout/StudentAppShell";
import type { StudentShellStats } from "@/shared/components/layout/StudentTopBar";
import { Button } from "@/shared/components/ui/Button";
import { useToast } from "@/shared/hooks/useToast";

type Direction = "en_ar" | "ar_en";
type Example = { source: string; target: string };
type Translation = {
  translation: string;
  translation_harakat?: string | null;
  pos?: string | null;
  ipa?: string | null;
  examples: Example[];
  related?: string[];
  direction?: Direction;
};

export default function TranslationPracticePage() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState<Direction>("en_ar");
  const [result, setResult] = useState<Translation | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);

  const translate = async (text: string, dir: Direction) => {
    const value = text.trim();
    if (!value) {
      setResult(null);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-translate", {
        body: { query: value, direction: dir },
      });
      if (error) throw error;
      if (id !== requestId.current) return;
      if (!data || data.blocked || !data.translation) {
        setResult(null);
        toast.show({
          title: "No translation found",
          description: data?.message ?? "Try a word or short phrase.",
          type: "error",
        });
        return;
      }
      setResult(data as Translation);
      setSaved(false);
    } catch (e) {
      if (id === requestId.current)
        toast.show({
          title: "Translation failed",
          description: e instanceof Error ? e.message : "Please try again.",
          type: "error",
        });
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!query.trim()) {
      setResult(null);
      setLoading(false);
      return;
    }
    timer.current = setTimeout(() => void translate(query, direction), 450);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // translate intentionally debounced from the current query and direction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, direction]);

  const speak = (text: string, lang: string) => {
    if (!("speechSynthesis" in window)) {
      toast.show({ title: "Audio is not supported in this browser", type: "error" });
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  };

  const saveWord = async () => {
    if (!result || !query.trim()) return;
    setSaving(true);
    try {
      const english = direction === "en_ar" ? query.trim() : result.translation;
      const arabic =
        direction === "en_ar" ? result.translation_harakat || result.translation : query.trim();
      const { error } = await supabase.rpc("add_words_to_library", {
        items: [
          {
            word: english,
            part_of_speech: result.pos ?? null,
            meaning: arabic,
            arabic_meaning: arabic,
            example: result.examples?.[0]
              ? `${result.examples[0].source} — ${result.examples[0].target}`
              : null,
            vocab_item_id: null,
          },
        ],
        from: "translation",
      });
      if (error) throw error;
      setSaved(true);
      toast.show({
        title: "Added to My Words",
        description: "This word is in your personal review deck.",
        type: "success",
      });
    } catch (e) {
      toast.show({
        title: "Could not save this word",
        description: e instanceof Error ? e.message : "Please try again.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const arabic = direction === "en_ar" ? result?.translation_harakat || result?.translation : query;
  const english = direction === "en_ar" ? query : result?.translation;

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
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-8">
        <header className="flex items-start gap-3">
          <div className="text-ink rounded-2xl bg-[var(--skill-translation,#d9f3ef)] p-3">
            <Languages size={25} />
          </div>
          <div>
            <p className="text-sm font-semibold text-muted">Student practice</p>
            <h1 className="font-display text-ink text-3xl font-bold md:text-4xl">
              Translation workbench
            </h1>
            <p className="mt-2 max-w-2xl text-muted">
              Look up English and Arabic words, hear them aloud, and save useful vocabulary to
              review later.
            </p>
          </div>
        </header>

        <section className="rounded-2xl border border-stroke bg-surface-0 p-4 md:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setDirection("en_ar")}
              aria-pressed={direction === "en_ar"}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${direction === "en_ar" ? "bg-primary text-white" : "bg-surface-1 text-ink"}`}
            >
              English → Arabic
            </button>
            <button
              type="button"
              onClick={() => setDirection("ar_en")}
              aria-pressed={direction === "ar_en"}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${direction === "ar_en" ? "bg-primary text-white" : "bg-surface-1 text-ink"}`}
            >
              Arabic → English
            </button>
            <button
              type="button"
              aria-label="Switch translation direction"
              onClick={() => {
                setDirection((d) => (d === "en_ar" ? "ar_en" : "en_ar"));
                setQuery("");
                setResult(null);
              }}
              className="text-ink hover:bg-surface-1 ml-auto rounded-lg border border-stroke p-2"
            >
              <ArrowLeftRight size={18} />
            </button>
          </div>
          <label htmlFor="translation-query" className="text-ink mb-2 block text-sm font-semibold">
            Word or short phrase
          </label>
          <div className="flex gap-2">
            <div className="focus-within:ring-primary flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-stroke bg-surface-0 px-3 focus-within:ring-2">
              <Search size={19} className="shrink-0 text-muted" />
              <input
                id="translation-query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                maxLength={300}
                dir={direction === "ar_en" ? "rtl" : "ltr"}
                placeholder={
                  direction === "en_ar" ? "Try “adventure” or “brave”" : "جرّب كلمة مثل «مغامرة»"
                }
                className="text-ink min-w-0 flex-1 bg-transparent py-3 text-base outline-none"
                autoComplete="off"
              />
              {loading && <LoaderCircle className="text-primary animate-spin" size={18} />}
            </div>
            <Button
              onClick={() => void translate(query, direction)}
              disabled={!query.trim() || loading}
            >
              <Search size={16} className="mr-1" /> Translate
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted">
            Translations update as you type. Use a single word for the most useful part-of-speech
            information.
          </p>
        </section>

        {result && (
          <section className="overflow-hidden rounded-2xl border border-stroke bg-surface-0">
            <div className="bg-surface-1/50 border-b border-stroke p-5 md:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-muted">
                    {direction === "en_ar" ? "English" : "Arabic"}
                  </p>
                  <h2 className="font-display text-ink mt-1 break-words text-2xl font-bold">
                    {english}
                  </h2>
                  <p className="mt-5 text-sm font-semibold text-muted">Arabic translation</p>
                  <p
                    lang="ar"
                    dir="rtl"
                    className="text-ink mt-1 font-['IBM_Plex_Sans_Arabic',sans-serif] text-3xl leading-relaxed md:text-4xl"
                  >
                    {arabic}
                  </p>
                  {result.ipa && (
                    <p className="mt-2 text-sm text-muted">
                      Pronunciation: <span className="font-mono">{result.ipa}</span>
                    </p>
                  )}
                  {result.pos && (
                    <span className="bg-primary/10 text-primary mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold">
                      {result.pos}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => speak(String(english ?? ""), "en-US")}
                    aria-label="Play English pronunciation"
                  >
                    <Volume2 size={17} className="mr-2" /> English
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => speak(String(arabic ?? ""), "ar-SA")}
                    aria-label="Play Arabic pronunciation"
                  >
                    <Volume2 size={17} className="mr-2" /> العربية
                  </Button>
                </div>
              </div>
              <div className="mt-5">
                <Button onClick={() => void saveWord()} loading={saving} disabled={saved || saving}>
                  <BookMarked size={17} className="mr-2" />
                  {saved ? "Saved to My Words" : "Save to My Words"}
                </Button>
              </div>
            </div>
            <div className="p-5 md:p-7">
              <h3 className="font-display text-ink text-xl font-bold">Examples in context</h3>
              <div className="mt-4 flex flex-col divide-y divide-stroke">
                {(result.examples ?? []).slice(0, 3).map((example, i) => (
                  <article
                    key={`${example.source}-${i}`}
                    className="grid gap-2 py-4 md:grid-cols-2 md:gap-6"
                  >
                    <p className="text-ink">{example.source}</p>
                    <p
                      lang="ar"
                      dir="rtl"
                      className="text-ink font-['IBM_Plex_Sans_Arabic',sans-serif]"
                    >
                      {example.target}
                    </p>
                  </article>
                ))}
              </div>
              {!!result.related?.length && (
                <div className="mt-3 border-t border-stroke pt-4">
                  <h3 className="text-ink text-sm font-semibold">Related words and phrases</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {result.related.map((word) => (
                      <button
                        key={word}
                        onClick={() => setQuery(word)}
                        className="text-ink hover:border-primary rounded-full border border-stroke px-3 py-1.5 text-sm"
                      >
                        {word}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
        {!result && !loading && query.trim() && (
          <div className="rounded-xl border border-dashed border-stroke p-6 text-center text-sm text-muted">
            Searching for your translation… If nothing appears, check the word and try again.
          </div>
        )}
        {!query.trim() && (
          <div className="rounded-2xl border border-dashed border-stroke p-8 text-center">
            <Languages className="mx-auto text-muted" size={28} />
            <h2 className="font-display text-ink mt-3 text-xl font-bold">
              Your next word starts here
            </h2>
            <p className="mt-1 text-sm text-muted">
              Search in either language to see meanings, pronunciation, and real examples.
            </p>
          </div>
        )}
      </main>
    </StudentAppShell>
  );
}
