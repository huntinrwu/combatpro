-- CombatPro — per-event custom sponsorable items. Promoter can add items
-- unique to their event (venue signage, weigh-in backdrop, etc.). Items are
-- referenced by `key` (slugified label) which lands in event_sponsors.item_type
-- and event_sponsor_targets.item_type — those columns become opaque text
-- so we drop the fixed-catalog CHECK constraints they previously carried.

create table if not exists public.event_sponsorable_items (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references public.events(id) on delete cascade,
  key text not null,
  label text not null,
  hint text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (event_id, key)
);

create index if not exists event_sponsorable_items_event_idx
  on public.event_sponsorable_items(event_id);

alter table public.event_sponsors
  drop constraint if exists event_sponsors_item_type_check;

alter table public.event_sponsor_targets
  drop constraint if exists event_sponsor_targets_item_type_check;
