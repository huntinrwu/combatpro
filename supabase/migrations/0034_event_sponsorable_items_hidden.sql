-- CombatPro — add a `hidden` flag to event_sponsorable_items so promoters can
-- hide built-in sponsorable items (Ring, Cage, VIP, etc.) or soft-remove a
-- custom item from their event without losing existing assignments.
--
-- A row in event_sponsorable_items whose `key` matches a built-in
-- SPONSORABLE_ITEMS enum value is treated by the app as a per-event override
-- for that built-in (custom label / hint / hidden state). Rows with novel
-- keys are pure custom items as before.

alter table public.event_sponsorable_items
  add column if not exists hidden boolean not null default false;

create index if not exists event_sponsorable_items_hidden_idx
  on public.event_sponsorable_items(event_id, hidden);
