-- CombatPro — canonical person entity
--
-- A single human can appear in the platform in many roles (fighter,
-- promoter, gym owner, judge, official). They all share one identity —
-- `persons`. Every human gets a public `person_no` (sequential from 10000)
-- that surfaces as "CP-10000" in the UI.
--
-- Backfill order matters: profiles first (auth-linked, best data), then
-- fighters, officials, and promotions. Rows are dedup'd on lower(email).

-- 1. persons table + sequence

create sequence if not exists public.persons_person_no_seq start 10000;

create table if not exists public.persons (
  id uuid primary key default uuid_generate_v4(),
  person_no int not null unique default nextval('public.persons_person_no_seq'),
  full_name text not null,
  date_of_birth date,
  email text,
  phone text,
  avatar_url text,
  hometown text,
  nationality text,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists persons_email_lower_idx
  on public.persons (lower(email)) where email is not null;

create index if not exists persons_full_name_idx on public.persons (lower(full_name));

-- 2. Link columns on existing tables (nullable so rows survive migration)

alter table public.profiles
  add column if not exists person_id uuid references public.persons(id) on delete set null;

alter table public.fighters
  add column if not exists person_id uuid references public.persons(id) on delete set null;

alter table public.officials
  add column if not exists person_id uuid references public.persons(id) on delete set null;

alter table public.promotions
  add column if not exists contact_person_id uuid references public.persons(id) on delete set null;

create index if not exists profiles_person_idx on public.profiles(person_id);
create index if not exists fighters_person_idx on public.fighters(person_id);
create index if not exists officials_person_idx on public.officials(person_id);
create index if not exists promotions_contact_person_idx on public.promotions(contact_person_id);

-- 3. Backfill: profiles first (they have real auth emails and are the
-- most trustworthy signal of who is who).

do $$
declare
  r record;
  v_pid uuid;
begin
  for r in
    select * from public.profiles p
    where p.person_id is null
    order by p.created_at asc
  loop
    v_pid := null;
    if r.email is not null and r.email <> '' then
      select id into v_pid
      from public.persons
      where lower(email) = lower(r.email)
      limit 1;
    end if;

    if v_pid is null then
      insert into public.persons (full_name, email, avatar_url, auth_user_id, created_at)
      values (
        coalesce(nullif(r.full_name, ''), split_part(r.email, '@', 1)),
        nullif(r.email, ''),
        r.avatar_url,
        r.id,
        r.created_at
      )
      returning id into v_pid;
    else
      update public.persons
        set auth_user_id = coalesce(auth_user_id, r.id),
            avatar_url = coalesce(avatar_url, r.avatar_url)
        where id = v_pid;
    end if;

    update public.profiles set person_id = v_pid where id = r.id;
  end loop;
end $$;

-- 4. Backfill fighters — email match first, else create new person.

do $$
declare
  r record;
  v_pid uuid;
begin
  for r in
    select * from public.fighters f
    where f.person_id is null
    order by f.created_at asc
  loop
    v_pid := null;
    if r.contact_email is not null and r.contact_email <> '' then
      select id into v_pid
      from public.persons
      where lower(email) = lower(r.contact_email)
      limit 1;
    end if;

    if v_pid is null then
      insert into public.persons (full_name, email, phone, avatar_url, date_of_birth, hometown, nationality, created_at)
      values (
        r.full_name,
        nullif(r.contact_email, ''),
        r.contact_phone,
        r.photo_url,
        r.date_of_birth,
        r.hometown,
        r.nationality,
        r.created_at
      )
      returning id into v_pid;
    end if;

    update public.fighters set person_id = v_pid where id = r.id;
  end loop;
end $$;

-- 5. Backfill officials — email match first, else create new person.

do $$
declare
  r record;
  v_pid uuid;
begin
  for r in
    select * from public.officials o
    where o.person_id is null
    order by o.created_at asc
  loop
    v_pid := null;
    if r.contact_email is not null and r.contact_email <> '' then
      select id into v_pid
      from public.persons
      where lower(email) = lower(r.contact_email)
      limit 1;
    end if;

    if v_pid is null then
      insert into public.persons (full_name, email, phone, avatar_url, nationality, created_at)
      values (
        r.full_name,
        nullif(r.contact_email, ''),
        r.contact_phone,
        r.photo_url,
        r.home_state,
        r.created_at
      )
      returning id into v_pid;
    end if;

    update public.officials set person_id = v_pid where id = r.id;
  end loop;
end $$;

-- 6. Backfill promotion contacts (only when a contact_name or contact_email exists).

do $$
declare
  r record;
  v_pid uuid;
begin
  for r in
    select * from public.promotions p
    where p.contact_person_id is null
      and (coalesce(p.contact_email, '') <> '' or coalesce(p.contact_name, '') <> '')
    order by p.created_at asc
  loop
    v_pid := null;
    if r.contact_email is not null and r.contact_email <> '' then
      select id into v_pid
      from public.persons
      where lower(email) = lower(r.contact_email)
      limit 1;
    end if;

    if v_pid is null and r.contact_name is not null and r.contact_name <> '' then
      insert into public.persons (full_name, email, phone, created_at)
      values (
        r.contact_name,
        nullif(r.contact_email, ''),
        r.contact_phone,
        r.created_at
      )
      returning id into v_pid;
    end if;

    if v_pid is not null then
      update public.promotions set contact_person_id = v_pid where id = r.id;
    end if;
  end loop;
end $$;

-- 7. Signup trigger — creates a person alongside the profile. If a
-- person already exists with this email and isn't yet auth-linked, we
-- claim it (so someone typed in as a fighter first can later sign up
-- and adopt their existing person_no).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_staff boolean := lower(new.email) in ('huntinrwu@gmail.com');
  v_person_id uuid;
  v_full_name text := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );
