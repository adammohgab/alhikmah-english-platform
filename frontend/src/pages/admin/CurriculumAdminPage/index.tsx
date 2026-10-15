// frontend/src/pages/admin/CurriculumAdminPage/index.tsx
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, LockKeyhole, RefreshCw, ShieldCheck, UnlockKeyhole } from "lucide-react";
import { env } from "@/shared/config/env";
import { supabase } from "@/shared/api/supabase";

interface Course {
  id: string;
  title: string;
  description: string | null;
  grade_level: string | null;
  is_official: boolean;
  status: string;
  author_id: string | null;
  updated_at: string;
}
interface Unit {
  id: string;
  course_id: string;
  title: string;
  order_index: number;
}
interface Lesson {
  id: string;
  unit_id: string;
  title: string;
  order_index: number;
}

const base = env.VITE_SUPABASE_URL.replace(/\/$/, "") + "/rest/v1";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new Error(error?.message ?? "Sign in to use curriculum management.");
  }

  const response = await fetch(base + "/" + path, {
    ...init,
    headers: {
      apikey: env.VITE_SUPABASE_ANON_KEY,
      Authorization: "Bearer " + data.session.access_token,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error((await response.text()) || "Curriculum request failed.");
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

const grades = Array.from({ length: 12 }, (_, index) => String(index + 1));
const frame = "rounded-2xl border-2 border-stroke bg-surface-0 shadow-retro-sm";

export default function CurriculumAdminPage() {
  const client = useQueryClient();
  const [grade, setGrade] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const coursesQuery = useQuery({
    queryKey: ["admin-curriculum-courses"],
    queryFn: () =>
      request<Course[]>(
        "courses?select=id,title,description,grade_level,is_official,status,author_id,updated_at&order=grade_level.asc,title.asc",
      ),
    staleTime: 30_000,
  });

  const courses = useMemo(() => coursesQuery.data ?? [], [coursesQuery.data]);
  const shown = courses.filter((course) => grade === "all" || course.grade_level === grade);

  const officialByGrade = useMemo(
    () =>
      new Map(
        grades.map((item) => [
          item,
          courses.filter((course) => course.grade_level === item && course.is_official),
        ]),
      ),
    [courses],
  );

  async function setOfficial(course: Course, official: boolean) {
    setNotice("");

    try {
      await request<Course[]>("courses?id=eq." + encodeURIComponent(course.id), {
        method: "PATCH",
        body: JSON.stringify({ is_official: official }),
      });

      await client.invalidateQueries({
        queryKey: ["admin-curriculum-courses"],
      });

      setNotice(
        official
          ? "Course promoted to official curriculum."
          : "Official status removed; teacher editing follows course permissions.",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update the course.");
    }
  }

  return (
    <main
      data-world="amber"
      className="min-h-screen space-y-6 bg-world-amber-50 p-4 text-stroke sm:p-8"
    >
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border-2 border-stroke bg-world-amber-200 p-6 shadow-retro-md">
        <div>
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest">
            <ShieldCheck size={16} /> Official learning plan
          </p>
          <h1 className="mt-2 font-heading text-4xl font-bold">Curriculum repository</h1>
          <p className="mt-1">Courses and their published units and lessons.</p>
        </div>

        <button
          onClick={() => void coursesQuery.refetch()}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-stroke bg-surface-0 px-4 font-bold shadow-retro-sm"
        >
          <RefreshCw size={17} /> Refresh
        </button>
      </header>

      {notice && (
        <p role="status" className={frame + " p-4"}>
          {notice}
        </p>
      )}

      {coursesQuery.isError && (
        <p role="alert" className="rounded-xl border-2 border-stroke bg-world-rose-100 p-4">
          {coursesQuery.error.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="font-bold" htmlFor="curriculum-grade">
          Grade
        </label>

        <select
          id="curriculum-grade"
          value={grade}
          onChange={(event) => setGrade(event.target.value)}
          className="min-h-11 rounded-xl border-2 border-stroke bg-surface-0 px-3"
        >
          <option value="all">All grades</option>
          {grades.map((item) => (
            <option key={item} value={item}>
              Grade {item}
            </option>
          ))}
        </select>

        <span className="text-sm text-muted">
          Official courses use the database is_official flag; published curriculum is protected by
          the course access rules.
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(220px,0.65fr)_minmax(0,1.35fr)]">
        <aside className={frame + " p-4"}>
          <h2 className="mb-3 font-heading text-xl font-bold">Grade map</h2>

          {grades.map((item) => (
            <button
              key={item}
              onClick={() => setGrade(item)}
              className="mb-2 flex w-full items-center justify-between rounded-xl border-2 border-stroke bg-world-amber-100 px-3 py-2 text-left font-bold"
            >
              Grade {item}
              <span className="text-sm">{officialByGrade.get(item)?.length ?? 0} official</span>
            </button>
          ))}
        </aside>

        <section className="space-y-3" aria-label="Curriculum courses">
          {coursesQuery.isLoading && <p className={frame + " p-5"}>Loading curriculum…</p>}

          {!coursesQuery.isLoading && shown.length === 0 && (
            <p className={frame + " p-5"}>No courses match this grade.</p>
          )}

          {shown.map((course) => (
            <CourseRow
              key={course.id}
              course={course}
              selected={selected === course.id}
              onSelect={() => setSelected(selected === course.id ? null : course.id)}
              onToggle={() => void setOfficial(course, !course.is_official)}
            />
          ))}
        </section>
      </div>
    </main>
  );
}

function CourseRow({
  course,
  selected,
  onSelect,
  onToggle,
}: {
  course: Course;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const tree = useQuery({
    queryKey: ["curriculum-tree", course.id],
    enabled: selected,
    queryFn: async () => {
      const units = await request<Unit[]>(
        "units?select=id,course_id,title,order_index&course_id=eq." +
          course.id +
          "&order=order_index.asc",
      );

      const lessons = units.length
        ? await request<Lesson[]>(
            "lessons?select=id,unit_id,title,order_index&unit_id=in.(" +
              units.map((unit) => unit.id).join(",") +
              ")&order=order_index.asc",
          )
        : [];

      return units.map((unit) => ({
        ...unit,
        lessons: lessons.filter((lesson) => lesson.unit_id === unit.id),
      }));
    },
  });

  return (
    <article className={frame + " overflow-hidden"}>
      <div className="flex flex-wrap items-center gap-3 p-4">
        <BookOpen aria-hidden="true" />

        <button onClick={onSelect} className="min-w-0 flex-1 text-left">
          <span className="block font-heading text-xl font-bold">{course.title}</span>
          <span className="text-sm text-muted">
            Grade {course.grade_level ?? "Unassigned"} · {course.status} · Updated{" "}
            {new Date(course.updated_at).toLocaleDateString()}
          </span>
        </button>

        <span className="rounded-full border-2 border-stroke bg-world-mint-100 px-3 py-1 text-sm font-bold">
          {course.is_official ? "Official" : "Teacher course"}
        </span>

        <button
          onClick={onToggle}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border-2 border-stroke bg-surface-0 px-3 font-bold"
        >
          {course.is_official ? (
            <>
              <UnlockKeyhole size={16} /> Remove official
            </>
          ) : (
            <>
              <LockKeyhole size={16} /> Promote official
            </>
          )}
        </button>
      </div>

      {selected && (
        <div className="border-t-2 border-stroke/20 bg-world-amber-50 p-4">
          {tree.isLoading ? (
            "Loading course structure…"
          ) : tree.isError ? (
            <p role="alert">{tree.error.message}</p>
          ) : tree.data?.length ? (
            tree.data.map((unit) => (
              <div
                key={unit.id}
                className="mb-3 rounded-xl border-2 border-stroke bg-surface-0 p-3"
              >
                <h3 className="font-bold">{unit.title}</h3>
                <ol className="mt-2 list-inside list-decimal text-sm">
                  {unit.lessons.map((lesson) => (
                    <li key={lesson.id}>{lesson.title}</li>
                  ))}
                </ol>
              </div>
            ))
          ) : (
            <p>No units are assigned to this course yet.</p>
          )}
        </div>
      )}
    </article>
  );
}
