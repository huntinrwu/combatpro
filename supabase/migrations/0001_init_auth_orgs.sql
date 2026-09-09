-- CombatPro — M0 schema: profiles, orgs, memberships
-- Apply via Supabase SQL Editor.

create extension if not exists "uuid-ossp";

-- profiles: 1:1 with auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- orgs: tenants. Two flavors — promotion vs. sanctioning body.
do $$ begin
  create type org_type as enum ('promotion', 'sanctioning_body');
exception when duplicate_object then null; end $$;

do $$ begin
  create type org_plan as enum ('trial', 'active', 'past_due', 'canceled');
exception when duplicate_object then null; end $$;

create table if not exists public.orgs (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  type org_type not null,
  state text,                          -- USPS 2-letter, e.g. 'FL'
  plan org_plan not null default 'trial',
  stripe_customer_id text,
  stripe_subscription_id text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orgs_type_idx on public.orgs(type);
create index if not exists orgs_state_idx on public.orgs(state);

-- memberships: user ↔ org with role
do $$ begin
  create type member_role as enum (
    'owner',       -- billing + everything
    'admin',       -- everything except billing
    'official',    -- event/bout management, no billing
    'judge',       -- live scoring only
    'doctor',      -- medical clearance only
    'fighter'      -- own profile + own docs
  );
exception when duplicate_object then null; end $$;

create table if not exists public.memberships (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role member_role not null,
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index if not exists memberships_user_idx on public.memberships(user_id);
create index if not exists memberships_org_idx on public.memberships(org_id);

-- helper: is current user a member of org (any role)
create or replace function public.is_member(_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where org_id = _org_id and user_id = auth.uid()
  );
$$;

-- helper: does current user have one of the given roles in org
create or replace function public.has_role(_org_id uuid, _roles member_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where org_id = _org_id
      and user_id = auth.uid()
      and role = any(_roles)
  );
$$;

-- updated_at triggers
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_updated on public.profiles;
create trigger profiles_updated before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists orgs_updated on public.orgs;
create trigger orgs_updated before update on public.orgs
  for each row execute function public.touch_updated_at();

-- RLS
alter table public.profiles enable row level security;
alter table public.orgs enable row level security;
alter table public.memberships enable row level security;

-- profiles: users read their own; anyone in a shared org can read too (for name/avatar in UI)
drop policy if exists "profiles: self read" on public.profiles;
create policy "profiles: self read" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "profiles: shared-org read" on public.profiles;
create policy "profiles: shared-org read" on public.profiles
  for select using (
    exists (
      select 1 from public.memberships m1
      join public.memberships m2 on m2.org_id = m1.org_id
      where m1.user_id = auth.uid() and m2.user_id = profiles.id
    )
  );

drop policy if exists "profiles: self update" on public.profiles;
create policy "profiles: self update" on public.profiles
  for update using (id = auth.uid());

-- orgs: readable by any member; only owner/admin can update
drop policy if exists "orgs: member read" on public.orgs;
create policy "orgs: member read" on public.orgs
  for select using (public.is_member(id));

drop policy if exists "orgs: admin update" on public.orgs;
create policy "orgs: admin update" on public.orgs
  for update using (public.has_role(id, array['owner','admin']::member_role[]));

drop policy if exists "orgs: authenticated insert" on public.orgs;
create policy "orgs: authenticated insert" on public.orgs
  for insert with check (auth.uid() is not null and created_by = auth.uid());

-- memberships: readable by anyone in the same org; owner/admin can write
drop policy if exists "memberships: member read" on public.memberships;
create policy "memberships: member read" on public.memberships
  for select using (public.is_member(org_id));

drop policy if exists "memberships: self insert on org create" on public.memberships;
create policy "memberships: self insert on org create" on public.memberships
  for insert with check (user_id = auth.uid());

drop policy if exists "memberships: admin manage" on public.memberships;
create policy "memberships: admin manage" on public.memberships
  for all using (public.has_role(org_id, array['owner','admin']::member_role[]))
  with check (public.has_role(org_id, array['owner','admin']::member_role[]));
