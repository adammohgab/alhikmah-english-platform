import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SoundContext, type SoundContextValue } from "@/shared/hooks/useSound";
import { ToastContext, type ToastContextValue } from "@/app/providers/toast-context";
import { AuthContext, type AuthContextValue } from "@/app/providers/auth-context";
import StudentProgressPage from "./index";

const rpc = vi.fn<(fn: string, args: Record<string, unknown>) => Promise<unknown>>();
const insert =
  vi.fn<(row: Record<string, unknown>) => Promise<{ error: null | { message: string } }>>();
const update =
  vi.fn<
    (row: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: null }> }
  >();
let existingNote: { id: string; note: string }[] = [];

vi.mock("@/shared/api/supabase", () => ({
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => rpc(fn, args),
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({ limit: () => Promise.resolve({ data: existingNote, error: null }) }),
          }),
        }),
      }),
      insert: (row: Record<string, unknown>) => insert(row),
      update: (row: Record<string, unknown>) => update(row),
    }),
  },
}));

const sound: SoundContextValue = {
  play: vi.fn(),
  volume: 0.35,
  setVolume: vi.fn(),
  muted: false,
  setMuted: vi.fn(),
  toggleMute: vi.fn(),
};
const toast: ToastContextValue = {
  show: vi.fn(() => "t"),
  dismiss: vi.fn(),
  dismissAll: vi.fn(),
  toasts: [],
};
const auth: AuthContextValue = {
  isAuthenticated: true,
  isLoading: false,
  signOut: () => Promise.resolve(),
  user: {
    id: "teacher-1",
    username: "t",
    fullName: "Teacher",
    role: "teacher",
    adminLevel: null,
    status: "active",
    mustChangePassword: false,
  },
};

const data: Record<string, unknown> = {
  student_overview: {
    student: {
      id: "u1",
      full_name: "Amal Student",
      class: { id: "c1", name: "Grade 8 A", grade_level: "8" },
      level: 7,
      streak: 12,
    },
    tiles: { average_score: 84, lessons_completed: 30, words_learned: 210 },
    attention: [],
  },
  student_quiz_results: {
    items: [
      {
        id: "q1",
        title: "Verbs quiz",
        date: "2026-10-01T10:00:00Z",
        score_pct: 70,
        attempts: 1,
        passed: true,
      },
    ],
    next_cursor: null,
  },
  student_assignment_results: {
    items: [
      {
        id: "a1",
        title: "Weekend essay",
        date: "2026-10-05T10:00:00Z",
        grade_pct: 92,
        status: "Graded",
      },
    ],
    next_cursor: null,
  },
  student_skills: {
    skills: [{ skill: "vocabulary", accuracy: 76 }],
    mistakes: { words: [{ word: "necessary", count: 4 }], grammar_topics: [] },
  },
};

function renderPage() {
  rpc.mockImplementation((fn: string) => Promise.resolve({ data: data[fn] ?? null, error: null }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SoundContext.Provider value={sound}>
        <ToastContext.Provider value={toast}>
          <AuthContext.Provider value={auth}>
            <MemoryRouter initialEntries={["/teacher/students/u1"]}>
              <Routes>
                <Route path="/teacher/students/:studentId" element={<StudentProgressPage />} />
              </Routes>
            </MemoryRouter>
          </AuthContext.Provider>
        </ToastContext.Provider>
      </SoundContext.Provider>
    </QueryClientProvider>,
  );
}

describe("StudentProgressPage", () => {
  beforeEach(() => {
    rpc.mockReset();
    insert.mockReset().mockResolvedValue({ error: null });
    update.mockReset().mockReturnValue({ eq: () => Promise.resolve({ error: null }) });
    existingNote = [];
    vi.mocked(toast.show).mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it("shows level, overall grade, streak and the full history newest first with score pills", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Amal Student" })).toBeInTheDocument();
    expect(screen.getByText("Level 7")).toBeInTheDocument();
    expect(screen.getByText("84%")).toBeInTheDocument();
    expect(screen.getByText("Grade B")).toBeInTheDocument();
    expect(screen.getByText("12 days")).toBeInTheDocument();

    const items = await screen.findAllByRole("listitem");
    const titles = items.map((li) => li.textContent ?? "").filter((t) => /essay|quiz/i.test(t));
    expect(titles[0]).toContain("Weekend essay");
    expect(titles[0]).toContain("92%");
    expect(titles[1]).toContain("Verbs quiz");
    expect(screen.getByRole("img", { name: /Score trajectory/ })).toBeInTheDocument();
    expect(screen.getByText("necessary × 4")).toBeInTheDocument();
  });

  it("autosaves the private note into admin_notes after typing stops", async () => {
    const user = userEvent.setup();
    renderPage();
    const field = await screen.findByLabelText("Private notes");
    await waitFor(() => expect(field).toBeEnabled());
    await user.type(field, "Parent meeting Tuesday");
    expect(insert).not.toHaveBeenCalled();
    await waitFor(() => expect(insert).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(insert.mock.calls[0]?.[0]).toMatchObject({
      user_id: "u1",
      author_id: "teacher-1",
      note: "Parent meeting Tuesday",
    });
    await screen.findByText("Saved");
  });

  it("updates the existing note row instead of inserting a second one", async () => {
    existingNote = [{ id: "n1", note: "Earlier note" }];
    const user = userEvent.setup();
    renderPage();
    const field = await screen.findByDisplayValue("Earlier note");
    await user.type(field, "!");
    await waitFor(() => expect(update).toHaveBeenCalledWith({ note: "Earlier note!" }), {
      timeout: 3000,
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("tells the teacher when the note could not be saved", async () => {
    insert.mockResolvedValue({ error: { message: "new row violates row-level security policy" } });
    const user = userEvent.setup();
    renderPage();
    const field = await screen.findByLabelText("Private notes");
    await waitFor(() => expect(field).toBeEnabled());
    await user.type(field, "x");
    await waitFor(
      () =>
        expect(toast.show).toHaveBeenCalledWith(
          expect.objectContaining({ title: "Note was not saved" }),
        ),
      { timeout: 3000 },
    );
    expect(await screen.findByText(/Not saved:/)).toBeInTheDocument();
  });
});
