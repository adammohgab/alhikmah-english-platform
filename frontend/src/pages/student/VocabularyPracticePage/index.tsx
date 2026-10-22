import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/Tabs";
import { Button } from "@/shared/components/ui/Button";
import { Chip } from "@/shared/components/ui/Chip";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { SearchField } from "@/shared/components/ui/SearchField";
import { SegmentedControl } from "@/shared/components/ui/SegmentedControl";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { useToast } from "@/shared/hooks/useToast";
import {
  addWordsToLibrary,
  fetchGroupWords,
  fetchLibrary,
  fetchVocabGroups,
  setStarred,
  type ReviewOutcome,
  type VocabGroup,
} from "./api";
import { SessionView } from "./SessionView";
import { WordCard } from "./WordCard";
import {
  MASTERY_FILTERS,
  buildSession,
  countByMastery,
  filterWords,
  isDue,
  topicsOf,
  type LibraryWord,
  type MasteryFilter,
} from "./rules";

/* Vocabulary practice, /student/practice/vocabulary (STUDENT-SPEC ST-15, TASKS STU-CORE-16).
   Two tabs: From my lessons (words grouped by unit, with Learn and Practice) and My library (the
   student's words with search, mastery and topic filters). Practice is flashcards: flip, rate,
   and every rating is saved by `review_word`. Multiple choice and spelling modes from the spec
   are not part of this task. */

const LIBRARY_KEY = ["student", "vocabulary", "library"] as const;
const GROUPS_KEY = ["student", "vocabulary", "groups"] as const;

function ListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-busy="true">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-36 w-full rounded-[16px]" />
      ))}
    </div>
  );
}

interface GroupRowProps {
  group: VocabGroup;
  busy: boolean;
  onPractice: (group: VocabGroup) => void;
}

