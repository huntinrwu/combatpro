-- CombatPro — weight class belongs to the event, not the fighter.
-- Fighters move up and down, so each roster entry records the class (and
-- whether they compete as pro or amateur) for that one event. The fighter's
-- profile class is derived from their most recent event.
alter table public.event_fighters
  add column if not exists weight_class text,
  add column if not exists competing_as text
    check (competing_as in ('pro', 'amateur'));

-- Per-event matchmaking rules (weight gap, experience gap, pro/am mixing,
-- same-gym). Empty object = app defaults.
alter table public.events
  add column if not exists matchmaking jsonb not null default '{}'::jsonb;

-- Backfill from bouts already on a card.
update public.event_fighters ef
set
  weight_class = coalesce(ef.weight_class, b.weight_class),
  competing_as = coalesce(ef.competing_as, b.bout_class)
from public.bouts b
where b.event_id = ef.event_id
  and ef.fighter_id in (b.red_corner_fighter_id, b.blue_corner_fighter_id)
  and (ef.weight_class is null or ef.competing_as is null);
