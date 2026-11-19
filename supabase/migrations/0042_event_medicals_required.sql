-- CombatPro — whether an event requires fighter medicals. Smokers and
-- some amateur shows don't; when off, medical warnings and the medical
-- check-in gate are hidden for that event.
alter table public.events
  add column if not exists medicals_required boolean not null default true;
