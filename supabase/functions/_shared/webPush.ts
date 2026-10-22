/**
 * Web Push (VAPID) via web-push compatible HTTP call.
 *
 * Secrets (supabase secrets set):
 *   VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY
 *   VAPID_SUBJECT=mailto:you@example.com
 *
 * For Deno, we use a minimal JWT + encryption via the `webpush` npm package
 * through esm.sh when available; otherwise log + optional relay.
 */

export type WebPushSub = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type DropNotification = {
  taskId: string;
  title: string;
  creatorName: string;
  voiceNoteUrl: string | null;
  escalationLevel: 1 | 2 | 3;
  vaultCount: number;
};

export function buildNotificationBody(n: DropNotification) {
  const urgent = n.escalationLevel >= 2;
  return {
    title: urgent
      ? `${n.creatorName} is dropping a task`
      : "New item in your Vault",
    body: n.title,
    data: {
      type: "incoming_drop",
      taskId: n.taskId,
      voiceNoteUrl: n.voiceNoteUrl,
      escalationLevel: n.escalationLevel,
      vaultCount: n.vaultCount,
      url: `/vault?drop=${n.taskId}`,
    },
    // Client SW uses this to open full-screen call overlay
    requireInteraction: urgent,
    tag: `drop-${n.taskId}`,
    renotify: urgent,
  };
}

export async function sendWebPush(
  sub: WebPushSub,
  notification: DropNotification,
): Promise<void> {
  const payload = JSON.stringify(buildNotificationBody(notification));
  const relay = Deno.env.get("PUSH_RELAY_URL");

  // Preferred: dedicated relay that signs with VAPID (keeps private key off Deno if desired)
  if (relay) {
    const res = await fetch(relay, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${Deno.env.get("PUSH_RELAY_SECRET") ?? ""}`,
      },
      body: JSON.stringify({
        subscription: {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
      }),
    });
    if (!res.ok) {
      console.error("[webpush] relay failed", res.status, await res.text());
    }
    return;
  }

  // Fallback: try npm:web-push via esm.sh
  try {
    const webpush = await import("https://esm.sh/web-push@3.6.7");
    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@dropvault.app",
      Deno.env.get("VAPID_PUBLIC_KEY")!,
      Deno.env.get("VAPID_PRIVATE_KEY")!,
    );
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      payload,
    );
  } catch (err) {
    console.warn(
      "[webpush] could not send (set VAPID keys or PUSH_RELAY_URL)",
      err,
    );
    console.log("[webpush] payload preview", payload, "→", sub.endpoint.slice(0, 48));
  }
}
