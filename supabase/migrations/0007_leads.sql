-- Lead intake, one step earlier in the funnel than sow_sent (a lead hasn't
-- necessarily had a proposal sent yet). A lead can convert forward into a
-- sow_sent row (proposal sent) and/or directly into a project.

create table leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  project_type text check (project_type in ('Residential', 'Commercial', 'Furniture')),
  state text,
  budget_range text,
  timeline text,
  referral_source_id uuid references referral_sources(id) on delete set null,
  notes text,
  status text not null default 'New' check (status in ('New', 'Contacted', 'Qualified', 'Converted', 'Lost')),
  last_contacted_date date,
  converted_sow_id uuid references sow_sent(id) on delete set null,
  converted_project_id uuid references projects(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_status_idx on leads(status);

create trigger leads_set_updated_at
  before update on leads
  for each row execute function set_updated_at();

alter table leads enable row level security;

create policy "leads_owner_staff" on leads
  for all to authenticated
  using (is_owner_or_staff())
  with check (is_owner_or_staff());
