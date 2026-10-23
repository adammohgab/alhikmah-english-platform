import { createElement } from "react";
import { SoundContext } from "@/shared/hooks/useSound";
import type { SoundContextValue } from "@/shared/hooks/useSound";

const testSoundContext: SoundContextValue = {
  play: () => undefined,
  volume: 0.35,
  setVolume: () => undefined,
  muted: false,
  setMuted: () => undefined,
  toggleMute: () => undefined,
};

// Components such as Button require the sound context in the app. Give tests a silent
// default provider; tests that verify sound behavior can still supply their own provider.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Cleanup after each test case
afterEach(() => {
  cleanup();
});

const noop = () => {
  /* no-op for mock implementations */
};

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: noop,
    removeListener: noop,
    addEventListener: noop,
    removeEventListener: noop,
    dispatchEvent: () => false,
  }),
});

// Mock ResizeObserver
class MockResizeObserver {
  observe = noop;
  unobserve = noop;
  disconnect = noop;
}
window.ResizeObserver = MockResizeObserver;

// Mock IntersectionObserver
class MockIntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];
  observe = noop;
  unobserve = noop;
  disconnect = noop;
  takeRecords() {
    return [];
  }
}
window.IntersectionObserver = MockIntersectionObserver;
