-- Officials: multi-role, active tracking.
--
-- `role` (single) → `roles` (multi). Real officials often hold multiple
-- credentials (referee + judge, judge + inspector, etc.) — forcing a single
-- role is a lie we no longer have to live with.
--
-- `years_experience` → replaced by `active_since` (date of first event
-- worked) + `is_active` toggle. Static year counts drift; asking someone to
-- keep them current across a whole registry is unrealistic.

do $$ begin
  alter table public.officials
    add column roles text[] not null default '{}';
exception when duplicate_column then null; end $$;

-- Backfill roles[] from the legacy single-role column.
update public.officials
  set roles = array[role]
  where role is not null and (roles is null or array_length(roles, 1) is null);

do $$ begin
  alter table public.officials
    add column active_since date;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.officials
    add column is_active boolean not null default true;
exception when duplicate_column then null; end $$;

-- Drop legacy columns after backfill.
alter table public.officials drop column if exists role;
alter table public.officials drop column if exists years_experience;
