/* eslint-disable react-refresh/only-export-components -- pure helpers are exported for tests; this file owns them */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, Pause, Play, RotateCcw, Square, Upload } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/shared/api/supabase";
import { normalizeApiError } from "@/shared/api/error-normalizer";
import { Button } from "@/shared/components/ui/Button";
import { cn } from "@/shared/lib/utils/cn";

/* ========================================
   Audio feedback recorder (task TCH-CORE-21, used by the grading screen)

   A teacher records up to 60 seconds of spoken encouragement or pronunciation tips with the
   MediaRecorder API: record, pause, resume and stop. Before anything is saved the clip is
   previewed with a waveform and a play button, and can be re-recorded. "Save" uploads the file
   through the signed-upload flow (API-CONTRACT 1.8: `create_upload`, a PUT to the signed URL,
   `complete_upload`), then asks `get_asset_url` for the playable URL and hands both the asset id
   and the URL to `onSaved`, so the parent can attach them to the submission's feedback.
   ======================================== */

export const MAX_RECORDING_SECONDS = 60;
const WAVEFORM_BARS = 64;
const AUDIO_BUCKET = "lesson-media";

export interface SavedAudioFeedback {
  assetId: string;
  /** Playable URL for the uploaded clip. */
  url: string;
  durationSeconds: number;
}

export type AudioUploader = (
  blob: Blob,
  filename: string,
  durationSeconds: number,
) => Promise<{ assetId: string; url: string }>;

export interface AudioFeedbackRecorderProps {
  onSaved: (saved: SavedAudioFeedback) => void;
  /** Called when the teacher removes a clip that was already saved. */
  onRemoved?: (() => void) | undefined;
  onError?: ((message: string) => void) | undefined;
  /** Hard limit in seconds. Default 60. */
  maxSeconds?: number | undefined;
  /** Replaces the upload step (tests, other buckets). */
  upload?: AudioUploader | undefined;
  className?: string | undefined;
}

type Phase = "idle" | "recording" | "paused" | "preview" | "uploading" | "saved";

/* ---------- pure helpers ---------- */

/** Formats seconds as m:ss. */
export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** Reduces raw samples to `bars` peak heights in the range 0..1 (loudest bar is 1). */
export function computePeaks(samples: ArrayLike<number>, bars: number): number[] {
  if (bars <= 0) return [];
  const size = Math.max(1, Math.floor(samples.length / bars));
  const peaks: number[] = [];
  for (let bar = 0; bar < bars; bar += 1) {
    let peak = 0;
    const start = bar * size;
    const end = Math.min(samples.length, start + size);
    for (let i = start; i < end; i += 1) {
      const value = Math.abs(samples[i] ?? 0);
      if (value > peak) peak = value;
    }
    peaks.push(peak);
  }
  const max = Math.max(...peaks, 0);
  return max > 0 ? peaks.map((p) => p / max) : peaks.map(() => 0);
}

/** First recording format this browser supports, so Safari (mp4) and Chrome/Firefox (webm) both work. */
export function pickMimeType(isSupported: (type: string) => boolean): string | undefined {
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find(
    isSupported,
  );
}

