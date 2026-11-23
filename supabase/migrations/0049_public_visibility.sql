-- CombatPro — per event, the promoter chooses whether the public can see the
-- list of registered fighters and the bout list (fight card and tentative
-- matchups). Both default to shown, which is how events behaved before.
alter table public.events
  add column if not exists public_roster boolean not null default true,
  add column if not exists public_bouts boolean not null default true;

-- A hidden bout list must also be unreadable with the public key, not just
-- left off the page. Signed-in users keep live updates (control room, scoring).
drop policy if exists "bouts: public read" on public.bouts;
create policy "bouts: public read" on public.bouts
  for select using (
    exists (
      select 1 from public.events e
      where e.id = bouts.event_id
        and e.status in ('scheduled', 'complete')
        and (e.public_bouts or auth.role() = 'authenticated')
    )
  );
