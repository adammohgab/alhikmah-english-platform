import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SoundContext, type SoundContextValue } from "@/shared/hooks/useSound";
import CoursesPage from "./index";

interface Result {
  data: unknown;
  error: { message: string } | null;
}

const rpc = vi.fn<(fn: string, args: Record<string, unknown>) => Promise<Result>>();

vi.mock("@/shared/api/supabase", () => ({
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => rpc(fn, args) },
}));

const sound: SoundContextValue = {
  play: vi.fn(),
  volume: 0.35,
  setVolume: vi.fn(),
  muted: false,
  setMuted: vi.fn(),
  toggleMute: vi.fn(),
};

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SoundContext.Provider value={sound}>
        <MemoryRouter initialEntries={["/student/courses"]}>
          <Routes>
            <Route path="/student/courses" element={<CoursesPage />} />
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </SoundContext.Provider>
    </QueryClientProvider>,
  );
}

const rows = [
  {
    id: "c1",
    title: "Grade 7 English",
    category: "Main course",
    grade: "7",
    teacher_name: "Mr. Hassan",
    units_count: 6,
    progress_pct: 42,
    lessons_done: 5,
    lessons_total: 12,
    next_label: "Unit 3, Lesson 2",
    cover_pattern: null,
    completed: false,
    last_opened_at: "2026-10-20T08:00:00Z",
  },
  {
    id: "c2",
    title: "Reading Club: Short Stories",
    category: "Reading Club",
    grade: null,
    teacher_name: "Ms. Layla",
    units_count: 3,
    progress_pct: 10,
    next_label: null,
    cover_pattern: "stories",
    completed: false,
    last_opened_at: null,
  },
  {
    id: "c3",
    title: "Grade 6 English",
    category: "Main course",
    grade: "6",
    teacher_name: "Mr. Hassan",
    units_count: 5,
    progress_pct: 100,
    lessons_done: 10,
    lessons_total: 10,
    next_label: null,
    cover_pattern: null,
    completed: true,
    last_opened_at: "2026-06-01T08:00:00Z",
  },
];

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: rows, error: null });
});

describe("CoursesPage", () => {
  it("shows a grid of enrolled courses with progress bars, teacher and lesson counts", async () => {
    renderPage();
    const card = (await screen.findByRole("link", { name: "Grade 7 English" })).closest("li")!;

    expect(within(card).getByText("Mr. Hassan")).toBeInTheDocument();
    expect(within(card).getByText("Main course")).toBeInTheDocument();
    expect(within(card).getByText("5 of 12 lessons")).toBeInTheDocument();
    expect(within(card).getByText("Next: Unit 3, Lesson 2")).toBeInTheDocument();
    const bar = within(card).getByRole("progressbar", { name: "Grade 7 English progress" });
    expect(bar).toHaveAttribute("aria-valuenow", "42");
    expect(rpc).toHaveBeenCalledWith("my_courses", {});
  });

  it("starts on Enrolled Classes and shows a count on every tab", async () => {
    renderPage();
    await screen.findByRole("link", { name: "Grade 7 English" });

    expect(screen.getByRole("tab", { name: /Enrolled Classes\s*1/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: /Completed\s*1/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Self-Paced\s*1/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Grade 6 English" })).not.toBeInTheDocument();
  });

  it("filters with the tabs without fetching again", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("link", { name: "Grade 7 English" });

    await user.click(screen.getByRole("tab", { name: /Completed/ }));
    expect(screen.getByRole("link", { name: "Grade 6 English" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Grade 7 English" })).not.toBeInTheDocument();
    expect(screen.getByText("Completed", { selector: "span.inline-flex" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Certificate/ })).toHaveAttribute(
      "href",
      "/student/certificates",
    );

    await user.click(screen.getByRole("tab", { name: /Self-Paced/ }));
    expect(screen.getByRole("link", { name: "Reading Club: Short Stories" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Grade 6 English" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Enrolled Classes/ }));
    expect(screen.getByRole("link", { name: "Grade 7 English" })).toBeInTheDocument();

    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("opens the course page when a course is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("link", { name: "Grade 7 English" }));
    expect(await screen.findByTestId("where")).toHaveTextContent("/student/courses/c1");
  });

  it("explains an empty tab instead of showing a blank page", async () => {
    const user = userEvent.setup();
    rpc.mockResolvedValue({ data: [rows[0]], error: null });
    renderPage();
    await screen.findByRole("link", { name: "Grade 7 English" });

    await user.click(screen.getByRole("tab", { name: /Completed/ }));
    expect(screen.getByText("No completed courses yet.")).toBeInTheDocument();
  });

  it("tells a student with no courses what happens next", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    renderPage();
    expect(await screen.findByText("You have no courses yet.")).toBeInTheDocument();
    expect(screen.getByText("Your teacher will add you to a class.")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("shows a retry when the courses fail to load, and recovers", async () => {
    const user = userEvent.setup();
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    renderPage();

    expect(await screen.findByText(/could not load/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /try again|retry/i }));
    expect(await screen.findByRole("link", { name: "Grade 7 English" })).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("reports a malformed response as an error rather than blank cards", async () => {
    rpc.mockResolvedValue({ data: [{ title: "No id" }], error: null });
    renderPage();
    await waitFor(() => expect(screen.getByText(/could not load/i)).toBeInTheDocument());
  });
});
