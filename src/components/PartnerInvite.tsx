"use client";

import { useState } from "react";
import { createConnection, joinConnection } from "@/lib/api";
import { APP_URL } from "@/lib/supabase";
import type { ConnectionType } from "@/lib/types";

type Props = {
  onReady?: () => void;
};

/** 6-character invite code + shareable /vault link */
export function PartnerInvite({ onReady }: Props) {
  const [name, setName] = useState("Our household");
  const [type, setType] = useState<ConnectionType>("couple");
  const [code, setCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const conn = await createConnection(name, type);
      const invite = (conn.invite_code ?? "").slice(0, 6).toUpperCase();
      setCode(invite || conn.invite_code || null);
      setMsg("Household created. Share the code with your partner.");
      onReady?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not create household");
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await joinConnection(joinCode);
      setMsg("Joined household.");
      onReady?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Invalid code");
    } finally {
      setBusy(false);
    }
  };

  const shareUrl = `${APP_URL}/vault?invite=${code ?? ""}`;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="font-display text-xl">Create & invite</h2>
        <input
          className="w-full rounded-xl bg-white px-3 py-3 ring-1 ring-ink/10"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Household name"
        />
        <select
          className="w-full rounded-xl bg-white px-3 py-3 ring-1 ring-ink/10"
          value={type}
          onChange={(e) => setType(e.target.value as ConnectionType)}
        >
          <option value="couple">Couple</option>
          <option value="roommates">Roommates</option>
          <option value="family">Family</option>
          <option value="friends">Friends</option>
        </select>
        <button
          type="button"
          disabled={busy}
          onClick={() => void create()}
          className="h-12 w-full rounded-2xl bg-ink font-semibold text-fog"
        >
          Generate invite code
        </button>
        {code && (
          <div className="rounded-2xl bg-pine/10 p-4 text-center">
            <p className="text-xs uppercase tracking-[0.18em] text-pine">Partner code</p>
            <p className="mt-2 font-display text-4xl font-semibold tracking-[0.2em] text-pine">
              {code}
            </p>
            <p className="mt-3 break-all text-xs text-ink/50">{shareUrl}</p>
            <button
              type="button"
              className="mt-3 text-sm font-medium text-clay"
              onClick={() => void navigator.clipboard.writeText(`${code}\n${shareUrl}`)}
            >
              Copy code + link
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-xl">Or join with a code</h2>
        <input
          className="w-full rounded-xl bg-white px-3 py-3 uppercase tracking-[0.2em] ring-1 ring-ink/10"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.slice(0, 8))}
          placeholder="ABC123"
          maxLength={8}
        />
        <button
          type="button"
          disabled={busy || joinCode.length < 4}
          onClick={() => void join()}
          className="h-12 w-full rounded-2xl bg-white font-semibold ring-1 ring-ink/15"
        >
          Join household
        </button>
      </div>

      {msg && <p className="text-sm text-moss">{msg}</p>}
    </div>
  );
}
