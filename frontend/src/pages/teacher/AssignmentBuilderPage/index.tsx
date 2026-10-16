import React, { useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

export type RubricOption = { id: string; title: string };

export type AssignmentDraft = {
  title: string;
  classId: string;
  dueAt: string;
  latePolicy: 'accept' | 'penalty' | 'reject';
  promptHtml: string;
  rubricId: string;
};

type Props = {
  classes: { id: string; name: string }[];
  rubrics: RubricOption[];
  initial?: Partial<AssignmentDraft>;
  save: (draft: AssignmentDraft, publish: boolean) => Promise<void>;
  buildRubric: () => void;
};

export default function AssignmentBuilderPage({
  classes,
  rubrics,
  initial,
  save,
  buildRubric,
}: Props) {
  const [draft, setDraft] = useState<AssignmentDraft>({
    title: '',
    classId: '',
    dueAt: '',
    latePolicy: 'accept',
    promptHtml: '',
    rubricId: '',
    ...initial,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const editor = useEditor({
    extensions: [StarterKit],
    content: draft.promptHtml,
    onUpdate: ({ editor }) =>
      setDraft(current => ({ ...current, promptHtml: editor.getHTML() })),
  });

  async function submit(publish: boolean) {
    if (!draft.title.trim() || !draft.classId) {
      setMessage('Add a title and choose a class.');
      return;
    }

    setBusy(true);
    try {
      await save({ ...draft, promptHtml: editor?.getHTML() ?? draft.promptHtml }, publish);
      setMessage(publish ? 'Assignment published to the class.' : 'Draft saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save assignment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: '2rem auto', fontFamily: 'system-ui' }}>
      <h1>Assignment Builder</h1>

      <label>
        Assignment title{' '}
        <input
          required
          value={draft.title}
          onChange={event => setDraft({ ...draft, title: event.target.value })}
        />
      </label>

      <p>
        <label>
          Target class{' '}
          <select
            required
            value={draft.classId}
            onChange={event => setDraft({ ...draft, classId: event.target.value })}
          >
            <option value="">Choose a class</option>
            {classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      </p>

      <p>
        <label>
          Due date &amp; time{' '}
          <input
            type="datetime-local"
            value={draft.dueAt}
            onChange={event => setDraft({ ...draft, dueAt: event.target.value })}
          />
        </label>
      </p>

      <p>
        <label>
          Late submissions{' '}
          <select
            value={draft.latePolicy}
            onChange={event =>
              setDraft({ ...draft, latePolicy: event.target.value as AssignmentDraft['latePolicy'] })
            }
          >
            <option value="accept">Accept late work</option>
            <option value="penalty">Accept with penalty</option>
            <option value="reject">Reject after due date</option>
          </select>
        </label>
      </p>

      <h2>Writing prompt</h2>
      <div style={{ border: '1px solid #aaa', borderRadius: 8, padding: 12, minHeight: 180 }}>
        <EditorContent editor={editor} />
      </div>

      <h2>Rubric</h2>
      <label>
        Attached rubric{' '}
        <select
          value={draft.rubricId}
          onChange={event => setDraft({ ...draft, rubricId: event.target.value })}
        >
          <option value="">No rubric</option>
          {rubrics.map(rubric => (
            <option value={rubric.id} key={rubric.id}>{rubric.title}</option>
          ))}
        </select>
      </label>{' '}
      <button type="button" onClick={buildRubric}>Build New Rubric</button>

      <p>
        <button disabled={busy} type="button" onClick={() => void submit(false)}>
          Save draft
        </button>{' '}
        <button disabled={busy} type="button" onClick={() => void submit(true)}>
          Publish to class
        </button>
      </p>
      <p role="status">{message}</p>
    </main>
  );
}
