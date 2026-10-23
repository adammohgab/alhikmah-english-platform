import { useState } from "react";
import VersionHistoryModal from "@/pages/teacher/CourseBuilderPage/VersionHistoryModal";

export interface TeacherCourse {
  id: string;
  title: string;
  source: "teacher" | "official";
  status: "draft" | "published" | "archived";
  unitCount: number;
  enrolledClasses: number;
  updatedAt: string;
}

interface Props {
  courses: TeacherCourse[];
  createCourse: () => void;
  adoptOfficial: () => void;
  duplicate: (id: string, title: string) => Promise<void>;
  archive: (id: string) => Promise<void>;
}

export default function CoursesAuthoringPage({
  courses,
  createCourse,
  adoptOfficial,
  duplicate,
  archive,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [historyCourse, setHistoryCourse] = useState<TeacherCourse | null>(null);

  async function run(id: string, action: () => Promise<void>, success: string) {
    setBusy(id);
    setMessage("");
    try {
      await action();
      setMessage(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  const activeCourses = courses.filter((course) => course.status !== "archived");

  return (
    <main style={{ maxWidth: 1100, margin: "2rem auto", fontFamily: "system-ui" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1>My Courses</h1>
          <p>Manage your courses and adopted school curriculum.</p>
        </div>
        <div>
          <button onClick={createCourse}>Create New Course</button>{" "}
          <button onClick={adoptOfficial}>Adopt Official Curriculum</button>
        </div>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(270px,1fr))",
          gap: 16,
        }}
      >
        {activeCourses.map((course) => (
          <article
            key={course.id}
            style={{ border: "1px solid #ddd", borderRadius: 12, padding: 18 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <h2>{course.title}</h2>
              <span
                style={{
                  alignSelf: "start",
                  padding: "4px 9px",
                  borderRadius: 12,
                  background: course.status === "published" ? "#d9f3e3" : "#fff0c2",
                }}
              >
                {course.status}
              </span>
            </div>
            <p>
              {course.source === "official"
                ? "Official school curriculum"
                : "Teacher-authored course"}
            </p>
            <p>
              {course.unitCount} units · {course.enrolledClasses} enrolled classes
            </p>
            <small>Last edited {new Date(course.updatedAt).toLocaleString()}</small>
            <hr />
            <button onClick={() => setHistoryCourse(course)}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                Version history
              </span>
            </button>{" "}
            <button
              onClick={() => {
                void run(
                  course.id,
                  () => duplicate(course.id, `${course.title} (Copy)`),
                  "Course duplicated.",
                );
              }}
            >
              Duplicate
            </button>{" "}
            <button
              disabled={busy === course.id}
              onClick={() => {
                if (window.confirm(`Archive “${course.title}”?`)) {
                  void run(course.id, () => archive(course.id), "Course archived.");
                }
              }}
            >
              {busy === course.id ? "Working…" : "Archive"}
            </button>
          </article>
        ))}
      </div>

      {activeCourses.length === 0 && (
        <p>No courses yet. Create a course or adopt an official curriculum to get started.</p>
      )}
      <p role="status">{message}</p>
      {historyCourse && (
        <VersionHistoryModal
          courseId={historyCourse.id}
          open
          onClose={() => setHistoryCourse(null)}
          onRestored={() =>
            setMessage(`Draft restored from version history for “${historyCourse.title}”.`)
          }
        />
      )}
    </main>
  );
}
