-- Record keeping for generated quote/contract PDFs. Until now each download
-- re-rendered the PDF from live data and overwrote the single stored file, so
-- an earlier version could never be pulled up again. Every generated PDF is
-- now kept as its own versioned file in the "documents" bucket, with one row
-- here per version. Owner-only (Amy + Mariano), same tier as quotes/contracts.

create table generated_documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('quote', 'contract')),
  project_id uuid not null references projects(id) on delete cascade,
  quote_id uuid references quotes(id) on delete set null,
  contract_id uuid references contracts(id) on delete set null,
  version int not null,
  storage_path text not null unique,
  -- Fingerprint of what the PDF contains, so an unchanged quote reuses its
  -- stored file instead of piling up identical versions.
  content_hash text,
  total numeric,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index generated_documents_project_idx on generated_documents(project_id, created_at desc);
create index generated_documents_quote_idx on generated_documents(quote_id);
create index generated_documents_contract_idx on generated_documents(contract_id);

alter table generated_documents enable row level security;

create policy "generated_documents_owner" on generated_documents
  for all to authenticated using (is_owner()) with check (is_owner());

-- Keep the PDFs that were already generated as version 1 of their quote or
-- contract, so they appear in the history too.
insert into generated_documents (kind, project_id, quote_id, version, storage_path, total, created_at)
select 'quote', q.project_id, q.id, 1, q.pdf_storage_path, q.total, q.updated_at
from quotes q
where q.pdf_storage_path is not null;

insert into generated_documents (kind, project_id, contract_id, version, storage_path, total, created_at)
select 'contract', c.project_id, c.id, 1, c.pdf_storage_path, c.design_fee_total, c.updated_at
from contracts c
where c.pdf_storage_path is not null;
