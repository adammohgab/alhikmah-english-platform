import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { useAuth } from "@/app/providers/auth-context";
import { useToast } from "@/shared/hooks/useToast";
import { Textarea } from "@/shared/components/ui/Textarea";
import { fetchTeacherNote, saveTeacherNote } from "./api";

/* ========================================
   Private teacher notes (TC-08): one note per teacher per student, saved automatically
   800 ms after typing stops. Only the author's own row is read or written.
   ======================================== */

const AUTOSAVE_MS = 800;

type SaveState = "idle" | "saving" | "saved" | "error";

export function NotesPanel({ studentId }: { studentId: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const authorId = user?.id ?? "";

  const query = useQuery({
    queryKey: ["teacher", "student-note", studentId, authorId],
    queryFn: () => fetchTeacherNote(studentId, authorId),
    enabled: authorId !== "",
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  const [edited, setEdited] = useState<string | null>(null);
  const [state, setState] = useState<SaveState>("idle");
  const [failure, setFailure] = useState("");
  const value = edited ?? query.data?.note ?? "";

  const savedText = useRef("");
  const noteId = useRef<string | null>(null);
  const busy = useRef(false);
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => {
    if (query.data) {
      savedText.current = query.data.note;
      noteId.current = query.data.id;
    }
  }, [query.data]);

  const persist = async (text: string): Promise<boolean> => {
    if (busy.current) return false;
    busy.current = true;
    setState("saving");
    try {
      noteId.current = await saveTeacherNote(studentId, authorId, noteId.current, text);
      savedText.current = text;
      setState("saved");
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Try again.";
      setFailure(message);
      setState("error");
      toast.show({ type: "error", title: "Note was not saved", description: message });
      return false;
    } finally {
      busy.current = false;
    }
  };

  // Debounced autosave. Re-runs after a save so text typed during the save is not lost.
  useEffect(() => {
    if (
      edited === null ||
      edited === savedText.current ||
      state === "saving" ||
      state === "error"
    ) {
      return undefined;
    }
    const timer = window.setTimeout(() => void persist(edited), AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
    // `persist` only reads refs and stable ids, so it is deliberately not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edited, state]);

  // Leaving the page flushes anything still waiting for the debounce.
  useEffect(
    () => () => {
      if (authorId !== "" && latest.current !== savedText.current && !busy.current) {
        void saveTeacherNote(studentId, authorId, noteId.current, latest.current).catch(
          (error: unknown) =>
            toast.show({
              type: "error",
              title: "Note was not saved",
              description: error instanceof Error ? error.message : "Try again.",
            }),
        );
      }
    },
    // Runs only on unmount; the refs hold the latest values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const status =
    state === "saving"
      ? "Saving…"
      : state === "saved"
        ? "Saved"
        : state === "error"
          ? `Not saved: ${failure}`
          : "Saves automatically";

  return (
    <section
      aria-labelledby="teacher-notes-title"
      className="rounded-[20px] border-2 border-stroke bg-surface-0 p-5 shadow-retro-sm"
    >
      <h2
        id="teacher-notes-title"
        className="font-display flex items-center gap-2 text-lg font-extrabold"
      >
        <Lock size={18} aria-hidden="true" /> Teacher notes
      </h2>
      <p className="mb-3 text-sm text-muted">
        Private to you. Use it for IEP and parent conference prep.
      </p>
      {query.isError ? (
        <p role="alert" className="text-sm font-bold">
          Notes could not be loaded:{" "}
          {query.error instanceof Error ? query.error.message : "try again."}
        </p>
      ) : (
        <Textarea
          label="Private notes"
          value={value}
          disabled={query.isPending}
          onChange={(event) => {
            setEdited(event.target.value);
            if (state === "error" || state === "saved") setState("idle");
          }}
          helperText={<span aria-live="polite">{status}</span>}
        />
      )}
    </section>
  );
}
