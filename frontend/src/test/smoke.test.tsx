import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryProvider } from "@/app/providers/QueryProvider";
import { normalizeApiError } from "@/shared/api/error-normalizer";

function SampleComponent() {
  return (
    <div>
      <h1>Al-Hikmah English Platform</h1>
      <p>Interactive English learning platform</p>
    </div>
  );
}

describe("Frontend Smoke Tests", () => {
  it("renders React components inside DOM correctly", () => {
    render(<SampleComponent />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Al-Hikmah English Platform",
    );
    expect(screen.getByText("Interactive English learning platform")).toBeInTheDocument();
  });

  it("wraps components with QueryProvider properly", () => {
    render(
      <QueryProvider>
        <SampleComponent />
      </QueryProvider>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("normalizes Supabase PostgREST errors into clean AppError objects", () => {
    const error = normalizeApiError({
      code: "PGRST116",
      message: "The result contains 0 rows",
      details: "No rows found",
    });

    expect(error.code).toBe("PGRST116");
    expect(error.message).toBe("Requested record not found.");
    expect(error.details).toBe("No rows found");
  });

  it("normalizes 401 unauthorized errors", () => {
    const error = normalizeApiError({
      code: "401",
      message: "JWT expired",
    });

    expect(error.code).toBe("401");
    expect(error.message).toBe("Session expired or unauthenticated. Please sign in again.");
  });
});
