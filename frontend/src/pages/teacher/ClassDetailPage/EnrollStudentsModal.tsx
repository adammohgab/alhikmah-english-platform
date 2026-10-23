import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";
import { Avatar } from "@/shared/components/ui/Avatar";
import { Button } from "@/shared/components/ui/Button";
import { Checkbox } from "@/shared/components/ui/Checkbox";
import { Chip } from "@/shared/components/ui/Chip";
import { Dialog } from "@/shared/components/ui/Dialog";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { SearchField } from "@/shared/components/ui/SearchField";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { useToast } from "@/shared/hooks/useToast";

/* ========================================
   Enroll students modal (TEACHER-SPEC TC-04 "Pick from school roster", task TCH-CORE-04)

   A searchable list of the school's students. The teacher ticks any number of them, across
   several searches, and adds them to the class in one go with "Add N students".

   Data (API-CONTRACT §4.2):
     `search_students {q, exclude_class_id, limit}`  rows with `in_my_other_classes`
     `add_students_to_class {class_id, student_ids}`  to `{added, skipped}`
   The generated Database type does not describe these RPCs yet, so results are validated with
   zod and a bad shape shows up as a visible error state instead of a silent blank list.
   ======================================== */

const SEARCH_LIMIT = 25;
const SEARCH_DEBOUNCE_MS = 300;

const person = z.object({
  id: z.string(),
  full_name: z.string(),
  username: z.string().nullish(),
  avatar_url: z.string().nullish(),
  grade_level: z.string().nullish(),
});

/* Rows may nest the person under `student` (like the other class RPCs) or be flat. */
const nestedRow = z.object({
  student: person,
  username: z.string().nullish(),
  in_my_other_classes: z.boolean().nullish(),
});
const flatRow = person.extend({ in_my_other_classes: z.boolean().nullish() });

const searchRow = z.union([nestedRow, flatRow]).transform((row) => {
  if ("student" in row) {
    return {
      ...row.student,
      username: row.username ?? row.student.username ?? null,
      inOtherClass: row.in_my_other_classes === true,
    };
  }
  return {
    ...row,
    username: row.username ?? null,
    inOtherClass: row.in_my_other_classes === true,
  };
});

const searchResult = z
  .union([z.array(searchRow), z.object({ items: z.array(searchRow) })])
  .transform((value) => (Array.isArray(value) ? value : value.items));

const addResult = z.object({
  added: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
});

export interface DirectoryStudent {
  id: string;
  full_name: string;
  username: string | null;
  avatar_url?: string | null | undefined;
  grade_level?: string | null | undefined;
  inOtherClass: boolean;
}

type LooseRpc = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;

