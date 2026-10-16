import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/components/ui/Button";
import { Dialog } from "@/shared/components/ui/Dialog";
import { Input } from "@/shared/components/ui/Input";
import { Select } from "@/shared/components/ui/Select";
import { Textarea } from "@/shared/components/ui/Textarea";
import { useToast } from "@/shared/hooks/useToast";
import { TEACHER_CLASSES_KEY, createClass, fetchTerms } from "./api";
import {
  DESCRIPTION_MAX,
  GRADES,
  NAME_MAX,
  gradeLabel,
  groupTerms,
  validateCreateClass,
  yearIdForTerm,
} from "./rules";
import type { CreateClassErrors, CreateClassValues } from "./rules";

/* Create class (TC-02): name, grade 1-12, academic term, optional description. The server
   creates the class, makes the teacher its teacher and issues the unique join code. */

const EMPTY: CreateClassValues = { name: "", grade: "", termId: "", description: "" };

export function CreateClassDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<CreateClassValues>(EMPTY);
  const [errors, setErrors] = useState<CreateClassErrors>({});

  const terms = useQuery({
    queryKey: [TEACHER_CLASSES_KEY, "terms"],
    queryFn: fetchTerms,
    enabled: open,
  });

  const create = useMutation({
    mutationFn: createClass,
    onSuccess: (_result, input) => {
      toast.show({ type: "success", title: `“${input.name}” was created` });
      void queryClient.invalidateQueries({ queryKey: [TEACHER_CLASSES_KEY] });
      void queryClient.invalidateQueries({ queryKey: ["teacher-dashboard", "classes"] });
      close(false);
    },
    onError: (error: Error) => {
      toast.show({ type: "error", title: "The class was not created", description: error.message });
    },
  });

  const close = (next: boolean) => {
    if (!next) {
      setValues(EMPTY);
      setErrors({});
    }
    onOpenChange(next);
  };

  const patch = (change: Partial<CreateClassValues>) => {
    setValues((current) => ({ ...current, ...change }));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(change)) delete next[key as keyof CreateClassValues];
      return next;
    });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = validateCreateClass(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const schoolYearId = yearIdForTerm(terms.data ?? [], values.termId);
    if (!schoolYearId) {
      setErrors({ termId: "Choose an academic term." });
      return;
    }
    create.mutate({
      name: values.name.trim(),
      grade: values.grade,
      termId: values.termId,
      schoolYearId,
      description: values.description.trim(),
    });
  };

  const noTerms = terms.isSuccess && terms.data.length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      size="md"
      title="Create class"
      description="Add students afterwards from the class roster."
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input
          label="Class name"
          value={values.name}
          maxLength={NAME_MAX}
          error={errors.name}
          onChange={(event) => patch({ name: event.target.value })}
        />
        <div className="space-y-1.5">
          <p id="class-grade-label" className="text-sm font-bold">
            Grade level
          </p>
          <Select
            aria-labelledby="class-grade-label"
            aria-invalid={errors.grade ? true : undefined}
            placeholder="Choose a grade"
            value={values.grade}
            onValueChange={(grade) => patch({ grade })}
            options={GRADES.map((grade) => ({ value: grade, label: gradeLabel(grade) }))}
          />
          {errors.grade && <p className="text-sm font-semibold text-danger-600">{errors.grade}</p>}
        </div>
        <div className="space-y-1.5">
          <p id="class-term-label" className="text-sm font-bold">
            Academic term
          </p>
          <Select
            aria-labelledby="class-term-label"
            aria-invalid={errors.termId ? true : undefined}
            placeholder={terms.isPending ? "Loading terms…" : "Choose a term"}
            value={values.termId}
            onValueChange={(termId) => patch({ termId })}
            options={groupTerms(terms.data ?? [])}
          />
          {errors.termId && (
            <p className="text-sm font-semibold text-danger-600">{errors.termId}</p>
          )}
          {terms.isError && (
            <p role="alert" className="text-sm font-semibold text-danger-600">
              Terms could not be loaded.{" "}
              <button type="button" className="underline" onClick={() => void terms.refetch()}>
                Try again
              </button>
            </p>
          )}
          {noTerms && (
            <p className="text-sm font-semibold text-muted">
              No academic terms exist yet. Ask a school admin to add one.
            </p>
          )}
        </div>
        <Textarea
          label="Description (optional)"
          value={values.description}
          maxLength={DESCRIPTION_MAX}
          showCount
          error={errors.description}
          onChange={(event) => patch({ description: event.target.value })}
        />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending} disabled={noTerms}>
            Create class
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