export function extensionFor(mime: string): string {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

/* ---------- default upload (signed-upload flow) ---------- */

const uploadTicket = z.object({
  asset_id: z.string(),
  upload_url: z.string(),
  token: z.string().nullish(),
});
const assetUrl = z.object({ url: z.string() });

async function invokeEdge<T>(name: string, body: Record<string, unknown>, schema: z.ZodType<T>) {
  const response = await supabase.functions.invoke<unknown>(name, { body });
  if (response.error) throw new Error(normalizeApiError(response.error).message);
  const parsed = schema.safeParse(response.data);
  if (!parsed.success) throw new Error(`${name} returned data in an unexpected shape.`);
  return parsed.data;
}

export const uploadAudioFeedback: AudioUploader = async (blob, filename, durationSeconds) => {
  const ticket = await invokeEdge(
    "create_upload",
    {
      bucket: AUDIO_BUCKET,
      kind: "audio",
      filename,
      mime: blob.type,
      size: blob.size,
      duration_s: Math.round(durationSeconds * 10) / 10,
    },
    uploadTicket,
  );
  const response = await fetch(ticket.upload_url, {
    method: "PUT",
    headers: {
      "Content-Type": blob.type,
      ...(ticket.token ? { Authorization: `Bearer ${ticket.token}` } : {}),
    },
    body: blob,
  });
  if (!response.ok) throw new Error("The audio feedback could not be uploaded.");
  await invokeEdge("complete_upload", { asset_id: ticket.asset_id }, z.object({}).passthrough());
  const { url } = await invokeEdge("get_asset_url", { asset_id: ticket.asset_id }, assetUrl);
  return { assetId: ticket.asset_id, url };
};

/* ---------- waveform ---------- */

function Waveform({ peaks, progress }: { peaks: number[]; progress: number }) {
  const barWidth = 100 / peaks.length;
  return (
    <svg
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      role="img"
      aria-label="Waveform of the recording"
      data-testid="waveform"
      className="h-14 w-full rounded-[10px] border-2 border-stroke bg-surface-100"
    >
      {peaks.map((peak, index) => {
        const height = Math.max(2, peak * 36);
        const played = (index + 0.5) / peaks.length <= progress;
        return (
          <rect
            key={index}
            x={index * barWidth + barWidth * 0.15}
            y={20 - height / 2}
            width={barWidth * 0.7}
            height={height}
            rx={0.4}
            className={played ? "fill-[var(--world-main,#ffb84d)]" : "fill-[var(--ink,#1a1a2e)]"}
            opacity={played ? 1 : 0.55}
          />
        );
      })}
    </svg>
  );
}

/* ---------- component ---------- */

export function AudioFeedbackRecorder({
  onSaved,
  onRemoved,
  onError,
  maxSeconds = MAX_RECORDING_SECONDS,
  upload = uploadAudioFeedback,
  className,
}: AudioFeedbackRecorderProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [peaks, setPeaks] = useState<number[]>(() => Array<number>(WAVEFORM_BARS).fill(0));
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const banked = useRef(0); // seconds recorded before the current run
  const runStart = useRef(0);
  const finalDuration = useRef(0);
  const audioEl = useRef<HTMLAudioElement>(null);

  const fail = useCallback(
    (message: string) => {
      onError?.(message);
    },
    [onError],
  );

  const releaseMic = () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  };

  // Free the microphone and the preview URL when the component goes away.
  useEffect(
    () => () => {
      if (recorder.current && recorder.current.state !== "inactive") {
        recorder.current.onstop = null;
        recorder.current.stop();
      }
      stream.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const stop = useCallback(() => {
    const media = recorder.current;
    if (!media || media.state === "inactive") return;
    if (media.state === "recording") {
      banked.current += (performance.now() - runStart.current) / 1000;
    }
    finalDuration.current = Math.min(banked.current, maxSeconds);
    media.stop();
  }, [maxSeconds]);

  // Clock: ticks while recording and stops the clip at the limit.
  useEffect(() => {
    if (phase !== "recording") return undefined;
    const timer = window.setInterval(() => {
      const total = banked.current + (performance.now() - runStart.current) / 1000;
      setElapsed(Math.min(total, maxSeconds));
      if (total >= maxSeconds) stop();
    }, 100);
    return () => window.clearInterval(timer);
  }, [phase, maxSeconds, stop]);

  // Draw the waveform of the finished clip.
  useEffect(() => {
    if (!blob) return undefined;
    let cancelled = false;
    const Context =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return undefined;
    const context = new Context();
    blob
      .arrayBuffer()
      .then((buffer) => context.decodeAudioData(buffer))
      .then((decoded) => {
        if (!cancelled) setPeaks(computePeaks(decoded.getChannelData(0), WAVEFORM_BARS));
      })
      .catch(() => {
        // The clip still plays; the bars simply stay flat.
      })
      .finally(() => void context.close().catch(() => undefined));
    return () => {
      cancelled = true;
    };
  }, [blob]);

  const start = async () => {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      fail("Audio recording is not supported in this browser.");
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      const mimeType = pickMimeType((type) => MediaRecorder.isTypeSupported(type));
      const rec = new MediaRecorder(
        media,
        mimeType ? { mimeType, audioBitsPerSecond: 96_000 } : undefined,
      );
      stream.current = media;
      recorder.current = rec;
      chunks.current = [];
      banked.current = 0;
      rec.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      rec.onstop = () => {
        releaseMic();
        const type = rec.mimeType !== "" ? rec.mimeType : (mimeType ?? "audio/webm");
        const clip = new Blob(chunks.current, { type });
        setElapsed(finalDuration.current);
        setBlob(clip);
        setPreviewUrl(URL.createObjectURL(clip));
        setPlayhead(0);
        setPlaying(false);
        setPhase("preview");
      };
      rec.start();
      runStart.current = performance.now();
      setElapsed(0);
      setPhase("recording");
    } catch {
      fail("Microphone access was blocked. Allow it in your browser to record feedback.");
    }
  };

  const togglePause = () => {
    const media = recorder.current;
    if (!media) return;
    if (media.state === "recording") {
      banked.current += (performance.now() - runStart.current) / 1000;
      media.pause();
      setPhase("paused");
    } else if (media.state === "paused") {
      runStart.current = performance.now();
      media.resume();
      setPhase("recording");
    }
  };

  const reset = () => {
    audioEl.current?.pause();
    setBlob(null);
    setPreviewUrl(null);
    setPeaks(Array<number>(WAVEFORM_BARS).fill(0));
    setElapsed(0);
    setPlayhead(0);
    setPlaying(false);
    setPhase("idle");
  };

  const discardSaved = () => {
    reset();
    onRemoved?.();
  };

  const save = async () => {
    if (!blob) return;
    setPhase("uploading");
    try {
      const filename = `feedback-${Date.now()}.${extensionFor(blob.type)}`;
      const result = await upload(blob, filename, elapsed);
      onSaved({ assetId: result.assetId, url: result.url, durationSeconds: elapsed });
      setPhase("saved");
    } catch (error) {
      fail(error instanceof Error ? error.message : "The audio feedback could not be saved.");
      setPhase("preview");
    }
  };

  const togglePlay = () => {
    const audio = audioEl.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => setPlaying(false));
    else audio.pause();
  };

  const remaining = useMemo(() => Math.max(0, maxSeconds - elapsed), [elapsed, maxSeconds]);
  const active = phase === "recording" || phase === "paused";
  const reviewing = phase === "preview" || phase === "uploading" || phase === "saved";

  return (
    <section
      aria-label="Audio feedback"
      className={cn(
        "rounded-[20px] border-2 border-stroke bg-surface-0 p-4 shadow-retro-sm",
        className,
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-display font-extrabold">Audio feedback</h3>
        <output
          aria-live="off"
          data-testid="recorder-clock"
          className="rounded-[10px] border-2 border-stroke bg-surface-0 px-2 py-0.5 text-sm font-extrabold tabular-nums"
        >
          {formatClock(elapsed)} / {formatClock(maxSeconds)}
        </output>
      </div>
      <p className="mb-3 text-sm text-muted">
        Record up to {maxSeconds} seconds of encouragement or pronunciation tips.
      </p>

      {phase === "idle" && (
        <Button variant="outline" onClick={() => void start()}>
          <Mic size={16} aria-hidden="true" /> Start recording
        </Button>
      )}

      {active && (
        <div className="space-y-3">
          <div
            role="progressbar"
            aria-label="Recording length"
            aria-valuemin={0}
            aria-valuemax={maxSeconds}
            aria-valuenow={Math.round(elapsed)}
            className="h-2 overflow-hidden rounded-full border-2 border-stroke bg-surface-100"
          >
            <div
              className="h-full bg-[var(--world-main,#ffb84d)]"
              style={{ width: `${(elapsed / maxSeconds) * 100}%` }}
            />
          </div>
          <p role="status" className="text-sm font-bold">
            {phase === "recording" ? "Recording…" : "Paused"} · {formatClock(remaining)} left
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={togglePause}>
              {phase === "recording" ? (
                <>
                  <Pause size={16} aria-hidden="true" /> Pause
                </>
              ) : (
                <>
                  <Mic size={16} aria-hidden="true" /> Resume
                </>
              )}
            </Button>
            <Button variant="danger" onClick={stop}>
              <Square size={16} aria-hidden="true" /> Stop
            </Button>
          </div>
        </div>
      )}

      {reviewing && previewUrl && (
        <div className="space-y-3">
          <Waveform peaks={peaks} progress={playhead} />
          {/* A teacher previewing their own recording: there is no transcript to caption. */}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio
            ref={audioEl}
            src={previewUrl}
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => {
              setPlaying(false);
              setPlayhead(0);
            }}
            onTimeUpdate={(event) => {
              const { currentTime, duration } = event.currentTarget;
              const total = Number.isFinite(duration) && duration > 0 ? duration : elapsed;
              setPlayhead(total > 0 ? Math.min(1, currentTime / total) : 0);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={togglePlay} disabled={phase === "uploading"}>
              {playing ? (
                <>
                  <Pause size={16} aria-hidden="true" /> Pause preview
                </>
              ) : (
                <>
                  <Play size={16} aria-hidden="true" /> Play preview
                </>
              )}
            </Button>
            {phase === "saved" ? (
              <>
                <span role="status" className="text-sm font-bold text-muted">
                  Saved with the feedback
                </span>
                <Button size="sm" variant="ghost" onClick={discardSaved}>
                  Remove
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => void save()} loading={phase === "uploading"}>
                  <Upload size={16} aria-hidden="true" /> Save feedback
                </Button>
                <Button variant="ghost" onClick={reset} disabled={phase === "uploading"}>
                  <RotateCcw size={16} aria-hidden="true" /> Re-record
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default AudioFeedbackRecorder;