async function callRpc<T>(
  fn: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>,
): Promise<T> {
  // The generated Database type does not describe these RPCs yet; zod validates the result.
  const rpc = supabase.rpc.bind(supabase) as unknown as LooseRpc;
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error(normalizeApiError(error).message);
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error(`${fn} returned data in an unexpected shape.`);
  return parsed.data;
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export interface EnrollStudentsModalProps {
  classId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ids already on the roster. They are never offered, even if the search returns them. */
  enrolledIds: ReadonlySet<string>;
}

export function EnrollStudentsModal({
  classId,
  open,
  onOpenChange,
  enrolledIds,
}: EnrollStudentsModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Enroll students"
      description="Search the school directory and tick the students to add to this class."
    >
      {/* Mounted only while open, so every opening starts with an empty search and selection. */}
      {open && (
        <EnrollBody
          classId={classId}
          enrolledIds={enrolledIds}
          onClose={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}

function EnrollBody({
  classId,
  enrolledIds,
  onClose,
}: {
  classId: string;
  enrolledIds: ReadonlySet<string>;
  onClose: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");
  // Selection is kept as a map so a student ticked in one search stays ticked in the next.
  const [picked, setPicked] = useState<ReadonlyMap<string, DirectoryStudent>>(new Map());
  const [submitError, setSubmitError] = useState<string | null>(null);

  const q = useDebounced(term.trim(), SEARCH_DEBOUNCE_MS);
  const search = useQuery({
    queryKey: ["teacher", "class-detail", classId, "enroll-search", q] as const,
    queryFn: () =>
      callRpc(
        "search_students",
        { q: q === "" ? null : q, exclude_class_id: classId, limit: SEARCH_LIMIT },
        searchResult,
      ),
    staleTime: 15_000,
  });

  const enroll = useMutation({
    mutationFn: (ids: string[]) =>
      callRpc("add_students_to_class", { class_id: classId, student_ids: ids }, addResult),
    onSuccess: ({ added, skipped }) => {
      void queryClient.invalidateQueries({ queryKey: ["teacher", "class-detail", classId] });
      void queryClient.invalidateQueries({ queryKey: ["teacher", "classes"] });
      const addedText = `${added} student${added === 1 ? "" : "s"} added to the class.`;
      if (skipped > 0) {
        toast.show({
          type: added > 0 ? "warning" : "error",
          title: added > 0 ? "Some students were skipped" : "No students were added",
          description: `${addedText} ${skipped} skipped: already in the class or removed from it earlier.`,
        });
      } else {
        toast.show({ type: "success", title: "Students enrolled", description: addedText });
      }
      onClose();
    },
    onError: (error: Error) => {
      setSubmitError(error.message);
      toast.show({
        type: "error",
        title: "Could not enroll students",
        description: error.message,
      });
    },
  });

  const results = (search.data ?? []).filter((student) => !enrolledIds.has(student.id));

  const toggle = (student: DirectoryStudent, checked: boolean) => {
    setSubmitError(null);
    setPicked((previous) => {
      const next = new Map(previous);
      if (checked) next.set(student.id, student);
      else next.delete(student.id);
      return next;
    });
  };

  const count = picked.size;

  return (
    <div className="flex flex-col gap-4">
      <SearchField
        aria-label="Search students by name or username"
        placeholder="Search by name or username"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
      />

      {count > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Selected students">
          {[...picked.values()].map((student) => (
            <li key={student.id}>
              <Chip
                size="sm"
                onRemove={() => toggle(student, false)}
                removeLabel={`Remove ${student.full_name} from the selection`}
              >
                {student.full_name}
              </Chip>
            </li>
          ))}
        </ul>
      )}

      <div aria-live="polite" aria-busy={search.isFetching}>
        {search.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" label="Searching…" />
            <Skeleton className="h-14 w-full" label={null} />
            <Skeleton className="h-14 w-full" label={null} />
          </div>
        ) : search.isError ? (
          <ErrorState
            size="sm"
            title="Could not search students"
            description={search.error instanceof Error ? search.error.message : undefined}
            onRetry={() => void search.refetch()}
          />
        ) : results.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            {q === ""
              ? "No more students are available to enroll."
              : `No students match “${q}”.`}
          </p>
        ) : (
          <>
            <ul className="flex flex-col gap-2" aria-label="Students in the school directory">
              {results.map((student) => (
                <li
                  key={student.id}
                  className="flex items-center gap-3 rounded-[14px] border-2 border-stroke bg-surface-0 p-3 shadow-retro-sm"
                >
                  <Checkbox
                    aria-label={`Select ${student.full_name}`}
                    checked={picked.has(student.id)}
                    onCheckedChange={(value) => toggle(student, value === true)}
                  />
                  <Avatar size="sm" name={student.full_name} src={student.avatar_url} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{student.full_name}</p>
                    <p className="truncate text-sm text-muted">
                      {student.username ? `@${student.username}` : "No username"}
                      {student.grade_level ? ` · Grade ${student.grade_level}` : ""}
                    </p>
                  </div>
                  {student.inOtherClass && <Chip size="sm">In another of your classes</Chip>}
                </li>
              ))}
            </ul>
            {search.data !== undefined && search.data.length >= SEARCH_LIMIT && (
              <p className="mt-2 text-center text-sm text-muted">
                Showing the first {SEARCH_LIMIT} matches. Type more to narrow the list.
              </p>
            )}
          </>
        )}
      </div>

      {submitError !== null && (
        <p role="alert" className="text-sm font-bold text-danger-600">
          {submitError}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t-2 border-stroke pt-4">
        <Button variant="outline" onClick={onClose} disabled={enroll.isPending}>
          Cancel
        </Button>
        <Button
          loading={enroll.isPending}
          disabled={count === 0}
          onClick={() => {
            setSubmitError(null);
            enroll.mutate([...picked.keys()]);
          }}
        >
          {count === 0 ? "Add students" : `Add ${count} student${count === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  );
}

export default EnrollStudentsModal;
