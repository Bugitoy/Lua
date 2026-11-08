-- Friend safety: who can send you requests, blocking, reporting, a daily limit
-- on requests, and profiles that only friends (and people with a pending
-- request) can see. Search and adding by code go through functions below
-- that apply all of this.

-- Who can send the user a friend request from username search. Anyone with
-- their link, QR or code can always ask; they were given it.
create table public.friend_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  requests_from text not null default 'everyone',
  updated_at timestamptz not null default now(),
  constraint friend_settings_requests_from check (requests_from in ('everyone', 'friends_of_friends', 'code_only'))
);

create table public.blocks (
  blocker uuid not null references public.profiles (id) on delete cascade,
  blocked uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  constraint blocks_not_self check (blocker <> blocked)
);
create index blocks_blocked_idx on public.blocks (blocked);

-- Reviewed by hand in the Supabase dashboard. The names are copied in, since
-- people can change them (or delete their account) after being reported.
create table public.reports (
  id bigint generated always as identity primary key,
  reporter uuid references public.profiles (id) on delete set null,
  reported uuid references public.profiles (id) on delete set null,
  reported_username text not null,
  reported_display_name text not null,
  reason text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  constraint reports_reason check (reason in ('spam', 'harassment', 'inappropriate', 'other')),
  constraint reports_status check (status in ('open', 'reviewed', 'actioned'))
);
create index reports_open_idx on public.reports (created_at) where status = 'open';

-- One row per request sent, kept after the request is declined or cancelled,
-- so the daily limit can't be dodged by asking again.
create table public.friend_request_log (
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index friend_request_log_user_idx on public.friend_request_log (user_id, created_at);

alter table public.friend_settings enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.friend_request_log enable row level security;

create policy "Users can read their own friend settings"
  on public.friend_settings for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can add their own friend settings"
  on public.friend_settings for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can change their own friend settings"
  on public.friend_settings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.friend_settings, public.blocks, public.reports, public.friend_request_log from anon, authenticated;
grant select, insert on public.friend_settings to authenticated;
-- user_id is included because the app saves with an upsert, which sets every
-- column it sends; the policies keep it pinned to the caller.
grant update (user_id, requests_from) on public.friend_settings to authenticated;
-- blocks, reports and the request log are only touched through the functions below.

create trigger friend_settings_touch before update on public.friend_settings
  for each row execute function public.touch_updated_at();

-- Profiles: only your own, your friends', and people with a pending request
-- between you. Everyone else is reached through search_profiles and
-- find_by_friend_code, which apply blocks and settings.
drop policy "Signed-in users can read profiles" on public.profiles;
create policy "Users can read profiles they're connected to"
  on public.profiles for select to authenticated
  using (
    (select auth.uid()) = id
    or exists (
      select 1 from public.friendships f
      where (f.requester = (select auth.uid()) and f.addressee = profiles.id)
         or (f.addressee = (select auth.uid()) and f.requester = profiles.id)
    )
  );

-- Helpers ------------------------------------------------------------------

create function public.blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker = a and blocked = b) or (blocker = b and blocked = a)
  );
$$;

create function public.share_a_friend(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with friends_of_a as (
    select case when requester = a then addressee else requester end as id
    from public.friendships where status = 'accepted' and a in (requester, addressee)
  ), friends_of_b as (
    select case when requester = b then addressee else requester end as id
    from public.friendships where status = 'accepted' and b in (requester, addressee)
  )
  select exists (select 1 from friends_of_a join friends_of_b using (id));
$$;

create function public.requests_from_of(uid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select requests_from from public.friend_settings where user_id = uid), 'everyone');
$$;

