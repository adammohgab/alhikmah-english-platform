import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAssignmentDetails } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchAssignmentDetails", () => {
  it("encodes the assignment id and validates the response", async () => {
    const payload = {
      id: "assignment/1",
      title: "Write a story",
      prompt: "Write about a memorable day.",
      formattingGuidelines: [],
      wordCount: {},
      attachments: [],
      rubric: [],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchAssignmentDetails("assignment/1")).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/student/assignments/assignment%2F1",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("distinguishes missing assignments from failed or invalid responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    await expect(fetchAssignmentDetails("missing")).rejects.toThrow("NOT_FOUND");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    await expect(fetchAssignmentDetails("assignment")).rejects.toThrow("REQUEST_FAILED");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "invalid" }), { status: 200 })),
    );
    await expect(fetchAssignmentDetails("assignment")).rejects.toThrow("REQUEST_FAILED");
  });
});
