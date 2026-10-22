/* ========================================
   Courses list rules (STUDENT-SPEC ST-02, STU-CORE-03)
   Pure functions, no React and no network, so the tab partition, the sort order and the
   generated cover are testable on their own.
   ======================================== */

export const WORLD_IDS = ["coral", "amber", "mint", "sky", "violet", "rose"] as const;
export type CoverWorld = (typeof WORLD_IDS)[number];

/* ---------- Course model (what the page works with) ---------- */

export type CourseCategory = "main" | "reading_club" | "exam_prep" | "custom";

export interface Course {
  id: string;
  title: string;
  category: CourseCategory;
  /** Raw category text for a course whose category is not one of the known ones. */
  categoryText: string | null;
  grade: string | null;
  teacherName: string | null;
  unitsCount: number;
  /** Always a whole number from 0 to 100. */
  progressPct: number;
  lessonsDone: number | null;
  lessonsTotal: number | null;
  nextLabel: string | null;
  coverSeed: string;
  completed: boolean;
  lastOpenedAt: string | null;
}

/* ---------- Category ---------- */

const CATEGORY_KEYS: Record<string, CourseCategory> = {
  main: "main",
  main_course: "main",
  reading_club: "reading_club",
  readingclub: "reading_club",
  exam_prep: "exam_prep",
  examprep: "exam_prep",
  custom: "custom",
};

/** Maps the server's category text ("Main course", "reading-club", ...) to a known category. */
export function normalizeCategory(raw: string | null | undefined): CourseCategory {
  const trimmed = raw?.trim() ?? "";
  if (trimmed === "") return "main";
  const key = trimmed.toLowerCase().replace(/[\s-]+/g, "_");
  return CATEGORY_KEYS[key] ?? "custom";
}

const CATEGORY_LABELS: Record<CourseCategory, string> = {
  main: "Main course",
  reading_club: "Reading Club",
  exam_prep: "Exam Prep",
  custom: "Course",
};

export function categoryLabel(course: Pick<Course, "category" | "categoryText">): string {
  if (course.category === "custom" && course.categoryText) return course.categoryText.trim();
  return CATEGORY_LABELS[course.category];
}

/* ---------- Progress ---------- */

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** "4 of 12 lessons", or null when the server did not send lesson counts. */
export function lessonsLabel(course: Pick<Course, "lessonsDone" | "lessonsTotal">): string | null {
  const { lessonsDone, lessonsTotal } = course;
  if (lessonsDone === null || lessonsTotal === null) return null;
  const done = Math.min(Math.max(0, lessonsDone), lessonsTotal);
  return `${done} of ${lessonsTotal} ${lessonsTotal === 1 ? "lesson" : "lessons"}`;
}

/* ---------- Tabs ---------- */

/**
 * Every course sits in exactly one tab, so the tab counts add up to the number of courses:
 *   completed     the course is finished (any category)
 *   self-paced    an unfinished supplementary track (Reading Club, Exam Prep, custom)
 *   enrolled      an unfinished main course taught through the student's class
 */
export type CoursesTab = "enrolled" | "completed" | "self-paced";

export const COURSE_TABS: ReadonlyArray<{ value: CoursesTab; label: string }> = [
  { value: "enrolled", label: "Enrolled Classes" },
  { value: "completed", label: "Completed" },
  { value: "self-paced", label: "Self-Paced" },
];

export function tabOf(course: Pick<Course, "completed" | "category">): CoursesTab {
  if (course.completed) return "completed";
  return course.category === "main" ? "enrolled" : "self-paced";
}

export function filterByTab<T extends Pick<Course, "completed" | "category">>(
  courses: readonly T[],
  tab: CoursesTab,
): T[] {
  return courses.filter((course) => tabOf(course) === tab);
}

export function tabCounts(
  courses: readonly Pick<Course, "completed" | "category">[],
): Record<CoursesTab, number> {
  const counts: Record<CoursesTab, number> = { enrolled: 0, completed: 0, "self-paced": 0 };
  for (const course of courses) counts[tabOf(course)] += 1;
  return counts;
}

/* ---------- Sort ---------- */

export type CourseSort = "recent" | "progress" | "name";

export const COURSE_SORTS: ReadonlyArray<{ value: CourseSort; label: string }> = [
  { value: "recent", label: "Recently used" },
  { value: "progress", label: "Progress" },
  { value: "name", label: "Name" },
];

export function isCourseSort(value: string): value is CourseSort {
  return COURSE_SORTS.some((sort) => sort.value === value);
}

function byName(a: Course, b: Course): number {
  return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
}

function openedAt(course: Course): number {
  if (course.lastOpenedAt === null) return Number.NEGATIVE_INFINITY;
  const time = Date.parse(course.lastOpenedAt);
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

/** Returns a sorted copy. Ties fall back to the title so the order never jumps around. */
export function sortCourses(courses: readonly Course[], sort: CourseSort): Course[] {
  const copy = [...courses];
  switch (sort) {
    case "name":
      return copy.sort(byName);
    case "progress":
      return copy.sort((a, b) => b.progressPct - a.progressPct || byName(a, b));
    case "recent":
      return copy.sort((a, b) => {
        const left = openedAt(a);
        const right = openedAt(b);
        if (left === right) return byName(a, b);
        return right > left ? 1 : -1;
      });
  }
}

/* ---------- Generated cover artwork ---------- */

export const COVER_SHAPES = ["dots", "stripes", "zigzag", "grid", "rings", "triangles"] as const;
export type CoverShape = (typeof COVER_SHAPES)[number];

export interface CoverSpec {
  world: CoverWorld;
  accent: CoverWorld;
  shape: CoverShape;
}

/** FNV-1a, a tiny stable hash: the same seed always draws the same cover. */
function hash(seed: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
}

export function coverSpec(seed: string): CoverSpec {
  const value = hash(seed);
  const world = WORLD_IDS[value % WORLD_IDS.length] ?? "amber";
  const accent = WORLD_IDS[(Math.floor(value / 7) + 1) % WORLD_IDS.length] ?? "sky";
  const shape = COVER_SHAPES[Math.floor(value / 49) % COVER_SHAPES.length] ?? "dots";
  return {
    world,
    accent: accent === world ? (WORLD_IDS[(WORLD_IDS.indexOf(world) + 3) % 6] ?? "sky") : accent,
    shape,
  };
}

/* ---------- Links ---------- */

export function coursePath(courseId: string): string {
  return `/student/courses/${encodeURIComponent(courseId)}`;
}
