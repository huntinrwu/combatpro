-- CombatPro — platform roles, staff flag, gym approval workflow.
--
-- Model note: `member_role` (from 0001) is org-scoped (owner/admin of a specific
-- promotion/SB). `platform_role` here is account-scoped — what kind of person
-- someone is, independent of any org. A user has many role grants, each
-- separately approved by staff. `is_staff` on profiles is the platform admin
-- flag (CombatPro operators, not org admins).

do $$ begin
  create type platform_role as enum (
    'fighter',
    'coach',
    'gym_owner',
    'commission',
    'sanctioning_body',
    'official',
    'promoter'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type role_grant_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

-- Staff flag on profiles
do $$ begin
  alter table public.profiles
    add column is_staff boolean not null default false;
exception when duplicate_column then null; end $$;

-- Role grants: one row per (user, role). Staff review each.
create table if not exists public.user_role_grants (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role platform_role not null,
  status role_grant_status not null default 'pending',
  gym_id uuid references public.gyms(id) on delete set null,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  notes text,
  unique (user_id, role)
);

create index if not exists user_role_grants_user_idx on public.user_role_grants(user_id);
create index if not exists user_role_grants_status_idx on public.user_role_grants(status);
create index if not exists user_role_grants_role_idx on public.user_role_grants(role);

-- Gym approval — self-submitted gyms need staff review. Existing gyms default
-- to 'approved' so the current registry is not disrupted.
do $$ begin
  create type gym_approval_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.gyms
    add column approval_status gym_approval_status not null default 'approved';
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.gyms
    add column submitted_by uuid references public.profiles(id) on delete set null;
exception when duplicate_column then null; end $$;

create index if not exists gyms_approval_status_idx on public.gyms(approval_status);

-- Bootstrap staff seed — huntinrwu@gmail.com becomes staff the moment the auth
-- user is created. We can't reference an auth.users row that may not exist yet,
-- so we set the flag inside handle_new_user() on signup.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_staff boolean := lower(new.email) in ('huntinrwu@gmail.com');
begin
  insert into public.profiles (id, email, full_name, avatar_url, is_staff)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    v_is_staff
  )
  on conflict (id) do update
    set is_staff = excluded.is_staff or public.profiles.is_staff;
  return new;
end;
$$;

-- If the staff account already exists (e.g. they signed up before this
-- migration), backfill the flag.
update public.profiles
  set is_staff = true
  where lower(email) = 'huntinrwu@gmail.com';

-- RLS: role grants are self-readable + staff-manageable. Users can insert their
-- own pending grants (they can't self-approve — status defaults to pending and
-- staff-only updates flip it).
alter table public.user_role_grants enable row level security;

drop policy if exists "role_grants: self read" on public.user_role_grants;
create policy "role_grants: self read" on public.user_role_grants
  for select using (user_id = auth.uid());

drop policy if exists "role_grants: staff read" on public.user_role_grants;
create policy "role_grants: staff read" on public.user_role_grants
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_staff)
  );

drop policy if exists "role_grants: self insert pending" on public.user_role_grants;
create policy "role_grants: self insert pending" on public.user_role_grants
  for insert with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "role_grants: staff update" on public.user_role_grants;
create policy "role_grants: staff update" on public.user_role_grants
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_staff)
  );

-- Gyms: existing RLS is left as is (POC tables run through service-role client).
-- The approval column is enforced at the application layer for now — surfaces
-- filter `approval_status = 'approved'` unless staff is viewing.
