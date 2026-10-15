import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Flame, Megaphone } from "lucide-react";
import { Avatar } from "@/shared/components/ui/Avatar";
import { Button } from "@/shared/components/ui/Button";
import { Chip } from "@/shared/components/ui/Chip";
import { DataTable } from "@/shared/components/ui/DataTable";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { ProgressBar } from "@/shared/components/ui/ProgressBar";
import { SearchField } from "@/shared/components/ui/SearchField";
import { Select } from "@/shared/components/ui/Select";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { cn } from "@/shared/lib/utils/cn";
import { fetchClassOptions, fetchStudentsPage } from "./api";
import type { StudentFlag, StudentRow } from "./api";
import { formatLastActive, gradeOptions } from "./format";

/* ========================================
   All my students (TEACHER-SPEC TC-07, task TCH-CORE-07)

   One directory across every class the teacher teaches. The quick-filter chips and the search
   box go to `my_students`, so the server's flag rules (and the thresholds in Settings) decide who
   is "needs attention", "inactive" or a "top performer". The student's name and the View button
   open the student's progress page (TC-08). Selected rows can be sent an announcement.
   ======================================== */

const PANEL = "rounded-[20px] border-2 border-stroke bg-surface-0 p-5 shadow-retro-sm";

const FLAG_CHIPS: ReadonlyArray<{ id: StudentFlag | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "needs_attention", label: "Needs attention" },
  { id: "inactive", label: "Inactive this week" },
  { id: "top_performers", label: "Top performers" },
];

const studentHref = (id: string) => `/teacher/students/${encodeURIComponent(id)}`;

const columns: ColumnDef<StudentRow>[] = [
  {
    id: "name",
    header: "Student",
    accessorFn: (row) => row.student.full_name,
    cell: ({ row }) => (
      <Link
        to={studentHref(row.original.student.id)}
        className="flex items-center gap-3 font-bold text-stroke hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <Avatar
          size="sm"
          name={row.original.student.full_name}
          src={row.original.student.avatar_url ?? null}
        />
        <span className="min-w-0">
          <span className="block truncate">{row.original.student.full_name}</span>
          {row.original.student.username && (
            <span className="block truncate text-xs font-semibold text-muted">
              @{row.original.student.username}
            </span>
          )}
        </span>
      </Link>
    ),
  },
  { id: "class", header: "Class", accessorFn: (row) => row.class.name },
  { id: "grade", header: "Grade", accessorFn: (row) => row.class.grade_level ?? "—" },
  { id: "level", header: "Level", accessorFn: (row) => row.level ?? "—" },
  {
    id: "progress",
    header: "Progress",
    accessorFn: (row) => row.progress ?? -1,
    cell: ({ row }) =>
      row.original.progress == null ? (
        "—"
      ) : (
        <ProgressBar
          className="min-w-24"
          value={row.original.progress}
          label={`${row.original.student.full_name} progress`}
          valueText={`${Math.round(row.original.progress)}%`}
        />
      ),
  },
  {
    id: "avg",
    header: "Avg score",
    accessorFn: (row) => row.avg_score ?? -1,
    cell: ({ row }) =>
      row.original.avg_score == null ? "—" : `${Math.round(row.original.avg_score)}%`,
  },
  {
    id: "active",
    header: "Last active",
    accessorFn: (row) => (row.last_active_at ? Date.parse(row.last_active_at) : 0),
    cell: ({ row }) => formatLastActive(row.original.last_active_at),
  },
  {
    id: "streak",
    header: "Streak",
    accessorFn: (row) => row.streak ?? 0,
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1">
        <Flame size={14} aria-hidden="true" />
        {row.original.streak ?? 0}
      </span>
    ),
  },
  {
    id: "flags",
    header: "Flags",
    enableSorting: false,
    accessorFn: (row) => row.flags.map((flag) => flag.label).join(", "),
    cell: ({ row }) => (
      <span className="flex flex-wrap gap-1">
        {row.original.flags.map((flag) => (
          <Chip key={flag.code} size="sm" world="amber">
            {flag.label}
          </Chip>
        ))}
      </span>
    ),
  },
  {
    id: "view",
    header: "",
    enableSorting: false,
    cell: ({ row }) => (
      <Link
        to={studentHref(row.original.student.id)}
        aria-label={`View ${row.original.student.full_name}`}
        className="inline-flex min-h-9 items-center rounded-[10px] border-2 border-stroke bg-surface-0 px-3 text-sm font-extrabold shadow-retro-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        View
      </Link>
    ),
  },
];

