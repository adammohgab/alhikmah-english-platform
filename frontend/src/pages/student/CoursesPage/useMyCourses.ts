import { useQuery } from "@tanstack/react-query";
import { fetchMyCourses } from "./api";

/** The student's courses, loaded once. Tabs and sorting reuse this list without a new request. */
export const MY_COURSES_KEY = ["student", "courses"] as const;

export function useMyCourses() {
  return useQuery({
    queryKey: MY_COURSES_KEY,
    queryFn: fetchMyCourses,
    refetchOnWindowFocus: false,
  });
}
