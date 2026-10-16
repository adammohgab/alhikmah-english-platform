import React, { useState } from 'react';

type Props = {
  sourceYears: string[];
  preflight: () => Promise<{ gradesSubmitted: boolean; activeSessions: number }>;
  start: (source: string, destination: string) => Promise<void>;
  rollback: () => Promise<void>;
  rollbackUntil?: string;
  progress?: number;
};

export default function YearRolloverPage({
  sourceYears,
  preflight,
  start,
  rollback,
  rollbackUntil,
  progress = 0,
}: Props) {
  const [source, setSource] = useState(sourceYears[0] || '');
  const [destination, setDestination] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [check, setCheck] = useState<{
    gradesSubmitted: boolean;
    activeSessions: number;
  } | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function inspect() {
    setBusy(true);
    try {
      setCheck(await preflight());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Pre-flight failed.');
    } finally {
      setBusy(false);
    }
  }

  async function run(event: React.FormEvent) {
    event.preventDefault();
    if (
      confirmation !== 'CONFIRM ROLLOVER' ||
      !check?.gradesSubmitted ||
      check.activeSessions > 0
    ) {
      return;
    }

    setBusy(true);
    try {
      await start(source, destination);
      setMessage('Rollover job dispatched.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start rollover.');
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    setBusy(true);
    try {
      await rollback();
      setMessage('Rollback requested.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Rollback failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 800, margin: '2rem auto', fontFamily: 'system-ui' }}>
      <h1>Academic Year Rollover</h1>
      <p>Run pre-flight checks before preparing a rollover.</p>

      <button disabled={busy} onClick={inspect}>Run pre-flight checklist</button>

      {check && (
        <ul>
          <li>{check.gradesSubmitted ? '✓' : '⚠'} All current term grades submitted</li>
          <li>
            {check.activeSessions === 0 ? '✓' : `⚠ ${check.activeSessions} active sessions`}
          </li>
        </ul>
      )}

      <form onSubmit={run}>
        <p>
          <label>
            Source year{' '}
            <select value={source} onChange={event => setSource(event.target.value)}>
              {sourceYears.map(year => <option key={year}>{year}</option>)}
            </select>
          </label>
        </p>

        <p>
          <label>
            Destination year{' '}
            <input
              required
              value={destination}
              onChange={event => setDestination(event.target.value)}
              placeholder="2027–2028"
            />
          </label>
        </p>

        <p>
          Grade mapping should be confirmed by the rollover service before execution
          (for example Grade 5 → Grade 6).
        </p>

        <label>
          Type CONFIRM ROLLOVER{' '}
          <input value={confirmation} onChange={event => setConfirmation(event.target.value)} />
        </label>

        <p>
          <button
            disabled={
              busy ||
              confirmation !== 'CONFIRM ROLLOVER' ||
              !check?.gradesSubmitted ||
              check.activeSessions > 0
            }
          >
            Start rollover
          </button>
        </p>
      </form>

      <progress max={100} value={progress} /> {progress}%

      {rollbackUntil && (
        <p>
          Rollback available until {new Date(rollbackUntil).toLocaleString()}{' '}
          <button
            disabled={busy || Date.now() > Date.parse(rollbackUntil)}
            onClick={undo}
          >
            Rollback
          </button>
        </p>
      )}

      <p role="status">{message}</p>
    </main>
  );
}
