import { describe, it, expect } from "vitest";
import { shouldRetryQuery, createQueryClient } from "./query-client";

describe("QueryProvider retry & configuration", () => {
  it("allows retrying up to 2 times for standard network errors", () => {
    const networkError = new Error("Network timeout");
    expect(shouldRetryQuery(0, networkError)).toBe(true);
    expect(shouldRetryQuery(1, networkError)).toBe(true);
    expect(shouldRetryQuery(2, networkError)).toBe(false);
  });

  it("does not retry 401, 403, or 404 errors", () => {
    expect(shouldRetryQuery(0, { status: 401 })).toBe(false);
    expect(shouldRetryQuery(0, { status: 403 })).toBe(false);
    expect(shouldRetryQuery(0, { status: 404 })).toBe(false);
    expect(shouldRetryQuery(0, { code: "401" })).toBe(false);
    expect(shouldRetryQuery(0, { code: "PGRST116" })).toBe(false);
    expect(shouldRetryQuery(0, { code: "42501" })).toBe(false);
  });

  it("creates QueryClient with configured default stale and gc times", () => {
    const client = createQueryClient();
    const defaultOptions = client.getDefaultOptions();
    expect(defaultOptions.queries?.staleTime).toBe(1000 * 60 * 2);
    expect(defaultOptions.queries?.gcTime).toBe(1000 * 60 * 10);
  });
});
