import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import AssignmentDetailsPage from "./index";

const assignment = {
  id: "essay/42",
  title: "A memorable day",
  courseName: "English",
  dueAt: "2026-11-05T12:00:00.000Z",
  prompt: "Describe a memorable day.\n\nExplain why you remember it.",
  formattingGuidelines: ["Use paragraphs", "Check your spelling"],
  wordCount: { min: 100, max: 300 },
  attachments: [
    { id: "pdf1", name: "Guide.pdf", type: "pdf", url: "/guide.pdf", sizeBytes: 2048 },
    {
      id: "audio1",
      name: "Example.mp3",
      type: "audio",
      url: "/example.mp3",
      durationSeconds: 65,
    },
  ],
  rubric: [
    {
      id: "ideas",
      name: "Ideas",
      description: "Relevant details",
      fullCreditExpectation: "Uses vivid, relevant details.",
      maxPoints: 5,
    },
    {
      id: "grammar",
      name: "Grammar",
      description: "Correct sentence structure",
      fullCreditExpectation: "Uses accurate sentence structures throughout.",
      maxPoints: 3,
    },
  ],
  draft: { id: "draft 1", updatedAt: "2026-10-20T12:00:00.000Z", wordCount: 120 },
};

function CurrentLocation() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname + location.search}</p>;
}

function renderPage(payload: unknown = assignment) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })),
  );
  return render(
    <MemoryRouter initialEntries={["/student/assignments/essay%2F42"]}>
      <Routes>
        <Route path="/student/assignments/:assignmentId" element={<AssignmentDetailsPage />} />
        <Route path="/student/assignments/:assignmentId/workspace" element={<CurrentLocation />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AssignmentDetailsPage", () => {
  it("renders the prompt, guidelines, attachments and complete rubric", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "A memorable day" })).toBeInTheDocument();
    expect(screen.getByText("Describe a memorable day.")).toBeInTheDocument();
    expect(screen.getByText("Use paragraphs")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Guide.pdf" })).toHaveAttribute(
      "target",
      "_blank",
    );
    expect(screen.getByRole("link", { name: "Download" })).toHaveAttribute("download");
    expect(screen.getByLabelText("Audio: Example.mp3")).toHaveAttribute("src", "/example.mp3");
    expect(screen.getByText("Uses accurate sentence structures throughout.")).toBeInTheDocument();
    expect(screen.getByText("8", { selector: "td" })).toBeInTheDocument();
  });

  it("resumes the saved draft with encoded ids", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "A memorable day" });

    fireEvent.click(screen.getByRole("button", { name: "Start Working" }));
    expect(await screen.findByTestId("location")).toHaveTextContent(
      "/student/assignments/essay%2F42/workspace?draft=draft%201",
    );
  });

  it("opens a fresh workspace if there is no saved draft", async () => {
    renderPage({ ...assignment, draft: null });
    await screen.findByRole("heading", { name: "A memorable day" });

    fireEvent.click(screen.getByRole("button", { name: "Start Working" }));
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/student/assignments/essay%2F42/workspace",
      ),
    );
    expect(screen.getByTestId("location")).not.toHaveTextContent("?draft=");
  });

  it("shows a retry action on request failures and a not-found state on 404", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(assignment), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
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

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    render(
      <MemoryRouter initialEntries={["/student/assignments/missing"]}>
        <Routes>
          <Route path="/student/assignments/:assignmentId" element={<AssignmentDetailsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole("heading", { name: "Assignment not found" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });
});
