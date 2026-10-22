-- Deliver urgent (and already-in-window) tasks immediately.
-- Without this, everything stays "queued" until task-engine cron runs.

create or replace function public.queue_task_outside_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_urgent then
    new.status := 'delivered';
    new.scheduled_for := coalesce(new.scheduled_for, now());
    new.delivered_at := now();
    new.escalation_level := greatest(coalesce(new.escalation_level, 1), 2);
    new.acknowledged_at := null;
  else
    new.scheduled_for := public.next_delivery_slot(
      new.assignee_id,
      coalesce(new.scheduled_for, now())
    );
    if new.scheduled_for <= now() then
      new.status := 'delivered';
      new.delivered_at := now();
      new.escalation_level := coalesce(new.escalation_level, 1);
      new.acknowledged_at := null;
    else
      new.status := 'queued';
    end if;
  end if;
  return new;
end;
$$;

-- Flush anything already stuck in queue that is due (or urgent)
update public.tasks
set
  status = 'delivered',
  delivered_at = coalesce(delivered_at, now()),
  escalation_level = case
    when is_urgent then greatest(escalation_level, 2)
    else escalation_level
  end,
  acknowledged_at = null
where status in ('queued', 'snoozed')
  and (is_urgent = true or scheduled_for <= now());
