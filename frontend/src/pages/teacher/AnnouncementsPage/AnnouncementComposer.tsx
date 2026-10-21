import { useMemo, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bold, Italic, Link2, List, ListOrdered, Unlink } from "lucide-react";
import { Button } from "@/shared/components/ui/Button";
import { Chip } from "@/shared/components/ui/Chip";
import { Dialog } from "@/shared/components/ui/Dialog";
import { Input } from "@/shared/components/ui/Input";
import { SegmentedControl } from "@/shared/components/ui/SegmentedControl";
import { Select } from "@/shared/components/ui/Select";
import { useToast } from "@/shared/hooks/useToast";
import { cn } from "@/shared/lib/utils/cn";
import { ANNOUNCEMENTS_KEY, publishAnnouncement } from "./api";
import type { TeacherClass } from "./api";
import {
  EMPTY_COMPOSER,
  PRIORITY_LABEL,
  PRIORITY_WORLD,
  TITLE_MAX,
  expiryToIso,
  isPriority,
  plainText,
  sanitizeAnnouncementHtml,
  validateComposer,
} from "./rules";
import type { AnnouncementPriority, ComposerErrors, ComposerValues } from "./rules";

/* ========================================
   Announcement composer (TEACHER-SPEC TC-27)
   Title, one class, a basic rich-text message (bold, italic, lists, links), Normal / Important /
   Urgent priority and an optional expiry. A live student-view preview sits beside the form.
   "Review and send" asks for confirmation with the recipient count. Publishing goes through
   `publish_announcement`: the server fans out to every enrolled student and, for Urgent items,
   sends the Realtime alert banner straight away.
   Scheduling and drafts are not in this release: the RPC publishes immediately.
   ======================================== */

const SAFE_LINK = /^(https?:\/\/|mailto:)\S+$/i;

const EDITOR_CLASS =
  "min-h-[180px] rounded-[12px] border-2 border-stroke bg-surface-0 p-3 text-base text-stroke focus:outline-none focus-visible:ring-2 focus-visible:ring-stroke [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:underline [&_p]:my-1";

const TOOL =
  "inline-flex h-9 w-9 items-center justify-center rounded-[10px] border-2 border-stroke bg-surface-0 text-stroke shadow-retro-sm transition-transform hover:-translate-y-0.5 aria-pressed:bg-[var(--world-main,#ffb84d)] motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";

const PRIORITY_HINT: Record<AnnouncementPriority, string> = {
  normal: "Appears in the announcements list and the notification bell.",
  important: "Shows with a stronger marker and on the student dashboard.",
  urgent: "Also sends a live alert banner to every student's screen right away.",
};

const PANEL = "rounded-[20px] border-2 border-stroke bg-surface-0 p-4 shadow-retro-sm";

interface ComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: TeacherClass[];
}

export function AnnouncementComposer({ open, onOpenChange, classes }: ComposerProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="New announcement"
      description="Students in the chosen class are notified as soon as it is sent."
    >
      <ComposerForm classes={classes} onDone={() => onOpenChange(false)} />
    </Dialog>
  );
}

