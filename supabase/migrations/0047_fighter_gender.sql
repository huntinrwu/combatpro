-- CombatPro — gender on fighters (used by matchmaking), and gender + date of
-- birth on public event sign-ups so new fighters arrive with both.
alter table public.fighters
  add column if not exists gender text check (gender in ('male', 'female'));

alter table public.event_registrations
  add column if not exists gender text check (gender in ('male', 'female')),
  add column if not exists date_of_birth date;
