-- CombatPro — what a fighter tells us when registering for an event:
-- gym, the weight class they want, their record, and how to reach them.
alter table public.event_registrations
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists gym_name text,
  add column if not exists weight_class text,
  add column if not exists wins int,
  add column if not exists losses int,
  add column if not exists draws int;
