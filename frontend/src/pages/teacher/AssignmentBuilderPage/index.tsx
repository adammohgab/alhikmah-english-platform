import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered } from "lucide-react";
import { Button } from "@/shared/components/ui/Button";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { Input } from "@/shared/components/ui/Input";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/RadioGroup";
import { Select } from "@/shared/components/ui/Select";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { useAuth } from "@/shared/hooks/useAuth";
import { useToast } from "@/shared/hooks/useToast";
import {
  BUILDER_KEY,
  EMPTY_FORM,
  fetchAssignment,
  fetchClasses,
  fetchRubrics,
  localToIso,
  saveAssignment,
  type AssignmentForm,
  type LatePolicy,
} from "./api";

/* Assignment builder (TC-14): details, schedule, late policy, a rich-text prompt (Tiptap) and a
   rubric picker. "Save draft" keeps it private; "Publish" sends it to the class at once.
   Questions are added elsewhere; this page owns the details, prompt and rubric. */

const NO_RUBRIC = "none";
const TOOL =
  "inline-flex h-9 w-9 items-center justify-center rounded-[10px] border-2 border-stroke bg-surface-0 text-stroke shadow-retro-sm aria-pressed:bg-world-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

const LATE_OPTIONS: { value: LatePolicy; label: string }[] = [
  { value: "reject", label: "Late work is not accepted" },
  { value: "penalty", label: "Accepted with a daily penalty" },
  { value: "accept", label: "Accepted with no penalty until the close date" },
];

