import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  Save,
  Send,
} from "lucide-react";
import { Dialog } from "@/shared/components/ui/Dialog";
import { QuestionRenderer } from "@/shared/components/questions/QuestionRenderer";
import type { QuestionRendererProps } from "@/shared/components/questions/QuestionRenderer";
import type { AssignmentDetails } from "../AssignmentDetailsPage/types";
import { SolveError, submitAssignment, saveAssignmentDraft, useAssignmentWorkspace } from "./api";
import { countAnswered, isAnswerEmpty, isWritingAnswer, totalPoints } from "./questions";
import {
  formatDue,
  formatPoints,
  formatPromptPreview,
  formatQuestionType,
  formatSavedAt,
} from "./format";
import { useAutosave } from "./useAutosave";
import type { AnswerMap, SolveAnswer, SolveErrorCode, SolveQuestion, SubmitResult } from "./types";
import { WritingEditor } from "./WritingEditor";
import importedStyles from "./AssignmentSolvePage.module.css";

type StyleName =
  | "workspace"
  | "topBar"
  | "topBarInner"
  | "exitButton"
  | "exitLabel"
  | "titleBlock"
  | "eyebrow"
  | "title"
  | "saveState"
  | "saveStateText"
  | "saveStateIcon"
  | "spinner"
  | "retryButton"
  | "dueDate"
  | "progressWrap"
  | "progressMeta"
  | "progressTrack"
  | "progressFill"
  | "content"
  | "layout"
  | "mainColumn"
  | "successBanner"
  | "bannerIcon"
  | "bannerCopy"
  | "notice"
  | "questionCard"
  | "questionHead"
  | "questionNumber"
  | "questionMeta"
  | "typeChip"
  | "answeredPill"
  | "prompt"
  | "srOnly"
  | "answerArea"
  | "desktopPager"
  | "pagerButton"
  | "pagerHint"
  | "rail"
  | "railCard"
  | "railHead"
  | "railCount"
  | "navGrid"
  | "navButton"
  | "legend"
  | "legendItem"
  | "legendDot"
  | "legendDotAnswered"
  | "legendDotCurrent"
  | "facts"
  | "factRow"
  | "factLabel"
  | "factValue"
  | "railActions"
  | "saveButton"
  | "submitButton"
  | "buttonIcon"
  | "lockedNote"
  | "lockedLink"
  | "mobileBar"
  | "mobilePager"
  | "mobileCount"
  | "mobileSubmit"
  | "statePage"
  | "stateCard"
  | "stateKicker"
  | "stateTitle"
  | "stateMessage"
  | "stateActions"
  | "primaryLink"
  | "secondaryButton"
  | "stateIcon"
  | "skeleton"
  | "skeletonLine"
  | "skeletonLineShort"
  | "skeletonBlock"
  | "dialogBody"
  | "unansweredTitle"
  | "unansweredList"
  | "warningBox"
  | "answerComplete"
  | "submitError"
  | "dialogActions"
  | "dialogCancel"
  | "dialogSubmit";
const styles = importedStyles as Record<StyleName, string>;

function promptText(question: SolveQuestion): string {
  return question.kind === "writing" ? question.prompt.text : question.question.prompt.text;
}

/* The workspace renders inside the student shell; this root supplies the Writing world tokens. */
export default function AssignmentSolvePage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { state, retry } = useAssignmentWorkspace(assignmentId);

  if (state.status === "loading") return <LoadingState />;
  if (state.status === "error") return <ErrorState code={state.code} onRetry={retry} />;
  if (state.status === "locked") return <LockedState brief={state.brief} />;

  return (
    <SolveWorkspace
      key={`${assignmentId ?? "assignment"}:${state.submissionId}`}
      assignmentId={assignmentId ?? ""}
      brief={state.brief}
      questions={state.questions}
      initialAnswers={state.initialAnswers}
      ignoredQuestionCount={state.ignoredQuestionCount}
    />
  );
}

interface SolveWorkspaceProps {
  assignmentId: string;
  brief: AssignmentDetails;
  questions: SolveQuestion[];
  initialAnswers: AnswerMap;
  ignoredQuestionCount: number;
}

