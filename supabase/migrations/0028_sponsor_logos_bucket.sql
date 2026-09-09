-- CombatPro — public storage bucket for sponsor logos.
--
-- Sponsors' marks are inherently public branding, so a public-read
-- bucket is fine. Uploads happen via the service-role admin client from
-- a Next.js server action gated by requireStaff/requireEventCreator, so
-- we don't need RLS to enforce write auth — the anon/authenticated
-- client can't write. Policies below are permissive-read only.

insert into storage.buckets (id, name, public)
values ('sponsor-logos', 'sponsor-logos', true)
on conflict (id) do update set public = excluded.public;

-- Public read for the bucket. Writes are performed by the service role
-- (which bypasses RLS entirely).
do $$ begin
  drop policy if exists "sponsor logos public read"
    on storage.objects;
  create policy "sponsor logos public read"
    on storage.objects for select
    using (bucket_id = 'sponsor-logos');
end $$;
