-- Accounts: a public profile per user, a private friend code, and each day's
-- stats synced from the phone. Rows are made by a trigger when someone signs
-- up, so a user never exists without a profile.

-- Public profile: what other signed-in users can see.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null default '',
  -- What their Lua wears: { skin, costume, equipped }.
  look jsonb not null default '{}'::jsonb,
  xp integer not null default 0,
  streak integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[A-Za-z0-9_]{2,30}$'),
  constraint profiles_display_name_length check (char_length(display_name) <= 40),
  constraint profiles_xp_positive check (xp >= 0),
  constraint profiles_streak_positive check (streak >= 0)
);

-- Usernames are unique ignoring case: @Maya and @maya are the same person.
create unique index profiles_username_key on public.profiles (lower(username));

-- Friend codes are kept apart from profiles so only their owner can read them.
-- Adding someone by code goes through a function (added with friend requests).
create table public.friend_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

-- One row per user per day (the phone's local date).
create table public.daily_stats (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  goals_done integer not null default 0,
  goals_total integer not null default 0,
  steps integer not null default 0,
  meters double precision not null default 0,
  work_hours double precision not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day),
  constraint daily_stats_positive check (
    goals_done >= 0 and goals_total >= 0 and steps >= 0 and meters >= 0 and work_hours >= 0
  )
);

-- Keep updated_at current.
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger daily_stats_touch before update on public.daily_stats
  for each row execute function public.touch_updated_at();

-- A code like LUA-7KX2QD. No 0/O or 1/I/L, so it's easy to read out.
create function public.new_friend_code()
returns text
language plpgsql
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
  bytes bytea;
begin
  loop
    bytes := extensions.gen_random_bytes(6);
    candidate := 'LUA-';
    for i in 0..5 loop
      candidate := candidate || substr(alphabet, 1 + get_byte(bytes, i) % length(alphabet), 1);
    end loop;
    exit when not exists (select 1 from public.friend_codes f where f.code = candidate);
  end loop;
  return candidate;
end;
$$;

-- Makes the profile and friend code when someone signs up. The app sends the
-- username and display name as sign-up metadata. If the username is missing or
-- was taken in the moment since the app checked, a placeholder is used rather
-- than failing the sign-up, and the user can change it in Manage Profile.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted text := new.raw_user_meta_data ->> 'username';
  shown text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
begin
  if wanted is null
    or wanted !~ '^[A-Za-z0-9_]{2,30}$'
    or exists (select 1 from public.profiles p where lower(p.username) = lower(wanted))
  then
    wanted := 'lua_' || substr(replace(new.id::text, '-', ''), 1, 10);
  end if;

  insert into public.profiles (id, username, display_name)
  values (new.id, wanted, left(coalesce(shown, wanted), 40));

  insert into public.friend_codes (user_id, code)
  values (new.id, public.new_friend_code());

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Lets the sign-up screen say "taken" before the account is made.
create function public.username_available(wanted text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select wanted ~ '^[A-Za-z0-9_]{2,30}$'
    and not exists (select 1 from public.profiles p where lower(p.username) = lower(wanted));
$$;

-- Gives the caller a new friend code, so an old one shared too widely stops working.
create function public.reset_friend_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  fresh text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  fresh := public.new_friend_code();
  insert into public.friend_codes (user_id, code)
  values (auth.uid(), fresh)
  on conflict (user_id) do update set code = excluded.code, created_at = now();
  return fresh;
end;
$$;

-- Row level security: everyone signed in can read profiles; each user can
-- only read their own friend code and stats, and only change their own rows.
alter table public.profiles enable row level security;
alter table public.friend_codes enable row level security;
alter table public.daily_stats enable row level security;

create policy "Signed-in users can read profiles"
  on public.profiles for select to authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Users can read their own friend code"
  on public.friend_codes for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own stats"
  on public.daily_stats for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own stats"
  on public.daily_stats for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own stats"
  on public.daily_stats for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Table access on top of the policies: nothing for signed-out users, profiles
-- are made by the trigger only, and only these profile columns can change.
revoke all on public.profiles, public.friend_codes, public.daily_stats from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (username, display_name, look, xp, streak) on public.profiles to authenticated;
grant select on public.friend_codes to authenticated;
grant select, insert, update on public.daily_stats to authenticated;

revoke execute on function public.new_friend_code() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.reset_friend_code() from public, anon;
grant execute on function public.reset_friend_code() to authenticated;
grant execute on function public.username_available(text) to anon, authenticated;
