import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';

export interface QuizQuestion {
  id: string;
  title: string;
  points: number;
}

export interface QuizSettings {
  title: string;
  durationMinutes: number | null;
  maxAttempts: number;
  passingGrade: number;
  shuffle: boolean;
  resultsVisibility: 'immediately' | 'after_due_date' | 'never';
}

interface Props {
  initial?: Partial<QuizSettings>;
  questions: QuizQuestion[];
  save: (settings: QuizSettings, questions: QuizQuestion[]) => Promise<void>;
  openQuestionBank: () => Promise<QuizQuestion[]>;
  createQuestion: () => Promise<QuizQuestion | null>;
  generateQuestionWithAi: () => Promise<QuizQuestion | null>;
}

const defaults: QuizSettings = {
  title: '',
  durationMinutes: null,
  maxAttempts: 1,
  passingGrade: 60,
  shuffle: false,
  resultsVisibility: 'immediately',
};

export default function QuizBuilderPage({
  initial,
  questions: initialQuestions,
  save,
  openQuestionBank,
  createQuestion,
  generateQuestionWithAi,
}: Props) {
  const [settings, setSettings] = useState({ ...defaults, ...initial });
  const [questions, setQuestions] = useState(initialQuestions);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const totalPoints = useMemo(
    () => questions.reduce((sum, question) => sum + question.points, 0),
    [questions],
  );

  async function addQuestions(
    action: () => Promise<QuizQuestion[] | QuizQuestion | null>,
  ) {
    setBusy(true);
    try {
      const result = await action();
      if (Array.isArray(result)) {
        setQuestions(current => [...current, ...result]);
      } else if (result) {
        setQuestions(current => [...current, result]);
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not add questions.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await save(settings, questions);
      setMessage('Quiz saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  function moveQuestion(index: number, delta: number) {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= questions.length) return;

    const reordered = [...questions];
    [reordered[index], reordered[nextIndex]] = [
      reordered[nextIndex],
      reordered[index],
    ];
    setQuestions(reordered);
  }

  return (
    <main style={{ maxWidth: 900, margin: '2rem auto', fontFamily: 'system-ui' }}>
      <h1>Quiz Builder</h1>

      <form
        onSubmit={event => {
          void submit(event);
        }}
      >
        <p>
          <label>
            Quiz title{' '}
            <input
              required
              value={settings.title}
              onChange={event =>
                setSettings({ ...settings, title: event.target.value })
              }
            />
          </label>
        </p>

        <p>
          <label>
            <input
              type="checkbox"
              checked={settings.durationMinutes === null}
              onChange={event =>
                setSettings({
                  ...settings,
                  durationMinutes: event.target.checked ? null : 30,
                })
              }
            />{' '}
            Untimed
          </label>{' '}
          {settings.durationMinutes !== null && (
            <label>
              Duration (minutes){' '}
              <input
                type="number"
                min="1"
                value={settings.durationMinutes}
                onChange={event =>
                  setSettings({
                    ...settings,
                    durationMinutes: Number(event.target.value),
                  })
                }
              />
            </label>
          )}
        </p>

        <p>
          <label>
            Maximum attempts{' '}
            <select
              value={settings.maxAttempts}
              onChange={event =>
                setSettings({
                  ...settings,
                  maxAttempts: Number(event.target.value),
                })
              }
            >
              {[1, 2, 3, 4, 5].map(value => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </p>

        <p>
          <label>
            Passing grade (%){' '}
            <input
              type="number"
              min="0"
              max="100"
              value={settings.passingGrade}
              onChange={event =>
                setSettings({
                  ...settings,
                  passingGrade: Number(event.target.value),
                })
              }
            />
          </label>
        </p>

        <p>
          <label>
            <input
              type="checkbox"
              checked={settings.shuffle}
              onChange={event =>
                setSettings({ ...settings, shuffle: event.target.checked })
              }
            />{' '}
            Shuffle questions
          </label>
        </p>

        <p>
          <label>
            Results visibility{' '}
            <select
              value={settings.resultsVisibility}
              onChange={event =>
                setSettings({
                  ...settings,
                  resultsVisibility: event.target
                    .value as QuizSettings['resultsVisibility'],
                })
              }
            >
              <option value="immediately">Immediately</option>
              <option value="after_due_date">After due date</option>
              <option value="never">Never show results</option>
            </select>
          </label>
        </p>

        <h2>
          Questions · {questions.length} · Total {totalPoints} points
        </h2>

        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void addQuestions(openQuestionBank);
          }}
        >
          Add from Question Bank
        </button>{' '}
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void addQuestions(createQuestion);
          }}
        >
          Create New Question
        </button>{' '}
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void addQuestions(generateQuestionWithAi);
          }}
        >
          Generate with AI
        </button>

        <ol>
          {questions.map((question, index) => (
            <li key={question.id} style={{ padding: 8 }}>
              {question.title}{' '}
              <label>
                Points{' '}
                <input
                  type="number"
                  min="0"
                  value={question.points}
                  onChange={event =>
                    setQuestions(current =>
                      current.map(item =>
                        item.id === question.id
                          ? { ...item, points: Number(event.target.value) }
                          : item,
                      ),
                    )
                  }
                />
              </label>{' '}
              <button
                type="button"
                onClick={() => moveQuestion(index, -1)}
              >
                ↑
              </button>{' '}
              <button
                type="button"
                onClick={() => moveQuestion(index, 1)}
              >
                ↓
              </button>{' '}
              <button
                type="button"
                onClick={() =>
                  setQuestions(current =>
                    current.filter(item => item.id !== question.id),
                  )
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ol>

        <button disabled={busy}>
          {busy ? 'Saving…' : 'Save quiz'}
        </button>
      </form>

      <p role="status">{message}</p>
    </main>
  );
}
