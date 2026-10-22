import { createBrowserClient } from "@supabase/ssr";

export const MAX_VOICE_SECONDS = 5;
export const SOFT_VOICE_SECONDS = 3;

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  );
}

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://household-vault.vercel.app";
