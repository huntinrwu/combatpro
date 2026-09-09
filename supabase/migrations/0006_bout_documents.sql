-- CombatPro — sanctioning documents (bout agreement + fight report).
-- PDFs are generated live from bout state; this table only tracks whether a
-- document has been formally filed with the sanctioning body (audit trail).
-- One row per (bout, kind); unique so mark-as-filed is idempotent.

create table if not exists public.bout_documents (
  id uuid primary key default uuid_generate_v4(),
  bout_id uuid not null references public.bouts(id) on delete cascade,
  kind text not null,
  filed_at timestamptz not null default now(),
  filed_by text,
  filed_with text,
  reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bout_id, kind)
);

do $$ begin
  alter table public.bout_documents
    add constraint bout_documents_kind_check check (kind in ('bout_agreement','fight_report'));
exception when duplicate_object then null; end $$;

create index if not exists bout_documents_bout_idx on public.bout_documents(bout_id);

create or replace function public.bout_documents_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists bout_documents_touch_trg on public.bout_documents;
create trigger bout_documents_touch_trg
  before update on public.bout_documents
  for each row execute function public.bout_documents_touch();
