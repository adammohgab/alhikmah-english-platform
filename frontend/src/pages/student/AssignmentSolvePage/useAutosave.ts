import { useCallback, useEffect, useRef, useState } from "react";

/* ========================================
   Background draft autosave (ST-13)

   The editor never waits for the network. A 15-second tick looks for a revision that has not been
   saved yet and sends the latest snapshot. Saves are serialized, so a slow request cannot stack up
   or overwrite a newer one with an older payload. A failed save leaves the draft dirty and the
   editor usable; the header offers a retry.
   ======================================== */

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

interface UseAutosaveOptions<T> {
  enabled: boolean;
  /** Increment after every edit. The initial revision counts as already saved. */
  revision: number;
  snapshot: T;
  save: (snapshot: T) => Promise<void>;
  intervalMs?: number;
}

export interface AutosaveState {
  status: AutosaveStatus;
  dirty: boolean;
  savedAt: number | null;
  error: string | null;
  saveNow: () => Promise<boolean>;
}

export function useAutosave<T>({
  enabled,
  revision,
  snapshot,
  save,
  intervalMs = 15_000,
}: UseAutosaveOptions<T>): AutosaveState {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const enabledRef = useRef(enabled);
  const snapshotRef = useRef(snapshot);
  const revisionRef = useRef(revision);
  const savedRevisionRef = useRef(revision);
  const saveRef = useRef(save);
  const inFlightRef = useRef<Promise<boolean> | null>(null);

  enabledRef.current = enabled;
  snapshotRef.current = snapshot;
  revisionRef.current = revision;
  saveRef.current = save;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (revision > savedRevisionRef.current) setDirty(true);
  }, [revision]);

  const run = useCallback(async (force = false): Promise<boolean> => {
    if (!enabledRef.current) return false;

    while (inFlightRef.current) {
      const pending = inFlightRef.current;
      const result = await pending;
      if (!force || !result) return result;
      if (revisionRef.current <= savedRevisionRef.current) return true;
    }

    const currentRevision = revisionRef.current;
    if (!force && currentRevision <= savedRevisionRef.current) return true;

    const payload = snapshotRef.current;
    if (mountedRef.current) {
      setStatus("saving");
      setError(null);
    }

    const request = (async () => {
      try {
        await saveRef.current(payload);
        savedRevisionRef.current = Math.max(savedRevisionRef.current, currentRevision);

        if (mountedRef.current) {
          setSavedAt(Date.now());
          setStatus("saved");
          setDirty(revisionRef.current > savedRevisionRef.current);
        }
        return true;
      } catch (cause) {
        if (mountedRef.current) {
          setStatus("error");
          setDirty(true);
          setError(cause instanceof Error ? cause.message : "The draft could not be saved.");
        }
        return false;
      } finally {
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = request;
    return request;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => {
      void run();
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [enabled, intervalMs, run]);

  const saveNow = useCallback(() => run(true), [run]);

  return { status, dirty, savedAt, error, saveNow };
}
