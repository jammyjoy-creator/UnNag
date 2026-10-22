"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { CallOverlayModal } from "@/components/CallOverlayModal";
import { InstallBanner } from "@/components/InstallBanner";
import { PartnerInvite } from "@/components/PartnerInvite";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import {
  completeTask,
  createTask,
  getSessionUser,
  getTask,
  listConnections,
  listMembers,
  savePushSubscription,
  signIn,
  signOut,
  signUp,
  uploadVoiceNote,
  vaultTasks,
} from "@/lib/api";
import type { Connection, Profile, Task } from "@/lib/types";

export function VaultApp() {
  const params = useSearchParams();
  const dropId = params.get("drop");
  const inviteParam = params.get("invite");

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [vault, setVault] = useState<Task[]>([]);
  const [overlay, setOverlay] = useState<Task | null>(null);
  const [tab, setTab] = useState<"inbox" | "compose" | "invite">("inbox");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  const [connections, setConnections] = useState<Connection[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [connectionId, setConnectionId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [title, setTitle] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [clip, setClip] = useState<{ blob: Blob; durationSeconds: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const tasks = await vaultTasks();
    setVault(tasks);
    const conns = await listConnections();
    setConnections(conns);
    if (conns[0] && !connectionId) setConnectionId(conns[0].id);
  }, [connectionId]);

  useEffect(() => {
    void (async () => {
      const user = await getSessionUser();
      setUserId(user?.id ?? null);
      setLoading(false);
      if (user) await reload();
    })();
  }, [reload]);

  // Poll inbox so B sees A's drops without needing push/cron
  useEffect(() => {
    if (!userId) return;
    const id = window.setInterval(() => {
      void reload();
    }, 4000);
    return () => window.clearInterval(id);
  }, [userId, reload]);

  useEffect(() => {
    if (inviteParam) setTab("invite");
  }, [inviteParam]);

  useEffect(() => {
    if (!dropId || !userId) return;
    void getTask(dropId).then((t) => t && setOverlay(t));
  }, [dropId, userId]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "incoming_drop" && event.data.taskId) {
        void getTask(event.data.taskId).then((t) => t && setOverlay(t));
      }
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => navigator.serviceWorker?.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!connectionId || !userId) return;
    void listMembers(connectionId).then((m) => {
      setMembers(m);
      // Default to the *other* person — not yourself
      const other = m.find((x) => x.id !== userId) ?? m[0];
      setAssigneeId((prev) => (m.some((x) => x.id === prev) ? prev : (other?.id ?? "")));
    });
  }, [connectionId, userId]);

  const enablePush = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setMsg("Push not supported in this browser.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setMsg("Notifications blocked.");
      return;
    }
    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapid) {
      setMsg("Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY");
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const key = urlBase64ToUint8Array(vapid);
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });
    }
    await savePushSubscription(sub);
    setMsg("Quiet-window alerts enabled.");
  };

  const onAuth = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const res =
      authMode === "signin"
        ? await signIn(email, password)
        : await signUp(email, password, fullName);
    if (res.error) {
      setAuthError(res.error.message);
      return;
    }
    const user = await getSessionUser();
    setUserId(user?.id ?? null);
    await reload();
  };

  const submitDrop = async (e: FormEvent) => {
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
      await createTask({
        connection_id: connectionId,
        assignee_id: assigneeId,
        title,
        voice_note_url: voiceUrl,
        voice_duration_seconds: seconds,
        is_urgent: urgent,
      });
      setTitle("");
      setClip(null);
      setUrgent(false);
      setMsg(
        urgent
          ? "Urgent drop delivered — have them refresh Inbox on /vault."
          : "Sent. If outside their quiet window it waits; otherwise it lands in their Inbox.",
      );
      setTab("inbox");
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center font-display text-xl text-ink/40">
        Loading…
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-moss">UnNag</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">Your vault</h1>
        <p className="mt-2 text-ink/60">
          Sign in to queue 5-second drops for quiet windows.
        </p>
        <form onSubmit={(e) => void onAuth(e)} className="mt-8 space-y-3">
          {authMode === "signup" && (
            <input
              className="w-full rounded-xl bg-white px-3 py-3 ring-1 ring-ink/10"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          )}
          <input
            className="w-full rounded-xl bg-white px-3 py-3 ring-1 ring-ink/10"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="w-full rounded-xl bg-white px-3 py-3 ring-1 ring-ink/10"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          <button type="submit" className="h-12 w-full rounded-2xl bg-ink font-semibold text-fog">
            {authMode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
        {authError && <p className="mt-3 text-sm text-clay">{authError}</p>}
        <button
          type="button"
          className="mt-6 text-sm text-ink/50"
          onClick={() => setAuthMode(authMode === "signin" ? "signup" : "signin")}
        >
          {authMode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
        </button>
      </div>
    );
  }

  return (
    <div className="relative mx-auto min-h-dvh max-w-lg px-5 pb-24 pt-8">
      <InstallBanner />

      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-moss">UnNag</p>
          <h1 className="font-display text-3xl font-semibold">Vault</h1>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <a href="/settings" className="rounded-full bg-white px-3 py-2 text-sm ring-1 ring-ink/10">
            Windows
          </a>
          <button
            type="button"
            onClick={() => void enablePush()}
            className="rounded-full bg-pine px-3 py-2 text-sm font-medium text-white"
          >
            Alerts
          </button>
          <button
            type="button"
            onClick={() => void signOut().then(() => setUserId(null))}
            className="rounded-full bg-white px-3 py-2 text-sm ring-1 ring-ink/10"
          >
            Out
          </button>
        </div>
      </header>

      <nav className="mb-5 flex gap-2">
        {(
          [
            ["inbox", "Inbox"],
            ["compose", "New drop"],
            ["invite", "Partner"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              tab === id ? "bg-ink text-fog" : "bg-white/80 text-ink/55"
            }`}
          >
            {label}
            {id === "inbox" && vault.length > 0 ? ` (${vault.length})` : ""}
          </button>
        ))}
      </nav>

      {msg && <p className="mb-4 text-sm text-moss">{msg}</p>}

      {tab === "inbox" && (
        <div className="space-y-3">
          {vault.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-ink/15 bg-white/50 px-6 py-12 text-center">
              <p className="font-display text-xl">Vault is clear</p>
              <p className="mt-2 text-sm text-ink/55">
                Queued drops land here when a quiet window opens.
              </p>
            </div>
          ) : (
            vault.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-2xl bg-white/85 p-4 ring-1 ring-ink/5"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setOverlay(t)}
                >
                  <p className="truncate font-semibold">{t.title}</p>
                  <p className="text-sm text-ink/50">
                    {t.creator?.full_name ?? "Someone"}
                    {t.voice_note_url ? " · voice" : ""}
                  </p>
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-moss/10 px-3 py-2 text-sm font-medium text-moss"
                  onClick={() => void completeTask(t.id).then(reload)}
                >
                  Done
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "compose" && (
        <form onSubmit={(e) => void submitDrop(e)} className="space-y-4">
          {connections.length === 0 ? (
            <p className="text-sm text-ink/60">
              Invite a partner first (Partner tab).
            </p>
          ) : (
            <>
              <label className="block text-sm">
                <span className="mb-1 block text-ink/55">Household</span>
                <select
                  className="w-full rounded-xl bg-white px-3 py-3 ring-1 ring-ink/10"
                  value={connectionId}
                  onChange={(e) => setConnectionId(e.target.value)}
                >
                  {connections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-ink/55">Assign to</span>
                <select
                  className="w-full rounded-xl bg-white px-3 py-3 ring-1 ring-ink/10"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-ink/55">What needs doing?</span>
                <input
                  className="w-full rounded-xl bg-white px-3 py-3 ring-1 ring-ink/10"
                  placeholder="Drop Liam at school at 5"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  required
                />
              </label>
              <VoiceRecorder
                attachedSeconds={clip?.durationSeconds ?? null}
                onReady={setClip}
                onCleared={() => setClip(null)}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={urgent}
                  onChange={(e) => setUrgent(e.target.checked)}
                />
                Urgent — ring as soon as it delivers
              </label>
              <button
                type="submit"
                disabled={busy}
                className="h-12 w-full rounded-2xl bg-ink font-semibold text-fog disabled:opacity-50"
              >
                {busy ? "Sending…" : "Queue drop"}
              </button>
            </>
          )}
        </form>
      )}

      {tab === "invite" && <PartnerInvite onReady={() => void reload()} />}

      {overlay && (
        <CallOverlayModal
          task={overlay}
          vaultCount={vault.length || 1}
          onClose={() => setOverlay(null)}
          onChanged={() => void reload()}
        />
      )}
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
