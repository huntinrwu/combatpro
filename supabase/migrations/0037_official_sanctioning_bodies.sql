-- CombatPro — officials ↔ sanctioning bodies join table.
--
-- Replaces (and complements) the free-text `officials.certifications`
-- array. That column stays for third-party certs (USA Boxing Level 2,
-- CPR certification, etc.) but the SB relationship becomes a real
-- linked record so both sides of the graph can be walked.

create table if not exists public.official_sanctioning_bodies (
  id uuid primary key default uuid_generate_v4(),
  official_id uuid not null references public.officials(id) on delete cascade,
  sanctioning_body_id uuid not null references public.sanctioning_bodies(id) on delete cascade,
  status text not null default 'active',        -- active | inactive | suspended
  level text,                                    -- 'Level 1', 'Senior', etc. (free text)
  certified_since date,
  expires_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (official_id, sanctioning_body_id)
);

create index if not exists osb_official_idx
  on public.official_sanctioning_bodies(official_id);
create index if not exists osb_body_idx
  on public.official_sanctioning_bodies(sanctioning_body_id);
create index if not exists osb_status_idx
  on public.official_sanctioning_bodies(status);

alter table public.official_sanctioning_bodies enable row level security;

-- Everyone signed-in can read (the graph is not sensitive; downstream
-- pages already surface both officials and SBs publicly to logged-in users).
drop policy if exists "osb: authenticated read" on public.official_sanctioning_bodies;
create policy "osb: authenticated read" on public.official_sanctioning_bodies
  for select using (auth.role() = 'authenticated');

-- Staff can create / update / delete links.
drop policy if exists "osb: staff manage" on public.official_sanctioning_bodies;
create policy "osb: staff manage" on public.official_sanctioning_bodies
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and (p.is_staff or p.is_admin))
  );
