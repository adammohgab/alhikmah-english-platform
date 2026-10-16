import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Copy, Plus } from "lucide-react";
import { Avatar } from "@/shared/components/ui/Avatar";
import { Button } from "@/shared/components/ui/Button";
import { Chip } from "@/shared/components/ui/Chip";
import { Dialog } from "@/shared/components/ui/Dialog";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { ProgressBar } from "@/shared/components/ui/ProgressBar";
import { SearchField } from "@/shared/components/ui/SearchField";
import { Select } from "@/shared/components/ui/Select";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { useToast } from "@/shared/hooks/useToast";
import { cn } from "@/shared/lib/utils/cn";
import { TEACHER_CLASSES_KEY, archiveClass, duplicateClass, fetchClassesPage } from "./api";
import type { ClassRow, ClassStatus } from "./api";
import { CreateClassDialog } from "./CreateClassDialog";
import { GRADES, classLinks, gradeLabel } from "./rules";

/* ========================================
   Classes list (TEACHER-SPEC TC-02, task TCH-CORE-02)

   Every class the teacher teaches, as cards with students, progress, score, work waiting for
   grading and the join code, plus quick links to Roster, Rules and Curriculum. "Create class"
   opens the wizard; a new class invalidates the shared classes query, so the shell's class
   switcher shows it straight away.
   ======================================== */

const PANEL = "rounded-[20px] border-2 border-stroke bg-surface-0 p-5 shadow-retro-sm";
const LINK =
  "inline-flex min-h-9 items-center rounded-[10px] border-2 border-stroke bg-surface-0 px-3 text-sm font-extrabold text-stroke shadow-retro-sm transition-transform hover:-translate-y-0.5 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

function useDebounced(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

interface CardProps {
  row: ClassRow;
  onCopyCode: (code: string) => void;
  onDuplicate: (row: ClassRow) => void;
  onArchive: (row: ClassRow) => void;
}

function ClassCard({ row, onCopyCode, onDuplicate, onArchive }: CardProps) {
  const links = classLinks(row.class.id);
  const archived = row.class.is_archived === true;
  return (
    <li className="flex flex-col gap-3 rounded-[16px] border-2 border-stroke bg-surface-0 p-4 shadow-retro-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-heading text-xl font-bold text-stroke">{row.class.name}</h3>
          <p className="text-sm font-semibold text-muted">
            {row.class.grade_level ? gradeLabel(row.class.grade_level) : "No grade"}
            {row.term ? ` · ${row.term.name}` : ""}
          </p>
        </div>
        {row.assigned_by_admin && (
          <Chip size="sm" world="sky">
            Assigned by admin
          </Chip>
        )}
        {archived && (
          <Chip size="sm" world="amber">
            Archived
          </Chip>
        )}
      </div>

      {row.teachers.length > 0 && (
        <div className="flex items-center gap-1" aria-label="Teachers">
          {row.teachers.map((teacher) => (
            <Avatar
              key={teacher.id}
              size="xs"
              name={teacher.full_name}
              src={teacher.avatar_url ?? null}
            />
          ))}
        </div>
      )}

      {row.courses.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {row.courses.map((course) => (
            <Chip key={course.id} size="sm">
              {course.title}
            </Chip>
          ))}
        </div>
      )}

      <dl className="grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-xs font-bold text-muted">Students</dt>
          <dd className="font-heading text-xl font-bold">{row.students}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold text-muted">Avg score</dt>
          <dd className="font-heading text-xl font-bold">
            {row.avg_score == null ? "—" : `${Math.round(row.avg_score)}%`}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold text-muted">To grade</dt>
          <dd
            className={cn(
              "mx-auto w-fit rounded-full px-2 font-heading text-xl font-bold",
              row.awaiting_grading > 0 && "border-2 border-stroke bg-world-amber-300",
            )}
          >
            {row.awaiting_grading}
          </dd>
        </div>
      </dl>

      {row.avg_progress != null && (
        <ProgressBar
          value={row.avg_progress}
          label={`${row.class.name} average progress`}
          valueText={`${Math.round(row.avg_progress)}% average progress`}
        />
      )}

      <div className="flex items-center gap-2 text-sm">
        <span className="font-bold text-muted">Join code</span>
        {row.join_code_enabled && row.join_code ? (
          <>
            <code className="rounded-md border-2 border-stroke bg-surface-100 px-2 py-0.5 font-mono font-bold tracking-widest">
              {row.join_code}
            </code>
            <button
              type="button"
              aria-label={`Copy join code ${row.join_code}`}
              onClick={() => onCopyCode(row.join_code ?? "")}
              className="rounded-md p-1 hover:bg-surface-100 focus-visible:outline focus-visible:outline-2"
            >
              <Copy size={15} aria-hidden="true" />
            </button>
          </>
        ) : (
          <span className="font-semibold text-muted">Off</span>
        )}
      </div>

      <nav aria-label={`${row.class.name} shortcuts`} className="mt-auto flex flex-wrap gap-2 pt-1">
        <Link to={links.open} className={cn(LINK, "bg-world-coral-300")}>
          Open class
        </Link>
        <Link to={links.roster} className={LINK}>
          Roster
        </Link>
        <Link to={links.rules} className={LINK}>
          Rules
        </Link>
        <Link to={links.curriculum} className={LINK}>
          Curriculum
        </Link>
      </nav>

      {!archived && !row.assigned_by_admin && (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => onDuplicate(row)}>
            Duplicate
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onArchive(row)}>
            Archive
          </Button>
        </div>
      )}
    </li>
  );
}

