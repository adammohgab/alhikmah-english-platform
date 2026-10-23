import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "@/app/providers/auth-context";
import { DeadlinesWidget } from "./DeadlinesWidget";

const rpc = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/supabase", () => ({ supabase: { rpc } }));

const auth: AuthContextValue = {
  isAuthenticated: true,
  isLoading: false,
  signOut: () => Promise.resolve(),
  user: {
    id: "me",
    username: "sara",
    fullName: "Sara Ahmed",
    role: "student",
    adminLevel: null,
    status: "active",
    mustChangePassword: false,
  },
};

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderWidget() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={["/student"]}>
          <Routes>
            <Route path="/student" element={<DeadlinesWidget />} />
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

const hoursFromNow = (count: number): string =>
  new Date(Date.now() + count * 3_600_000).toISOString();

const rows = [
  {
    kind: "assignment",
    id: "a-later",
    title: "Reading journal",
    course: "Grade 7 English",
    due_at: hoursFromNow(50),
    status: "in_progress",
    action: "continue",
    overdue: false,
  },
  {
    kind: "quiz",
    id: "q-soon",
    title: "Grammar quiz",
    course: "Grade 7 English",
    due_at: hoursFromNow(3),
    status: "not_started",
    action: "start",
    overdue: false,
  },
  {
    kind: "assignment",
    id: "a-late",
    title: "Essay draft",
    course: { title: "Grade 7 English" },
    due_at: hoursFromNow(-30),
    status: "not_started",
    action: "start",
    overdue: true,
  },
];

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: rows, error: null });
});

describe("DeadlinesWidget", () => {
  it("asks my_deadlines for at most five items", async () => {
    renderWidget();
    await screen.findByText("Essay draft");
    expect(rpc).toHaveBeenCalledWith("my_deadlines", { limit: 5 });
  });

  it("lists overdue first, then upcoming items chronologically", async () => {
    renderWidget();
    const list = await screen.findByRole("list");
    const titles = within(list)
      .getAllByRole("link")
      .map((link) => link.querySelector("p")?.textContent);
    expect(titles).toEqual(["Essay draft", "Grammar quiz", "Reading journal"]);
  });

  it("highlights overdue items and warns about unsubmitted assignments", async () => {
    renderWidget();
    const overdue = (await screen.findByText("Essay draft")).closest("a");
    expect(overdue).toHaveAttribute("data-overdue", "true");
    expect(within(overdue as HTMLElement).getByText("Overdue by 1 day")).toBeVisible();
    expect(screen.getByText("1 assignment is overdue and not submitted.")).toBeVisible();
  });

  it("tags items due within 24 hours with a pulsing clock", async () => {
    renderWidget();
    const soon = (await screen.findByText("Grammar quiz")).closest("a") as HTMLElement;
    expect(soon).toHaveAttribute("data-due-soon", "true");
    const tag = within(soon).getByText("Due soon");
    expect(tag.className).toContain("animate-pulse");
    const later = screen.getByText("Reading journal").closest("a");
    expect(later).not.toHaveAttribute("data-due-soon");
  });

  it("opens the assessment start page directly", async () => {
    const user = userEvent.setup();
    renderWidget();
    const quiz = (await screen.findByText("Grammar quiz")).closest("a") as HTMLElement;
    expect(quiz).toHaveAttribute("href", "/student/quizzes/q-soon");
    const assignment = screen.getByText("Reading journal").closest("a");
    expect(assignment).toHaveAttribute("href", "/student/assignments/a-later");
    await user.click(quiz);
    await waitFor(() =>
      expect(screen.getByTestId("where")).toHaveTextContent("/student/quizzes/q-soon"),
    );
  });

  it("says so when nothing is due", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    renderWidget();
    expect(await screen.findByText("Nothing due. Nice.")).toBeVisible();
  });

  it("offers a retry when the deadlines cannot load", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    renderWidget();
    expect(await screen.findByRole("button", { name: "Try again" })).toBeVisible();
  });
});
