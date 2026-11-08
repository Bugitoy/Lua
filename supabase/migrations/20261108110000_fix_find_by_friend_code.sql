-- find_by_friend_code compared the code column with itself: inside the query,
-- the parameter `code` was shadowed by friend_codes.code, so every account
-- matched. Naming the parameter through the function fixes it. Only public
-- profile fields were ever returned, never anyone's code.
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
    and auth.uid() is not null;
$$;
