"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  createRecurringDrop,
  deleteRecurringDrop,
  listRecurringDrops,
  setRecurringEnabled,
  uploadVoiceNote,
} from "@/lib/api";
import type { Connection, Profile, RecurringDrop } from "@/lib/types";
import { VoiceRecorder } from "./VoiceRecorder";

type Props = {
  userId: string;
  connections: Connection[];
  members: Profile[];
  connectionId: string;
  assigneeId: string;
  onConnectionChange: (id: string) => void;
  onAssigneeChange: (id: string) => void;
  onChanged: () => void;
};

export function RecurringPanel({
  userId,
  connections,
  members,
  connectionId,
  assigneeId,
  onConnectionChange,
  onAssigneeChange,
  onChanged,
}: Props) {
  const [items, setItems] = useState<RecurringDrop[]>([]);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("17:00");
  const [tz, setTz] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );
  const [clip, setClip] = useState<{ blob: Blob; durationSeconds: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setItems(await listRecurringDrops());
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!connectionId || !assigneeId || !title.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      let voiceUrl: string | null = null;
      let seconds: number | null = null;
      if (clip) {
        voiceUrl = await uploadVoiceNote(clip.blob);
        seconds = Math.min(5, Math.ceil(clip.durationSeconds));
      }
      await createRecurringDrop({
        connection_id: connectionId,
        assignee_id: assigneeId,
        title,
        time_of_day: time,
        timezone: tz,
        voice_note_url: voiceUrl,
        voice_duration_seconds: seconds,
        is_urgent: true,
      });
      setTitle("");
      setClip(null);
      setMsg("Daily reminder set — fires around that time each day.");
      await reload();
      onChanged();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not save reminder");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl">Daily reminders</h2>
        <p className="text-sm text-ink/55">
          e.g. every day at 5:00 — “pick up Liam”. Spawns a fresh drop once a day.
        </p>
      </div>

      <form onSubmit={(e) => void submit(e)} className="space-y-3">
        {connections.length === 0 ? (
          <p className="text-sm text-ink/60">Invite a partner first.</p>
        ) : (
          <>
            <select
              className="w-full rounded-xl bg-white px-3 py-3 ring-1 ring-ink/10"
              value={connectionId}
              onChange={(e) => onConnectionChange(e.target.value)}
            >
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className="w-full rounded-xl bg-white px-3 py-3 ring-1 ring-ink/10"
              value={assigneeId}
              onChange={(e) => onAssigneeChange(e.target.value)}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id === userId ? `${m.full_name} (you)` : m.full_name}
                </option>
              ))}
            </select>
            <input
              className="w-full rounded-xl bg-white px-3 py-3 ring-1 ring-ink/10"
              placeholder="Reminder title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-ink/55">Every day at</span>
                <input
                  type="time"
                  className="w-full rounded-xl bg-white px-3 py-3 ring-1 ring-ink/10"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-ink/55">Timezone</span>
                <input
                  className="w-full rounded-xl bg-white px-3 py-3 ring-1 ring-ink/10"
                  value={tz}
                  onChange={(e) => setTz(e.target.value)}
                />
              </label>
            </div>
            <VoiceRecorder
              attachedSeconds={clip?.durationSeconds ?? null}
              onReady={setClip}
              onCleared={() => setClip(null)}
            />
            <button
              type="submit"
              disabled={busy}
              className="h-12 w-full rounded-2xl bg-pine font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Saving…" : "Add daily drop"}
            </button>
          </>
        )}
      </form>

      {msg && <p className="text-sm text-moss">{msg}</p>}

      <ul className="space-y-2">
        {items.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-3 rounded-2xl bg-white/85 p-4 ring-1 ring-ink/5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{r.title}</p>
              <p className="text-sm text-ink/50">
                Daily · {r.time_of_day.slice(0, 5)} ({r.timezone}) →{" "}
                {r.assignee?.full_name ?? "Partner"}
                {!r.enabled ? " · paused" : ""}
              </p>
            </div>
            {r.creator_id === userId && (
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-xl bg-moss/10 px-3 py-2 text-xs font-medium text-moss"
                  onClick={() =>
                    void setRecurringEnabled(r.id, !r.enabled).then(reload)
                  }
                >
                  {r.enabled ? "Pause" : "Resume"}
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-clay/10 px-3 py-2 text-xs font-medium text-clay"
                  onClick={() => void deleteRecurringDrop(r.id).then(reload)}
                >
                  Delete
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