export default function AssignmentBuilderPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<AssignmentForm>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(assignmentId ?? null);
  const loaded = useRef(false);

  const classes = useQuery({ queryKey: [BUILDER_KEY, "classes"], queryFn: fetchClasses });
  const rubrics = useQuery({ queryKey: [BUILDER_KEY, "rubrics"], queryFn: fetchRubrics });
  const existing = useQuery({
    queryKey: [BUILDER_KEY, "assignment", assignmentId],
    queryFn: () => fetchAssignment(assignmentId!),
    enabled: assignmentId !== undefined,
  });

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    onUpdate: ({ editor: current }) =>
      setForm((previous) => ({
        ...previous,
        promptHtml: current.isEmpty ? "" : current.getHTML(),
      })),
    editorProps: {
      attributes: {
        class:
          "min-h-40 rounded-b-[12px] border-2 border-t-0 border-stroke bg-surface-0 p-3 outline-none [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5",
        "aria-label": "Writing prompt",
      },
    },
  });
  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive("bold") ?? false,
      italic: current?.isActive("italic") ?? false,
      bulletList: current?.isActive("bulletList") ?? false,
      orderedList: current?.isActive("orderedList") ?? false,
    }),
  });

  useEffect(() => {
    if (existing.data && editor && !loaded.current) {
      loaded.current = true;
      setForm(existing.data);
      editor.commands.setContent(existing.data.promptHtml);
    }
  }, [existing.data, editor]);

  const patch = (change: Partial<AssignmentForm>) => {
    setForm((current) => ({ ...current, ...change }));
    setError(null);
  };

  const save = useMutation({
    mutationFn: ({ publish }: { publish: boolean }) =>
      saveAssignment(user!.id, savedId, form, publish),
    onSuccess: (result) => {
      setSavedId(result.id);
      void queryClient.invalidateQueries({ queryKey: [BUILDER_KEY] });
      toast.show({
        title: result.published ? "Assignment published to the class" : "Draft saved",
        type: "success",
      });
      if (!result.extrasSaved) {
        toast.show({
          title: "Rubric and late policy were not stored",
          description: "The database has no columns for them yet. The rest was saved.",
          type: "warning",
        });
      }
      if (result.published) navigate("/teacher/assignments");
      else if (!assignmentId) navigate(`/teacher/assignments/${result.id}/edit`, { replace: true });
    },
    onError: (failure: Error) =>
      toast.show({
        title: "The assignment was not saved",
        description: failure.message,
        type: "error",
      }),
  });

  const submit = (publish: boolean) => {
    if (form.title.trim() === "") return setError("Enter a title.");
    if (form.classId === "") return setError("Choose a class.");
    if (publish) {
      const due = localToIso(form.dueAt);
      if (!due) return setError("Set a due date and time before publishing.");
      if (new Date(due).getTime() <= Date.now())
        return setError("The due date must be in the future.");
      if (form.closeAt && localToIso(form.closeAt)! < due) {
        return setError("The close date must be after the due date.");
      }
      if (form.promptHtml === "") return setError("Write the prompt students will answer.");
    }
    setError(null);
    save.mutate({ publish });
  };

  const rubricOptions = [
    { value: NO_RUBRIC, label: "No rubric" },
    ...(rubrics.data ?? []).map((rubric) => ({
      value: rubric.id,
      label: rubric.max_score != null ? `${rubric.title} (${rubric.max_score} pts)` : rubric.title,
    })),
  ];

  if (existing.isError) {
    return (
      <main className="mx-auto w-full max-w-3xl p-4">
        <ErrorState
          description="This assignment could not load. Check your connection and try again."
          onRetry={() => void existing.refetch()}
        />
      </main>
    );
  }
  if (assignmentId && !existing.data) {
    return (
      <main className="mx-auto w-full max-w-3xl p-4" aria-busy="true">
        <Skeleton shape="rect" className="h-96 w-full" label="Loading assignment" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-[28px] font-bold leading-tight text-stroke">
          {assignmentId ? "Edit assignment" : "New assignment"}
        </h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            loading={save.isPending && save.variables?.publish === false}
            disabled={save.isPending}
            onClick={() => submit(false)}
          >
            Save draft
          </Button>
          <Button
            loading={save.isPending && save.variables?.publish === true}
            disabled={save.isPending}
            onClick={() => submit(true)}
          >
            Publish
          </Button>
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-xl border-2 border-danger-600 bg-danger-100 px-3 py-2 text-sm font-semibold"
        >
          {error}
        </p>
      )}

      <section aria-labelledby="basics-heading" className="flex flex-col gap-4">
        <h2 id="basics-heading" className="font-heading text-xl font-bold">
          Basics
        </h2>
        <Input
          label="Assignment title"
          value={form.title}
          maxLength={150}
          onChange={(event) => patch({ title: event.target.value })}
        />
        <div className="space-y-1.5">
          <p id="assignment-class-label" className="text-sm font-bold">
            Target class
          </p>
          <Select
            aria-labelledby="assignment-class-label"
            placeholder={classes.isPending ? "Loading classes…" : "Choose a class"}
            value={form.classId}
            onValueChange={(classId) => patch({ classId })}
            options={(classes.data ?? []).map((item) => ({
              value: item.id,
              label: item.grade_level ? `${item.name} · Grade ${item.grade_level}` : item.name,
            }))}
          />
          {classes.isError && (
            <p role="alert" className="text-sm font-semibold text-danger-600">
              Classes could not be loaded.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <p id="assignment-prompt-label" className="text-sm font-bold">
            Writing prompt
          </p>
          <div role="group" aria-labelledby="assignment-prompt-label">
            <div className="flex gap-2 rounded-t-[12px] border-2 border-stroke bg-surface-100 p-2">
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
            </div>
            <EditorContent editor={editor} />
          </div>
        </div>
      </section>

      <section aria-labelledby="schedule-heading" className="flex flex-col gap-4">
        <h2 id="schedule-heading" className="font-heading text-xl font-bold">
          Schedule and late work
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Due date and time"
            type="datetime-local"
            value={form.dueAt}
            onChange={(event) => patch({ dueAt: event.target.value })}
          />
          <Input
            label="Close date (late work)"
            type="datetime-local"
            value={form.closeAt}
            disabled={form.latePolicy === "reject"}
            onChange={(event) => patch({ closeAt: event.target.value })}
          />
        </div>
        <RadioGroup
          aria-label="Late submissions"
          value={form.latePolicy}
          onValueChange={(value) => patch({ latePolicy: value as LatePolicy })}
        >
          {LATE_OPTIONS.map((option) => (
            <RadioGroupItem key={option.value} value={option.value} label={option.label} />
          ))}
        </RadioGroup>
        {form.latePolicy === "penalty" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Penalty per day (%)"
              type="number"
              min={0}
              max={100}
              value={form.penaltyPerDay}
              onChange={(event) => patch({ penaltyPerDay: event.target.value })}
            />
            <Input
              label="Maximum penalty (%)"
              type="number"
              min={0}
              max={100}
              value={form.penaltyMax}
              onChange={(event) => patch({ penaltyMax: event.target.value })}
            />
          </div>
        )}
      </section>

      <section aria-labelledby="rubric-heading" className="flex flex-col gap-3">
        <h2 id="rubric-heading" className="font-heading text-xl font-bold">
          Rubric
        </h2>
        <div className="space-y-1.5">
          <p id="assignment-rubric-label" className="text-sm font-bold">
            Attached rubric
          </p>
          <Select
            aria-labelledby="assignment-rubric-label"
            placeholder={rubrics.isPending ? "Loading rubrics…" : "No rubric"}
            value={form.rubricId === "" ? NO_RUBRIC : form.rubricId}
            onValueChange={(value) => patch({ rubricId: value === NO_RUBRIC ? "" : value })}
            options={rubricOptions}
          />
          {rubrics.isError && (
            <p role="alert" className="text-sm font-semibold text-danger-600">
              Rubrics could not be loaded.
            </p>
          )}
        </div>
        <div>
          <Button variant="outline" onClick={() => navigate("/teacher/settings")}>
            Build New Rubric
          </Button>
        </div>
      </section>
    </main>
  );
}
