import { useEffect, useState } from "react";
import { z } from "zod";
import type { AssignmentDetails } from "./types";

const assignmentDetails = z.object({
  id: z.string(),
  title: z.string(),
  courseName: z.string().optional(),
  dueAt: z.string().optional(),
  prompt: z.string(),
  formattingGuidelines: z.array(z.string()),
  wordCount: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  }),
  attachments: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.enum(["pdf", "audio"]),
      url: z.string(),
      sizeBytes: z.number().optional(),
      durationSeconds: z.number().optional(),
    }),
  ),
  rubric: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      fullCreditExpectation: z.string(),
      maxPoints: z.number(),
    }),
  ),
  draft: z
    .object({
      id: z.string(),
      updatedAt: z.string(),
      wordCount: z.number(),
    })
    .nullable()
    .optional(),
});

export async function fetchAssignmentDetails(
  assignmentId: string,
  signal?: AbortSignal,
): Promise<AssignmentDetails> {
  const response = await fetch(`/api/student/assignments/${encodeURIComponent(assignmentId)}`, {
    signal,
    credentials: "include",
  });
  if (response.status === 404) throw new Error("NOT_FOUND");
  if (!response.ok) throw new Error("REQUEST_FAILED");

  const parsed = assignmentDetails.safeParse(await response.json());
  if (!parsed.success) throw new Error("REQUEST_FAILED");
  return parsed.data;
}

export type DetailsState =
  | { status: "loading" }
  | { status: "error"; code: "NOT_FOUND" | "REQUEST_FAILED" }
  | { status: "ready"; data: AssignmentDetails };

export function useAssignmentDetails(assignmentId: string | undefined) {
  const [state, setState] = useState<DetailsState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!assignmentId) {
      setState({ status: "error", code: "NOT_FOUND" });
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading" });
    fetchAssignmentDetails(assignmentId, controller.signal)
      .then((data) => setState({ status: "ready", data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          code:
            error instanceof Error && error.message === "NOT_FOUND"
              ? "NOT_FOUND"
              : "REQUEST_FAILED",
        });
      });
    return () => controller.abort();
  }, [assignmentId, attempt]);

  return { state, retry: () => setAttempt((current) => current + 1) };
}
