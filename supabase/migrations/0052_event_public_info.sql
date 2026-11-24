-- CombatPro — what a promoter writes for the public event page: street
-- address, doors and start times, admission, ticket link and free text.
-- Kept as JSON so more public fields can be added without a schema change.
alter table public.events
  add column if not exists public_info jsonb not null default '{}'::jsonb;
