-- CombatPro — M0.5 POC schema: registry + fighters + officials + events + bouts
-- No RLS on these tables (POC only). RLS goes on when auth lands.

-- Commissions: reference registry of state/regional regulators (FSBC, NSAC, etc.)
create table if not exists public.commissions (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  abbreviation text not null,
  jurisdiction text not null,
  country text not null default 'US',
  state text,
  website text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists commissions_state_idx on public.commissions(state);

-- Sanctioning bodies: reference registry — some seeded, some submitted for review
create table if not exists public.sanctioning_bodies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  abbreviation text not null,
  sports text[] not null default '{}',
  scope text not null,
  headquarters text,
  website text,
  contact_email text,
  status text not null default 'approved',
  submitted_by_email text,
  submitted_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists sanctioning_bodies_status_idx on public.sanctioning_bodies(status);

-- Fighters: cross-org registry
create table if not exists public.fighters (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  nickname text,
  date_of_birth date,
  nationality text,
  gym text,
  hometown text,
  stance text,
  height_cm int,
  reach_cm int,
  weight_class text,
  primary_sport text not null,
  pro_wins int not null default 0,
  pro_losses int not null default 0,
  pro_draws int not null default 0,
  am_wins int not null default 0,
  am_losses int not null default 0,
  am_draws int not null default 0,
  photo_url text,
  contact_email text,
  contact_phone text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists fighters_sport_idx on public.fighters(primary_sport);
create index if not exists fighters_name_idx on public.fighters(full_name);

-- Officials: judges, referees, doctors, timekeepers, inspectors
create table if not exists public.officials (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  role text not null,
  sports text[] not null default '{}',
  home_state text,
  years_experience int,
  contact_email text,
  contact_phone text,
  certifications text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists officials_role_idx on public.officials(role);

-- Events
create table if not exists public.events (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  event_date date not null,
  venue text,
  city text,
  state text,
  country text default 'US',
  promoter text,
  primary_sport text not null,
  commission_id uuid references public.commissions(id) on delete set null,
  sanctioning_body_id uuid references public.sanctioning_bodies(id) on delete set null,
  status text not null default 'draft',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists events_date_idx on public.events(event_date);
create index if not exists events_status_idx on public.events(status);

-- Bouts
create table if not exists public.bouts (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references public.events(id) on delete cascade,
  bout_order int,
  sport text not null,
  weight_class text,
  contracted_weight_lbs numeric,
  rounds int,
  round_length_minutes numeric,
  scoring_mode text,
  red_corner_fighter_id uuid references public.fighters(id) on delete set null,
  blue_corner_fighter_id uuid references public.fighters(id) on delete set null,
  result text,
  method text,
  round_finished int,
  time_finished text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists bouts_event_idx on public.bouts(event_id);

-- Seed: commissions (US state athletic commissions Brandyn cares about first)
insert into public.commissions (name, abbreviation, jurisdiction, country, state, website)
values
  ('Florida State Boxing Commission', 'FSBC', 'Florida', 'US', 'FL', 'https://www.myfloridalicense.com/dbpr/pmw/'),
  ('California State Athletic Commission', 'CSAC-CA', 'California', 'US', 'CA', 'https://www.dca.ca.gov/csac/'),
  ('Nevada State Athletic Commission', 'NSAC', 'Nevada', 'US', 'NV', 'https://boxing.nv.gov/'),
  ('New York State Athletic Commission', 'NYSAC', 'New York', 'US', 'NY', 'https://dos.ny.gov/athletic-commission'),
  ('Texas Department of Licensing and Regulation — Combative Sports', 'TDLR-CS', 'Texas', 'US', 'TX', 'https://www.tdlr.texas.gov/combat/combat.htm')
on conflict do nothing;

-- Seed: sanctioning bodies (approved by default)
insert into public.sanctioning_bodies (name, abbreviation, sports, scope, headquarters, website, status)
values
  ('World Boxing Council', 'WBC', array['boxing'], 'international', 'Mexico City, Mexico', 'https://wbcboxing.com/', 'approved'),
  ('World Boxing Association', 'WBA', array['boxing'], 'international', 'Panama City, Panama', 'https://www.wbaboxing.com/', 'approved'),
  ('International Boxing Federation', 'IBF', array['boxing'], 'international', 'Springfield, NJ, USA', 'https://www.ibf-usba-boxing.com/', 'approved'),
  ('World Boxing Organization', 'WBO', array['boxing'], 'international', 'San Juan, Puerto Rico', 'https://www.wboboxing.com/', 'approved'),
  ('International Sport Karate & Kickboxing Association', 'ISKA', array['kickboxing', 'karate'], 'international', 'Gainesville, FL, USA', 'https://www.iska.com/', 'approved'),
  ('Combat Sports Athletic Commission', 'CSAC', array['boxing', 'mma', 'kickboxing'], 'regional', 'Florida, USA', null, 'approved'),
  ('Thai Boxing Association', 'TBA', array['muay thai'], 'international', 'Bangkok, Thailand', null, 'approved')
on conflict do nothing;