/* Mounted only while the dialog is open, so every opening starts from a blank composer. */
function ComposerForm({ classes, onDone }: { classes: TeacherClass[]; onDone: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<ComposerValues>(EMPTY_COMPOSER);
  const [errors, setErrors] = useState<ComposerErrors>({});
  const [confirming, setConfirming] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState("");

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    onUpdate: ({ editor: current }) => {
      const html = current.getHTML();
      setValues((previous) => ({ ...previous, bodyHtml: html }));
      setErrors((previous) => withoutKey(previous, "bodyHtml"));
    },
    editorProps: {
      attributes: { class: EDITOR_CLASS, "aria-label": "Announcement message" },
    },
  });

  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive("bold") ?? false,
      italic: current?.isActive("italic") ?? false,
      bulletList: current?.isActive("bulletList") ?? false,
      orderedList: current?.isActive("orderedList") ?? false,
      link: current?.isActive("link") ?? false,
    }),
  });

  const preview = useMemo(() => sanitizeAnnouncementHtml(values.bodyHtml), [values.bodyHtml]);
  const selectedClass = classes.find((item) => item.id === values.classId);
  const recipients = selectedClass?.students ?? 0;
  const bodyHasText = plainText(values.bodyHtml).length > 0;

  const patch = (change: Partial<ComposerValues>) => {
    setValues((previous) => ({ ...previous, ...change }));
    setErrors((previous) => {
      let next = previous;
      for (const key of Object.keys(change)) next = withoutKey(next, key as keyof ComposerValues);
      return next;
    });
  };

  const publish = useMutation({
    mutationFn: publishAnnouncement,
    onSuccess: (result, input) => {
      const urgent = input.priority === "urgent";
      toast.show({
        type: "success",
        title: urgent ? "Urgent announcement sent" : "Announcement sent",
        description: urgent
          ? `${result.recipients} students will see the live alert now.`
          : `${result.recipients} students will be notified.`,
      });
      void queryClient.invalidateQueries({ queryKey: [ANNOUNCEMENTS_KEY] });
      onDone();
    },
    onError: (error: Error) => {
      setConfirming(false);
      toast.show({
        type: "error",
        title: "The announcement was not sent",
        description: error.message,
      });
    },
  });

  const review = () => {
    const found = validateComposer(values, Date.now());
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setConfirming(false);
      return;
    }
    setConfirming(true);
  };

  const send = () => {
    const found = validateComposer(values, Date.now());
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setConfirming(false);
      return;
    }
    publish.mutate({
      title: values.title.trim(),
      body: values.bodyHtml,
      priority: values.priority,
      classId: values.classId,
      expiresAt: expiryToIso(values.expiresAt),
    });
  };

  const applyLink = () => {
    const href = linkValue.trim();
    if (!editor) return;
    if (!SAFE_LINK.test(href)) {
      setLinkError("Use a link that starts with https:// or mailto:.");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setLinkOpen(false);
    setLinkValue("");
    setLinkError("");
  };

  const removeLink = () => {
    editor?.chain().focus().extendMarkRange("link").unsetLink().run();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-4">
        <Input
          label="Title"
          value={values.title}
          maxLength={TITLE_MAX}
          showCount
          error={errors.title}
          onChange={(event) => patch({ title: event.target.value })}
        />

        <div className="space-y-1.5">
          <p id="announcement-class-label" className="text-sm font-bold">
            Class
          </p>
          <Select
            aria-labelledby="announcement-class-label"
            aria-invalid={errors.classId ? true : undefined}
            placeholder={classes.length === 0 ? "No active classes" : "Choose a class"}
            value={values.classId}
            onValueChange={(classId) => patch({ classId })}
            options={classes.map((item) => ({ value: item.id, label: item.name }))}
          />
          {errors.classId && (
            <p className="text-sm font-semibold text-danger-600">{errors.classId}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <p id="announcement-body-label" className="text-sm font-bold">
            Message
          </p>
          <div
            role="toolbar"
            aria-labelledby="announcement-body-label"
            className="flex flex-wrap gap-1.5"
          >
            <button
              type="button"
              className={TOOL}
              aria-label="Bold"
              aria-pressed={active.bold}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            >
              <Bold size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={TOOL}
              aria-label="Italic"
              aria-pressed={active.italic}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            >
              <Italic size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={TOOL}
              aria-label="Bulleted list"
              aria-pressed={active.bulletList}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            >
              <List size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={TOOL}
              aria-label="Numbered list"
              aria-pressed={active.orderedList}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={TOOL}
              aria-label="Add link"
              aria-pressed={linkOpen}
              onClick={() => setLinkOpen((open) => !open)}
            >
              <Link2 size={16} aria-hidden="true" />
            </button>
            {active.link && (
              <button type="button" className={TOOL} aria-label="Remove link" onClick={removeLink}>
                <Unlink size={16} aria-hidden="true" />
              </button>
            )}
          </div>

          {linkOpen && (
            <div className="flex flex-wrap items-start gap-2">
              <div className="min-w-[220px] flex-1">
                <Input
                  label="Link address"
                  placeholder="https://"
                  value={linkValue}
                  error={linkError || undefined}
                  onChange={(event) => setLinkValue(event.target.value)}
                />
              </div>
              <Button type="button" size="sm" className="mt-7" onClick={applyLink}>
                Apply link
              </Button>
            </div>
          )}

          <EditorContent editor={editor} />
          {errors.bodyHtml && (
            <p className="text-sm font-semibold text-danger-600">{errors.bodyHtml}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <p id="announcement-priority-label" className="text-sm font-bold">
            Priority
          </p>
          <SegmentedControl
            aria-label="Priority"
            value={values.priority}
            onValueChange={(next) => {
              if (isPriority(next)) patch({ priority: next });
            }}
            options={(["normal", "important", "urgent"] as const).map((priority) => ({
              value: priority,
              label: PRIORITY_LABEL[priority],
            }))}
          />
          <p className="text-sm font-semibold text-muted">{PRIORITY_HINT[values.priority]}</p>
        </div>

        <Input
          type="datetime-local"
          label="Expires (optional)"
          value={values.expiresAt}
          error={errors.expiresAt}
          helperText="After this time students no longer see the announcement."
          onChange={(event) => patch({ expiresAt: event.target.value })}
        />

        {confirming && (
          <section aria-labelledby="announcement-confirm-title" className={cn(PANEL, "space-y-2")}>
            <h3 id="announcement-confirm-title" className="font-heading text-lg font-bold">
              Send to {recipients} {recipients === 1 ? "student" : "students"}?
            </h3>
            <p className="text-sm font-semibold text-muted">
              {[
                selectedClass?.name ?? "The chosen class",
                PRIORITY_LABEL[values.priority],
                values.expiresAt ? "expires as set" : "no expiry",
              ].join(" · ")}
            </p>
            {values.priority === "urgent" && (
              <p className="text-sm font-bold">
                Urgent: students see the alert banner immediately, not at their next visit.
              </p>
            )}
          </section>
        )}

        <div className="flex flex-wrap justify-end gap-3 pt-2">
          {confirming ? (
            <>
              <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
                Back
              </Button>
              <Button type="button" loading={publish.isPending} onClick={send}>
                Send now
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={onDone}>
                Cancel
              </Button>
              <Button type="button" disabled={classes.length === 0} onClick={review}>
                Review and send
              </Button>
            </>
          )}
        </div>
      </div>

      <aside aria-label="Student preview" className="space-y-4">
        <div className={cn(PANEL, "space-y-3")}>
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted">Student view</p>
          <div className="space-y-2 rounded-[14px] border-2 border-stroke bg-surface-0 p-3">
            <div className="flex flex-wrap gap-1.5">
              <Chip size="sm" world={PRIORITY_WORLD[values.priority]}>
                {PRIORITY_LABEL[values.priority]}
              </Chip>
              {selectedClass && (
                <Chip size="sm" world="sky">
                  {selectedClass.name}
                </Chip>
              )}
            </div>
            <h3 className="break-words font-heading text-lg font-bold text-stroke">
              {values.title.trim() || "Your title appears here"}
            </h3>
            {bodyHasText ? (
              <div
                className="break-words text-sm text-stroke [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
                dangerouslySetInnerHTML={{ __html: preview }}
              />
            ) : (
              <p className="text-sm font-semibold text-muted">Your message appears here.</p>
            )}
          </div>
        </div>

        <div className={cn(PANEL, "space-y-2 text-sm font-semibold")}>
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted">Checklist</p>
          <ChecklistItem done={values.title.trim().length > 0} label="Title added" />
          <ChecklistItem done={values.classId !== ""} label="Class chosen" />
          <ChecklistItem done={bodyHasText} label="Message written" />
          <p className="pt-1 text-muted">
            {selectedClass
              ? `Recipients: ${recipients} enrolled ${recipients === 1 ? "student" : "students"}`
              : "Recipients: choose a class"}
          </p>
        </div>
      </aside>
    </div>
  );
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <p className={cn("flex items-center gap-2", done ? "text-stroke" : "text-muted")}>
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-stroke text-xs",
          done && "bg-world-amber-300",
        )}
      >
        {done ? "✓" : ""}
      </span>
      <span>
        {label}
        <span className="sr-only">{done ? " (done)" : " (not done)"}</span>
      </span>
    </p>
  );
}

function withoutKey(errors: ComposerErrors, key: keyof ComposerValues): ComposerErrors {
  if (!(key in errors)) return errors;
  const next = { ...errors };
  delete next[key];
  return next;
}
