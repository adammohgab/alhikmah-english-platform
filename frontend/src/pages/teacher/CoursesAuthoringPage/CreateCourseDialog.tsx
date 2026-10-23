import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/shared/components/ui/Button";
import { Dialog } from "@/shared/components/ui/Dialog";
import { Input } from "@/shared/components/ui/Input";
import { Select } from "@/shared/components/ui/Select";
import { Textarea } from "@/shared/components/ui/Textarea";
import { useToast } from "@/shared/hooks/useToast";
import { createCourse } from "./api";

/* New course dialog (TC-09): name, grade, category, description and a blank start. Copying an
   existing course is done from the course card or the school library. */

const GRADES = Array.from({ length: 12 }, (_, index) => String(index + 1));
const CATEGORIES = ["Main course", "Reading Club", "Exam Prep", "Custom"];

export function CreateCourseDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (courseId: string) => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [grade, setGrade] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]!);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: createCourse,
    onSuccess: (courseId) => {
      onOpenChange(false);
      setTitle("");
      setDescription("");
      onCreated(courseId);
    },
    onError: (failure: Error) =>
      toast.show({
        title: "The course was not created",
        description: failure.message,
        type: "error",
      }),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (title.trim() === "" || grade === "") {
      setError("Enter a course name and choose a grade.");
      return;
    }
    setError(null);
    create.mutate({
      title: title.trim(),
      grade,
      category,
      description: description.trim(),
      startFrom: "blank",
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title="New course"
      description="You can add units and lessons in the course builder."
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input
          label="Course name"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="space-y-1.5">
          <p id="course-grade-label" className="text-sm font-bold">
            Grade
          </p>
          <Select
            aria-labelledby="course-grade-label"
            placeholder="Choose a grade"
            value={grade}
            onValueChange={setGrade}
            options={GRADES.map((value) => ({ value, label: `Grade ${value}` }))}
          />
        </div>
        <div className="space-y-1.5">
          <p id="course-category-label" className="text-sm font-bold">
            Category
          </p>
          <Select
            aria-labelledby="course-category-label"
            value={category}
            onValueChange={setCategory}
            options={CATEGORIES.map((value) => ({ value, label: value }))}
          />
        </div>
        <Textarea
          label="Description (optional)"
          value={description}
          maxLength={500}
          showCount
          onChange={(e) => setDescription(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm font-semibold text-danger-600">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            Create course
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
