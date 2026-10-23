import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AssignmentSolvePage from "./index";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/shared/api/supabase", () => ({ supabase: { rpc } }));

vi.mock("./WritingEditor", async () => {
  const React = await import("react");
  return {
    WritingEditor: ({
      initialHtml,
      readOnly,
      label,
      onChange,
    }: {
      initialHtml: string;
      readOnly: boolean;
      label: string;
      onChange: (answer: {
        html: string;
        text: string;
        wordCount: number;
        characterCount: number;
      }) => void;
    }) =>
      React.createElement("textarea", {
        "aria-label": label,
        readOnly,
        defaultValue: initialHtml
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim(),
        onChange: (event: { target: { value: string } }) => {
          const text = event.target.value;
          onChange({
            html: `<p>${text}</p>`,
            text,
            wordCount: text.trim() === "" ? 0 : text.trim().split(/\s+/).length,
            characterCount: text.length,
          });
        },
      }),
  };
});

const brief = {
  assignment: {
    id: "essay/42",
    title: "A memorable day",
    course_name: "English",
    teacher_name: "Ms Noor",
    instructions: "Describe a memorable day.",
    formatting_guidelines: ["Use paragraphs"],
    word_count: { min: 100, max: 300 },
    rubric: { criteria: [] },
  },
  resources: [],
  question_types: [
    { type: "writing", count: 1 },
    { type: "multiple_choice", count: 1 },
  ],
  has_writing: true,
  due_at: "2026-11-05T12:00:00.000Z",
  close_at: "2026-11-12T12:00:00.000Z",
  late_policy_text: "Late work loses 10% per day.",
  points: 10,
  status: "in_progress",
  attempts_used: 0,
  attempts_allowed: 2,
  draft: { id: "draft 1", updated_at: "2026-10-20T12:00:00.000Z", word_count: 2 },
};

const started = {
  submission_id: "submission-1",
  draft_version: 2,
  draft: {
    q1: {
      html: "<p>Seed text</p>",
      text: "Seed text",
      word_count: 2,
      character_count: 9,
    },
  },
  questions: [
    {
      key: "q1",
      type: "writing",
      prompt: { text: "Describe a memorable day." },
      points: 8,
      meta: { min_words: 100, max_words: 300 },
    },
    {
      key: "q2",
      type: "multiple_choice",
      prompt: { text: "Which title fits best?" },
      options: [
        { id: "a", text: "The sea" },
        { id: "b", text: "The city" },
      ],
      points: 2,
    },
  ],
};

function mockRpc(submitted = false) {
  rpc.mockImplementation((fn: string) => {
    if (fn === "get_assignment_brief") {
      return Promise.resolve({
        data: submitted ? { ...brief, status: "submitted" } : brief,
        error: null,
      });
    }
    if (fn === "start_assignment") return Promise.resolve({ data: started, error: null });
    if (fn === "save_assignment_draft") {
      return Promise.resolve({
        data: { draft_version: 3, saved_at: "2026-10-22T10:00:00.000Z" },
        error: null,
      });
    }
    if (fn === "submit_assignment") {
      return Promise.resolve({
        data: {
          ok: true,
          already_submitted: false,
          status: "submitted",
          submitted_at: "2026-10-22T10:05:00.000Z",
          is_late: false,
          late_penalty_pct: 0,
          draft_version: 4,
        },
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: { message: "Unknown RPC" } });
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/student/assignments/essay%2F42/solve"]}>
      <Routes>
        <Route path="/student/assignments/:assignmentId/solve" element={<AssignmentSolvePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  rpc.mockReset();
});

describe("AssignmentSolvePage", () => {
  it("hydrates the draft, keeps typing responsive and saves through the assignment RPC", async () => {
    mockRpc();
    renderPage();

    expect(await screen.findByRole("heading", { name: "A memorable day" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Describe a memorable day." })).toBeInTheDocument();
    expect(screen.getByText("1 of 2 answered")).toBeInTheDocument();

    const editor = screen.getByLabelText("Writing answer for question 1");
    expect(editor).toHaveValue("Seed text");

    fireEvent.change(editor, { target: { value: "New answer" } });
    expect(screen.getByText("Autosaving soon")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    expect(await screen.findByText("Saved just now")).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith("save_assignment_draft", {
      assessment_id: "essay/42",
      draft_data: {
        q1: {
          html: "<p>New answer</p>",
          text: "New answer",
          word_count: 2,
          character_count: 10,
        },
      },
    });
  });

  it("lists unanswered questions in the confirmation dialog and locks the editor after submitting", async () => {
    mockRpc();
    renderPage();

    await screen.findByRole("heading", { name: "A memorable day" });
    fireEvent.change(screen.getByLabelText("Writing answer for question 1"), {
      target: { value: "A finished answer" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Submit for Grading" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Questions without an answer")).toBeInTheDocument();
    expect(within(dialog).getByText("Which title fits best?")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Submit for Grading" }));

    expect(await screen.findByText("Submitted for grading.")).toBeInTheDocument();
    expect(screen.getByLabelText("Writing answer for question 1")).toHaveProperty("readOnly", true);
    expect(screen.getByText("This assignment is read-only now.")).toBeInTheDocument();

    const submitCall = rpc.mock.calls.find(([fn]) => fn === "submit_assignment");
    expect(submitCall?.[1]).toMatchObject({
      assessment_id: "essay/42",
      submission_data: {
        q1: {
          text: "A finished answer",
          word_count: 3,
        },
      },
    });
  });

  it("shows a read-only locked state without starting a submitted assignment", async () => {
    mockRpc(true);
    renderPage();

    expect(await screen.findByRole("heading", { name: "A memorable day" })).toBeInTheDocument();
    expect(screen.getByText(/submitted and read-only/)).toBeInTheDocument();
    await waitFor(() => {
      expect(rpc).toHaveBeenCalledTimes(1);
    });
    expect(rpc).toHaveBeenCalledWith("get_assignment_brief", { assignment_id: "essay/42" });
    expect(rpc).not.toHaveBeenCalledWith("start_assignment", expect.anything());
  });
});
