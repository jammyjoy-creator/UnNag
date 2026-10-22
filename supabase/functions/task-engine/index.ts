/**
 * Drop Vault — Task Engine (cron every minute)
 *
 * 1. Release queued/snoozed tasks when scheduled_for <= now()
 * 2. Escalate unacked delivered tasks (15m → overlay, 30m urgent → critical)
 *
 * Deploy:  supabase functions deploy task-engine --no-verify-jwt
 * Schedule via Supabase Dashboard → Edge Functions → Cron, or pg_cron + net.http_post
 */

import { adminClient, type TaskRow } from "../_shared/supabase.ts";
import { sendWebPush, type DropNotification } from "../_shared/webPush.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabase = adminClient();
    const now = new Date();
    const released = await releaseDueTasks(supabase, now);
    const escalated = await escalateUnacked(supabase, now);
    return json({
      ok: true,
      released: released.length,
      escalated: escalated.length,
      releasedIds: released,
      escalatedIds: escalated,
      at: now.toISOString(),
    });
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function vaultCount(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  assigneeId: string,
) {
  const { count } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("assignee_id", assigneeId)
    .eq("status", "delivered")
    .is("acknowledged_at", null);
  return count ?? 0;
}

async function notifyAssignee(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  taskId: string,
  level: 1 | 2 | 3,
) {
  const { data: task } = await supabase
    .from("tasks")
    .select(
      `id, title, voice_note_url, assignee_id, creator:profiles!tasks_creator_id_fkey(full_name)`,
    )
    .eq("id", taskId)
    .maybeSingle();

  if (!task) return;

  const count = await vaultCount(supabase, task.assignee_id);
  const notification: DropNotification = {
    taskId: task.id,
    title: task.title,
    creatorName: (task.creator as { full_name: string } | null)?.full_name ??
      "Someone",
    voiceNoteUrl: task.voice_note_url,
    escalationLevel: level,
    vaultCount: count,
  };

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", task.assignee_id);

  for (const sub of subs ?? []) {
    await sendWebPush(sub, notification);
  }
}

async function releaseDueTasks(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  now: Date,
): Promise<string[]> {
  const { data: due, error } = await supabase
    .from("tasks")
    .select("id, is_urgent, escalation_level")
    .in("status", ["queued", "snoozed"])
    .lte("scheduled_for", now.toISOString())
    .limit(100);

  if (error) throw error;
  if (!due?.length) return [];

  const ids: string[] = [];
  for (const row of due) {
    const level: 1 | 2 | 3 = row.is_urgent
      ? Math.max(2, row.escalation_level ?? 1) as 1 | 2 | 3
      : 1;

    const { error: upErr } = await supabase
      .from("tasks")
      .update({
        status: "delivered",
        delivered_at: now.toISOString(),
        escalation_level: level,
        acknowledged_at: null,
      })
      .eq("id", row.id)
      .in("status", ["queued", "snoozed"]);

    if (upErr) continue;
    await notifyAssignee(supabase, row.id, level);
    ids.push(row.id);
  }
  return ids;
}

async function escalateUnacked(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  now: Date,
): Promise<string[]> {
  const { data: open, error } = await supabase
    .from("tasks")
    .select("id, is_urgent, escalation_level, delivered_at")
    .eq("status", "delivered")
    .is("acknowledged_at", null)
    .not("delivered_at", "is", null)
    .lt("escalation_level", 3)
    .limit(100);

  if (error) throw error;
  if (!open?.length) return [];

  const ids: string[] = [];
  for (const row of open as TaskRow[]) {
    const ageMin =
      (now.getTime() - new Date(row.delivered_at!).getTime()) / 60_000;
    let next: 1 | 2 | 3 | null = null;
    if (row.escalation_level < 2 && ageMin >= 15) next = 2;
    else if (row.escalation_level < 3 && ageMin >= 30 && row.is_urgent) {
      next = 3;
    }
    if (!next) continue;

    const { error: upErr } = await supabase
      .from("tasks")
      .update({ escalation_level: next })
      .eq("id", row.id)
      .eq("status", "delivered")
      .is("acknowledged_at", null);

    if (upErr) continue;
    await notifyAssignee(supabase, row.id, next);
    ids.push(row.id);
  }
  return ids;
}
