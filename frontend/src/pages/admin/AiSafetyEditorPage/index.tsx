import React, { useState } from 'react';

export type SafetyConfig = {
  schoolInstructions: string;
  prohibitedKeywords: string[];
};

export type SandboxResult = {
  reply: string;
  promptPreview: string;
  tokens: number;
  safetyVerdict: string;
};

type Props = {
  initial: SafetyConfig;
  save: (config: SafetyConfig) => Promise<void>;
  runSandbox: (query: string, config: SafetyConfig) => Promise<SandboxResult>;
};

export default function AiSafetyEditorPage({ initial, save, runSandbox }: Props) {
  const [config, setConfig] = useState(initial);
  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SandboxResult | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function persist() {
    setBusy(true);
    try {
      await save(config);
      setMessage('Safety instructions saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setResult(null);
    try {
      setResult(await runSandbox(query, config));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sandbox request failed.');
    } finally {
      setBusy(false);
    }
  }

  function addKeyword(event: React.FormEvent) {
    event.preventDefault();
    const value = keyword.trim();
    if (value && !config.prohibitedKeywords.includes(value)) {
      setConfig(current => ({
        ...current,
        prohibitedKeywords: [...current.prohibitedKeywords, value],
      }));
    }
    setKeyword('');
  }

  return (
    <main style={{ maxWidth: 950, margin: '2rem auto', fontFamily: 'system-ui' }}>
      <h1>AI Safety Instructions</h1>
      <p>School-specific guidance is appended by the server to the platform prompt.</p>

      <label>
        School guidelines
        <textarea
          rows={8}
          style={{ display: 'block', width: '100%' }}
          value={config.schoolInstructions}
          onChange={event =>
            setConfig({ ...config, schoolInstructions: event.target.value })
          }
          placeholder="Prefer British English spelling; encourage learners with our school motto…"
        />
      </label>

      <h2>Prohibited topic keywords</h2>
      <div>
        {config.prohibitedKeywords.map(term => (
          <span
            key={term}
            style={{
              display: 'inline-block',
              padding: 6,
              margin: 4,
              background: '#eee',
              borderRadius: 8,
            }}
          >
            {term}
            <button
              aria-label={`Remove ${term}`}
              onClick={() =>
                setConfig({
                  ...config,
                  prohibitedKeywords: config.prohibitedKeywords.filter(item => item !== term),
                })
              }
            >
              {' '}×
            </button>
          </span>
        ))}
      </div>

      <form onSubmit={addKeyword}>
        <input
          value={keyword}
          onChange={event => setKeyword(event.target.value)}
          placeholder="Add keyword"
        />
        <button>Add keyword</button>
      </form>

      <button disabled={busy} onClick={persist}>Save instructions</button>

      <h2>Test sandbox</h2>
      <label>
        Test query
        <textarea
          rows={3}
          value={query}
          onChange={event => setQuery(event.target.value)}
          style={{ display: 'block', width: '100%' }}
        />
      </label>
      <button disabled={busy || !query.trim()} onClick={test}>
        {busy ? 'Working…' : 'Run test'}
      </button>

      {result && (
        <section>
          <h3>Sandbox response</h3>
          <p>{result.reply}</p>
          <p>Tokens: {result.tokens} · Safety verdict: {result.safetyVerdict}</p>
          <details>
            <summary>Assembled prompt preview</summary>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{result.promptPreview}</pre>
          </details>
        </section>
      )}

      <p role="status">{message}</p>
    </main>
  );
}