-- Whether `me` may send `target` a request from search (not by code).
create function public.can_request_from_search(me uuid, target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case public.requests_from_of(target)
    when 'everyone' then true
    when 'friends_of_friends' then public.share_a_friend(me, target)
    else false
  end;
$$;

revoke execute on function public.blocked_between(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.share_a_friend(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.requests_from_of(uuid) from public, anon, authenticated;
revoke execute on function public.can_request_from_search(uuid, uuid) from public, anon, authenticated;

-- Requests -----------------------------------------------------------------

-- Most requests one person can send in 24 hours.
create function public.daily_request_limit()
returns integer
language sql
immutable
set search_path = ''
as $$ select 20 $$;

-- Sends a request from `me` to `target`. `via_code` skips the target's
-- "who can send requests" setting (they handed out the code), never blocks.
-- Returns 'requested', 'incoming', 'already_requested', 'already_friends',
-- 'unavailable' (blocked, or their setting doesn't allow it) or 'limit'.
create function public.request_friend(me uuid, target uuid, via_code boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.friendships;
begin
  if target is null or target = me then
    raise exception 'cannot befriend yourself';
  end if;
  if not exists (select 1 from public.profiles p where p.id = target) then
    raise exception 'no such user';
  end if;
  -- The same answer whoever blocked whom, so a block isn't revealed.
  if public.blocked_between(me, target) then
    return 'unavailable';
  end if;

  select * into existing from public.friendships f
  where (f.requester = me and f.addressee = target)
     or (f.requester = target and f.addressee = me);
  if found then
    if existing.status = 'accepted' then return 'already_friends'; end if;
    if existing.requester = me then return 'already_requested'; end if;
    return 'incoming';
  end if;

  if not via_code and not public.can_request_from_search(me, target) then
    return 'unavailable';
  end if;
  if (select count(*) from public.friend_request_log l
      where l.user_id = me and l.created_at > now() - interval '24 hours') >= public.daily_request_limit() then
    return 'limit';
  end if;

  insert into public.friendships (requester, addressee) values (me, target);
  insert into public.friend_request_log (user_id) values (me);
  return 'requested';
end;
$$;
revoke execute on function public.request_friend(uuid, uuid, boolean) from public, anon, authenticated;

-- From username search.
create or replace function public.send_friend_request(target uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  return public.request_friend(auth.uid(), target, false);
end;
$$;

-- From a link, QR or typed friend code. 'not_found' when no one has the code.
create function public.send_friend_request_by_code(code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  code_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select f.user_id into code_owner from public.friend_codes f
  where f.code = public.normalize_friend_code(send_friend_request_by_code.code);
  if code_owner is null then
    return 'not_found';
  end if;
  return public.request_friend(auth.uid(), code_owner, true);
end;
$$;

-- Looking people up --------------------------------------------------------

-- The person behind a code, unless one of you blocked the other.
create or replace function public.find_by_friend_code(code text)
returns table (id uuid, username text, display_name text, look jsonb, xp integer, streak integer)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.look, p.xp, p.streak
  from public.friend_codes f
  join public.profiles p on p.id = f.user_id
  where f.code = public.normalize_friend_code(find_by_friend_code.code)
    and auth.uid() is not null
    and not public.blocked_between(auth.uid(), p.id);
$$;

-- Usernames starting with `term`: people the caller is allowed to ask, plus
-- anyone they're already connected to. Never the caller or blocked people.
create function public.search_profiles(term text)
returns table (id uuid, username text, display_name text, look jsonb, xp integer, streak integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  cleaned text := btrim(coalesce(term, ''));
  pattern text;
begin
  if me is null then
    raise exception 'not signed in';
  end if;
  cleaned := regexp_replace(cleaned, '^@', '');
  if length(cleaned) < 2 then
    return;
  end if;
  -- \, % and _ are special in LIKE; usernames can contain _.
  pattern := replace(replace(replace(lower(cleaned), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return query
    select p.id, p.username, p.display_name, p.look, p.xp, p.streak
    from public.profiles p
    where lower(p.username) like pattern
      and p.id <> me
      and not public.blocked_between(me, p.id)
      and (
        public.can_request_from_search(me, p.id)
        or exists (
          select 1 from public.friendships f
          where (f.requester = me and f.addressee = p.id) or (f.addressee = me and f.requester = p.id)
        )
      )
    order by lower(p.username)
    limit 20;
end;
$$;

-- Blocking and reporting ---------------------------------------------------

-- Blocks someone: ends any friendship or request between you, and neither of
-- you can find or ask the other until it's undone.
create function public.block_user(target uuid)
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
  if target is null or target = me then
    raise exception 'cannot block yourself';
  end if;
  insert into public.blocks (blocker, blocked) values (me, target) on conflict do nothing;
  delete from public.friendships
    where (requester = me and addressee = target) or (requester = target and addressee = me);
  return true;
end;
$$;

create function public.unblock_user(target uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from public.blocks where blocker = auth.uid() and blocked = target;
  return found;
end;
$$;

-- People the caller blocked, newest first.
create function public.list_blocked()
returns table (id uuid, username text, display_name text, look jsonb, xp integer, streak integer)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.look, p.xp, p.streak
  from public.blocks b
  join public.profiles p on p.id = b.blocked
  where b.blocker = auth.uid()
  order by b.created_at desc;
$$;

-- Saves a report for review. At most 10 a day per person, so the table can't
-- be flooded; returns false past that.
create function public.report_user(target uuid, reason text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  them public.profiles;
begin
  if me is null then
    raise exception 'not signed in';
  end if;
  select * into them from public.profiles where id = target;
  if not found or target = me then
    raise exception 'no such user';
  end if;
  if (select count(*) from public.reports r
      where r.reporter = me and r.created_at > now() - interval '24 hours') >= 10 then
    return false;
  end if;
  insert into public.reports (reporter, reported, reported_username, reported_display_name, reason)
  values (me, target, them.username, them.display_name, reason);
  return true;
end;
$$;

revoke execute on function public.send_friend_request_by_code(text) from public, anon;
revoke execute on function public.search_profiles(text) from public, anon;
revoke execute on function public.block_user(uuid) from public, anon;
revoke execute on function public.unblock_user(uuid) from public, anon;
revoke execute on function public.list_blocked() from public, anon;
revoke execute on function public.report_user(uuid, text) from public, anon;
grant execute on function public.send_friend_request_by_code(text) to authenticated;
grant execute on function public.search_profiles(text) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.list_blocked() to authenticated;
grant execute on function public.report_user(uuid, text) to authenticated;
