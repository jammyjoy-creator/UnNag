export type TaskStatus = "queued" | "delivered" | "completed" | "snoozed";
export type ConnectionType = "couple" | "roommates" | "family" | "friends";

export type Profile = {
  id: string;
  full_name: string;
  window_1_start: string;
  window_1_end: string;
  window_2_start: string;
  window_2_end: string;
  timezone: string;
};

export type Connection = {
  id: string;
  name: string;
  type: ConnectionType;
  invite_code?: string;
};

export type Task = {
  id: string;
  connection_id: string;
  creator_id: string;
  assignee_id: string;
  title: string;
  voice_note_url: string | null;
  voice_duration_seconds: number | null;
  is_urgent: boolean;
  escalation_level: number;
  status: TaskStatus;
  scheduled_for: string;
  delivered_at: string | null;
  acknowledged_at: string | null;
  created_at: string;
  creator?: { full_name: string } | null;
};

export type IncomingDropPayload = {
  type: "incoming_drop";
  taskId: string;
  voiceNoteUrl?: string | null;
  escalationLevel: number;
  vaultCount: number;
  url?: string;
};
