import { useState } from 'react';

export interface RubricCriterion {
  id: string;
  label: string;
  maxPoints: number;
}

export interface AiCriterionSuggestion {
  criterionId: string;
  score: number;
  rationale: string;
}

export interface AiPreGradeResult {
  suggestions: AiCriterionSuggestion[];
  feedback: string;
}

export type DraftScores = Record<string, number | null>;

export type WorldName =
  | 'world-coral'
  | 'world-amber'
  | 'world-mint'
  | 'world-sky'
  | 'world-violet'
  | 'world-rose';

interface Props {
  submissionId: string;
  rubric: RubricCriterion[];
  draftScores: DraftScores;
  onDraftScoresChange: (scores: DraftScores) => void;
  draftComments: string;
  onDraftCommentsChange: (comments: string) => void;
  invokeAiGradeSubmission: (input: {
    submissionId: string;
    rubric: RubricCriterion[];
  }) => Promise<AiPreGradeResult>;
  world?: WorldName;
}

interface SuggestionState extends AiCriterionSuggestion {
  status: 'pending' | 'accepted' | 'rejected';
}

export default function AiGradingAssistant({
  submissionId,
  rubric,
  draftScores,
  onDraftScoresChange,
  draftComments,
  onDraftCommentsChange,
  invokeAiGradeSubmission,
  world = 'world-violet',
}: Props) {
  const [suggestions, setSuggestions] = useState<
    Record<string, SuggestionState>
  >({});
  const [suggestedFeedback, setSuggestedFeedback] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState<
    'pending' | 'accepted' | 'rejected' | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function runPreGrade() {
    setBusy(true);
    setError('');
    setSuggestions({});
    setSuggestedFeedback('');
    setFeedbackStatus(null);

    try {
      const result = await invokeAiGradeSubmission({ submissionId, rubric });
      const next: Record<string, SuggestionState> = {};

      for (const suggestion of result.suggestions) {
        const criterion = rubric.find(
          item => item.id === suggestion.criterionId,
        );

        if (!criterion || !Number.isFinite(suggestion.score)) continue;

        next[criterion.id] = {
          ...suggestion,
          score: Math.max(
            0,
            Math.min(criterion.maxPoints, suggestion.score),
          ),
          status: 'pending',
        };
      }

      setSuggestions(next);
      setSuggestedFeedback(result.feedback ?? '');
      setFeedbackStatus(result.feedback?.trim() ? 'pending' : null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not run AI pre-grade.',
      );
    } finally {
      setBusy(false);
    }
  }

  function acceptScore(criterionId: string) {
    const suggestion = suggestions[criterionId];
    if (!suggestion) return;

    onDraftScoresChange({
      ...draftScores,
      [criterionId]: suggestion.score,
    });

    setSuggestions(current => {
      const existing = current[criterionId];
      if (!existing) return current;

      return {
        ...current,
        [criterionId]: { ...existing, status: 'accepted' },
      };
    });
  }

  function rejectScore(criterionId: string) {
    setSuggestions(current => {
      const existing = current[criterionId];
      if (!existing) return current;

      return {
        ...current,
        [criterionId]: { ...existing, status: 'rejected' },
      };
    });
  }

  function acceptFeedback() {
    onDraftCommentsChange(suggestedFeedback);
    setFeedbackStatus('accepted');
  }

  return (
    <section
      className="ai-grade font-body"
      data-world={world}
      aria-labelledby="ai-pre-grade-heading"
    >
      <style>{`
        .ai-grade {
          --world-primary: #7656c9;
          --world-secondary: #5536a5;
          --world-surface: #fff;
          --world-ink: #242039;
          --world-tint: #f5f0ff;
          --border-neutral-stroke: #7656c9;
          color: var(--world-ink);
          background: var(--world-surface);
          border: 2px solid var(--border-neutral-stroke);
          box-shadow: 4px 4px 0 #000;
          border-radius: 12px;
          padding: 18px;
        }
        .ai-grade[data-world="world-coral"] {
          --world-primary:#e76b5b;
          --world-secondary:#9c382e;
          --world-tint:#fff1ed;
          --border-neutral-stroke:#e76b5b;
        }
        .ai-grade[data-world="world-amber"] {
          --world-primary:#d28b16;
          --world-secondary:#80520a;
          --world-tint:#fff7df;
          --border-neutral-stroke:#d28b16;
        }
        .ai-grade[data-world="world-mint"] {
          --world-primary:#31866e;
          --world-secondary:#205c4c;
          --world-tint:#eaf8f1;
          --border-neutral-stroke:#31866e;
        }
        .ai-grade[data-world="world-sky"] {
          --world-primary:#357cac;
          --world-secondary:#245775;
          --world-tint:#edf7ff;
          --border-neutral-stroke:#357cac;
        }
        .ai-grade[data-world="world-violet"] {
          --world-primary:#7656c9;
          --world-secondary:#5536a5;
          --world-tint:#f5f0ff;
          --border-neutral-stroke:#7656c9;
        }
        .ai-grade[data-world="world-rose"] {
          --world-primary:#c44e79;
          --world-secondary:#84324f;
          --world-tint:#fff0f5;
          --border-neutral-stroke:#c44e79;
        }
        .ai-grade, .ai-grade * { box-sizing: border-box; }
        .ai-grade h2, .ai-grade h3 {
          font-family: var(--font-heading, 'Fredoka', sans-serif);
          font-weight: 600;
        }
        .ai-grade button, .ai-grade textarea {
          font-family: var(--font-body, 'Figtree', sans-serif);
        }
        .ai-grade button {
          color: var(--world-ink);
          background: var(--world-surface);
          border: 2px solid var(--border-neutral-stroke);
          border-radius: 8px;
          padding: 7px 11px;
          box-shadow: 2px 2px 0 #000;
          cursor: pointer;
          transition: transform 100ms ease, box-shadow 100ms ease,
            background-color 100ms ease;
        }
        .ai-grade button:hover:not(:disabled) {
          background: var(--world-tint);
          transform: translate(-1px, -1px);
          box-shadow: 3px 3px 0 #000;
        }
        .ai-grade button:active:not(:disabled) {
          transform: translate(2px, 2px);
          box-shadow: none;
        }
        .ai-grade button:focus-visible,
        .ai-grade textarea:focus-visible {
          outline: 3px solid var(--world-primary);
          outline-offset: 3px;
        }
        .ai-grade button:disabled {
          opacity: .55;
          cursor: not-allowed;
          box-shadow: none;
        }
        .ai-grade textarea {
          border: 2px solid var(--border-neutral-stroke);
          border-radius: 8px;
          padding: 10px;
          color: inherit;
          background: var(--world-surface);
        }
        .ai-grade__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        .ai-grade__badge, .ai-grade__status {
          display: inline-block;
          border: 2px solid var(--border-neutral-stroke);
          border-radius: 999px;
          padding: 4px 9px;
          font-size: 12px;
          font-weight: 700;
        }
        .ai-grade__badge {
          color: var(--world-secondary);
          background: var(--world-tint);
        }
        .ai-grade__draft {
          color: var(--world-secondary);
          background: var(--world-tint);
          padding: 7px 10px;
          border-radius: 8px;
        }
        .ai-grade__row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
          padding: 12px 0;
          border-bottom: 2px solid
            color-mix(in srgb, var(--border-neutral-stroke) 20%, transparent);
        }
        .ai-grade__suggestion {
          display: grid;
          gap: 8px;
          max-width: 440px;
          padding: 10px;
          border: 2px solid var(--world-primary);
          border-radius: 8px;
          background: var(--world-tint);
          box-shadow: 2px 2px 0 #000;
        }
        .ai-grade__feedback {
          margin-top: 16px;
          padding: 14px;
          border: 2px solid var(--border-neutral-stroke);
          border-radius: 10px;
          background: var(--world-tint);
          box-shadow: 2px 2px 0 #000;
        }
        .ai-grade__error {
          color: #9f1d18;
          border: 2px solid #b42318;
          padding: 10px;
          border-radius: 8px;
          background: #fff1f0;
        }
        .ai-grade__spinner {
          display: inline-block;
          width: 12px;
          height: 12px;
          margin-right: 7px;
          border: 2px solid currentColor;
          border-right-color: transparent;
          border-radius: 50%;
          vertical-align: -2px;
          animation: ai-grade-spin .7s linear infinite;
        }
        @keyframes ai-grade-spin {
          to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ai-grade *, .ai-grade *::before, .ai-grade *::after {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: .01ms !important;
          }
        }
      `}</style>

      <header className="ai-grade__header">
        <div>
          <h2 id="ai-pre-grade-heading" style={{ margin: 0 }}>
            AI Pre-Grade Assistant
          </h2>
          <p style={{ margin: '6px 0 0' }}>
            Suggestions stay in draft until you review and save the grade yourself.
          </p>
        </div>

        <button
          type="button"
          disabled={busy}
          aria-busy={busy}
          onClick={() => void runPreGrade()}
        >
          {busy && (
            <span className="ai-grade__spinner" aria-hidden="true" />
          )}
          {busy ? 'Evaluating…' : 'Run AI Pre-Grade'}
        </button>
      </header>

      <p className="ai-grade__draft">
        Teacher-controlled draft · AI cannot finalize or submit grades
      </p>

      {error && (
        <p role="alert" className="ai-grade__error">
          {error}
        </p>
      )}

      <div style={{ display: 'grid', gap: 8 }}>
        {rubric.map(criterion => {
          const suggestion = suggestions[criterion.id];

          return (
            <article key={criterion.id} className="ai-grade__row">
              <div style={{ flex: 1 }}>
                <strong>{criterion.label}</strong>
                <div>
                  Current draft: {draftScores[criterion.id] ?? 'Not scored'} /{' '}
                  {criterion.maxPoints}
                </div>
              </div>

              {suggestion?.status === 'pending' && (
                <div
                  className="ai-grade__suggestion"
                  title={suggestion.rationale}
                >
                  <span className="ai-grade__badge">AI suggestion</span>
                  <strong>
                    {suggestion.score} / {criterion.maxPoints}
                  </strong>
                  <span>{suggestion.rationale}</span>
                  <div>
                    <button
                      type="button"
                      onClick={() => acceptScore(criterion.id)}
                    >
                      Use in draft
                    </button>{' '}
                    <button
                      type="button"
                      onClick={() => rejectScore(criterion.id)}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {suggestion?.status === 'accepted' && (
                <span className="ai-grade__status">
                  Accepted into teacher draft
                </span>
              )}

              {suggestion?.status === 'rejected' && (
                <span className="ai-grade__status">
                  Suggestion rejected
                </span>
              )}
            </article>
          );
        })}
      </div>

      {suggestedFeedback.trim() && (
        <section className="ai-grade__feedback">
          <h3 style={{ marginTop: 0 }}>Constructive feedback suggestion</h3>
          <span className="ai-grade__badge">
            AI suggestion · review before use
          </span>
          <p style={{ whiteSpace: 'pre-wrap' }}>{suggestedFeedback}</p>

          {feedbackStatus === 'pending' ? (
            <>
              <button type="button" onClick={acceptFeedback}>
                Insert into draft comments
              </button>{' '}
              <button
                type="button"
                onClick={() => setFeedbackStatus('rejected')}
              >
                Reject
              </button>
            </>
          ) : (
            <span className="ai-grade__status">
              {feedbackStatus === 'accepted'
                ? 'Inserted into editable teacher draft'
                : 'Suggestion rejected'}
            </span>
          )}
        </section>
      )}

      <label style={{ display: 'block', marginTop: 18 }}>
        Draft comments (editable)
        <textarea
          rows={5}
          style={{ display: 'block', width: '100%', marginTop: 6 }}
          value={draftComments}
          onChange={event => onDraftCommentsChange(event.target.value)}
        />
      </label>
    </section>
  );
}
