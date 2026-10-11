import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { usePlatformSettings, useFeatures, DEFAULT_PLATFORM_SETTINGS } from "./usePlatformSettings";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("usePlatformSettings & useFeatures", () => {
  it("provides fallback default settings when initial query mounts", () => {
    const { result } = renderHook(() => usePlatformSettings(), {
      wrapper: createWrapper(),
    });

    expect(result.current.settings).toEqual(DEFAULT_PLATFORM_SETTINGS);
    expect(result.current.isFeatureEnabled("games")).toBe(true);
    expect(result.current.isFeatureEnabled("shop")).toBe(true);
    expect(result.current.isFeatureEnabled("registration")).toBe(false);
  });

  it("useFeatures correctly checks enabled state", () => {
    const { result } = renderHook(() => useFeatures(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFeatureEnabled("leaderboards")).toBe(true);
    expect(result.current.isFeatureEnabled("non_existent_key")).toBe(false);
  });
});
