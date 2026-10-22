import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export type TaskRow = {
  id: string;
  title: string;
  voice_note_url: string | null;
  is_urgent: boolean;
  escalation_level: number;
  status: string;
  scheduled_for: string;
  delivered_at: string | null;
  acknowledged_at: string | null;
  assignee_id: string;
  creator_id: string;
  creator?: { full_name: string } | null;
};
