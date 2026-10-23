import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SoundContext, type SoundContextValue } from "@/shared/hooks/useSound";
import StudentsDirectoryPage from "./index";
import { formatLastActive, gradeOptions } from "./format";

const rpc = vi.fn<(fn: string, args: Record<string, unknown>) => Promise<unknown>>();

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

const student = (id: string, name: string, className: string, flags: string[] = []) => ({
  student: { id, full_name: name, username: name.split(" ")[0]?.toLowerCase() },
  class: { id: `c-${className}`, name: className, grade_level: "8" },
  level: 4,
  progress: 40,
  avg_score: 55,
  last_active_at: null,
  streak: 3,
  flags: flags.map((label) => ({ code: label, label })),
});

function renderPage() {
  rpc.mockImplementation((fn, args) => {
    if (fn === "teacher_classes_summary") {
      return Promise.resolve({ data: [{ class: { id: "c-8A", name: "8A" } }], error: null });
    }
    const all = [
      student("s1", "Amal Hassan", "8A"),
      student("s2", "Bilal Omar", "8B", ["Avg 41%"]),
    ];
    const items = args.flag === "needs_attention" ? all.filter((row) => row.flags.length) : all;
    return Promise.resolve({ data: { items, next_cursor: null }, error: null });
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SoundContext.Provider value={sound}>
        <MemoryRouter initialEntries={["/teacher/students"]}>
          <Routes>
            <Route path="/teacher/students" element={<StudentsDirectoryPage />} />
            <Route path="/teacher/students/:id" element={<p>Student dossier</p>} />
          </Routes>
        </MemoryRouter>
      </SoundContext.Provider>
    </QueryClientProvider>,
  );
}

describe("StudentsDirectoryPage (TC-07)", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("lists students from every class", async () => {
    renderPage();
    expect(await screen.findByText("Amal Hassan")).toBeInTheDocument();
    expect(screen.getByText("Bilal Omar")).toBeInTheDocument();
  });

  it("the Needs attention chip isolates flagged students through the server flag", async () => {
    renderPage();
    await screen.findByText("Amal Hassan");
    await userEvent.click(screen.getByRole("button", { name: "Needs attention" }));
    await waitFor(() => expect(screen.queryByText("Amal Hassan")).not.toBeInTheDocument());
    expect(screen.getByText("Bilal Omar")).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith("my_students", { flag: "needs_attention" });
  });

  it("searches by name or username through the server", async () => {
    renderPage();
    await screen.findByText("Amal Hassan");
    await userEvent.type(screen.getByRole("searchbox"), "bilal");
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("my_students", { q: "bilal" }));
  });

  it("opens the student dossier from the row", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("link", { name: "View Amal Hassan" }));
    expect(await screen.findByText("Student dossier")).toBeInTheDocument();
  });
});

describe("format helpers", () => {
  it("formats last activity", () => {
    expect(formatLastActive(null)).toBe("Never");
    expect(formatLastActive("2026-10-13T12:00:00Z", Date.parse("2026-10-15T12:00:00Z"))).toBe(
      "2 days ago",
    );
  });

  it("lists distinct grades in numeric order", () => {
    expect(gradeOptions(["10", "8", null, "8", "9"])).toEqual(["8", "9", "10"]);
  });
});
