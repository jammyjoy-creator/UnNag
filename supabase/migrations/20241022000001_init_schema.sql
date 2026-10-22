-- Drop Vault PWA — household async tasks with 5-second voice drops
-- Schema aligned for web push + browser delivery

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.connection_type as enum (
  'couple',
  'roommates',
  'family',
  'friends'
);

create type public.task_status as enum (
  'queued',
  'delivered',
  'completed',
  'snoozed'
);

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  window_1_start time not null default '07:30',
  window_1_end time not null default '09:30',
  window_2_start time not null default '17:30',
  window_2_end time not null default '19:30',
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Connections + members
-- ---------------------------------------------------------------------------
create table public.connections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.connection_type not null default 'roommates',
  -- 6-character partner invite code (hex of 3 bytes)
  invite_code text unique default substr(encode(gen_random_bytes(3), 'hex'), 1, 6),
  created_at timestamptz not null default now()
);

create table public.connection_members (
  connection_id uuid not null references public.connections (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (connection_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------
create table public.tasks (
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
  is_urgent boolean not null default false,
  escalation_level int not null default 1 check (escalation_level between 1 and 3),
  status public.task_status not null default 'queued',
  scheduled_for timestamptz not null default now(),
  delivered_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_assignee_status_idx on public.tasks (assignee_id, status);
create index tasks_scheduled_for_idx on public.tasks (scheduled_for)
  where status in ('queued', 'snoozed');

-- ---------------------------------------------------------------------------
-- Web Push subscriptions (VAPID)
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

-- ---------------------------------------------------------------------------
-- Triggers / helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_connection_member(conn_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.connection_members cm
    where cm.connection_id = conn_id and cm.user_id = auth.uid()
  );
$$;

-- Next delivery slot in assignee's timezone
create or replace function public.next_delivery_slot(
  assignee uuid,
  from_ts timestamptz default now()
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p public.profiles%rowtype;
  local_ts timestamp;
  local_time time;
  local_date date;
  candidates timestamptz[] := '{}';
  candidate timestamptz;
  day_offset int;
begin
  select * into p from public.profiles where id = assignee;
  if not found then
    return from_ts;
  end if;

  local_ts := from_ts at time zone p.timezone;
  local_time := local_ts::time;
  local_date := local_ts::date;

  if (local_time >= p.window_1_start and local_time < p.window_1_end)
     or (local_time >= p.window_2_start and local_time < p.window_2_end) then
    return from_ts;
  end if;

  for day_offset in 0..1 loop
    candidates := candidates || array[
      ((local_date + day_offset) + p.window_1_start) at time zone p.timezone,
      ((local_date + day_offset) + p.window_2_start) at time zone p.timezone
    ];
  end loop;

  foreach candidate in array candidates loop
    if candidate > from_ts then
      return candidate;
    end if;
  end loop;

  return from_ts + interval '12 hours';
end;
$$;

create or replace function public.queue_task_outside_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_urgent then
    new.status := 'queued';
    new.scheduled_for := coalesce(new.scheduled_for, now());
    new.escalation_level := greatest(coalesce(new.escalation_level, 1), 2);
  else
    new.scheduled_for := public.next_delivery_slot(
      new.assignee_id,
      coalesce(new.scheduled_for, now())
    );
    new.status := 'queued';
  end if;
  return new;
end;
$$;

create trigger tasks_queue_on_insert
  before insert on public.tasks
  for each row execute function public.queue_task_outside_window();

create or replace function public.snooze_task(task_id uuid, minutes int default 60)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare t public.tasks;
begin
  update public.tasks
  set
    status = 'snoozed',
    scheduled_for = now() + make_interval(mins => minutes),
    escalation_level = 1,
    acknowledged_at = now()
  where id = task_id
    and (assignee_id = auth.uid() or creator_id = auth.uid())
  returning * into t;
  if not found then raise exception 'Task not found or not permitted'; end if;
  return t;
end;
$$;

create or replace function public.accept_task(task_id uuid)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare t public.tasks;
begin
  update public.tasks
  set acknowledged_at = now()
  where id = task_id and assignee_id = auth.uid()
  returning * into t;
  if not found then raise exception 'Task not found or not permitted'; end if;
  return t;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.connections enable row level security;
alter table public.connection_members enable row level security;
alter table public.tasks enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "profiles_select_self_or_shared"
  on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.connection_members me
      join public.connection_members them on me.connection_id = them.connection_id
      where me.user_id = auth.uid() and them.user_id = profiles.id
    )
  );

create policy "profiles_update_self"
  on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

create policy "profiles_insert_self"
  on public.profiles for insert with check (id = auth.uid());

create policy "connections_select_member"
  on public.connections for select
  using (public.is_connection_member(id));

create policy "connections_insert_auth"
  on public.connections for insert
  with check (auth.uid() is not null);

create policy "connections_update_member"
  on public.connections for update
  using (public.is_connection_member(id));

create policy "members_select_same"
  on public.connection_members for select
  using (public.is_connection_member(connection_id));

create policy "members_insert_self_or_owner"
  on public.connection_members for insert
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.connection_members cm
      where cm.connection_id = connection_members.connection_id
        and cm.user_id = auth.uid() and cm.role = 'owner'
    )
  );

create policy "members_delete_self_or_owner"
  on public.connection_members for delete
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.connection_members cm
      where cm.connection_id = connection_members.connection_id
        and cm.user_id = auth.uid() and cm.role = 'owner'
    )
  );

create policy "tasks_select_connection"
  on public.tasks for select
  using (public.is_connection_member(connection_id));

create policy "tasks_insert_member"
  on public.tasks for insert
  with check (
    public.is_connection_member(connection_id) and creator_id = auth.uid()
  );

create policy "tasks_update_parties"
  on public.tasks for update
  using (creator_id = auth.uid() or assignee_id = auth.uid());

create policy "tasks_delete_creator"
  on public.tasks for delete using (creator_id = auth.uid());

create policy "push_own"
  on public.push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage: voice-notes (≤5s clips)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voice-notes',
  'voice-notes',
  false,
  512000,
  array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav']
)
on conflict (id) do nothing;

create policy "voice_select_auth"
  on storage.objects for select
  using (bucket_id = 'voice-notes' and auth.role() = 'authenticated');

create policy "voice_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'voice-notes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "voice_update_own"
  on storage.objects for update
  using (
    bucket_id = 'voice-notes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "voice_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'voice-notes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
