import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAssignmentDetails } from "./api";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/shared/api/supabase", () => ({ supabase: { rpc } }));

const brief = {
  assignment: {
    id: "assignment/1",
    title: "Write a story",
    course_name: "English",
    teacher_name: "Ms Noor",
    instructions: "Write about a memorable day.",
    formatting_guidelines: ["Use paragraphs"],
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
  draft: { id: "draft/1", updated_at: "2026-10-20T12:00:00.000Z", word_count: 120 },
};

beforeEach(() => {
  rpc.mockReset();
});

describe("fetchAssignmentDetails", () => {
  it("maps the deployed get_assignment_brief contract to the page view model", async () => {
    rpc.mockResolvedValue({ data: brief, error: null });

    const result = await fetchAssignmentDetails("assignment/1");

    expect(rpc).toHaveBeenCalledWith("get_assignment_brief", {
      assignment_id: "assignment/1",
    });
    expect(result).toMatchObject({
      id: "assignment/1",
      title: "Write a story",
      courseName: "English",
      teacherName: "Ms Noor",
      prompt: "Write about a memorable day.",
      formattingGuidelines: ["Use paragraphs"],
      wordCount: { min: 100, max: 300 },
      points: 8,
      questionCount: 3,
      status: "in_progress",
      hasWriting: true,
      attempts: { used: 0, allowed: 2 },
      dueAt: "2026-11-05T12:00:00.000Z",
      closeAt: "2026-11-12T12:00:00.000Z",
      latePolicyText: "Late work loses 10% per day.",
      lastSavedAt: "2026-10-20T12:00:00.000Z",
      draft: {
        id: "draft/1",
        updatedAt: "2026-10-20T12:00:00.000Z",
        wordCount: 120,
      },
    });
    expect(result.attachments).toEqual([
      {
        id: "pdf1",
        name: "Guide.pdf",
        type: "pdf",
        url: "/guide.pdf",
        sizeBytes: 2048,
      },
      {
        id: "audio1",
        name: "Example.mp3",
        type: "audio",
        url: "/example.mp3",
        durationSeconds: 65,
      },
    ]);
    expect(result.rubric).toEqual([
      {
        id: "ideas",
        name: "Ideas",
        description: "Relevant details",
        fullCreditExpectation: "Uses vivid, relevant details.",
        maxPoints: 5,
      },
    ]);
    expect(result.questionTypes).toEqual([
      { type: "multiple_choice", count: 2 },
      { type: "writing", count: 1 },
    ]);
  });

  it("distinguishes missing assignments from failed or invalid responses", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "Assignment not found", code: "PGRST116" },
    });
    await expect(fetchAssignmentDetails("missing")).rejects.toThrow("NOT_FOUND");

    rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(fetchAssignmentDetails("missing")).rejects.toThrow("NOT_FOUND");

    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "Database unavailable", code: "500" },
    });
    await expect(fetchAssignmentDetails("assignment")).rejects.toThrow("REQUEST_FAILED");

    rpc.mockResolvedValueOnce({ data: { assignment: {} }, error: null });
    await expect(fetchAssignmentDetails("assignment")).rejects.toThrow("REQUEST_FAILED");
  });
});
