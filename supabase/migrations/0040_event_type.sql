-- CombatPro — what kind of event this is. Null = not set yet (older events).
alter table public.events
  add column if not exists event_type text
  check (event_type in ('smoker', 'amateur_card', 'pro_card', 'tournament', 'other'));
