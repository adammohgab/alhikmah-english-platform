import { useMemo, useState } from "react";
import { EmptyState } from "@/shared/components/ui/EmptyState";
import { ErrorState } from "@/shared/components/ui/ErrorState";
import { Select } from "@/shared/components/ui/Select";
import { Skeleton } from "@/shared/components/ui/Skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/Tabs";
import { CourseCard } from "./CourseCard";
import {
  COURSE_SORTS,
  COURSE_TABS,
  filterByTab,
  isCourseSort,
  sortCourses,
  tabCounts,
  type CourseSort,
  type CoursesTab,
} from "./rules";
import { useMyCourses } from "./useMyCourses";

/* Courses list (STUDENT-SPEC ST-02, STU-CORE-03).
    Every course the student can open, as a grid of cards (1 column on a phone, 3 on a desktop).
    The list is fetched once by `useMyCourses`; the three tabs (Enrolled Classes, Completed,
    Self-Paced) and the sort control only reshape that list in the browser, so switching never
    triggers a new request. A card opens the course page (ST-03). */

const GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3";

const TAB_EMPTY: Record<CoursesTab, { title: string; description: string }> = {
  enrolled: {
    title: "No class courses in progress.",
    description: "Courses from your classes show up here until you finish them.",
  },
  completed: {
    title: "No completed courses yet.",
    description: "Finish every lesson in a course and it moves here.",
  },
  "self-paced": {
    title: "No self-paced tracks yet.",
    description: "Reading Club and Exam Prep tracks you can do at your own speed appear here.",
  },
};

function isTab(value: string): value is CoursesTab {
  return COURSE_TABS.some((tab) => tab.value === value);
}

export default function CoursesPage() {
  const courses = useMyCourses();
  const [tab, setTab] = useState<CoursesTab>("enrolled");
  const [sort, setSort] = useState<CourseSort>("recent");

  const list = courses.data;
  const sorted = useMemo(() => (list ? sortCourses(list, sort) : []), [list, sort]);
  const counts = useMemo(() => tabCounts(list ?? []), [list]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4">
      <header>
        <h1 className="font-display text-[28px] leading-tight text-stroke">My courses</h1>
        {list && list.length > 0 && (
          <p className="text-[14px] text-muted">
            {list.length} {list.length === 1 ? "course" : "courses"} to explore.
          </p>
        )}
      </header>

      {courses.isPending ? (
        <div className={GRID} aria-busy="true">
          {[0, 1, 2].map((n) => (
            <Skeleton key={n} shape="rect" className="h-72 w-full" label="Loading your courses…" />
          ))}
        </div>
      ) : courses.isError ? (
        <ErrorState
          description="Your courses could not load. Check your connection and try again."
          onRetry={() => void courses.refetch()}
        />
      ) : courses.data.length === 0 ? (
        <EmptyState
          title="You have no courses yet."
          description="Your teacher will add you to a class."
        />
      ) : (
        <Tabs
          value={tab}
          onValueChange={(value) => {
            if (isTab(value)) setTab(value);
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList aria-label="Course filter">
              {COURSE_TABS.map(({ value, label }) => (
                <TabsTrigger key={value} value={value}>
                  {label}
                  <span className="text-[13px] text-muted">{counts[value]}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="w-full sm:w-48">
              <Select
                aria-label="Sort courses"
                value={sort}
                onValueChange={(value) => {
                  if (isCourseSort(value)) setSort(value);
                }}
                options={COURSE_SORTS}
              />
            </div>
          </div>

          {COURSE_TABS.map(({ value }) => {
            const visible = filterByTab(sorted, value);
            return (
              <TabsContent key={value} value={value}>
                {visible.length === 0 ? (
                  <EmptyState
                    size="sm"
                    title={TAB_EMPTY[value].title}
                    description={TAB_EMPTY[value].description}
                  />
                ) : (
                  <ul className={GRID}>
                    {visible.map((course) => (
                      <CourseCard key={course.id} course={course} />
                    ))}
                  </ul>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </main>
  );
}
