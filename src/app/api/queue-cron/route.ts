import { NextRequest, NextResponse } from "next/server";

/**
 * Vercel Cron (or manual) trigger → forwards to Supabase Edge Function `task-engine`.
 *
 * Hobby note: Vercel free cron may only allow daily jobs. Prefer Supabase pg_cron
 * calling the Edge Function every minute for true window delivery.
 *
 * Protect with CRON_SECRET header when called from Vercel.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { ok: false, error: "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 },
    );
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/task-engine`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });

  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
