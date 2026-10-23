import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  Clock3,
  GraduationCap,
  LoaderCircle,
  Rocket,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/shared/api/supabase";

type Course = { id: string; title: string; status?: string | null };
type Lesson = { id: string; unit_id: string; title: string; xp_reward: number | null };
type Unit = { id: string; title: string; lessons: Lesson[] };
type ClassOption = {
  id: string;
  name: string;
  grade_level?: string | null;
  is_archived?: boolean | null;
};
type CheckItem = { label: string; detail: string; passed: boolean };
const db = supabase as any;

export default function CoursePublishPage() {
  const { courseId = "" } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [versionKind, setVersionKind] = useState<"major" | "minor">("minor");
  const [revisionNotes, setRevisionNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null);
  const [contentValid, setContentValid] = useState(false);
  const [contentMessage, setContentMessage] = useState("Checking lesson content…");

  const load = useCallback(async () => {
    if (!courseId) {
      setError("Course ID is missing from the URL.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [
        { data: courseData, error: courseError },
        { data: unitData, error: unitError },
        { data: authData },
      ] = await Promise.all([
        db.from("courses").select("id,title,status").eq("id", courseId).maybeSingle(),
        db
          .from("units")
          .select("id,title,order_index")
          .eq("course_id", courseId)
          .order("order_index", { ascending: true }),
        supabase.auth.getUser(),
      ]);
      if (courseError) throw courseError;
      if (unitError) throw unitError;
      if (!courseData) throw new Error("Course not found. Check the course link and try again.");
      setCourse(courseData);
      const unitRows = (unitData ?? []) as Array<{ id: string; title: string }>;
      const ids = unitRows.map((unit) => unit.id);
      let lessonRows: Lesson[] = [];
      if (ids.length) {
        const { data, error: lessonsError } = await db
          .from("lessons")
          .select("id,unit_id,title,xp_reward")
          .in("unit_id", ids)
          .order("order_index", { ascending: true });
        if (lessonsError) throw lessonsError;
        lessonRows = (data ?? []) as Lesson[];
      }
      setUnits(
        unitRows.map((unit) => ({
          ...unit,
          lessons: lessonRows.filter((lesson) => lesson.unit_id === unit.id),
        })),
      );
      const userId = authData?.user?.id;
      if (userId) {
        const { data: teacherRows, error: teacherError } = await db
          .from("class_teachers")
          .select("class_id, classes(id,name,grade_level,is_archived)")
          .eq("teacher_id", userId);
        if (teacherError) throw teacherError;
        const options = (teacherRows ?? [])
          .map((row: any) => (Array.isArray(row.classes) ? row.classes[0] : row.classes))
          .filter((item: any) => item && !item.is_archived) as ClassOption[];
        const unique = Array.from(new Map(options.map((item) => [item.id, item])).values()).sort(
          (a, b) => a.name.localeCompare(b.name),
        );
        setClasses(unique);
        const { data: existing, error: existingError } = await db
          .from("class_courses")
          .select("class_id")
          .eq("course_id", courseId)
          .eq("is_active", true);
        if (existingError) throw existingError;
        setSelectedClasses(
          (existing ?? [])
            .map((row: { class_id: string }) => row.class_id)
            .filter((id: string) => unique.some((item) => item.id === id)),
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load the course publish checklist.",
      );
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    const verify = async () => {
      const lessonIds = units.flatMap((unit) => unit.lessons.map((lesson) => lesson.id));
      if (!lessonIds.length) {
        setContentValid(false);
        setContentMessage("No lessons to check yet");
        return;
      }
      const { data, error: blockError } = await db
        .from("lesson_blocks")
        .select("lesson_id,content")
        .in("lesson_id", lessonIds);
      if (cancelled) return;
      if (blockError) {
        setContentValid(false);
        setContentMessage("Could not verify lesson blocks");
        return;
      }
      const nonEmpty = new Set(
        (data ?? [])
          .filter(
            (block: any) =>
              block.content &&
              typeof block.content === "object" &&
              Object.keys(block.content).length > 0,
          )
          .map((block: any) => block.lesson_id),
      );
      const missing = lessonIds.length - nonEmpty.size;
      setContentValid(missing === 0);
      setContentMessage(
        missing === 0
          ? "Every lesson has content"
          : `${missing} lesson${missing === 1 ? " is" : "s are"} missing content`,
      );
    };
    void verify();
    return () => {
      cancelled = true;
    };
  }, [units]);

  const checks = useMemo<CheckItem[]>(() => {
    const lessonList = units.flatMap((unit) => unit.lessons);
    return [
      {
        label: "At least one unit",
        detail: `${units.length} unit${units.length === 1 ? "" : "s"} found`,
        passed: units.length > 0,
      },
      {
        label: "At least one lesson",
        detail: `${lessonList.length} lesson${lessonList.length === 1 ? "" : "s"} found`,
        passed: lessonList.length > 0,
      },
      {
        label: "Every lesson has a title",
        detail: "Lesson titles must not be blank",
        passed:
          lessonList.length > 0 && lessonList.every((lesson) => Boolean(lesson.title?.trim())),
      },
      { label: "Every lesson has content", detail: contentMessage, passed: contentValid },
      {
        label: "XP rewards are valid",
        detail: "XP must be a whole number from 0 to 1,000",
        passed:
          lessonList.length > 0 &&
          lessonList.every(
            (lesson) =>
              Number.isInteger(Number(lesson.xp_reward ?? 0)) &&
              Number(lesson.xp_reward ?? 0) >= 0 &&
              Number(lesson.xp_reward ?? 0) <= 1000,
          ),
      },
    ];
  }, [units, contentValid, contentMessage]);
  const ready = checks.every((item) => item.passed);
  const toggleClass = (id: string) =>
    setSelectedClasses((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  const publish = async () => {
    setError("");
    setSuccess("");
    if (!ready) {
      setError("Fix every item in the validation checklist before publishing.");
      return;
    }
    if (!selectedClasses.length) {
      setError("Select at least one active class to assign this published course to.");
      return;
    }
    setPublishing(true);
    try {
      // Assign first so publish_course sends its publication event to the selected classes.
      const { error: deactivateError } = await db
        .from("class_courses")
        .update({ is_active: false })
        .eq("course_id", courseId)
        .eq("is_active", true);
      if (deactivateError) throw deactivateError;
      const assignmentRows = selectedClasses.map((class_id) => ({
        class_id,
        course_id: courseId,
        is_active: true,
        assigned_at: new Date().toISOString(),
      }));
      const { error: assignmentError } = await db
        .from("class_courses")
        .upsert(assignmentRows, { onConflict: "class_id,course_id" });
      if (assignmentError) throw assignmentError;
      const { data, error: publishError } = await db.rpc("publish_course", { course_id: courseId });
      if (publishError) throw publishError;
      const result = data as { published_version?: number; snapshot_id?: string } | null;
      setPublishedVersion(result?.published_version ?? null);
      setSuccess(
        `Course published successfully${result?.published_version ? ` as version ${result.published_version}` : ""}. ${selectedClasses.length} class${selectedClasses.length === 1 ? " was" : "es were"} assigned.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Publishing failed. The server did not confirm publication.",
      );
    } finally {
      setPublishing(false);
    }
  };

  if (loading)
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-5xl items-center justify-center p-8 text-slate-600">
        <LoaderCircle className="mr-3 animate-spin" />
        Loading course publish checklist…
      </main>
    );

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <Link
        to={`/teacher/courses/${courseId}/edit`}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"
      >
        <ArrowLeft size={16} /> Back to course builder
      </Link>
      <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            <Rocket size={14} /> Course publishing wizard
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Publish {course?.title ?? "course"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Validate learning content, choose a revision type, then assign the published snapshot to
            your classes.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
          <ShieldCheck className="text-indigo-600" />
          <div>
            <div className="text-sm font-semibold text-slate-900">Immutable snapshot</div>
            <div className="text-xs text-slate-500">Published content is versioned</div>
          </div>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <AlertCircle className="mt-0.5 shrink-0" size={18} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div
          role="status"
          className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
        >
          <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
          <div>
            <p className="font-semibold">{success}</p>
            {publishedVersion && (
              <p className="mt-1 text-xs">Snapshot version {publishedVersion} is now published.</p>
            )}
            <button
              onClick={() => navigate(`/teacher/courses/${courseId}/edit`)}
              className="mt-3 font-semibold underline"
            >
              Return to course
            </button>
          </div>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-900">1. Pre-publish validation</h2>
            <p className="mt-1 text-sm text-slate-500">Every check must pass before publishing.</p>
          </div>
          <span
            className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
          >
            {ready
              ? "Ready to publish"
              : `${checks.filter((item) => item.passed).length}/${checks.length} checks passed`}
          </span>
        </div>
        <div className="divide-y divide-slate-100">
          {checks.map((item) => (
            <div key={item.label} className="flex items-start gap-3 py-3">
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${item.passed ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}
              >
                {item.passed ? <Check size={15} /> : <AlertCircle size={15} />}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                <p className="mt-0.5 text-sm text-slate-500">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
        {units.length > 0 && (
          <div className="mt-4 rounded-xl bg-slate-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <BookOpen size={16} /> Course outline
            </div>
            {units.map((unit) => (
              <div key={unit.id} className="mb-2 last:mb-0">
                <p className="text-sm font-medium text-slate-800">
                  {unit.title || "Untitled unit"}
                </p>
                <ul className="ml-5 mt-1 list-disc text-sm text-slate-500">
                  {unit.lessons.map((lesson) => (
                    <li key={lesson.id}>
                      {lesson.title || "Untitled lesson"}{" "}
                      <span className="text-xs">· {lesson.xp_reward ?? 0} XP</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold text-slate-900">2. Version and revision notes</h2>
        <p className="mt-1 text-sm text-slate-500">
          The current publishing service creates the next immutable version automatically.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setVersionKind("major")}
            className={`rounded-xl border p-4 text-left ${versionKind === "major" ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500" : "border-slate-200 hover:border-slate-300"}`}
          >
            <span className="font-semibold text-slate-900">Major release</span>
            <p className="mt-1 text-sm text-slate-500">Significant curriculum changes</p>
          </button>
          <button
            type="button"
            onClick={() => setVersionKind("minor")}
            className={`rounded-xl border p-4 text-left ${versionKind === "minor" ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500" : "border-slate-200 hover:border-slate-300"}`}
          >
            <span className="font-semibold text-slate-900">Minor revision</span>
            <p className="mt-1 text-sm text-slate-500">Corrections and improvements</p>
          </button>
        </div>
        <label className="mt-4 block text-sm font-semibold text-slate-700">
          Revision notes <span className="font-normal text-slate-400">(optional)</span>
          <textarea
            value={revisionNotes}
            onChange={(event) => setRevisionNotes(event.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Describe what changed in this version…"
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </label>
        <p className="mt-2 text-xs text-slate-500">
          Selected: {versionKind === "major" ? "Major release" : "Minor revision"}
          {revisionNotes.trim() ? ` · ${revisionNotes.trim().length} characters of notes` : ""}. The
          current publish_course RPC accepts neither revision type nor notes; the selection is shown
          for the publishing workflow only.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-900">3. Assign to classes</h2>
            <p className="mt-1 text-sm text-slate-500">
              Choose the active classes that should receive this course version.
            </p>
          </div>
          <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {selectedClasses.length} selected
          </span>
        </div>
        {classes.length === 0 ? (
          <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            No active classes were found for your teacher account.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {classes.map((item) => (
              <label
                key={item.id}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${selectedClasses.includes(item.id) ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:border-slate-300"}`}
              >
                <input
                  type="checkbox"
                  checked={selectedClasses.includes(item.id)}
                  onChange={() => toggleClass(item.id)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <GraduationCap className="mt-0.5 shrink-0 text-slate-500" size={19} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-slate-900">{item.name}</span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {item.grade_level ? `Grade ${item.grade_level}` : "Grade not set"}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
      </section>

      <footer className="flex flex-col-reverse justify-between gap-3 sm:flex-row sm:items-center">
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Clock3 size={14} /> Publishing creates a new immutable snapshot.
        </p>
        <button
          type="button"
          onClick={() => void publish()}
          disabled={publishing || !ready || selectedClasses.length === 0 || Boolean(success)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {publishing ? (
            <>
              <LoaderCircle size={17} className="animate-spin" /> Publishing…
            </>
          ) : (
            <>
              <Rocket size={17} /> Publish course and assign classes
            </>
          )}
        </button>
      </footer>
    </main>
  );
}
