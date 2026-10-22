"use client";

import { APP_URL } from "@/lib/supabase";

/** Dynamic QR pointing at /vault for phone install */
export function LandingQr({ size = 220 }: { size?: number }) {
  const target = `${APP_URL}/vault`;
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(target)}`;

  return (
    <figure className="inline-flex flex-col items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        width={size}
        height={size}
        alt="QR code — scan to open UnNag vault on your phone"
        className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-ink/10"
      />
      <figcaption className="max-w-[14rem] text-center text-sm text-ink/55">
        Scan with your phone, then send the partner code to your roommate.
      </figcaption>
    </figure>
  );
}
