-- CombatPro — public "register for event" sign-ups.
-- Anyone can submit their name from the public event page. A sign-up is only
-- a request: staff turn it into a roster entry (or dismiss it) from the
-- event's Fighters tab.
create table if not exists public.event_registrations (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references public.events(id) on delete cascade,
  full_name text not null,
  contact text,
  status text not null default 'pending'
    check (status in ('pending', 'added', 'dismissed')),
  -- Set when staff turn the sign-up into a roster entry.
  fighter_id uuid references public.fighters(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists event_registrations_event_idx
  on public.event_registrations(event_id);

-- Writes go through a server action using the service role; no policies, so
-- the public key cannot read who has signed up.
alter table public.event_registrations enable row level security;

-- Lets staff close sign-ups for an event without unpublishing it.
alter table public.events
  add column if not exists registration_open boolean not null default true;
