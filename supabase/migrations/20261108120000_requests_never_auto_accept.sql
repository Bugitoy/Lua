-- Sending a friend request never makes a friendship on its own any more. Before,
-- asking someone who had already asked you accepted their request; now it
-- returns 'incoming' and leaves the request for the user to accept on purpose
-- with respond_friend_request, so every friendship is one request plus one
-- Accept by the person who was asked.
--
-- Returns 'requested', 'incoming', 'already_requested' or 'already_friends'.
create or replace function public.send_friend_request(target uuid)
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
    return 'incoming';
  end if;

  insert into public.friendships (requester, addressee) values (me, target);
  return 'requested';
end;
$$;
