import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Flame, UserMinus, UserPlus } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";
import { Avatar } from "@/shared/components/ui/Avatar";
import { Button } from "@/shared/components/ui/Button";
import { Chip } from "@/shared/components/ui/Chip";
import { DataTable } from "@/shared/components/ui/DataTable";
import { Dialog } from "@/shared/components/ui/Dialog";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { SearchField } from "@/shared/components/ui/SearchField";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { Textarea } from "@/shared/components/ui/Textarea";
import { useToast } from "@/shared/hooks/useToast";
import { EnrollStudentsModal } from "./EnrollStudentsModal";
import { formatDate } from "./rules";

/* ========================================
   Class roster tab (TEACHER-SPEC TC-04, task TCH-CORE-04)

   A TanStack DataTable of the students enrolled in the class: avatar and name, username,
   enrolled date, current streak, last active and enrollment status. A search box filters the
   rows by name, username or student ID. "Enroll students" opens the school directory modal.
   Removing a student (one row, or a selection) asks for a reason first, then calls the
   `remove_student_from_class` RPC, which archives the enrollment and writes the audit log.
   The student's progress is kept; only their access to the class is closed.

   Data: `class_roster {class_id}` (API-CONTRACT §4.2). Optional fields the server may add
   (`enrolled_at`, `streak`) show a dash until it sends them.
   ======================================== */

const MAX_REASON = 500;

const person = z.object({
  id: z.string(),
  full_name: z.string(),
  username: z.string().nullish(),
  avatar_url: z.string().nullish(),
});

const rosterRow = z.object({
  student: person,
  username: z.string().nullish(),
  student_code: z.string().nullish(),
  status: z.string(),
  enrolled_at: z.string().nullish(),
  joined_at: z.string().nullish(),
  streak: z.number().int().nonnegative().nullish(),
  last_active_at: z.string().nullish(),
});
const rosterResult = z.object({ rows: z.array(rosterRow).prefault([]) });

