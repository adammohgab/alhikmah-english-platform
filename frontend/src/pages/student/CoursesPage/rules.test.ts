import { describe, expect, it } from "vitest";
import {
  COVER_SHAPES,
  WORLD_IDS,
  categoryLabel,
  clampPercent,
  coursePath,
  coverSpec,
  filterByTab,
  lessonsLabel,
  normalizeCategory,
  sortCourses,
  tabCounts,
  tabOf,
  type Course,
} from "./rules";

function course(overrides: Partial<Course> & { id: string }): Course {
  return {
    title: overrides.id,
    category: "main",
    categoryText: null,
    grade: null,
    teacherName: null,
    unitsCount: 1,
    progressPct: 0,
    lessonsDone: null,
    lessonsTotal: null,
    nextLabel: null,
    coverSeed: overrides.id,
    completed: false,
    lastOpenedAt: null,
    ...overrides,
  };
}

describe("normalizeCategory and categoryLabel", () => {
  it("accepts the server's wording in any case and separator", () => {
    expect(normalizeCategory("Main course")).toBe("main");
    expect(normalizeCategory("main")).toBe("main");
    expect(normalizeCategory("Reading Club")).toBe("reading_club");
    expect(normalizeCategory("exam-prep")).toBe("exam_prep");
  });

  it("treats a missing category as a main course and an unknown one as custom", () => {
    expect(normalizeCategory(null)).toBe("main");
    expect(normalizeCategory("   ")).toBe("main");
    expect(normalizeCategory("Poetry Circle")).toBe("custom");
  });

  it("labels a custom category with its own text", () => {
    expect(categoryLabel({ category: "custom", categoryText: "Poetry Circle" })).toBe(
      "Poetry Circle",
    );
    expect(categoryLabel({ category: "exam_prep", categoryText: null })).toBe("Exam Prep");
  });
});

describe("tabs", () => {
  const items = [
    course({ id: "main-open" }),
    course({ id: "main-done", completed: true }),
    course({ id: "club-open", category: "reading_club" }),
    course({ id: "exam-done", category: "exam_prep", completed: true }),
    course({ id: "custom-open", category: "custom" }),
  ];

  it("puts every course in exactly one tab", () => {
    expect(tabOf(items[0])).toBe("enrolled");
    expect(tabOf(items[1])).toBe("completed");
    expect(tabOf(items[2])).toBe("self-paced");
    expect(tabOf(items[3])).toBe("completed");
    expect(tabOf(items[4])).toBe("self-paced");
  });

  it("counts add up to the number of courses", () => {
    const counts = tabCounts(items);
    expect(counts).toEqual({ enrolled: 1, completed: 2, "self-paced": 2 });
    expect(counts.enrolled + counts.completed + counts["self-paced"]).toBe(items.length);
  });

  it("filters without changing the order", () => {
    expect(filterByTab(items, "self-paced").map((c) => c.id)).toEqual(["club-open", "custom-open"]);
  });
});

describe("sortCourses", () => {
  const items = [
    course({ id: "b", title: "Beta", progressPct: 40, lastOpenedAt: "2026-10-01T10:00:00Z" }),
    course({ id: "a", title: "alpha", progressPct: 40, lastOpenedAt: "2026-10-20T10:00:00Z" }),
    course({ id: "c", title: "Gamma", progressPct: 90, lastOpenedAt: null }),
  ];

  it("recent puts the latest opened first and never-opened last", () => {
    expect(sortCourses(items, "recent").map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("progress puts the furthest first and breaks ties by name", () => {
    expect(sortCourses(items, "progress").map((c) => c.id)).toEqual(["c", "a", "b"]);
  });

  it("name ignores case", () => {
    expect(sortCourses(items, "name").map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("returns a copy and leaves the input alone", () => {
    const before = items.map((c) => c.id);
    sortCourses(items, "name");
    expect(items.map((c) => c.id)).toEqual(before);
  });
});

describe("progress helpers", () => {
  it("clamps to a whole number from 0 to 100", () => {
    expect(clampPercent(42.6)).toBe(43);
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(140)).toBe(100);
    expect(clampPercent(Number.NaN)).toBe(0);
  });

  it("words the lesson count and hides it when unknown", () => {
    expect(lessonsLabel({ lessonsDone: 4, lessonsTotal: 12 })).toBe("4 of 12 lessons");
    expect(lessonsLabel({ lessonsDone: 0, lessonsTotal: 1 })).toBe("0 of 1 lesson");
    expect(lessonsLabel({ lessonsDone: 20, lessonsTotal: 12 })).toBe("12 of 12 lessons");
    expect(lessonsLabel({ lessonsDone: null, lessonsTotal: 12 })).toBeNull();
  });
});

describe("coverSpec", () => {
  it("is stable for a seed", () => {
    expect(coverSpec("course-1")).toEqual(coverSpec("course-1"));
  });

  it("always yields valid, distinct worlds and a known shape", () => {
    for (let n = 0; n < 200; n += 1) {
      const spec = coverSpec(`seed-${n}`);
      expect(WORLD_IDS).toContain(spec.world);
      expect(WORLD_IDS).toContain(spec.accent);
      expect(spec.accent).not.toBe(spec.world);
      expect(COVER_SHAPES).toContain(spec.shape);
    }
  });

  it("does not give every seed the same cover", () => {
    const shapes = new Set(Array.from({ length: 60 }, (_, n) => coverSpec(`s${n}`).shape));
    expect(shapes.size).toBeGreaterThan(2);
  });
});

describe("coursePath", () => {
  it("points at the course details page and encodes the id", () => {
    expect(coursePath("abc")).toBe("/student/courses/abc");
    expect(coursePath("a/b")).toBe("/student/courses/a%2Fb");
  });
});
