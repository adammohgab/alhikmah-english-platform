import { useNavigate, useParams } from "react-router-dom";
import { useAssignmentDetails } from "./api";
import { formatDate, formatDuration, formatSize, formatWordTarget } from "./format";
import type { AssignmentAttachment, AssignmentDetails } from "./types";
import importedStyles from "./AssignmentDetailsPage.module.css";

type StyleName =
  | "page"
  | "header"
  | "section"
  | "muted"
  | "startRow"
  | "primary"
  | "secondary"
  | "prose"
  | "facts"
  | "list"
  | "attachments"
  | "attachment"
  | "attachmentHead"
  | "attachmentName"
  | "audio"
  | "linkRow"
  | "tableWrap"
  | "table"
  | "num"
  | "criterionName"
  | "criterionDesc"
  | "srOnly";
const styles = importedStyles as Record<StyleName, string>;

/* Audio uploads do not guarantee caption tracks. */
/* eslint-disable jsx-a11y/media-has-caption */
/* The rubric region is focusable so keyboard users can scroll its wide table. */
/* eslint-disable jsx-a11y/no-noninteractive-tabindex */

const workspacePath = (assignmentId: string, draftId?: string) =>
  `/student/assignments/${encodeURIComponent(assignmentId)}/workspace` +
  (draftId ? `?draft=${encodeURIComponent(draftId)}` : "");

function Attachment({ item }: { item: AssignmentAttachment }) {
  const meta = [
    item.type === "pdf" ? "PDF" : "Audio",
    item.type === "audio" ? formatDuration(item.durationSeconds) : "",
    formatSize(item.sizeBytes),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <li className={styles.attachment}>
      <div className={styles.attachmentHead}>
        <span className={styles.attachmentName}>{item.name}</span>
        <span className={styles.muted}>{meta}</span>
      </div>
      {item.type === "audio" ? (
        <audio
          controls
          preload="none"
          src={item.url}
          className={styles.audio}
          aria-label={`Audio: ${item.name}`}
        >
          Your browser does not support audio playback. <a href={item.url}>Download {item.name}</a>
        </audio>
      ) : (
        <div className={styles.linkRow}>
          <a href={item.url} target="_blank" rel="noopener noreferrer">
            Open {item.name}
          </a>
          <a href={item.url} download>
            Download
          </a>
        </div>
      )}
    </li>
  );
}

function Rubric({ rubric }: { rubric: AssignmentDetails["rubric"] }) {
  const total = rubric.reduce((sum, criterion) => sum + criterion.maxPoints, 0);
  return (
    <section aria-labelledby="rubric-heading" className={styles.section}>
      <h2 id="rubric-heading">Grading rubric</h2>
      <p className={styles.muted}>
        {rubric.length} criteria, {total} points in total. The last column describes what earns full
        credit.
      </p>
      <div
        className={styles.tableWrap}
        tabIndex={0}
        role="region"
        aria-label="Rubric table, scrollable"
      >
        <table className={styles.table}>
          <caption className={styles.srOnly}>Grading rubric with full-credit expectations</caption>
          <thead>
            <tr>
              <th scope="col">Criterion</th>
              <th scope="col" className={styles.num}>
                Points
              </th>
              <th scope="col">Full credit expectation</th>
            </tr>
          </thead>
          <tbody>
            {rubric.map((criterion) => (
              <tr key={criterion.id}>
                <th scope="row">
                  <span className={styles.criterionName}>{criterion.name}</span>
                  <span className={styles.criterionDesc}>{criterion.description}</span>
                </th>
                <td className={styles.num}>{criterion.maxPoints}</td>
                <td>{criterion.fullCreditExpectation}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td className={styles.num}>{total}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function Details({ assignment }: { assignment: AssignmentDetails }) {
  const navigate = useNavigate();
  const due = formatDate(assignment.dueAt);
  const paragraphs = assignment.prompt.split(/\n{2,}/).filter(Boolean);
  const hasDraft = Boolean(assignment.draft);

  return (
    <main className={styles.page} data-world="writing">
      <article>
        <header className={styles.header}>
          {assignment.courseName && <p className={styles.muted}>{assignment.courseName}</p>}
          <h1>{assignment.title}</h1>
          <p className={styles.muted}>
            {formatWordTarget(assignment.wordCount.min, assignment.wordCount.max)}
            {due && <> &middot; Due {due}</>}
          </p>
          <div className={styles.startRow}>
            <button
              type="button"
              className={styles.primary}
              onClick={() => navigate(workspacePath(assignment.id, assignment.draft?.id))}
            >
              Start Working
            </button>
            {hasDraft && assignment.draft && (
              <span className={styles.muted} role="status">
                Resumes your saved draft ({assignment.draft.wordCount} words, edited{" "}
                {formatDate(assignment.draft.updatedAt)})
              </span>
            )}
          </div>
        </header>

        <section aria-labelledby="prompt-heading" className={styles.section}>
          <h2 id="prompt-heading">Writing prompt</h2>
          <div className={styles.prose}>
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </section>

        <section aria-labelledby="format-heading" className={styles.section}>
          <h2 id="format-heading">Formatting guidelines</h2>
          <dl className={styles.facts}>
            <div>
              <dt>Length</dt>
              <dd>{formatWordTarget(assignment.wordCount.min, assignment.wordCount.max)}</dd>
            </div>
          </dl>
          {assignment.formattingGuidelines.length > 0 ? (
            <ul className={styles.list}>
              {assignment.formattingGuidelines.map((guideline, index) => (
                <li key={index}>{guideline}</li>
              ))}
            </ul>
          ) : (
            <p className={styles.muted}>Your teacher did not add formatting rules.</p>
          )}
        </section>

        <section aria-labelledby="resources-heading" className={styles.section}>
          <h2 id="resources-heading">Reference materials</h2>
          {assignment.attachments.length > 0 ? (
            <ul className={styles.attachments}>
              {assignment.attachments.map((item) => (
                <Attachment key={item.id} item={item} />
              ))}
            </ul>
          ) : (
            <p className={styles.muted}>No reference materials for this assignment.</p>
          )}
        </section>

        {assignment.rubric.length > 0 ? (
          <Rubric rubric={assignment.rubric} />
        ) : (
          <section className={styles.section}>
            <h2>Grading rubric</h2>
            <p className={styles.muted}>No rubric has been published yet.</p>
          </section>
        )}
      </article>
    </main>
  );
}

export default function AssignmentDetailsPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { state, retry } = useAssignmentDetails(assignmentId);

  if (state.status === "loading") {
    return (
      <p className={styles.page} data-world="writing" role="status" aria-live="polite">
        Loading assignment...
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <main className={styles.page} data-world="writing" role="alert">
        <h1>
          {state.code === "NOT_FOUND" ? "Assignment not found" : "Could not load this assignment"}
        </h1>
        <p className={styles.muted}>
          {state.code === "NOT_FOUND"
            ? "It may have been removed or is not assigned to you."
            : "Check your connection and try again."}
        </p>
        {state.code === "REQUEST_FAILED" && (
          <button type="button" className={styles.secondary} onClick={retry}>
            Try again
          </button>
        )}
      </main>
    );
  }

  return <Details assignment={state.data} />;
}
