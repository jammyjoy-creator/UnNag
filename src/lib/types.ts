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
  seen_at: string | null;
  created_at: string;
  recurring_drop_id?: string | null;
  creator?: { full_name: string } | null;
  assignee?: { full_name: string } | null;
};

export type RecurringDrop = {
  id: string;
  connection_id: string;
  creator_id: string;
  assignee_id: string;
  title: string;
  voice_note_url: string | null;
  voice_duration_seconds: number | null;
  is_urgent: boolean;
  time_of_day: string;
  timezone: string;
  enabled: boolean;
  last_spawned_on: string | null;
  created_at: string;
  assignee?: { full_name: string } | null;
};

export type DropPipelineStatus = "sent" | "queued" | "arrived" | "seen" | "done";

export function pipelineStatus(task: Task): DropPipelineStatus {
  if (task.status === "completed" || task.acknowledged_at) return "done";
  if (task.seen_at) return "seen";
  if (task.status === "delivered" || task.delivered_at) return "arrived";
  if (task.status === "queued" || task.status === "snoozed") return "queued";
  return "sent";
}

export type IncomingDropPayload = {
  type: "incoming_drop";
  taskId: string;
  voiceNoteUrl?: string | null;
  escalationLevel: number;
  vaultCount: number;
  url?: string;
};
