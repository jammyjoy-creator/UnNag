"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { getMyProfile, getSessionUser, updateWindows } from "@/lib/api";

export default function SettingsPage() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [w1s, setW1s] = useState("07:30");
  const [w1e, setW1e] = useState("09:30");
  const [w2s, setW2s] = useState("17:30");
  const [w2e, setW2e] = useState("19:30");
  const [tz, setTz] = useState("UTC");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const user = await getSessionUser();
      setAuthed(Boolean(user));
      if (user) {
        const profile = await getMyProfile();
        if (profile) {
          setW1s(profile.window_1_start.slice(0, 5));
          setW1e(profile.window_1_end.slice(0, 5));
          setW2s(profile.window_2_start.slice(0, 5));
          setW2e(profile.window_2_end.slice(0, 5));
          setTz(profile.timezone);
        } else {
          setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
        }
      }
      setReady(true);
    })();
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    await updateWindows({
      window_1_start: w1s,
      window_1_end: w1e,
      window_2_start: w2s,
      window_2_end: w2e,
      timezone: tz,
    });
    setMsg("Quiet windows saved.");
  };

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-ink/40">Loading…</div>
    );
  }

  if (!authed) {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <p className="font-display text-2xl">Sign in from the vault first</p>
        <Link href="/vault" className="mt-6 inline-block text-clay">
          Go to /vault
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-5 py-10">
      <Link href="/vault" className="text-sm text-ink/50">
        ← Back to vault
      </Link>
      <h1 className="mt-4 font-display text-3xl font-semibold">Quiet windows</h1>
      <p className="mt-2 text-ink/60">
        Non-urgent drops wait until these morning / evening slots in your timezone.
      </p>

      <form onSubmit={(e) => void save(e)} className="mt-8 space-y-4">
        <TimeRow label="Morning start" value={w1s} onChange={setW1s} />
        <TimeRow label="Morning end" value={w1e} onChange={setW1e} />
        <TimeRow label="Evening start" value={w2s} onChange={setW2s} />
        <TimeRow label="Evening end" value={w2e} onChange={setW2e} />
        <label className="block text-sm">
          <span className="mb-1 block text-ink/55">Timezone</span>
          <input
            className="w-full rounded-xl bg-white px-3 py-3 ring-1 ring-ink/10"
            value={tz}
            onChange={(e) => setTz(e.target.value)}
          />
        </label>
        <button
          type="submit"
          className="h-12 w-full rounded-2xl bg-pine font-semibold text-white"
        >
          Save windows
        </button>
      </form>
      {msg && <p className="mt-4 text-sm text-moss">{msg}</p>}
    </div>
  );
}

function TimeRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 text-sm">
      <span className="text-ink/55">{label}</span>
      <input
        type="time"
        className="rounded-xl bg-white px-3 py-2 ring-1 ring-ink/10"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
