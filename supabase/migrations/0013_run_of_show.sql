-- CombatPro — run-of-show additions.
--
-- Adds a freeform `scheduled_start_time` to bouts (a human-typed cue like
-- "7:30 PM" — kept as text so ringside can also write "20:00" or "after
-- intermission" without validation friction) and an `events.current_bout_id`
-- pointer that ringside toggles as the card progresses. Only one bout can be
-- LIVE per event at a time — enforced by the single-column pointer, not a
-- join. On delete the pointer clears, so removing the current bout is safe.

do $$
begin
  alter table public.bouts add column scheduled_start_time text;
exception when duplicate_column then null;
end $$;

do $$
begin
  alter table public.events
    add column current_bout_id uuid references public.bouts(id) on delete set null;
exception when duplicate_column then null;
end $$;

create index if not exists events_current_bout_id_idx
  on public.events(current_bout_id);
