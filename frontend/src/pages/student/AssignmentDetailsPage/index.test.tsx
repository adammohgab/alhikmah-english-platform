import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import AssignmentDetailsPage from "./index";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/shared/api/supabase", () => ({ supabase: { rpc } }));

const brief = {
  assignment: {
    id: "essay/42",
    title: "A memorable day",
    course_name: "English",
    teacher_name: "Ms Noor",
    instructions: "Describe a memorable day.\n\nExplain why you remember it.",
    formatting_guidelines: ["Use paragraphs", "Check your spelling"],
    word_count: { min: 100, max: 300 },
    rubric: {
      criteria: [
        {
          key: "ideas",
          name: "Ideas",
          description: "Relevant details",
          max_points: 5,
          descriptors: { "4": "Uses vivid, relevant details." },
        },
        {
          key: "grammar",
          name: "Grammar",
          description: "Correct sentence structure",
          max_points: 3,
          descriptors: { "4": "Uses accurate sentence structures throughout." },
        },
      ],
    },
  },
  resources: [
    {
      id: "pdf1",
      name: "Guide.pdf",
      type: "application/pdf",
      url: "/guide.pdf",
      size_bytes: 2048,
    },
    {
      id: "audio1",
      name: "Example.mp3",
      mime_type: "audio/mpeg",
      url: "/example.mp3",
      duration_seconds: 65,
    },
  ],
  question_types: [
    { type: "multiple_choice", count: 2 },
    { type: "writing", count: 1 },
  ],
  has_writing: true,
  due_at: "2026-11-05T12:00:00.000Z",
  close_at: "2026-11-12T12:00:00.000Z",
  late_policy_text: "Late work loses 10% per day.",
  points: 8,
  status: "in_progress",
  attempts_used: 0,
  attempts_allowed: 2,
  draft: { id: "draft 1", updated_at: "2026-10-20T12:00:00.000Z", word_count: 120 },
};

function CurrentLocation() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname + location.search}</p>;
}

function renderPage(data: unknown = brief) {
  rpc.mockResolvedValue({ data, error: null });
  return render(
    <MemoryRouter initialEntries={["/student/assignments/essay%2F42"]}>
      <Routes>
        <Route path="/student/assignments/:assignmentId" element={<AssignmentDetailsPage />} />
        <Route path="/student/assignments/:assignmentId/solve" element={<CurrentLocation />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  rpc.mockReset();
});

describe("AssignmentDetailsPage", () => {
  it("renders the prompt, guidelines, attachments, rubric and assignment facts", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "A memorable day" })).toBeInTheDocument();
    expect(screen.getByText("Describe a memorable day.")).toBeInTheDocument();
    expect(screen.getByText("Use paragraphs")).toBeInTheDocument();
    expect(screen.getByText("Multiple choice")).toBeInTheDocument();
    expect(screen.getByText("Writing")).toBeInTheDocument();
    expect(screen.getByText(/Some questions are writing/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Guide.pdf" })).toHaveAttribute(
      "target",
      "_blank",
    );
    expect(screen.getByRole("link", { name: "Download" })).toHaveAttribute("download");
    expect(screen.getByLabelText("Audio: Example.mp3")).toHaveAttribute("src", "/example.mp3");
    expect(screen.getByText("Uses accurate sentence structures throughout.")).toBeInTheDocument();
    expect(screen.getByText("8", { selector: "td" })).toBeInTheDocument();

    const facts = screen.getByRole("heading", { name: "At a glance" }).closest("aside");
    expect(facts).not.toBeNull();
    if (!facts) return;
    expect(screen.getByText("English · Ms Noor")).toBeInTheDocument();
    expect(within(facts).getByText("8 points")).toBeInTheDocument();
    expect(within(facts).getByText("3")).toBeInTheDocument();
    expect(within(facts).getByText("In progress")).toBeInTheDocument();
    expect(within(facts).getByText("0 of 2 used")).toBeInTheDocument();
    expect(within(facts).getByText(/Nov 5, 2026/)).toBeInTheDocument();
    expect(within(facts).getByText(/Nov 12, 2026/)).toBeInTheDocument();
    const lastSaved = within(facts).getByText("Last saved").closest("div");
    expect(lastSaved).not.toBeNull();
    expect(lastSaved).toHaveTextContent(/Oct 20, 2026/);
    expect(within(facts).getByText("Late work loses 10% per day.")).toBeInTheDocument();
  });

  it("resumes the saved draft with encoded ids", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "A memorable day" });

    expect(screen.getByText(/Resumes your saved draft/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start Working" }));
    expect(await screen.findByTestId("location")).toHaveTextContent(
      "/student/assignments/essay%2F42/solve?draft=draft%201",
    );
  });

  it("opens a fresh workspace if there is no saved draft", async () => {
    renderPage({ ...brief, status: "not_started", draft: null });
    await screen.findByRole("heading", { name: "A memorable day" });

    expect(screen.queryByText(/Resumes your saved draft/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start Working" }));
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/student/assignments/essay%2F42/solve",
      ),
    );
    expect(screen.getByTestId("location")).not.toHaveTextContent("?draft=");
  });

  it("shows a retry action on request failures and a not-found state on missing data", async () => {
    rpc
      .mockResolvedValueOnce({
        data: null,
        error: { message: "Temporary failure", code: "500" },
      })
      .mockResolvedValueOnce({ data: brief, error: null });

    const { unmount } = render(
      <MemoryRouter initialEntries={["/student/assignments/essay%2F42"]}>
        <Routes>
          <Route path="/student/assignments/:assignmentId" element={<AssignmentDetailsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole("heading", { name: "Could not load this assignment" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "A memorable day" })).toBeInTheDocument();
    unmount();

    renderPage(null);
    expect(
      await screen.findByRole("heading", { name: "Assignment not found" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });
});
