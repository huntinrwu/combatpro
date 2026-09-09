-- CombatPro — ruleset PDF versions + private Storage bucket.
--
-- Every ruleset is now backed by one or more PDF versions. The most recent
-- upload is the source of truth (is_current = true); older uploads stay in
-- history for reference. The extracted_json column captures what the LLM
-- pulled out at upload time so we can re-hydrate parsed fields per version
-- (useful for diffing old vs new rules).

create table if not exists public.ruleset_pdf_versions (
  id uuid primary key default uuid_generate_v4(),
  ruleset_id uuid not null references public.rulesets(id) on delete cascade,
  storage_path text not null,
  original_filename text,
  file_size_bytes integer,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid references public.profiles(id) on delete set null,
  extracted_json jsonb,
  extraction_error text,
  is_current boolean not null default false
);

create index if not exists ruleset_pdfs_ruleset_idx on public.ruleset_pdf_versions(ruleset_id);
create index if not exists ruleset_pdfs_current_idx
  on public.ruleset_pdf_versions(ruleset_id, is_current);

-- Private bucket. App reads via short-lived signed URLs from server actions;
-- direct fetches are denied.
insert into storage.buckets (id, name, public)
  values ('ruleset-pdfs', 'ruleset-pdfs', false)
  on conflict (id) do nothing;

-- No storage.objects policies — app uses the service-role client for
-- uploads/downloads (bypasses RLS). If we open the app to non-staff writers
-- later, add per-user object policies here.
