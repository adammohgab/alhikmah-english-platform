import { render, screen } from "@testing-library/react";
import { SoundContext, type SoundContextValue } from "@/shared/hooks/useSound";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/api/supabase", () => ({ supabase: { functions: { invoke: vi.fn() } } }));

import {
  AudioFeedbackRecorder,
  computePeaks,
  extensionFor,
  formatClock,
  pickMimeType,
} from "./AudioFeedbackRecorder";

const sound: SoundContextValue = {
  play: vi.fn(),
  volume: 0.35,
  setVolume: vi.fn(),
  muted: false,
  setMuted: vi.fn(),
  toggleMute: vi.fn(),
};

describe("recorder helpers", () => {
  it("formats the clock", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(59.9)).toBe("0:59");
    expect(formatClock(60)).toBe("1:00");
  });
  it("normalises peaks so the loudest bar is 1", () => {
    const peaks = computePeaks([0.1, -0.5, 0.25, 0.05], 2);
    expect(peaks).toEqual([1, 0.5]);
    expect(computePeaks([0, 0, 0, 0], 2)).toEqual([0, 0]);
  });
  it("picks the first supported mime type and extension", () => {
    expect(pickMimeType((t) => t === "audio/mp4")).toBe("audio/mp4");
    expect(pickMimeType(() => false)).toBeUndefined();
    expect(extensionFor("audio/mp4")).toBe("m4a");
    expect(extensionFor("audio/webm;codecs=opus")).toBe("webm");
  });
});

describe("AudioFeedbackRecorder", () => {
  it("starts idle with the 60 second limit and reports unsupported browsers", async () => {
    const onError = vi.fn();
    render(
      <SoundContext.Provider value={sound}>
        <AudioFeedbackRecorder onSaved={vi.fn()} onError={onError} />
      </SoundContext.Provider>,
    );
    expect(screen.getByTestId("recorder-clock")).toHaveTextContent("0:00 / 1:00");
    screen.getByRole("button", { name: /start recording/i }).click();
    await vi.waitFor(() => expect(onError).toHaveBeenCalled());
  });
});
