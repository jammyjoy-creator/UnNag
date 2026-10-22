-- Fix household create/join: RLS blocked SELECT after INSERT and invite lookup.
-- Run this in Supabase SQL Editor if create household fails.

create or replace function public.ensure_my_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.profiles;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into p from public.profiles where id = uid;
  if found then
    return p;
  end if;

  insert into public.profiles (id, full_name)
  values (
    uid,
    coalesce(
      auth.jwt() -> 'user_metadata' ->> 'full_name',
      split_part(coalesce(auth.jwt() ->> 'email', 'user'), '@', 1)
    )
  )
  returning * into p;

  return p;
end;
$$;

create or replace function public.create_household(p_name text, p_type public.connection_type default 'roommates')
returns public.connections
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.connections;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  perform public.ensure_my_profile();

  if nullif(trim(p_name), '') is null then
    raise exception 'Household name required';
  end if;

  insert into public.connections (name, type)
  values (trim(p_name), p_type)
  returning * into c;

  insert into public.connection_members (connection_id, user_id, role)
  values (c.id, uid, 'owner');

  return c;
end;
$$;

create or replace function public.join_household(p_code text)
returns public.connections
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.connections;
  uid uuid := auth.uid();
  code text := lower(trim(p_code));
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  perform public.ensure_my_profile();

  select * into c
  from public.connections
  where invite_code = code;

  if not found then
    raise exception 'Invalid invite code';
  end if;

  insert into public.connection_members (connection_id, user_id, role)
  values (c.id, uid, 'member')
  on conflict (connection_id, user_id) do nothing;

  return c;
end;
$$;

grant execute on function public.ensure_my_profile() to authenticated;
grant execute on function public.create_household(text, public.connection_type) to authenticated;
grant execute on function public.join_household(text) to authenticated;
