import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SoundContext, type SoundContextValue } from "@/shared/hooks/useSound";
import { ToastContext, type ToastContextValue } from "@/app/providers/toast-context";
import type { TermRow } from "./api";
import { groupTerms, validateCreateClass } from "./rules";
import ClassesListPage from "./index";

const rpc = vi.fn<(fn: string, args: Record<string, unknown>) => Promise<unknown>>();

vi.mock("@/shared/api/supabase", () => ({
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => rpc(fn, args),
    from: () => ({
      select: () => ({
        order: () =>
          Promise.resolve({
            data: [
              {
                id: "t1",
                name: "Term 1",
                year_id: "y1",
                school_years: { id: "y1", name: "2026/27", is_active: true },
              },
            ],
            error: null,
          }),
      }),
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

const classItem = {
  class: { id: "c1", name: "Grade 8 A", grade_level: "8" },
  term: { name: "Term 1" },
  students: 24,
  avg_progress: 61,
  avg_score: 78,
  awaiting_grading: 5,
  join_code: "AB12CD",
  join_code_enabled: true,
  teachers: [{ id: "t", full_name: "Rana Teacher" }],
  courses: [{ id: "k1", title: "English 8" }],
};

function renderPage() {
  rpc.mockImplementation((fn) => {
    if (fn === "list_my_classes")
      return Promise.resolve({ data: { items: [classItem], next_cursor: null }, error: null });
    if (fn === "create_class") return Promise.resolve({ data: { class_id: "new" }, error: null });
    return Promise.resolve({ data: {}, error: null });
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  render(
    <QueryClientProvider client={client}>
      <SoundContext.Provider value={sound}>
        <ToastContext.Provider value={toast}>
          <MemoryRouter>
            <ClassesListPage />
          </MemoryRouter>
        </ToastContext.Provider>
      </SoundContext.Provider>
    </QueryClientProvider>,
  );
  return { invalidate };
}

describe("ClassesListPage (TC-02)", () => {
  beforeAll(() => {
    // jsdom lacks the pointer and scroll APIs Radix Select calls when it opens.
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => undefined;
    Element.prototype.releasePointerCapture = () => undefined;
    Element.prototype.scrollIntoView = () => undefined;
  });

  beforeEach(() => {
    rpc.mockReset();
  });

  it("lists the teacher's classes with stats, join code and quick links", async () => {
    renderPage();
    expect(await screen.findByText("Grade 8 A")).toBeInTheDocument();
    expect(screen.getByText("24")).toBeInTheDocument();
    expect(screen.getByText("AB12CD")).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Grade 8 A shortcuts" });
    expect(within(nav).getByRole("link", { name: "Roster" })).toHaveAttribute(
      "href",
      "/teacher/classes/c1/students",
    );
    expect(within(nav).getByRole("link", { name: "Rules" })).toHaveAttribute(
      "href",
      "/teacher/classes/c1/rules",
    );
    expect(within(nav).getByRole("link", { name: "Curriculum" })).toBeInTheDocument();
  });

  it("validates the create form before calling the server", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /Create class/ }));
    await userEvent.click(
      await screen
        .findByRole("button", { name: "Create class", hidden: false })
        .catch(() => screen.getAllByRole("button", { name: "Create class" }).at(-1)!),
    );
    expect(await screen.findByText(/at least 2 characters/)).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalledWith("create_class", expect.anything());
  });

  it("creates the class with the term's school year and refreshes the class lists", async () => {
    const { invalidate } = renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /Create class/ }));
    await userEvent.type(await screen.findByLabelText("Class name"), "  Grade 9 B ");
    await userEvent.click(screen.getByRole("combobox", { name: "Grade level" }));
    await userEvent.click(await screen.findByRole("option", { name: "Grade 9" }));
    await userEvent.click(screen.getByRole("combobox", { name: "Academic term" }));
    await userEvent.click(await screen.findByRole("option", { name: "Term 1" }));
    await userEvent.click(screen.getAllByRole("button", { name: "Create class" }).at(-1)!);
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("create_class", {
        name: "Grade 9 B",
        grade: "9",
        school_year_id: "y1",
        term_id: "t1",
        join_code_enabled: true,
      }),
    );
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["teacher-classes"] }));
  });
});

describe("class rules", () => {
  it("validates name, grade and term", () => {
    expect(
      Object.keys(
        validateCreateClass({ name: "A", grade: "13", termId: "", description: "" }),
      ).sort(),
    ).toEqual(["grade", "name", "termId"]);
    expect(
      validateCreateClass({ name: "Grade 1 A", grade: "1", termId: "t", description: "" }),
    ).toEqual({});
  });

  it("groups terms by year with the current year first", () => {
    const terms: TermRow[] = [
      {
        id: "a",
        name: "Term 1",
        year_id: "old",
        school_years: { id: "old", name: "2025/26", is_active: false },
      },
      {
        id: "b",
        name: "Term 1",
        year_id: "new",
        school_years: { id: "new", name: "2026/27", is_active: true },
      },
    ];
    expect(groupTerms(terms).map((group) => group.label)).toEqual(["2026/27 (current)", "2025/26"]);
  });
});