interface Student {
  id: string;
  name: string;
  username: string | null;
  code: string | null;
  avatarUrl: string | null;
  status: string;
  enrolledAt: string | null;
  streak: number | null;
  lastActiveAt: string | null;
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

async function fetchStudents(classId: string): Promise<Student[]> {
  const { rows } = await callRpc("class_roster", { class_id: classId }, rosterResult);
  return (
    rows
      // An archived enrollment is a removed student; never list one even if the server sends it.
      .filter((row) => row.status !== "archived" && row.status !== "removed")
      .map((row) => ({
        id: row.student.id,
        name: row.student.full_name,
        username: row.username ?? row.student.username ?? null,
        code: row.student_code ?? null,
        avatarUrl: row.student.avatar_url ?? null,
        status: row.status,
        enrolledAt: row.enrolled_at ?? row.joined_at ?? null,
        streak: row.streak ?? null,
        lastActiveAt: row.last_active_at ?? null,
      }))
  );
}

function matchesSearch(student: Student, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (needle === "") return true;
  return [student.name, student.username, student.code].some((field) =>
    field?.toLowerCase().includes(needle),
  );
}

function statusLabel(status: string): string {
  const text = status.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function streakLabel(streak: number | null): string {
  if (streak === null) return "—";
  return `${streak} day${streak === 1 ? "" : "s"}`;
}

/** A removal in progress: who is leaving, and how to clear the table selection afterwards. */
interface Removal {
  students: Student[];
  clearSelection: (() => void) | null;
}

function RemoveStudentsDialog({
  classId,
  removal,
  onChange,
}: {
  classId: string;
  removal: Removal;
  onChange: (next: Removal | null) => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { students } = removal;
  const many = students.length > 1;
  const subject = many ? `${students.length} students` : (students[0]?.name ?? "this student");
  const trimmed = reason.trim();

  const remove = useMutation({
    mutationFn: async (targets: Student[]) => {
      const outcomes = await Promise.allSettled(
        targets.map((student) =>
          callRpc(
            "remove_student_from_class",
            { class_id: classId, student_id: student.id, reason: trimmed },
            z.unknown(),
          ),
        ),
      );
      const failed: Array<{ student: Student; message: string }> = [];
      outcomes.forEach((outcome, index) => {
        const student = targets[index];
        if (outcome.status === "rejected" && student) {
          failed.push({
            student,
            message: outcome.reason instanceof Error ? outcome.reason.message : "Request failed.",
          });
        }
      });
      return { removed: targets.length - failed.length, failed };
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["teacher", "class-detail", classId] });
      void queryClient.invalidateQueries({ queryKey: ["teacher", "classes"] });
    },
    onSuccess: ({ removed, failed }) => {
      if (failed.length === 0) {
        toast.show({
          type: "success",
          title: removed === 1 ? "Student removed" : `${removed} students removed`,
          description: "Their progress is kept, but the class is no longer available to them.",
        });
        removal.clearSelection?.();
        onChange(null);
        return;
      }
      // Some removals went through: keep the dialog open on the ones that did not.
      const names = failed.map((item) => item.student.name).join(", ");
      const message = `Could not remove ${names}. ${failed[0]?.message ?? ""}`.trim();
      setError(message);
      toast.show({
        type: "error",
        title: removed > 0 ? "Some students were not removed" : "Could not remove students",
        description: message,
      });
      onChange({ students: failed.map((item) => item.student), clearSelection: null });
    },
    onError: (err: Error) => {
      setError(err.message);
      toast.show({ type: "error", title: "Could not remove students", description: err.message });
    },
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !remove.isPending) onChange(null);
      }}
      title={many ? `Remove ${students.length} students?` : "Remove student?"}
      description={`${subject} will no longer see this class's content. Their progress stays in their record.`}
      footer={
        <>
          <Button variant="outline" onClick={() => onChange(null)} disabled={remove.isPending}>
            Keep in class
          </Button>
          <Button
            variant="danger"
            loading={remove.isPending}
            disabled={trimmed === ""}
            onClick={() => {
              setError(null);
              remove.mutate(students);
            }}
          >
            <UserMinus size={16} aria-hidden="true" /> Remove from class
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {many && (
          <ul className="flex flex-wrap gap-2" aria-label="Students to remove">
            {students.map((student) => (
              <li key={student.id}>
                <Chip size="sm">{student.name}</Chip>
              </li>
            ))}
          </ul>
        )}
        <Textarea
          label="Reason"
          required
          rows={3}
          maxLength={MAX_REASON}
          showCount
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          helperText="Saved in the audit log. For example: moved to another class."
        />
        {error !== null && (
          <p role="alert" className="text-sm font-bold text-danger-600">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}

export function RosterTab({ classId }: { classId: string }) {
  const [term, setTerm] = useState("");
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [removal, setRemoval] = useState<Removal | null>(null);

  const query = useQuery({
    queryKey: ["teacher", "class-detail", classId, "roster-table"] as const,
    queryFn: () => fetchStudents(classId),
  });

  const students = query.data;
  const visible = useMemo(
    () => (students ?? []).filter((student) => matchesSearch(student, term)),
    [students, term],
  );
  const enrolledIds = useMemo(
    () => new Set((students ?? []).map((student) => student.id)),
    [students],
  );

  const columns = useMemo<ColumnDef<Student, unknown>[]>(
    () => [
      {
        id: "name",
        header: "Student",
        accessorFn: (row) => row.name,
        cell: ({ row }) => (
          <Link
            to={`/teacher/students/${encodeURIComponent(row.original.id)}`}
            className="inline-flex items-center gap-2 font-bold"
          >
            <Avatar size="xs" name={row.original.name} src={row.original.avatarUrl} />
            {row.original.name}
          </Link>
        ),
      },
      {
        id: "username",
        header: "Username",
        accessorFn: (row) => row.username ?? undefined,
        cell: ({ row }) => (row.original.username ? `@${row.original.username}` : "—"),
      },
      {
        id: "enrolled",
        header: "Enrolled",
        accessorFn: (row) => row.enrolledAt ?? undefined,
        cell: ({ row }) => formatDate(row.original.enrolledAt),
      },
      {
        id: "streak",
        header: "Current streak",
        accessorFn: (row) => row.streak ?? undefined,
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1">
            {(row.original.streak ?? 0) > 0 && <Flame size={16} aria-hidden="true" />}
            {streakLabel(row.original.streak)}
          </span>
        ),
      },
      {
        id: "lastActive",
        header: "Last active",
        accessorFn: (row) => row.lastActiveAt ?? undefined,
        cell: ({ row }) => formatDate(row.original.lastActiveAt),
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (row) => row.status,
        cell: ({ row }) => <Chip size="sm">{statusLabel(row.original.status)}</Chip>,
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            size="sm"
            variant="outline"
            aria-label={`Remove ${row.original.name} from class`}
            onClick={() => setRemoval({ students: [row.original], clearSelection: null })}
          >
            <UserMinus size={16} aria-hidden="true" /> Remove
          </Button>
        ),
      },
    ],
    [],
  );

  if (query.isPending) {
    return (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-11 w-full" label="Loading roster…" />
        <Skeleton className="h-64 w-full" label={null} />
      </div>
    );
  }
  if (query.isError) {
    return (
      <ErrorState
        title="Could not load the roster"
        description={query.error instanceof Error ? query.error.message : undefined}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const enrollButton = (
    <Button onClick={() => setEnrollOpen(true)}>
      <UserPlus size={16} aria-hidden="true" /> Enroll students
    </Button>
  );

  return (
    <div className="space-y-4">
      {query.data.length === 0 ? (
        <EmptyState
          title="No students yet"
          description="Enroll students from the school directory, or share the join code."
          action={enrollButton}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SearchField
              className="w-full max-w-sm"
              aria-label="Search the roster by name, username or student ID"
              placeholder="Search students"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
            />
            {enrollButton}
          </div>
          <DataTable
            label="Students in this class"
            data={visible}
            columns={columns}
            getRowId={(student) => student.id}
            getRowLabel={(student) => `Select ${student.name}`}
            filterable={false}
            initialSorting={[{ id: "name", desc: false }]}
            emptyMessage={
              term.trim() === "" ? "No students" : `No students match “${term.trim()}”.`
            }
            bulkActions={[
              {
                id: "remove",
                label: "Remove from class",
                variant: "danger",
                icon: <UserMinus size={16} aria-hidden="true" />,
                onAction: (rows, clearSelection) => setRemoval({ students: rows, clearSelection }),
              },
            ]}
          />
        </>
      )}

      <EnrollStudentsModal
        classId={classId}
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        enrolledIds={enrolledIds}
      />
      {removal !== null && (
        <RemoveStudentsDialog classId={classId} removal={removal} onChange={setRemoval} />
      )}
    </div>
  );
}

export default RosterTab;
