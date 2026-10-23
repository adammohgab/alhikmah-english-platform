import { useEffect, useId, useRef } from "react";
import type { MouseEvent } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { formatWordTarget } from "./format";
import { writingAnswerFromHtml } from "./questions";
import type { WritingAnswer } from "./types";
import importedStyles from "./AssignmentSolvePage.module.css";

type StyleName =
  | "editorCard"
  | "toolbar"
  | "toolGroup"
  | "toolButton"
  | "editorHost"
  | "editorContent"
  | "placeholder"
  | "editorFooter"
  | "counters"
  | "counterNumber"
  | "target"
  | "targetUnder"
  | "targetOver"
  | "targetMet"
  | "readOnlyNote";
const styles = importedStyles as Record<StyleName, string>;

interface WritingEditorProps {
  initialHtml: string;
  readOnly: boolean;
  label: string;
  minWords?: number | undefined;
  maxWords?: number | undefined;
  onChange: (answer: WritingAnswer) => void;
}

interface ToolButtonProps {
  label: string;
  icon: LucideIcon;
  active?: boolean | undefined;
  disabled: boolean;
  onClick: () => void;
}

function ToolButton({ label, icon: Icon, active, disabled, onClick }: ToolButtonProps) {
  return (
    <button
      type="button"
      className={styles.toolButton}
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      data-active={active === true ? "true" : undefined}
      onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()}
      onClick={onClick}
    >
      <Icon aria-hidden="true" size={18} strokeWidth={2.5} />
    </button>
  );
}

export function WritingEditor({
  initialHtml,
  readOnly,
  label,
  minWords,
  maxWords,
  onChange,
}: WritingEditorProps) {
  const counterId = useId();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } })],
    content: initialHtml || "",
    editable: !readOnly,
    immediatelyRender: true,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class: styles.editorContent,
        role: "textbox",
        "aria-label": label,
        "aria-multiline": "true",
        "aria-describedby": counterId,
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor: current }) => {
      const text = current.getText({ blockSeparator: "\n\n" });
      onChangeRef.current(writingAnswerFromHtml(current.getHTML(), text));
    },
  });

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  const text = editor?.getText({ blockSeparator: "\n\n" }) ?? "";
  const words = text.trim() === "" ? 0 : text.trim().split(/\s+/u).length;
  const characters = text.length;
  const target = formatWordTarget(minWords, maxWords);
  const belowTarget = minWords !== undefined && words < minWords;
  const aboveTarget = maxWords !== undefined && words > maxWords;
  const targetClass = belowTarget
    ? styles.targetUnder
    : aboveTarget
      ? styles.targetOver
      : styles.targetMet;
  const targetNote = belowTarget
    ? `${minWords - words} to go`
    : aboveTarget
      ? `${words - maxWords} over`
      : "Target met";
  const disabled = readOnly || !editor;

  return (
    <div className={styles.editorCard} data-readonly={readOnly}>
      <div className={styles.toolbar} role="toolbar" aria-label="Writing format">
        <div className={styles.toolGroup}>
          <ToolButton
            label="Bold"
            icon={Bold}
            active={editor?.isActive("bold")}
            disabled={disabled}
            onClick={() => {
              editor?.chain().focus().toggleBold().run();
            }}
          />
          <ToolButton
            label="Italic"
            icon={Italic}
            active={editor?.isActive("italic")}
            disabled={disabled}
            onClick={() => {
              editor?.chain().focus().toggleItalic().run();
            }}
          />
        </div>
        <div className={styles.toolGroup}>
          <ToolButton
            label="Heading 2"
            icon={Heading2}
            active={editor?.isActive("heading", { level: 2 })}
            disabled={disabled}
            onClick={() => {
              editor?.chain().focus().toggleHeading({ level: 2 }).run();
            }}
          />
          <ToolButton
            label="Heading 3"
            icon={Heading3}
            active={editor?.isActive("heading", { level: 3 })}
            disabled={disabled}
            onClick={() => {
              editor?.chain().focus().toggleHeading({ level: 3 }).run();
            }}
          />
        </div>
        <div className={styles.toolGroup}>
          <ToolButton
            label="Bullet list"
            icon={List}
            active={editor?.isActive("bulletList")}
            disabled={disabled}
            onClick={() => {
              editor?.chain().focus().toggleBulletList().run();
            }}
          />
          <ToolButton
            label="Numbered list"
            icon={ListOrdered}
            active={editor?.isActive("orderedList")}
            disabled={disabled}
            onClick={() => {
              editor?.chain().focus().toggleOrderedList().run();
            }}
          />
        </div>
        <div className={styles.toolGroup}>
          <ToolButton
            label="Undo"
            icon={Undo2}
            disabled={disabled || !editor?.can().undo()}
            onClick={() => {
              editor?.chain().focus().undo().run();
            }}
          />
          <ToolButton
            label="Redo"
            icon={Redo2}
            disabled={disabled || !editor?.can().redo()}
            onClick={() => {
              editor?.chain().focus().redo().run();
            }}
          />
        </div>
      </div>

      <div className={styles.editorHost}>
        <EditorContent editor={editor} />
        {text.trim() === "" ? (
          <span className={styles.placeholder} aria-hidden="true">
            {readOnly ? "No answer was saved for this question." : "Start writing your answer…"}
          </span>
        ) : null}
      </div>

      <div className={styles.editorFooter} id={counterId}>
        <div className={styles.counters}>
          <span>
            <strong className={styles.counterNumber}>{words}</strong>{" "}
            {words === 1 ? "word" : "words"}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <strong className={styles.counterNumber}>{characters}</strong>{" "}
            {characters === 1 ? "character" : "characters"}
          </span>
        </div>
        {target ? (
          <span className={`${styles.target} ${targetClass}`}>
            {target}
            {!readOnly ? ` · ${targetNote}` : ""}
          </span>
        ) : null}
        {readOnly ? <span className={styles.readOnlyNote}>Locked after submission</span> : null}
      </div>
    </div>
  );
}
