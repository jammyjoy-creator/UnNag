-- Recurring daily drops + 24h send history (seen tracking + cleanup)

alter table public.tasks
  add column if not exists seen_at timestamptz,
  add column if not exists recurring_drop_id uuid;

create table if not exists public.recurring_drops (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections (id) on delete cascade,
  creator_id uuid not null references public.profiles (id) on delete cascade,
  assignee_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  voice_note_url text,
  voice_duration_seconds int check (
    voice_duration_seconds is null
    or (voice_duration_seconds > 0 and voice_duration_seconds <= 5)
  ),
  is_urgent boolean not null default true,
  time_of_day time not null, -- e.g. 17:00 local
  timezone text not null default 'UTC',
  enabled boolean not null default true,
  last_spawned_on date,
  created_at timestamptz not null default now()
);

alter table public.tasks
  drop constraint if exists tasks_recurring_drop_id_fkey;

alter table public.tasks
  add constraint tasks_recurring_drop_id_fkey
  foreign key (recurring_drop_id) references public.recurring_drops (id) on delete set null;

create index if not exists recurring_drops_enabled_idx
  on public.recurring_drops (enabled, time_of_day);

alter table public.recurring_drops enable row level security;

create policy "recurring_select_connection"
  on public.recurring_drops for select
  using (public.is_connection_member(connection_id));

create policy "recurring_insert_creator"
  on public.recurring_drops for insert
  with check (
    public.is_connection_member(connection_id)
    and creator_id = auth.uid()
  );

create policy "recurring_update_creator"
  on public.recurring_drops for update
  using (creator_id = auth.uid());

create policy "recurring_delete_creator"
  on public.recurring_drops for delete
  using (creator_id = auth.uid());

-- Mark seen when assignee opens the drop
create or replace function public.mark_task_seen(task_id uuid)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare t public.tasks;
begin
  update public.tasks
  set seen_at = coalesce(seen_at, now())
  where id = task_id
    and assignee_id = auth.uid()
  returning * into t;
  if not found then
    raise exception 'Task not found or not permitted';
  end if;
  return t;
end;
$$;

grant execute on function public.mark_task_seen(uuid) to authenticated;

-- Also mark seen on accept
create or replace function public.accept_task(task_id uuid)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare t public.tasks;
begin
  update public.tasks
  set
    acknowledged_at = now(),
    seen_at = coalesce(seen_at, now())
  where id = task_id and assignee_id = auth.uid()
  returning * into t;
  if not found then raise exception 'Task not found or not permitted'; end if;
  return t;
end;
$$;

-- Spawn daily reminders whose local time has been reached today
create or replace function public.spawn_due_recurring_drops()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.recurring_drops%rowtype;
  local_now timestamp;
  local_date date;
  local_time time;
  spawned int := 0;
  new_id uuid;
begin
  for r in
    select * from public.recurring_drops where enabled = true
  loop
    local_now := now() at time zone r.timezone;
    local_date := local_now::date;
    local_time := local_now::time;

    if r.last_spawned_on is not null and r.last_spawned_on >= local_date then
      continue;
    end if;

    -- Spawn once the clock has passed time_of_day (within the day)
    if local_time < r.time_of_day then
      continue;
    end if;

    insert into public.tasks (
      connection_id,
      creator_id,
      assignee_id,
      title,
      voice_note_url,
      voice_duration_seconds,
      is_urgent,
      recurring_drop_id
    ) values (
      r.connection_id,
      r.creator_id,
      r.assignee_id,
      r.title,
      r.voice_note_url,
      r.voice_duration_seconds,
      r.is_urgent,
      r.id
    )
    returning id into new_id;

    update public.recurring_drops
    set last_spawned_on = local_date
    where id = r.id;

    spawned := spawned + 1;
  end loop;

  return spawned;
end;
$$;

-- Wipe task history older than 24 hours (keeps recurring templates)
create or replace function public.cleanup_task_history()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare deleted int;
begin
  with d as (
    delete from public.tasks
    where created_at < now() - interval '24 hours'
    returning 1
  )
  select count(*)::int into deleted from d;
  return deleted;
end;
$$;

grant execute on function public.spawn_due_recurring_drops() to authenticated, service_role;
grant execute on function public.cleanup_task_history() to authenticated, service_role;

-- Convenience: run maintenance (call from cron or app open)
create or replace function public.run_drop_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  spawned int;
  cleaned int;
  released int;
begin
  select public.spawn_due_recurring_drops() into spawned;
  select public.cleanup_task_history() into cleaned;

  update public.tasks
  set
    status = 'delivered',
    delivered_at = coalesce(delivered_at, now()),
    acknowledged_at = null
  where status in ('queued', 'snoozed')
    and scheduled_for <= now();

  get diagnostics released = row_count;

  return jsonb_build_object(
    'spawned', spawned,
    'cleaned', cleaned,
    'released', released
  );
end;
$$;

grant execute on function public.run_drop_maintenance() to authenticated, service_role;
