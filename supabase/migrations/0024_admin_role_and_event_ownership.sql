-- CombatPro — split admin tier off from staff, and stamp event ownership.
--
-- `is_staff` = day-to-day platform staff (moderation, support). `is_admin` =
-- full platform admin (billing, role management, destructive ops). Admin
-- implies staff-tier bypass in application code, but the two flags are
-- independent so admin-only actions can be gated separately going forward.

do $$ begin
  alter table public.profiles
    add column is_admin boolean not null default false;
exception when duplicate_column then null; end $$;

create index if not exists profiles_is_admin_idx on public.profiles(is_admin) where is_admin;

-- Founder seed. Mirrors the staff seed from 0018 — huntinrwu@gmail.com is
-- both staff + admin on signup. Any future admin promotions go through
-- explicit staff action.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_staff boolean := lower(new.email) in ('huntinrwu@gmail.com');
  v_is_admin boolean := lower(new.email) in ('huntinrwu@gmail.com');
begin
  insert into public.profiles (id, email, full_name, avatar_url, is_staff, is_admin)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    v_is_staff,
    v_is_admin
  )
  on conflict (id) do update
    set is_staff = excluded.is_staff or public.profiles.is_staff,
        is_admin = excluded.is_admin or public.profiles.is_admin;
  return new;
end;
$$;

-- Backfill the founder if the row already exists.
update public.profiles
  set is_admin = true
  where lower(email) = 'huntinrwu@gmail.com';

-- Event ownership — stamps the creator so promoter-tier users can edit only
-- their own events. Staff/admin bypass this check at the app layer.
do $$ begin
  alter table public.events
    add column created_by uuid references public.profiles(id) on delete set null;
exception when duplicate_column then null; end $$;

create index if not exists events_created_by_idx on public.events(created_by);
