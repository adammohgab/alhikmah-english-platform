import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutosave } from "./useAutosave";

interface Snapshot {
  value: number;
}

function renderAutosave(save: (snapshot: Snapshot) => Promise<void>) {
  return renderHook(
    ({ revision }: { revision: number }) =>
      useAutosave<Snapshot>({
        enabled: true,
        revision,
        snapshot: { value: revision },
        save,
        intervalMs: 15_000,
      }),
    { initialProps: { revision: 0 } },
  );
}

describe("useAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits 15 seconds, saves the latest snapshot once and reports Saved just now", async () => {
    const save = vi.fn<(snapshot: Snapshot) => Promise<void>>().mockResolvedValue(undefined);
    const { result, rerender } = renderAutosave(save);

    expect(result.current.dirty).toBe(false);
    rerender({ revision: 1 });
    expect(result.current.dirty).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(14_999);
      await Promise.resolve();
    });
    expect(save).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ value: 1 });
    expect(result.current.status).toBe("saved");
    expect(result.current.dirty).toBe(false);
    expect(result.current.savedAt).not.toBeNull();
  });

  it("keeps the draft dirty after a failure and retries without losing the editor", async () => {
    const save = vi
      .fn<(snapshot: Snapshot) => Promise<void>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);
    const { result, rerender } = renderAutosave(save);

    rerender({ revision: 1 });
    await act(async () => {
      vi.advanceTimersByTime(15_000);
      await Promise.resolve();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.dirty).toBe(true);
    expect(result.current.error).toBe("offline");

    let saved = false;
    await act(async () => {
      saved = await result.current.saveNow();
    });

    expect(saved).toBe(true);
    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("saved");
    expect(result.current.error).toBeNull();
    expect(result.current.dirty).toBe(false);
  });

  it("saves the newest revision after an in-flight save when exiting", async () => {
    let finishFirst: () => void = () => undefined;
    const firstSave = new Promise<void>((resolve) => {
      finishFirst = resolve;
    });
    const save = vi
      .fn<(snapshot: Snapshot) => Promise<void>>()
      .mockImplementationOnce(() => firstSave)
      .mockResolvedValueOnce(undefined);
    const { result, rerender } = renderAutosave(save);

    rerender({ revision: 1 });
    await act(async () => {
      vi.advanceTimersByTime(15_000);
      await Promise.resolve();
    });
    expect(save).toHaveBeenCalledTimes(1);

    rerender({ revision: 2 });
    let exitSave = Promise.resolve(false);
    act(() => {
      exitSave = result.current.saveNow();
    });
    finishFirst();

    await act(async () => {
      await exitSave;
    });

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith({ value: 2 });
    expect(result.current.dirty).toBe(false);
  });
});
