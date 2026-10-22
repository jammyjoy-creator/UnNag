"use client";

import { createClient, MAX_VOICE_SECONDS } from "./supabase";
import type { Connection, ConnectionType, Profile, Task } from "./types";

const supabase = () => createClient();

export async function signUp(email: string, password: string, fullName: string) {
  return supabase().auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
}

export async function signIn(email: string, password: string) {
  return supabase().auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase().auth.signOut();
}

export async function getSessionUser() {
  const { data } = await supabase().auth.getUser();
  return data.user;
}

export async function getMyProfile(): Promise<Profile | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const { data } = await supabase()
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  return data;
}

export async function updateWindows(input: {
  window_1_start: string;
  window_1_end: string;
  window_2_start: string;
  window_2_end: string;
  timezone: string;
}) {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in");
  return supabase().from("profiles").update(input).eq("id", user.id);
}

export async function createConnection(name: string, type: ConnectionType) {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in");

  const { data: conn, error } = await supabase()
    .from("connections")
    .insert({ name, type })
    .select()
    .single();
  if (error) throw error;

  const { error: memErr } = await supabase().from("connection_members").insert({
    connection_id: conn.id,
    user_id: user.id,
    role: "owner",
  });
  if (memErr) throw memErr;
  return conn as Connection;
}

export async function joinConnection(inviteCode: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in");

  const { data: conn, error } = await supabase()
    .from("connections")
    .select("*")
    .eq("invite_code", inviteCode.trim().toLowerCase())
    .single();
  if (error) throw error;

  const { error: memErr } = await supabase().from("connection_members").upsert({
    connection_id: conn.id,
    user_id: user.id,
    role: "member",
  });
  if (memErr) throw memErr;
  return conn as Connection;
}

export async function listConnections(): Promise<Connection[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const { data } = await supabase()
    .from("connection_members")
    .select("connections(*)")
    .eq("user_id", user.id);
  return (data ?? []).map((r) => r.connections as unknown as Connection);
}

export async function listMembers(connectionId: string): Promise<Profile[]> {
  const { data } = await supabase()
    .from("connection_members")
    .select("profiles(*)")
    .eq("connection_id", connectionId);
  return (data ?? []).map((r) => r.profiles as unknown as Profile);
}

export async function uploadVoiceNote(blob: Blob): Promise<string> {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in");

  const ext = blob.type.includes("ogg") ? "ogg" : "webm";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase().storage.from("voice-notes").upload(path, blob, {
    contentType: blob.type || "audio/webm",
    upsert: false,
  });
  if (error) throw error;

  const { data, error: signErr } = await supabase()
    .storage.from("voice-notes")
    .createSignedUrl(path, 60 * 60 * 24 * 30);
  if (signErr) throw signErr;
  return data.signedUrl;
}

export async function createTask(input: {
  connection_id: string;
  assignee_id: string;
  title: string;
  voice_note_url?: string | null;
  voice_duration_seconds?: number | null;
  is_urgent?: boolean;
}) {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in");

  const seconds =
    input.voice_duration_seconds == null
      ? null
      : Math.min(MAX_VOICE_SECONDS, Math.max(1, Math.round(input.voice_duration_seconds)));

  const { data, error } = await supabase()
    .from("tasks")
    .insert({
      connection_id: input.connection_id,
      creator_id: user.id,
      assignee_id: input.assignee_id,
      title: input.title.trim(),
      voice_note_url: input.voice_note_url ?? null,
      voice_duration_seconds: seconds,
      is_urgent: input.is_urgent ?? false,
    })
    .select("*, creator:profiles!tasks_creator_id_fkey(full_name)")
    .single();
  if (error) throw error;
  return data as Task;
}

export async function vaultTasks(): Promise<Task[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const { data, error } = await supabase()
    .from("tasks")
    .select("*, creator:profiles!tasks_creator_id_fkey(full_name)")
    .eq("assignee_id", user.id)
    .eq("status", "delivered")
    .is("acknowledged_at", null)
    .order("delivered_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Task[];
}

export async function getTask(id: string): Promise<Task | null> {
  const { data } = await supabase()
    .from("tasks")
    .select("*, creator:profiles!tasks_creator_id_fkey(full_name)")
    .eq("id", id)
    .maybeSingle();
  return data as Task | null;
}

export async function acceptTask(taskId: string) {
  return supabase().rpc("accept_task", { task_id: taskId });
}

export async function snoozeTask(taskId: string, minutes = 60) {
  return supabase().rpc("snooze_task", { task_id: taskId, minutes });
}

export async function completeTask(taskId: string) {
  return supabase()
    .from("tasks")
    .update({
      status: "completed",
      acknowledged_at: new Date().toISOString(),
    })
    .eq("id", taskId);
}

export async function savePushSubscription(sub: PushSubscription) {
  const user = await getSessionUser();
  if (!user) return;
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

  await supabase().from("push_subscriptions").upsert({
    user_id: user.id,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    user_agent: navigator.userAgent,
  });
}
