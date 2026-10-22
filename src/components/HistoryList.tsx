"use client";

import { pipelineStatus, type Task } from "@/lib/types";

type Props = {
  tasks: Task[];
  userId: string;
};

const LABELS = {
  sent: "Sent",
  queued: "Queued",
  arrived: "Arrived",
  seen: "Seen",
  done: "Done",
} as const;

const COLORS = {
  sent: "bg-ink/10 text-ink/70",
  queued: "bg-ring/30 text-ink/80",
  arrived: "bg-moss/15 text-moss",
  seen: "bg-pine/15 text-pine",
  done: "bg-ink/80 text-fog",
} as const;

export function HistoryList({ tasks, userId }: Props) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-ink/15 bg-white/50 px-6 py-12 text-center">
        <p className="font-display text-xl">No drops in the last 24h</p>
        <p className="mt-2 text-sm text-ink/55">
          History auto-clears after a day — check here to confirm sent → arrived → seen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-display text-2xl">History</h2>
        <p className="text-sm text-ink/55">
          Shared for both of you · last 24 hours · then wiped
        </p>
      </div>
      <ul className="space-y-2">
        {tasks.map((t) => {
          const status = pipelineStatus(t);
          const iSent = t.creator_id === userId;
          const other = iSent
            ? t.assignee?.full_name ?? "Partner"
            : t.creator?.full_name ?? "Partner";
          return (
            <li
              key={t.id}
              className="rounded-2xl bg-white/85 p-4 ring-1 ring-ink/5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{t.title}</p>
                  <p className="text-sm text-ink/50">
                    {iSent ? `To ${other}` : `From ${other}`}
                    {t.recurring_drop_id ? " · daily reminder" : ""}
                    {t.voice_note_url ? " · voice" : ""}
                  </p>
                  <p className="mt-1 text-xs text-ink/40">
                    {new Date(t.created_at).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${COLORS[status]}`}
                >
                  {LABELS[status]}
                </span>
              </div>
              <PipelineBar status={status} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PipelineBar({ status }: { status: keyof typeof LABELS }) {
  const steps: (keyof typeof LABELS)[] = ["sent", "arrived", "seen", "done"];
  // Map queued under sent progress
  const active =
    status === "queued" ? "sent" : status === "sent" ? "sent" : status;
  const idx = steps.indexOf(active === "sent" && status === "queued" ? "sent" : active);

  return (
    <div className="mt-3 flex gap-1">
      {steps.map((step, i) => (
        <div key={step} className="flex-1">
          <div
            className={`h-1 rounded-full ${
              i <= idx ? "bg-moss" : "bg-ink/10"
            }`}
          />
          <p className="mt-1 text-[10px] uppercase tracking-wide text-ink/40">
            {step === "sent" && status === "queued" ? "queued" : step}
          </p>
        </div>
      ))}
    </div>
  );
}
