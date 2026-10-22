"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_VOICE_SECONDS, SOFT_VOICE_SECONDS } from "@/lib/supabase";

type Clip = { blob: Blob; durationSeconds: number };

type Props = {
  onReady: (clip: Clip) => void;
  onCleared?: () => void;
  attachedSeconds?: number | null;
};

/** Hold-to-record. Soft cue at 3s, hard stop at 5s — cannot extend. */
export function VoiceRecorder({ onReady, onCleared, attachedSeconds }: Props) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAt = useRef(0);
  const tickRef = useRef<number | null>(null);
  const hardRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const clearTimers = () => {
    if (tickRef.current) window.clearInterval(tickRef.current);
    if (hardRef.current) window.clearTimeout(hardRef.current);
    tickRef.current = null;
    hardRef.current = null;
  };

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const finish = useCallback(() => {
    const rec = mediaRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      mediaRef.current = rec;

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        clearTimers();
        stopTracks();
        const durationSeconds = Math.min(
          MAX_VOICE_SECONDS,
          Math.max(0.3, (Date.now() - startedAt.current) / 1000),
        );
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        setRecording(false);
        setElapsed(durationSeconds);
        if (blob.size < 200) {
          setError("Too short — hold and speak.");
          return;
        }
        onReadyRef.current({ blob, durationSeconds });
      };

      startedAt.current = Date.now();
      rec.start(100);
      setRecording(true);
      setElapsed(0);
      tickRef.current = window.setInterval(() => {
        setElapsed((Date.now() - startedAt.current) / 1000);
      }, 50);
      hardRef.current = window.setTimeout(finish, MAX_VOICE_SECONDS * 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Microphone unavailable");
      stopTracks();
    }
  }, [finish]);

  useEffect(() => () => {
    clearTimers();
    stopTracks();
    if (mediaRef.current?.state !== "inactive") mediaRef.current?.stop();
  }, []);

  const softHit = elapsed >= SOFT_VOICE_SECONDS;
  const progress = Math.min(1, elapsed / MAX_VOICE_SECONDS);

  return (
    <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-ink/5">
      <div className="mb-2 flex items-start justify-between gap-3">
        <p className="text-sm text-ink/75">
          {attachedSeconds != null
            ? `Voice drop attached · ${attachedSeconds.toFixed(1)}s`
            : recording
              ? softHit
                ? `Wrap it up — max ${MAX_VOICE_SECONDS}s`
                : 'Keep it punchy — “Liam to school at 5”'
              : `Hold to drop a ${MAX_VOICE_SECONDS}s voice note`}
        </p>
        {attachedSeconds != null && (
          <button
            type="button"
            className="text-sm text-ink/45 hover:text-clay"
            onClick={onCleared}
          >
            Remove
          </button>
        )}
      </div>

      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-ink/10">
        <div
          className={`h-full transition-all ${softHit ? "bg-clay" : "bg-moss"}`}
          style={{
            width: `${(recording ? progress : attachedSeconds ? 1 : 0) * 100}%`,
          }}
        />
      </div>

      <button
        type="button"
        className={`flex h-14 w-full touch-none select-none items-center justify-center gap-2 rounded-2xl text-base font-semibold text-white ${
          recording ? "bg-clay" : "bg-pine"
        }`}
        onPointerDown={(e) => {
          e.preventDefault();
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          void start();
        }}
        onPointerUp={() => finish()}
        onPointerCancel={() => finish()}
      >
        {recording ? `${elapsed.toFixed(1)}s / ${MAX_VOICE_SECONDS}s` : "Hold to record"}
      </button>
      {error && <p className="mt-2 text-sm text-clay">{error}</p>}
    </div>
  );
}
