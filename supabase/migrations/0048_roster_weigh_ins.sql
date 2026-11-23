-- CombatPro — weigh-ins belong to a fighter on an event's roster, not to a
-- bout: a fighter weighs in once, whether or not they have an opponent yet.
alter table public.event_fighters
  add column if not exists weigh_in_lbs numeric,
  add column if not exists weigh_in_at timestamptz,
  add column if not exists weigh_in_notes text;

-- Carry over weigh-ins already recorded against bouts.
update public.event_fighters ef
set weigh_in_lbs = c.weigh_in_lbs,
    weigh_in_at = c.weigh_in_at,
    weigh_in_notes = c.weigh_in_notes
from public.bout_fighter_checks c
join public.bouts b on b.id = c.bout_id
where c.weigh_in_lbs is not null
  and ef.weigh_in_lbs is null
  and b.event_id = ef.event_id
  and ef.fighter_id = case c.corner when 'red' then b.red_corner_fighter_id else b.blue_corner_fighter_id end;
