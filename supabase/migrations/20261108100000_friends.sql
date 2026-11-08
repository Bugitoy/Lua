-- Friends: one row per pair of users, pending until the other person accepts.
-- Every change goes through the functions below, which check who is asking;
-- the app can only read the rows it is part of.

create table public.friendships (
  requester uuid not null references public.profiles (id) on delete cascade,
  addressee uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (requester, addressee),
  constraint friendships_not_self check (requester <> addressee),
  constraint friendships_status check (status in ('pending', 'accepted'))
);

-- One row per pair, whichever of the two asked first.
create unique index friendships_pair_key
  on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index friendships_addressee_idx on public.friendships (addressee);

alter table public.friendships enable row level security;

create policy "Users can read their own friendships"
  on public.friendships for select to authenticated
  using ((select auth.uid()) in (requester, addressee));

revoke all on public.friendships from anon, authenticated;
grant select on public.friendships to authenticated;

-- Live updates, so a new request shows up without refreshing.
alter publication supabase_realtime add table public.friendships;

-- "LUA-7KX2QD", "lua 7kx2qd" and "7KX2QD" all mean the same code. The prefix
-- is only dropped from a 9-character code, since the 6 characters after it
-- can start with LUA themselves.
create function public.normalize_friend_code(raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  with cleaned as (
    select upper(regexp_replace(coalesce(raw, ''), '[^A-Za-z0-9]', '', 'g')) as s
  )
  select 'LUA-' || case when length(s) = 9 and s like 'LUA%' then substr(s, 4) else s end
  from cleaned;
$$;

-- The public profile behind a friend code, or nothing. Codes aren't readable
-- directly, so this is the only way to turn one into a person.
create function public.find_by_friend_code(code text)
returns table (id uuid, username text, display_name text, look jsonb, xp integer, streak integer)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.look, p.xp, p.streak
  from public.friend_codes f
  join public.profiles p on p.id = f.user_id
  where f.code = public.normalize_friend_code(code)
    and auth.uid() is not null;
$$;

-- Asks `target` to be friends. If they had already asked the caller, this
-- accepts their request instead. Returns what the two are now:
-- 'requested', 'accepted', 'already_requested' or 'already_friends'.
create function public.send_friend_request(target uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  existing public.friendships;
begin
  if me is null then
    raise exception 'not signed in';
  end if;
  if target is null or target = me then
    raise exception 'cannot befriend yourself';
  end if;
  if not exists (select 1 from public.profiles p where p.id = target) then
    raise exception 'no such user';
  end if;

  select * into existing from public.friendships f
  where (f.requester = me and f.addressee = target)
     or (f.requester = target and f.addressee = me);

  if found then
    if existing.status = 'accepted' then
      return 'already_friends';
    end if;
    if existing.requester = me then
      return 'already_requested';
    end if;
    update public.friendships
      set status = 'accepted', accepted_at = now()
      where requester = target and addressee = me;
    return 'accepted';
  end if;

  insert into public.friendships (requester, addressee) values (me, target);
  return 'requested';
end;
$$;

-- Accepts or declines a request someone sent the caller. Declining removes it,
-- so they could ask again later.
create function public.respond_friend_request(requester_id uuid, accept boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in';
  end if;
  if accept then
    update public.friendships
      set status = 'accepted', accepted_at = now()
      where requester = requester_id and addressee = me and status = 'pending';
  else
    delete from public.friendships
      where requester = requester_id and addressee = me and status = 'pending';
  end if;
  return found;
end;
$$;

-- Removes a friend, or cancels a request the caller sent.
create function public.remove_friend(other uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in';
  end if;
  delete from public.friendships
    where (requester = me and addressee = other)
       or (requester = other and addressee = me);
  return found;
end;
$$;

-- Everyone the caller is connected to, with their public profile and how:
-- 'friend', 'incoming' (they asked the caller) or 'outgoing' (the caller asked).
create function public.list_friends()
returns table (
  id uuid,
  username text,
  display_name text,
  look jsonb,
  xp integer,
  streak integer,
  relation text,
  since timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id, p.username, p.display_name, p.look, p.xp, p.streak,
    case
      when f.status = 'accepted' then 'friend'
      when f.addressee = auth.uid() then 'incoming'
      else 'outgoing'
    end,
    coalesce(f.accepted_at, f.created_at)
  from public.friendships f
  join public.profiles p
    on p.id = case when f.requester = auth.uid() then f.addressee else f.requester end
  where auth.uid() in (f.requester, f.addressee)
  order by coalesce(f.accepted_at, f.created_at) desc;
$$;

revoke execute on function public.find_by_friend_code(text) from public, anon;
revoke execute on function public.send_friend_request(uuid) from public, anon;
revoke execute on function public.respond_friend_request(uuid, boolean) from public, anon;
revoke execute on function public.remove_friend(uuid) from public, anon;
revoke execute on function public.list_friends() from public, anon;
grant execute on function public.find_by_friend_code(text) to authenticated;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.list_friends() to authenticated;
