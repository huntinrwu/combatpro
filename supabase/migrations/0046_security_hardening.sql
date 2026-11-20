-- CombatPro — close privilege and exposure gaps found in the 2026-11 review.

-- 1. A signed-in user could update any column of their own profile row
--    through the API, including is_staff and is_admin. The app only ever
--    writes profiles with the service role, so users need no more than
--    their display fields.
revoke update on public.profiles from anon, authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

-- 2. Legacy org tables are unused by the app, but their policies let any
--    signed-in user add themselves to any org as owner.
drop policy if exists "memberships: self insert on org create" on public.memberships;
drop policy if exists "orgs: authenticated insert" on public.orgs;

-- 3. The public key could read every event and bout, drafts included. Only
--    what the public event page shows needs to be readable (and streamed
--    over Realtime): scheduled and completed events and their bouts.
drop policy if exists "events: public read" on public.events;
create policy "events: public read" on public.events
  for select using (status in ('scheduled', 'complete'));

drop policy if exists "bouts: public read" on public.bouts;
create policy "bouts: public read" on public.bouts
  for select using (
    exists (
      select 1 from public.events e
      where e.id = bouts.event_id and e.status in ('scheduled', 'complete')
    )
  );