begin
  select id into v_person_id
  from public.persons
  where lower(email) = lower(new.email) and auth_user_id is null
  limit 1;

  if v_person_id is not null then
    update public.persons
      set auth_user_id = new.id,
          full_name = coalesce(v_full_name, full_name),
          avatar_url = coalesce(new.raw_user_meta_data->>'avatar_url', avatar_url),
          updated_at = now()
      where id = v_person_id;
  else
    insert into public.persons (full_name, email, avatar_url, auth_user_id)
    values (
      v_full_name,
      new.email,
      new.raw_user_meta_data->>'avatar_url',
      new.id
    )
    returning id into v_person_id;
  end if;

  insert into public.profiles (id, email, full_name, avatar_url, is_staff, person_id)
  values (
    new.id,
    new.email,
    v_full_name,
    new.raw_user_meta_data->>'avatar_url',
    v_is_staff,
    v_person_id
  )
  on conflict (id) do update
    set is_staff = excluded.is_staff or public.profiles.is_staff,
        person_id = coalesce(public.profiles.person_id, excluded.person_id);
  return new;
end;
$$;

-- 8. Merge audit log

create table if not exists public.person_merges (
  id uuid primary key default uuid_generate_v4(),
  source_person_no int not null,
  source_full_name text,
  source_email text,
  target_person_id uuid not null references public.persons(id) on delete cascade,
  target_person_no int not null,
  merged_by uuid references public.profiles(id) on delete set null,
  merged_at timestamptz not null default now()
);

create index if not exists person_merges_target_idx on public.person_merges(target_person_id);

-- 9. Merge function — moves every FK reference from source to target,
-- inherits the auth link if target didn't have one, logs the merge, and
-- deletes the source person. Refuses if both persons have DIFFERENT
-- auth accounts (would need manual intervention).

create or replace function public.merge_persons(p_source uuid, p_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.persons;
  v_target public.persons;
begin
  if p_source = p_target then
    raise exception 'merge_persons: source and target are the same';
  end if;

  select * into v_source from public.persons where id = p_source;
  select * into v_target from public.persons where id = p_target;

  if v_source.id is null then
    raise exception 'merge_persons: source not found';
  end if;
  if v_target.id is null then
    raise exception 'merge_persons: target not found';
  end if;

  if v_source.auth_user_id is not null
     and v_target.auth_user_id is not null
     and v_source.auth_user_id <> v_target.auth_user_id then
    raise exception 'merge_persons: both persons are linked to different auth accounts';
  end if;

  -- Move FKs
  update public.profiles     set person_id         = p_target where person_id         = p_source;
  update public.fighters     set person_id         = p_target where person_id         = p_source;
  update public.officials    set person_id         = p_target where person_id         = p_source;
  update public.promotions   set contact_person_id = p_target where contact_person_id = p_source;

  -- Inherit auth link if target didn't have one
  if v_target.auth_user_id is null and v_source.auth_user_id is not null then
    update public.persons set auth_user_id = null where id = p_source;
    update public.persons set auth_user_id = v_source.auth_user_id where id = p_target;
  end if;

  -- Fill any gaps on target from source (name/email/phone/dob/etc. only
  -- overwrite when the target field is null).
  update public.persons
    set full_name     = coalesce(nullif(full_name, ''), v_source.full_name),
        email         = coalesce(email, v_source.email),
        phone         = coalesce(phone, v_source.phone),
        avatar_url    = coalesce(avatar_url, v_source.avatar_url),
        date_of_birth = coalesce(date_of_birth, v_source.date_of_birth),
        hometown      = coalesce(hometown, v_source.hometown),
        nationality   = coalesce(nationality, v_source.nationality),
        updated_at    = now()
    where id = p_target;

  insert into public.person_merges (
    source_person_no, source_full_name, source_email,
    target_person_id, target_person_no, merged_by
  )
  values (
    v_source.person_no, v_source.full_name, v_source.email,
    p_target, v_target.person_no, auth.uid()
  );

  delete from public.persons where id = p_source;
end;
$$;

-- 10. RLS on persons + merges — staff-manageable, self-readable.

alter table public.persons enable row level security;
alter table public.person_merges enable row level security;

drop policy if exists "persons: staff read" on public.persons;
create policy "persons: staff read" on public.persons
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_staff)
  );

drop policy if exists "persons: self read" on public.persons;
create policy "persons: self read" on public.persons
  for select using (auth_user_id = auth.uid());

drop policy if exists "persons: staff manage" on public.persons;
create policy "persons: staff manage" on public.persons
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_staff)
  );

drop policy if exists "person_merges: staff read" on public.person_merges;
create policy "person_merges: staff read" on public.person_merges
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_staff)
  );