function useDebounced(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function StudentsDirectoryPage() {
  const navigate = useNavigate();
  const [classId, setClassId] = useState("all");
  const [grade, setGrade] = useState("all");
  const [flag, setFlag] = useState<StudentFlag | "all">("all");
  const [searchText, setSearchText] = useState("");
  const search = useDebounced(searchText.trim(), 250);

  const serverQuery = {
    classId: classId === "all" ? undefined : classId,
    flag: flag === "all" ? undefined : flag,
    search,
  };

  const classes = useQuery({
    queryKey: ["students-directory", "classes"],
    queryFn: fetchClassOptions,
  });
  const students = useInfiniteQuery({
    queryKey: ["students-directory", "rows", serverQuery],
    queryFn: ({ pageParam }) => fetchStudentsPage(serverQuery, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    placeholderData: keepPreviousData,
  });

  const loaded = useMemo(
    () => students.data?.pages.flatMap((page) => page.items) ?? [],
    [students.data],
  );
  const grades = useMemo(() => gradeOptions(loaded.map((row) => row.class.grade_level)), [loaded]);
  const rows = useMemo(
    () => (grade === "all" ? loaded : loaded.filter((row) => row.class.grade_level === grade)),
    [loaded, grade],
  );

  const classOptions = [
    { value: "all", label: "All classes" },
    ...(classes.data ?? []).map((item) => ({ value: item.id, label: item.name })),
  ];
  const gradeSelectOptions = [
    { value: "all", label: "All grades" },
    ...grades.map((value) => ({ value, label: `Grade ${value}` })),
  ];

  return (
    <main data-world="coral" className="mx-auto w-full max-w-[1440px] space-y-6 text-stroke">
      <header>
        <h1 className="font-heading text-3xl font-bold sm:text-4xl">My students</h1>
        <p className="font-medium text-muted">Every student across the classes you teach.</p>
      </header>

      <section aria-label="Filters" className={cn(PANEL, "space-y-4")}>
        <div className="grid gap-3 md:grid-cols-3">
          <SearchField
            aria-label="Search students by name or username"
            placeholder="Search by name or username"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <Select
            aria-label="Class"
            value={classId}
            onValueChange={setClassId}
            options={classOptions}
          />
          <Select
            aria-label="Grade"
            value={grade}
            onValueChange={setGrade}
            options={gradeSelectOptions}
          />
        </div>
        <div role="group" aria-label="Quick filters" className="flex flex-wrap gap-2">
          {FLAG_CHIPS.map((chip) => (
            <Chip key={chip.id} selected={flag === chip.id} onClick={() => setFlag(chip.id)}>
              {chip.label}
            </Chip>
          ))}
        </div>
      </section>

      <section aria-label="Students" aria-busy={students.isFetching}>
        {students.isPending ? (
          <div role="status" aria-label="Loading" className="space-y-3">
            {[0, 1, 2, 3, 4].map((item) => (
              <Skeleton key={item} label={null} className="h-12 w-full" />
            ))}
          </div>
        ) : students.isError ? (
          <div className={PANEL}>
            <ErrorState
              size="sm"
              title="Students could not be loaded"
              description="Check your connection and try again."
              onRetry={() => void students.refetch()}
            />
          </div>
        ) : (
          <>
            <DataTable
              label="Students"
              data={rows}
              columns={columns}
              filterable={false}
              selectable
              getRowId={(row) => `${row.class.id}:${row.student.id}`}
              getRowLabel={(row) => row.student.full_name}
              initialPageSize={25}
              emptyMessage="No students match these filters."
              bulkActions={[
                {
                  id: "announce",
                  label: "Send announcement",
                  icon: <Megaphone size={16} aria-hidden="true" />,
                  onAction: (selected) => {
                    const ids = [...new Set(selected.map((row) => row.student.id))];
                    navigate(
                      `/teacher/announcements/new?students=${ids.map(encodeURIComponent).join(",")}`,
                    );
                  },
                },
              ]}
            />
            {students.hasNextPage && (
              <div className="mt-4 text-center">
                <Button
                  variant="outline"
                  loading={students.isFetchingNextPage}
                  onClick={() => void students.fetchNextPage()}
                >
                  Load more students
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
