-- CombatPro — realtime updates on the public event page.
-- Anon subscribers to /e/[slug] need to know when bouts get results or the
-- event's current_bout_id pointer moves. Mirrors the pattern already in
-- 0003_assignments_scorecards.sql for bout_scorecards.

do $$ begin
  alter publication supabase_realtime add table public.bouts;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.events;
exception when duplicate_object then null; end $$;

alter table public.bouts enable row level security;
alter table public.events enable row level security;

-- Permissive public read — matches the POC data-access model (writes still
-- go through service-role via db(), which bypasses RLS).
drop policy if exists "bouts: public read" on public.bouts;
create policy "bouts: public read" on public.bouts for select using (true);

drop policy if exists "events: public read" on public.events;
create policy "events: public read" on public.events for select using (true);
