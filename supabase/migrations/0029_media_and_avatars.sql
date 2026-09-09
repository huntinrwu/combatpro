-- CombatPro — unified public media bucket + logo/photo columns.
--
-- Consolidates entity images (sponsor logos, fighter photos, official
-- headshots, gym/promotion/SB/commission logos) into one bucket with
-- per-entity folder prefixes. Writes go through the service role from
-- a Next.js API route gated by auth, so no write policies on the bucket
-- itself. Public-read is fine — these images are brand marks + public
-- profile shots.
--
-- Adds logo/photo columns to entities that were missing them.

-- 1. Public media bucket.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = excluded.public;

do $$ begin
  drop policy if exists "media public read" on storage.objects;
  create policy "media public read"
    on storage.objects for select
    using (bucket_id = 'media');
end $$;

-- 2. Missing image columns.
alter table public.officials
  add column if not exists photo_url text;

alter table public.gyms
  add column if not exists logo_url text;

alter table public.sanctioning_bodies
  add column if not exists logo_url text;

alter table public.commissions
  add column if not exists logo_url text;
