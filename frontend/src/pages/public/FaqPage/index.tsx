import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PublicFooter } from "@/shared/components/layout/PublicFooter";
import { PublicHeader } from "@/shared/components/layout/PublicHeader";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/components/ui/Accordion";
import { Button } from "@/shared/components/ui/Button";
import { Chip } from "@/shared/components/ui/Chip";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { SearchField } from "@/shared/components/ui/SearchField";
import {
  FAQ_CATEGORIES,
  FAQ_ENTRIES,
  filterFaq,
  type FaqCategoryId,
  type FaqEntry,
} from "./faq-data";
import { useFaqFeedback, type FaqVote } from "./useFaqFeedback";

/* ========================================
   FaqPage: SH-07 "/faq" (SHARED-SPEC §5, PUB-09)

   Reading layout (720px). A search box filters questions as you type: every word must appear
   in a question, its answer or its keywords. Category pills (All, Students, Parents,
   Teachers, Technical) narrow the list further. Each category is an accordion; inside a
   category one question is open at a time, and "Expand all" lifts that rule. Keyboard model
   (arrows, Home, End, Enter, Space) comes from the Accordion primitive.
   ======================================================== */

const PAGE_TITLE = "FAQ | Wordland";

function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

type CategoryFilter = FaqCategoryId | "all";

function Feedback({
  entry,
  vote,
  onVote,
}: {
  entry: FaqEntry;
  vote: FaqVote | undefined;
  onVote: (id: string, value: FaqVote) => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-dashed border-[rgba(26,21,48,0.25)] pt-3">
      {vote === undefined ? (
        <>
          <span id={`feedback-${entry.id}`} className="text-[14px] font-semibold text-stroke">
            Did this answer your question?
          </span>
          <div role="group" aria-labelledby={`feedback-${entry.id}`} className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => onVote(entry.id, "yes")}>
              Yes
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onVote(entry.id, "no")}>
              No
            </Button>
          </div>
        </>
      ) : (
        <p role="status" className="text-[14px] text-muted">
          {vote === "yes" ? (
            "Thanks for letting us know."
          ) : (
            <>
              Sorry about that. Try different words in the search, or{" "}
              <Link to="/help" className="font-semibold text-stroke underline underline-offset-2">
                contact your school
              </Link>
              .
            </>
          )}
        </p>
      )}
    </div>
  );
}

export default function FaqPage() {
  useDocumentTitle(PAGE_TITLE);

  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [open, setOpen] = useState<string[]>([]);
  const [expandAll, setExpandAll] = useState(false);
  const { votes, vote } = useFaqFeedback();

  const visible = useMemo(() => filterFaq(FAQ_ENTRIES, query, category), [query, category]);

  const groups = useMemo(
    () =>
      FAQ_CATEGORIES.map((cat) => ({
        ...cat,
        entries: visible.filter((entry) => entry.category === cat.id),
      })).filter((group) => group.entries.length > 0),
    [visible],
  );

  const handleGroupChange = (groupIds: string[], next: string[]) => {
    setOpen((current) => {
      const others = current.filter((id) => !groupIds.includes(id));
      if (expandAll) return [...others, ...next];
      const previous = current.filter((id) => groupIds.includes(id));
      const added = next.filter((id) => !previous.includes(id));
      const kept = added.length > 0 ? [added[added.length - 1]] : next;
      return [...others, ...kept];
    });
  };

  const toggleExpandAll = () => {
    if (expandAll) {
      setExpandAll(false);
      setOpen([]);
    } else {
      setExpandAll(true);
      setOpen(visible.map((entry) => entry.id));
    }
  };

  const count = visible.length;
  const resultText =
    count === 0
      ? "No questions match."
      : `${count} ${count === 1 ? "question" : "questions"} shown.`;

  return (
    <>
      <PublicHeader mainId="main-content" />
      <main id="main-content" className="bg-surface-100">
        <div className="mx-auto w-full max-w-[720px] px-6 py-12 md:py-16">
          <h1 className="font-heading text-[36px] font-bold leading-tight text-stroke md:text-[48px]">
            Frequently asked questions
          </h1>
          <p className="mt-3 text-[16px] leading-snug text-muted">
            Quick answers about signing in, learning, rewards, the AI Tutor and privacy. You do not
            need an account to read this page.
          </p>

          <div className="mt-8">
            <SearchField
              aria-label="Search the FAQ"
              placeholder="Search questions, for example “password”"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onClear={() => setQuery("")}
              size="lg"
            />
          </div>

          <div
            role="group"
            aria-label="Filter by category"
            className="mt-4 flex flex-wrap gap-2.5 pb-1"
          >
            <Chip selected={category === "all"} onClick={() => setCategory("all")}>
              All
            </Chip>
            {FAQ_CATEGORIES.map((cat) => (
              <Chip key={cat.id} selected={category === cat.id} onClick={() => setCategory(cat.id)}>
                {cat.label}
              </Chip>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p role="status" aria-live="polite" className="text-[14px] text-muted">
              {resultText}
            </p>
            {count > 0 && (
              <Button size="sm" variant="ghost" onClick={toggleExpandAll}>
                {expandAll ? "Collapse all" : "Expand all"}
              </Button>
            )}
          </div>

          {groups.length === 0 ? (
            <EmptyState
              className="mt-4"
              title="No questions match."
              description="Try different words, or contact your school."
              action={
                <Button variant="primary" onClick={() => void navigate("/help")}>
                  Help and contact
                </Button>
              }
            />
          ) : (
            <div className="mt-4 space-y-10">
              {groups.map((group) => {
                const ids = group.entries.map((entry) => entry.id);
                return (
                  <section key={group.id} aria-labelledby={`faq-group-${group.id}`}>
                    <h2
                      id={`faq-group-${group.id}`}
                      className="mb-3 font-heading text-[22px] font-bold text-stroke"
                    >
                      {group.label}
                    </h2>
                    <Accordion
                      type="multiple"
                      value={open.filter((id) => ids.includes(id))}
                      onValueChange={(next) => handleGroupChange(ids, next)}
                    >
                      {group.entries.map((entry) => (
                        <AccordionItem key={entry.id} value={entry.id}>
                          <AccordionTrigger level={3}>{entry.question}</AccordionTrigger>
                          <AccordionContent>
                            <p className="leading-relaxed">{entry.answer}</p>
                            {entry.link && (
                              <p className="mt-3">
                                <Link
                                  to={entry.link.to}
                                  className="font-semibold text-stroke underline underline-offset-2"
                                >
                                  {entry.link.label}
                                </Link>
                              </p>
                            )}
                            <Feedback entry={entry} vote={votes[entry.id]} onVote={vote} />
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </section>
                );
              })}
            </div>
          )}

          <p className="mt-12 text-[15px] text-muted">
            Still stuck?{" "}
            <Link to="/help" className="font-semibold text-stroke underline underline-offset-2">
              Contact your school
            </Link>
            .
          </p>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}

export { FaqPage };