function GroupRow({ group, busy, onPractice }: GroupRowProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const words = useQuery({
    queryKey: ["student", "vocabulary", "group", group.unitId],
    queryFn: () => fetchGroupWords(group.unitId),
    enabled: open,
  });

  const add = useMutation({
    mutationFn: async () => addWordsToLibrary(words.data ?? []),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: LIBRARY_KEY });
      toast.show({
        title: result.added > 0 ? "Added to your library" : "Already in your library",
        description: result.added > 0 ? `${result.added} new ${result.added === 1 ? "word" : "words"} added.` : undefined,
        type: "success",
      });
    },
    onError: (error: Error) => toast.show({ title: "Could not add words", description: error.message, type: "error" }),
  });

  return (
    <li className="rounded-[16px] border-2 border-stroke bg-surface-0 p-4 shadow-retro-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[20px] text-stroke">{group.title}</h3>
          <p className="font-body text-[14px] text-muted">
            {group.count} {group.count === 1 ? "word" : "words"}
          </p>
        </div>
        <Button variant="outline" size="sm" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? "Hide words" : "Learn"}
        </Button>
        <Button size="sm" loading={busy} onClick={() => onPractice(group)}>
          Practice
        </Button>
      </div>

      {open && (
        <div className="mt-4 flex flex-col gap-3">
          {words.isPending && <ListSkeleton />}
          {words.isError && <ErrorState size="sm" description={words.error.message} onRetry={() => void words.refetch()} />}
          {words.data && (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {words.data.map((item) => (
                  <WordCard key={item.id} {...item} />
                ))}
              </div>
              <div>
                <Button variant="secondary" size="sm" loading={add.isPending} onClick={() => add.mutate()}>
                  Add all to my library
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </li>
  );
}

export default function VocabularyPracticePage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("library");
  const [search, setSearch] = useState("");
  const [mastery, setMastery] = useState<MasteryFilter>("all");
  const [topic, setTopic] = useState<string | null>(null);
  const [session, setSession] = useState<LibraryWord[] | null>(null);
  const [startingUnit, setStartingUnit] = useState<string | null>(null);

  const library = useQuery({ queryKey: LIBRARY_KEY, queryFn: fetchLibrary });
  const groups = useQuery({ queryKey: GROUPS_KEY, queryFn: fetchVocabGroups, enabled: tab === "lessons" });

  const words = useMemo(() => library.data ?? [], [library.data]);
  const topics = useMemo(() => topicsOf(words), [words]);
  const counts = useMemo(() => countByMastery(words), [words]);
  const visible = useMemo(() => filterWords(words, { search, mastery, topic }), [words, search, mastery, topic]);
  const dueCount = useMemo(() => {
    const now = Date.now();
    return words.filter((word) => isDue(word, now)).length;
  }, [words]);

  const star = useMutation({
    mutationFn: (word: LibraryWord) => setStarred(word.id, !word.starred),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: LIBRARY_KEY }),
    onError: (error: Error) => toast.show({ title: "Could not update the star", description: error.message, type: "error" }),
  });

  const applyReview = (wordId: string, outcome: ReviewOutcome) => {
    queryClient.setQueryData<LibraryWord[]>(LIBRARY_KEY, (current) =>
      current?.map((word) =>
        word.id === wordId ? { ...word, mastery: outcome.mastery, nextReviewAt: outcome.nextReviewAt } : word,
      ),
    );
  };

  const practiceGroup = async (group: VocabGroup) => {
    setStartingUnit(group.unitId);
    try {
      const lessonWords = await queryClient.fetchQuery({
        queryKey: ["student", "vocabulary", "group", group.unitId],
        queryFn: () => fetchGroupWords(group.unitId),
      });
      await addWordsToLibrary(lessonWords);
      const fresh = await queryClient.fetchQuery({ queryKey: LIBRARY_KEY, queryFn: fetchLibrary, staleTime: 0 });
      const ids = new Set(lessonWords.map((item) => item.id));
      const set = buildSession(
        fresh.filter((word) => word.vocabItemId !== null && ids.has(word.vocabItemId)),
        Date.now(),
      );
      if (set.length === 0) {
        toast.show({ title: "No words to practice", description: "This unit has no words yet.", type: "info" });
        return;
      }
      setSession(set);
    } catch (error) {
      toast.show({
        title: "Could not start practice",
        description: error instanceof Error ? error.message : "Please try again.",
        type: "error",
      });
    } finally {
      setStartingUnit(null);
    }
  };

  if (session !== null) {
    return (
      <main className="mx-auto w-full max-w-5xl p-4">
        <SessionView words={session} onExit={() => setSession(null)} onReviewed={applyReview} />
      </main>
    );
  }

  const unitQuery = search.trim().toLowerCase();
  const shownGroups = (groups.data ?? []).filter((group) => group.title.toLowerCase().includes(unitQuery));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4">
      <header>
        <h1 className="font-display text-[28px] leading-tight text-stroke">Vocabulary</h1>
        <p className="text-[14px] text-muted">Learn new words and review them with flashcards.</p>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList aria-label="Vocabulary sections">
          <TabsTrigger value="library">My library</TabsTrigger>
          <TabsTrigger value="lessons">From my lessons</TabsTrigger>
        </TabsList>

        <SearchField
          aria-label="Search words and meanings"
          placeholder="Search words and meanings"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          clearable
          onClear={() => setSearch("")}
        />

        <TabsContent value="library" className="flex flex-col gap-4">
          {library.isPending && <ListSkeleton />}
          {library.isError && <ErrorState description={library.error.message} onRetry={() => void library.refetch()} />}
          {library.data && words.length === 0 && (
            <EmptyState
              title="Your library is empty"
              description="Add your first word from a lesson or from the translator."
              actionLabel="See words from my lessons"
              onAction={() => setTab("lessons")}
            />
          )}
          {library.data && words.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <p className="flex-1 font-body text-[14px] text-muted">
                  {words.length} {words.length === 1 ? "word" : "words"} · {counts.learning} learning · {counts.mastered} mastered ·{" "}
                  {dueCount} to review
                </p>
                <Button
                  disabled={visible.length === 0}
                  onClick={() => setSession(buildSession(visible, Date.now()))}
                >
                  Practice {Math.min(visible.length, 20)} {Math.min(visible.length, 20) === 1 ? "card" : "cards"}
                </Button>
              </div>

              <SegmentedControl
                aria-label="Filter by mastery"
                options={MASTERY_FILTERS.map((item) => ({ value: item.value, label: item.label }))}
                value={mastery}
                onValueChange={(value) => setMastery(value as MasteryFilter)}
              />

              {topics.length > 0 && (
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by topic">
                  <Chip selected={topic === null} onClick={() => setTopic(null)}>
                    All topics
                  </Chip>
                  {topics.map((name) => (
                    <Chip key={name} selected={topic === name} onClick={() => setTopic(topic === name ? null : name)}>
                      {name}
                    </Chip>
                  ))}
                </div>
              )}

              {visible.length === 0 ? (
                <EmptyState size="sm" title="No matching words" description="Try a different search or filter." />
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {visible.map((item) => (
                    <WordCard
                      key={item.id}
                      word={item.word}
                      partOfSpeech={item.partOfSpeech}
                      pronunciation={item.pronunciation}
                      meaning={item.meaning}
                      arabicMeaning={item.arabicMeaning}
                      example={item.example}
                      level={item.level}
                      mastery={item.mastery}
                      starred={item.starred}
                      onToggleStar={() => star.mutate(item)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="lessons" className="flex flex-col gap-4">
          {groups.isPending && <ListSkeleton />}
          {groups.isError && <ErrorState description={groups.error.message} onRetry={() => void groups.refetch()} />}
          {groups.data && shownGroups.length === 0 && (
            <EmptyState size="sm" title="No lesson words found" description="Words from your units will show up here." />
          )}
          {shownGroups.length > 0 && (
            <ul className="flex flex-col gap-4">
              {shownGroups.map((group) => (
                <GroupRow
                  key={group.unitId}
                  group={group}
                  busy={startingUnit === group.unitId}
                  onPractice={(value) => void practiceGroup(value)}
                />
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
}
