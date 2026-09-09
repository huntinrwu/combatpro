-- CombatPro — promotions registry (cross-tenant reference like gyms / sanctioning_bodies).
--
-- Promotions are the entities that host events. Some will also be paying
-- tenants (their own orgs row) — tenant_org_id links registry ↔ tenant when
-- that's true. Registry entries can exist without any org (e.g. a fighter's
-- prior promotion that isn't on CombatPro).
--
-- Approval workflow mirrors sanctioning_bodies: user-submitted rows land as
-- 'pending' and need staff verification. Staff/admin-created rows go
-- straight to 'approved'.

do $$ begin
  create type promotion_status as enum ('approved', 'pending', 'rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.promotions (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  abbreviation text,
  sports text[] not null default '{}',
  scope text not null default 'local',      -- local / regional / national / international
  home_state text,                           -- USPS 2-letter for US-based
  country text default 'US',
  city text,
  website text,
  contact_name text,
  contact_email text,
  contact_phone text,
  founded_year int,
  logo_url text,
  tenant_org_id uuid references public.orgs(id) on delete set null,
  status promotion_status not null default 'approved',
  submitted_by uuid references public.profiles(id) on delete set null,
  submitted_by_email text,
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists promotions_status_idx on public.promotions(status);
create index if not exists promotions_state_idx on public.promotions(home_state);
create index if not exists promotions_tenant_idx on public.promotions(tenant_org_id);

drop trigger if exists promotions_updated on public.promotions;
create trigger promotions_updated before update on public.promotions
  for each row execute function public.touch_updated_at();

-- Wire events → promotions. Keep free-text `promoter` for legacy/backfill
-- (same pattern as fighters.gym + fighters.gym_id).
alter table public.events
  add column if not exists promotion_id uuid references public.promotions(id) on delete set null;

create index if not exists events_promotion_idx on public.events(promotion_id);

-- Seed a few well-known promotions so demo data has something to link to.
insert into public.promotions (name, abbreviation, sports, scope, home_state, country, website, status)
values
  ('Ultimate Fighting Championship', 'UFC', array['mma'], 'international', 'NV', 'US', 'https://www.ufc.com/', 'approved'),
  ('Professional Fighters League', 'PFL', array['mma'], 'international', 'NY', 'US', 'https://www.pflmma.com/', 'approved'),
  ('Bellator MMA', 'Bellator', array['mma'], 'international', 'CA', 'US', 'https://www.bellator.com/', 'approved'),
  ('ONE Championship', 'ONE', array['mma','muay thai','kickboxing'], 'international', null, 'SG', 'https://www.onefc.com/', 'approved'),
  ('GLORY Kickboxing', 'GLORY', array['kickboxing'], 'international', null, 'NL', 'https://gloryworldseries.com/', 'approved'),
  ('Top Rank Boxing', 'Top Rank', array['boxing'], 'international', 'NV', 'US', 'https://www.toprank.com/', 'approved'),
  ('Premier Boxing Champions', 'PBC', array['boxing'], 'national', 'CA', 'US', 'https://www.premierboxingchampions.com/', 'approved'),
  ('Matchroom Boxing', 'Matchroom', array['boxing'], 'international', null, 'GB', 'https://www.matchroomboxing.com/', 'approved')
on conflict do nothing;