export default function ClassesListPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ClassStatus>("active");
  const [grade, setGrade] = useState("all");
  const [searchText, setSearchText] = useState("");
  const search = useDebounced(searchText.trim(), 250);
  const [creating, setCreating] = useState(false);
  const [archiving, setArchiving] = useState<ClassRow | null>(null);

  const query = { status, grade: grade === "all" ? undefined : grade, search };

  const classes = useInfiniteQuery({
    queryKey: [TEACHER_CLASSES_KEY, "list", query],
    queryFn: ({ pageParam }) => fetchClassesPage(query, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    placeholderData: keepPreviousData,
  });
  const rows = useMemo(
    () => classes.data?.pages.flatMap((page) => page.items) ?? [],
    [classes.data],
  );

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: [TEACHER_CLASSES_KEY] });
    void queryClient.invalidateQueries({ queryKey: ["teacher-dashboard", "classes"] });
  };
  const onError = (title: string) => (error: Error) =>
    toast.show({ type: "error", title, description: error.message });

  const archive = useMutation({
    mutationFn: (row: ClassRow) => archiveClass(row.class.id),
    onSuccess: (_result, row) => {
      toast.show({ type: "success", title: `“${row.class.name}” was archived` });
      setArchiving(null);
      refresh();
    },
    onError: onError("The class was not archived"),
  });
  const duplicate = useMutation({
    mutationFn: (row: ClassRow) => duplicateClass(row.class.id),
    onSuccess: (_result, row) => {
      toast.show({ type: "success", title: `“${row.class.name}” was duplicated` });
      refresh();
    },
    onError: onError("The class was not duplicated"),
  });

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.show({ type: "success", title: "Join code copied" });
    } catch {
      toast.show({
        type: "error",
        title: "Could not copy the join code",
        description: `Select it and copy: ${code}`,
      });
    }
  };

  const filtered = grade !== "all" || search !== "";

  return (
    <main data-world="coral" className="mx-auto w-full max-w-[1440px] space-y-6 text-stroke">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold sm:text-4xl">Classes</h1>
          <p className="font-medium text-muted">The classes you teach.</p>
        </div>
        <Button size="lg" onClick={() => setCreating(true)}>
          <Plus size={18} aria-hidden="true" /> Create class
        </Button>
      </header>

      <section aria-label="Filters" className={cn(PANEL, "space-y-4")}>
        <div className="grid gap-3 md:grid-cols-2">
          <SearchField
            aria-label="Search classes"
            placeholder="Search classes"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <Select
            aria-label="Grade"
            value={grade}
            onValueChange={setGrade}
            options={[
              { value: "all", label: "All grades" },
              ...GRADES.map((value) => ({ value, label: gradeLabel(value) })),
            ]}
          />
        </div>
        <div role="group" aria-label="Status" className="flex flex-wrap gap-2">
          <Chip selected={status === "active"} onClick={() => setStatus("active")}>
            Active
          </Chip>
          <Chip selected={status === "archived"} onClick={() => setStatus("archived")}>
            Archived
          </Chip>
        </div>
      </section>

      <section aria-label="Class list" aria-busy={classes.isFetching}>
        {classes.isPending ? (
          <div
            role="status"
            aria-label="Loading"
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} label={null} className="h-72 w-full" />
            ))}
          </div>
        ) : classes.isError ? (
          <div className={PANEL}>
            <ErrorState
              size="sm"
              title="Classes could not be loaded"
              description="Check your connection and try again."
              onRetry={() => void classes.refetch()}
            />
          </div>
        ) : rows.length === 0 ? (
          <div className={PANEL}>
            <EmptyState
              size="sm"
              title={
                filtered || status === "archived"
                  ? "No classes match these filters"
                  : "No classes yet"
              }
              description={
                filtered || status === "archived"
                  ? "Try a different filter."
                  : "Create your first class."
              }
              {...(!filtered && status === "active"
                ? { actionLabel: "Create class", onAction: () => setCreating(true) }
                : {})}
            />
          </div>
        ) : (
          <>
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((row) => (
                <ClassCard
                  key={row.class.id}
                  row={row}
                  onCopyCode={(code) => void copyCode(code)}
                  onDuplicate={(item) => duplicate.mutate(item)}
                  onArchive={setArchiving}
                />
              ))}
            </ul>
            {classes.hasNextPage && (
              <div className="mt-4 text-center">
                <Button
                  variant="outline"
                  loading={classes.isFetchingNextPage}
                  onClick={() => void classes.fetchNextPage()}
                >
                  Load more classes
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      <CreateClassDialog open={creating} onOpenChange={setCreating} />

      <Dialog
        open={archiving !== null}
        onOpenChange={(open) => !open && setArchiving(null)}
        size="sm"
        title="Archive this class?"
        description={archiving?.class.name}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setArchiving(null)}>
              Cancel
            </Button>
            <Button
              loading={archive.isPending}
              onClick={() => archiving && archive.mutate(archiving)}
            >
              Archive class
            </Button>
          </div>
        }
      >
        <p>It moves to the Archived filter. You can still open it and see its history.</p>
      </Dialog>
    </main>
  );
}
