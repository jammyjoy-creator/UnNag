"use client";

import { useEffect, useRef, useState } from "react";
import { acceptTask, markTaskSeen, snoozeTask } from "@/lib/api";
import type { Task } from "@/lib/types";

type Props = {
  task: Task;
  vaultCount: number;
  onClose: () => void;
  onChanged: () => void;
};

export function CallOverlayModal({ task, vaultCount, onClose, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const creator = task.creator?.full_name ?? "Someone";

  useEffect(() => {
    void markTaskSeen(task.id);
  }, [task.id]);

  useEffect(() => {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 440;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    let on = false;
    const pulse = window.setInterval(() => {
      on = !on;
      gain.gain.setTargetAtTime(on ? 0.035 : 0.0001, ctx.currentTime, 0.02);
      osc.frequency.setValueAtTime(on ? 520 : 440, ctx.currentTime);
    }, 700);
    return () => {
      window.clearInterval(pulse);
      osc.stop();
      void ctx.close();
    };
  }, [task.id]);

  const playVoice = async () => {
    if (!task.voice_note_url) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(task.voice_note_url);
      audioRef.current.onended = () => setPlaying(false);
    }
    setPlaying(true);
    await audioRef.current.play();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink text-fog">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(47,122,85,0.22),_transparent_55%)]" />

      <div className="relative flex flex-1 flex-col items-center justify-center px-6 pt-16 text-center">
        <p className="mb-6 text-xs font-medium uppercase tracking-[0.22em] text-ring/90">
          Incoming Drop
        </p>
        <div className="relative mb-8">
          <span className="absolute inset-0 animate-pulseRing rounded-full bg-moss/40" />
          <span
            className="absolute inset-0 animate-pulseRing rounded-full bg-moss/25"
            style={{ animationDelay: "0.55s" }}
          />
          <div className="relative flex h-28 w-28 animate-breathe items-center justify-center rounded-full bg-pine font-display text-3xl font-semibold shadow-lg shadow-moss/20">
            {creator.slice(0, 1).toUpperCase()}
          </div>
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{creator}</h1>
        <p className="mt-3 max-w-sm text-lg text-fog/80">{task.title}</p>
        {task.voice_note_url && (
          <p className="mt-2 text-sm text-ring">
            {task.voice_duration_seconds ?? "≤5"}s voice drop
          </p>
        )}
        {vaultCount > 1 && (
          <p className="mt-6 rounded-full bg-white/10 px-4 py-1.5 text-sm text-fog/70">
            {vaultCount} vault items pending
          </p>
        )}
      </div>

      <div className="relative space-y-3 px-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        {task.voice_note_url && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void playVoice()}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-white/10 text-base font-semibold"
          >
            {playing ? "Playing…" : "Play 5s Voice Drop"}
          </button>
        )}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await snoozeTask(task.id, 60);
              setBusy(false);
              onChanged();
              onClose();
            }}
            className="flex h-16 flex-col items-center justify-center rounded-2xl bg-white/10 font-semibold"
          >
            <span className="text-lg">Snooze</span>
            <span className="text-xs font-normal text-fog/55">1 hour</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await acceptTask(task.id);
              setBusy(false);
              onChanged();
              onClose();
            }}
            className="flex h-16 flex-col items-center justify-center rounded-2xl bg-moss font-semibold text-white"
          >
            <span className="text-lg">Accept</span>
            <span className="text-xs font-normal text-white/75">Open task</span>
          </button>
        </div>
        <button type="button" className="w-full py-3 text-sm text-fog/35" onClick={onClose}>
          Dismiss — keep in vault
        </button>
      </div>
    </div>
  );
}
