import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/shared/components/ui/Button";
import { Dialog, DialogClose } from "@/shared/components/ui/Dialog";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { SearchField } from "@/shared/components/ui/SearchField";
import { SegmentedControl } from "@/shared/components/ui/SegmentedControl";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { useAuth } from "@/shared/hooks/useAuth";
import { useToast } from "@/shared/hooks/useToast";
import { COURSES_KEY, archiveCourse, duplicateCourse, fetchCourses, type CourseItem } from "./api";
import { CreateCourseDialog } from "./CreateCourseDialog";

/* Teacher courses hub (TC-09): "My courses" with publication status, units and classes using
   each course, and a "School library" of published and official courses to copy. */

type Tab = "mine" | "library";

const dateFormat = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const STATUS_LABEL: Record<CourseItem["status"], string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};
const STATUS_TONE: Record<CourseItem["status"], string> = {
  draft: "bg-surface-100",
  published: "bg-world-sky-300",
  archived: "bg-surface-100 text-muted",
};

export default function CoursesAuthoringPage() {
  const { user } = useAuth();
  const teacherId = user?.id;
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("mine");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [archiving, setArchiving] = useState<CourseItem | null>(null);

  const query = useQuery({
    queryKey: [COURSES_KEY, teacherId],
    queryFn: () => fetchCourses(teacherId!),
    enabled: teacherId !== undefined,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: [COURSES_KEY] });

  const duplicate = useMutation({
    mutationFn: duplicateCourse,
    onSuccess: () => {
      toast.show({ title: "Course copied to My courses", type: "success" });
      setTab("mine");
      void refresh();
    },
    onError: (error: Error) =>
      toast.show({ title: "The course was not copied", description: error.message, type: "error" }),
  });

  const archive = useMutation({
    mutationFn: archiveCourse,
    onSuccess: () => {
      toast.show({ title: "Course archived", type: "success" });
      setArchiving(null);
      void refresh();
    },
    onError: (error: Error) =>
      toast.show({
        title: "The course was not archived",
        description: error.message,
        type: "error",
      }),
  });

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (query.data ?? []).filter((course) => {
      if (tab === "mine" ? !course.mine || course.status === "archived" : course.mine) return false;
      return needle === "" || course.title.toLowerCase().includes(needle);
    });
  }, [query.data, tab, search]);

  const adopt = () => {
    setTab("library");
    setSearch("");
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-[28px] font-bold leading-tight text-stroke">Courses</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={adopt}>
            Adopt Official Curriculum
          </Button>
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden="true" />
            Create New Course
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          aria-label="Course list"
          value={tab}
          onValueChange={(value) => setTab(value as Tab)}
          options={[
            { value: "mine", label: "My courses" },
            { value: "library", label: "School library" },
          ]}
        />
        <SearchField
          aria-label="Search courses"
          placeholder="Search courses"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {query.isError ? (
        <ErrorState
          description="Your courses could not load. Check your connection and try again."
          onRetry={() => void query.refetch()}
        />
      ) : !query.data ? (
        <div aria-busy="true" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((n) => (
            <Skeleton
              key={n}
              shape="rect"
              className="h-44 w-full"
              label={n === 0 ? "Loading courses" : null}
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          size="md"
          title={tab === "mine" ? "No courses yet" : "Nothing in the library"}
          description={
            search
              ? "No course matches your search."
              : tab === "mine"
                ? "Build your first course or copy one from the library."
                : "Published and official courses will appear here."
          }
          actionLabel={tab === "mine" ? "Create New Course" : "Show my courses"}
          onAction={() => (tab === "mine" ? setCreating(true) : setTab("mine"))}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((course) => (
            <li
              key={course.id}
              className="flex flex-col gap-3 rounded-2xl border-2 border-stroke bg-surface-0 p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border-2 border-stroke px-2 py-0.5 text-xs font-bold ${STATUS_TONE[course.status]}`}
                >
                  {STATUS_LABEL[course.status]}
                </span>
                {course.official && (
                  <span className="rounded-full border-2 border-stroke bg-world-amber-300 px-2 py-0.5 text-xs font-bold">
                    Official
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <h2 className="font-heading text-lg font-bold leading-snug">{course.title}</h2>
                <p className="text-sm text-muted">
                  {course.grade ? `Grade ${course.grade}` : "No grade set"}
                  {!course.mine && course.authorName ? ` · ${course.authorName}` : ""}
                </p>
              </div>
              <p className="text-sm">
                {course.units} {course.units === 1 ? "unit" : "units"} · Used by {course.classes}{" "}
                {course.classes === 1 ? "class" : "classes"}
              </p>
              <p className="text-xs text-muted">
                Last edited {dateFormat.format(new Date(course.updatedAt))}
              </p>
              <div className="mt-auto flex flex-wrap gap-2">
                {course.mine && (
                  <Button size="sm" onClick={() => navigate(`/teacher/courses/${course.id}/edit`)}>
                    Edit
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  loading={duplicate.isPending && duplicate.variables?.id === course.id}
                  onClick={() => duplicate.mutate({ id: course.id, title: course.title })}
                >
                  {course.mine ? "Duplicate" : "Duplicate to my courses"}
                </Button>
                {course.mine && (
                  <Button size="sm" variant="outline" onClick={() => setArchiving(course)}>
                    Archive
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <CreateCourseDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(id) => {
          void refresh();
          navigate(`/teacher/courses/${id}/edit`);
        }}
      />

      <Dialog
        open={archiving !== null}
        onOpenChange={(open) => !open && setArchiving(null)}
        size="sm"
        title="Archive this course?"
        description={`“${archiving?.title ?? ""}” will leave My courses. Classes already using it keep their copy.`}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="danger"
              loading={archive.isPending}
              onClick={() => archiving && archive.mutate(archiving.id)}
            >
              Archive
            </Button>
          </>
        }
      />
    </main>
  );
}