function SolveWorkspace({
  assignmentId,
  brief,
  questions,
  initialAnswers,
  ignoredQuestionCount,
}: SolveWorkspaceProps) {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<AnswerMap>(initialAnswers);
  const [revision, setRevision] = useState(0);
  const [current, setCurrent] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const saveDraft = useCallback(
    async (snapshot: AnswerMap) => {
      await saveAssignmentDraft(assignmentId, snapshot);
    },
    [assignmentId],
  );

  const autosave = useAutosave<AnswerMap>({
    enabled: !submitted && !submitting,
    revision,
    snapshot: answers,
    save: saveDraft,
  });

  useEffect(() => {
    if (autosave.savedAt === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      window.clearInterval(timer);
    };
  }, [autosave.savedAt]);

  const answeredCount = useMemo(() => countAnswered(questions, answers), [answers, questions]);
  const unanswered = useMemo(
    () =>
      questions.flatMap((question, index) =>
        isAnswerEmpty(question, answers[question.id])
          ? [
              {
                id: question.id,
                number: index + 1,
                prompt: formatPromptPreview(promptText(question)),
              },
            ]
          : [],
      ),
    [answers, questions],
  );
  const hasWriting = useMemo(
    () => questions.some((question) => question.kind === "writing"),
    [questions],
  );
  const total = totalPoints(questions);
  const points = total > 0 ? total : (brief.points ?? 0);
  const currentIndex = Math.min(current, Math.max(0, questions.length - 1));
  const question = questions[currentIndex];
  const position = currentIndex + 1;
  const answered = question ? !isAnswerEmpty(question, answers[question.id]) : false;
  const savedLabel = formatSavedAt(autosave.savedAt, now);
  const statusText = submitted
    ? "Submitted"
    : autosave.status === "saving"
      ? "Saving…"
      : autosave.status === "error"
        ? "Could not save"
        : autosave.dirty
          ? "Autosaving soon"
          : (savedLabel ?? "Autosave on");

  const updateAnswer = useCallback((questionId: string, answer: SolveAnswer) => {
    setAnswers((previous) => ({ ...previous, [questionId]: answer }));
    setRevision((value) => value + 1);
  }, []);

  const selectQuestion = (index: number) => {
    setCurrent(Math.min(Math.max(index, 0), questions.length - 1));
  };

  const handleSave = () => {
    void autosave.saveNow();
  };

  const handleExit = async () => {
    if (submitting) return;
    if (!submitted && autosave.dirty) {
      const saved = await autosave.saveNow();
      if (!saved) {
        const leave = window.confirm(
          "Your latest changes could not be saved. Leave this page anyway?",
        );
        if (!leave) return;
      }
    }
    void navigate(`/student/assignments/${encodeURIComponent(assignmentId)}`);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const result = await submitAssignment(assignmentId, answers);
      setSubmitted(true);
      setConfirmOpen(false);
      setSubmitResult(result);
      setNow(Date.now());
    } catch (error) {
      if (error instanceof SolveError && error.code === "NOT_FOUND") {
        setSubmitError("This assignment is no longer available. Ask your teacher for help.");
      } else {
        setSubmitError(
          "We couldn't submit your assignment. Your answers are still here. Try again.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!question) {
    return (
      <ErrorState
        code="NO_QUESTIONS"
        onRetry={() => {
          window.location.reload();
        }}
      />
    );
  }

  const progress =
    questions.length === 0 ? 0 : Math.round((answeredCount / questions.length) * 100);
  const due = formatDue(brief.dueAt);
  const typeLabel = formatQuestionType(question);
  const pointsLabel = formatPoints(question.points);
  const currentAnswer = answers[question.id];
  const writingHtml =
    question.kind === "writing" && isWritingAnswer(currentAnswer) ? currentAnswer.html : "";
  const lateMessage =
    submitResult?.isLate === true
      ? `Submitted late. ${submitResult.latePenaltyPct !== undefined ? `Your work may be reduced by ${submitResult.latePenaltyPct}%.` : "Your teacher's late policy applies."}`
      : undefined;

  return (
    <div className={styles.workspace} data-world="amber">
      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <button
            type="button"
            className={styles.exitButton}
            onClick={() => {
              void handleExit();
            }}
            disabled={submitting}
          >
            <ArrowLeft size={20} aria-hidden="true" />
            <span className={styles.exitLabel}>Exit</span>
          </button>

          <div className={styles.titleBlock}>
            <p className={styles.eyebrow}>Assignment</p>
            <h1 className={styles.title}>{brief.title}</h1>
          </div>

          <div className={styles.saveState} data-state={submitted ? "submitted" : autosave.status}>
            {submitted ? (
              <CheckCircle2 className={styles.saveStateIcon} size={18} aria-hidden="true" />
            ) : autosave.status === "saving" ? (
              <Loader2
                className={`${styles.saveStateIcon} ${styles.spinner}`}
                size={18}
                aria-hidden="true"
              />
            ) : autosave.status === "error" ? (
              <AlertTriangle className={styles.saveStateIcon} size={18} aria-hidden="true" />
            ) : autosave.dirty ? (
              <Clock3 className={styles.saveStateIcon} size={18} aria-hidden="true" />
            ) : (
              <Check className={styles.saveStateIcon} size={18} aria-hidden="true" />
            )}
            <span className={styles.saveStateText} role="status" aria-live="polite">
              {statusText}
            </span>
            {autosave.status === "error" && !submitted ? (
              <button
                type="button"
                className={styles.retryButton}
                onClick={handleSave}
                disabled={submitting}
              >
                Try again
              </button>
            ) : null}
          </div>

          <div className={styles.dueDate}>
            <Clock3 size={16} aria-hidden="true" />
            <span>{due === "No due date" ? due : `Due ${due}`}</span>
          </div>
        </div>

        <div className={styles.progressWrap}>
          <div className={styles.progressMeta}>
            <span>
              Question {position} of {questions.length}
            </span>
            <span>
              {answeredCount} of {questions.length} answered
            </span>
          </div>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-label="Questions answered"
            aria-valuemin={0}
            aria-valuemax={questions.length}
            aria-valuenow={answeredCount}
          >
            <span className={styles.progressFill} style={{ inlineSize: `${progress}%` }} />
          </div>
        </div>
      </header>

      <main className={styles.content}>
        <div className={styles.layout}>
          <div className={styles.mainColumn}>
            {submitted ? (
              <div className={styles.successBanner} role="status">
                <span className={styles.bannerIcon}>
                  <CheckCircle2 size={24} aria-hidden="true" />
                </span>
                <div className={styles.bannerCopy}>
                  <strong>Submitted for grading.</strong>
                  <span>
                    Your answers are locked. {lateMessage ?? "You can close this page now."}
                  </span>
                </div>
              </div>
            ) : null}

            {ignoredQuestionCount > 0 ? (
              <p className={styles.notice}>
                <AlertTriangle size={18} aria-hidden="true" />
                {ignoredQuestionCount} question
                {ignoredQuestionCount === 1 ? " uses a format" : "s use formats"} this workspace
                can&apos;t display yet. Ask your teacher which questions to answer.
              </p>
            ) : null}

            <article className={styles.questionCard} aria-labelledby={`question-${question.id}`}>
              <div className={styles.questionHead}>
                <div>
                  <p className={styles.questionNumber}>
                    Question {position} of {questions.length}
                  </p>
                  <p className={styles.questionMeta}>
                    <span className={styles.typeChip}>{typeLabel}</span>
                    {pointsLabel ? <span>{pointsLabel}</span> : null}
                  </p>
                </div>
                <span className={styles.answeredPill} data-answered={answered}>
                  {answered ? <Check size={14} aria-hidden="true" /> : null}
                  {answered ? "Answered" : "Not answered"}
                </span>
              </div>

              <h2
                id={`question-${question.id}`}
                className={question.kind === "writing" ? styles.prompt : styles.srOnly}
              >
                {promptText(question) || "Answer this question"}
              </h2>

              <div className={styles.answerArea}>
                {question.kind === "writing" ? (
                  <WritingEditor
                    key={question.id}
                    initialHtml={writingHtml}
                    readOnly={submitted}
                    label={`Writing answer for question ${position}`}
                    minWords={question.minWords ?? brief.wordCount.min}
                    maxWords={question.maxWords ?? brief.wordCount.max}
                    onChange={(answer) => updateAnswer(question.id, answer)}
                  />
                ) : (
                  <QuestionRenderer
                    {...({
                      question: question.question,
                      value: answers[question.id],
                      onChange: (answer: SolveAnswer) => updateAnswer(question.id, answer),
                      readOnly: submitted,
                    } as unknown as QuestionRendererProps)}
                  />
                )}
              </div>
            </article>

            <nav className={styles.desktopPager} aria-label="Question paging">
              <button
                type="button"
                className={styles.pagerButton}
                onClick={() => selectQuestion(currentIndex - 1)}
                disabled={currentIndex === 0}
              >
                <ChevronLeft size={18} aria-hidden="true" />
                Previous
              </button>
              <span className={styles.pagerHint}>
                {currentIndex + 1} / {questions.length}
              </span>
              <button
                type="button"
                className={styles.pagerButton}
                onClick={() => selectQuestion(currentIndex + 1)}
                disabled={currentIndex >= questions.length - 1}
              >
                Next
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </nav>
          </div>

          <aside className={styles.rail} aria-label="Assignment navigation">
            <div className={styles.railCard}>
              <div className={styles.railHead}>
                <h2>Questions</h2>
                <span className={styles.railCount}>
                  {answeredCount}/{questions.length}
                </span>
              </div>

              <div className={styles.navGrid} role="group" aria-label="Jump to a question">
                {questions.map((item, index) => {
                  const itemAnswered = !isAnswerEmpty(item, answers[item.id]);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={styles.navButton}
                      data-answered={itemAnswered}
                      data-current={index === currentIndex}
                      aria-current={index === currentIndex ? "step" : undefined}
                      aria-label={`Question ${index + 1}${itemAnswered ? ", answered" : ", not answered"}`}
                      onClick={() => selectQuestion(index)}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>

              <div className={styles.legend}>
                <span className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.legendDotAnswered}`} />
                  Answered
                </span>
                <span className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.legendDotCurrent}`} />
                  Current
                </span>
              </div>

              <dl className={styles.facts}>
                <div className={styles.factRow}>
                  <dt className={styles.factLabel}>Status</dt>
                  <dd className={styles.factValue}>{submitted ? "Submitted" : "In progress"}</dd>
                </div>
                <div className={styles.factRow}>
                  <dt className={styles.factLabel}>Due</dt>
                  <dd className={styles.factValue}>{due}</dd>
                </div>
                {points > 0 ? (
                  <div className={styles.factRow}>
                    <dt className={styles.factLabel}>Points</dt>
                    <dd className={styles.factValue}>{points}</dd>
                  </div>
                ) : null}
              </dl>

              {submitted ? (
                <div className={styles.lockedNote}>
                  <p>This assignment is read-only now.</p>
                  <Link
                    className={styles.lockedLink}
                    to={`/student/assignments/${encodeURIComponent(assignmentId)}`}
                  >
                    Back to assignment
                  </Link>
                </div>
              ) : (
                <div className={styles.railActions}>
                  <button
                    type="button"
                    className={styles.saveButton}
                    onClick={handleSave}
                    disabled={submitting}
                  >
                    <Save className={styles.buttonIcon} size={18} aria-hidden="true" />
                    Save draft
                  </button>
                  <button
                    type="button"
                    className={styles.submitButton}
                    onClick={() => {
                      setSubmitError(null);
                      setConfirmOpen(true);
                    }}
                    disabled={submitting}
                  >
                    <Send className={styles.buttonIcon} size={18} aria-hidden="true" />
                    Submit for Grading
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>

      <div className={styles.mobileBar}>
        <button
          type="button"
          className={styles.mobilePager}
          aria-label="Previous question"
          onClick={() => selectQuestion(currentIndex - 1)}
          disabled={currentIndex === 0}
        >
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <span className={styles.mobileCount}>
          {currentIndex + 1} / {questions.length}
        </span>
        <button
          type="button"
          className={styles.mobilePager}
          aria-label="Next question"
          onClick={() => selectQuestion(currentIndex + 1)}
          disabled={currentIndex >= questions.length - 1}
        >
          <ChevronRight size={22} aria-hidden="true" />
        </button>
        {submitted ? (
          <button
            type="button"
            className={styles.mobileSubmit}
            onClick={() => {
              void navigate(`/student/assignments/${encodeURIComponent(assignmentId)}`);
            }}
          >
            Back
          </button>
        ) : (
          <button
            type="button"
            className={styles.mobileSubmit}
            onClick={() => {
              setSubmitError(null);
              setConfirmOpen(true);
            }}
            disabled={submitting}
          >
            Submit
          </button>
        )}
      </div>

      <Dialog
        open={confirmOpen}
        onOpenChange={(next) => {
          if (!next && !submitting) setConfirmOpen(false);
        }}
        title="Submit for Grading"
        description={
          unanswered.length === 0
            ? `You answered all ${questions.length} questions. After you submit, you can't edit your answers.`
            : `You answered ${questions.length - unanswered.length} of ${questions.length} questions. You can still submit, but unanswered questions will be marked empty.`
        }
        showCloseButton={false}
        footer={
          <div className={styles.dialogActions}>
            <button
              type="button"
              className={styles.dialogCancel}
              onClick={() => setConfirmOpen(false)}
              disabled={submitting}
            >
              Keep working
            </button>
            <button
              type="button"
              className={styles.dialogSubmit}
              onClick={() => {
                void handleSubmit();
              }}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className={styles.spinner} size={18} aria-hidden="true" />
              ) : (
                <Send size={18} aria-hidden="true" />
              )}
              {submitting ? "Submitting…" : "Submit for Grading"}
            </button>
          </div>
        }
      >
        <div className={styles.dialogBody}>
          {unanswered.length > 0 ? (
            <>
              <h3 className={styles.unansweredTitle}>Questions without an answer</h3>
              <ul className={styles.unansweredList}>
                {unanswered.map((item) => (
                  <li key={item.id}>
                    <strong>Question {item.number}</strong>
                    <span>{item.prompt}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className={styles.answerComplete}>
              <CheckCircle2 size={18} aria-hidden="true" /> Every question has an answer.
            </p>
          )}

          {hasWriting ? (
            <p className={styles.warningBox}>
              <AlertTriangle size={18} aria-hidden="true" /> Your writing answers will be reviewed
              by your teacher.
            </p>
          ) : null}

          {submitError ? (
            <p className={styles.submitError} role="alert">
              {submitError}
            </p>
          ) : null}
        </div>
      </Dialog>
    </div>
  );
}

/* ---------- Loading, error and locked states ---------- */

function LoadingState() {
  return (
    <main className={styles.statePage} data-world="amber">
      <div className={styles.stateCard} role="status" aria-live="polite">
        <p className={styles.stateKicker}>Assignment</p>
        <h1 className={styles.stateTitle}>Opening your assignment…</h1>
        <div className={styles.skeleton} aria-hidden="true">
          <span className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
          <span className={styles.skeletonLine} />
          <span className={styles.skeletonBlock} />
        </div>
      </div>
    </main>
  );
}

interface ErrorStateProps {
  code: SolveErrorCode;
  onRetry: () => void;
}

function ErrorState({ code, onRetry }: ErrorStateProps) {
  const copy: Record<SolveErrorCode, { title: string; message: string }> = {
    NOT_FOUND: {
      title: "Assignment not found",
      message:
        "It may have been removed, or your class may have changed. Ask your teacher if you expected to see it.",
    },
    REQUEST_FAILED: {
      title: "We couldn't open this assignment",
      message: "Check your connection, then try again. Your saved draft is safe.",
    },
    ALREADY_SUBMITTED: {
      title: "Already submitted",
      message: "This assignment is read-only. Open the assignment page to check its status.",
    },
    NO_QUESTIONS: {
      title: "No questions yet",
      message: "Your teacher hasn't added questions to this assignment. Check back later.",
    },
    UNSUPPORTED_QUESTIONS: {
      title: "This assignment isn't ready here",
      message:
        "It uses question formats this workspace can't display yet. Ask your teacher which questions to answer.",
    },
  };
  const content = copy[code];
  const canRetry = code === "REQUEST_FAILED";

  return (
    <main className={styles.statePage} data-world="amber">
      <div className={styles.stateCard} role="alert">
        <span className={styles.stateIcon}>
          <AlertTriangle size={28} aria-hidden="true" />
        </span>
        <p className={styles.stateKicker}>Assignment</p>
        <h1 className={styles.stateTitle}>{content.title}</h1>
        <p className={styles.stateMessage}>{content.message}</p>
        <div className={styles.stateActions}>
          {canRetry ? (
            <button type="button" className={styles.primaryLink} onClick={onRetry}>
              Try again
            </button>
          ) : null}
          <Link className={styles.secondaryButton} to="/student/assignments">
            Back to assignments
          </Link>
        </div>
      </div>
    </main>
  );
}

function LockedState({ brief }: { brief: AssignmentDetails }) {
  return (
    <main className={styles.statePage} data-world="amber">
      <div className={styles.stateCard} role="status">
        <span className={styles.stateIcon}>
          <CheckCircle2 size={28} aria-hidden="true" />
        </span>
        <p className={styles.stateKicker}>Assignment</p>
        <h1 className={styles.stateTitle}>{brief.title}</h1>
        <p className={styles.stateMessage}>
          This assignment is {brief.status === "graded" ? "graded" : "submitted"} and read-only.
          Your teacher will review it from here.
        </p>
        <div className={styles.stateActions}>
          <Link
            className={styles.primaryLink}
            to={`/student/assignments/${encodeURIComponent(brief.id)}`}
          >
            View assignment
          </Link>
          <Link className={styles.secondaryButton} to="/student/assignments">
            All assignments
          </Link>
        </div>
      </div>
    </main>
  );
}
