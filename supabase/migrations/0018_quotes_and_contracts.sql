-- Quote -> Contract generation. Owner-only (Amy + Mariano), matching the
-- existing owner-only tier introduced for system_backups in 0014 (is_owner()
-- is reused here, not redefined).
--
-- Splits what ProjectKickoffPanel currently does as one step (at Signed
-- Contract) into two: a project is now created at quote time
-- (status='Quoted'), and its payment schedule (still just `milestones`
-- rows) is generated later at contract time. `projects.active` is untouched
-- -- it still means "ongoing vs closed work," orthogonal to this new
-- pre-signature status.

alter table projects add column status text check (status in ('Quoted', 'Contract Sent', 'Under Contract'));
update projects set status = 'Under Contract' where active = true;

-- ---------------------------------------------------------------------------
-- quotes
-- ---------------------------------------------------------------------------

create table quotes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete restrict,
  project_id uuid not null references projects(id) on delete restrict,
  project_type text not null check (project_type in ('Residential', 'Commercial', 'Furniture')),
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'superseded')),
  discount_type text check (discount_type in ('percent', 'fixed')),
  discount_value numeric,
  pm_hourly_rate numeric,
  pm_estimated_hours numeric,
  subtotal numeric not null default 0,
  total numeric not null default 0,
  pdf_storage_path text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quotes_lead_id_idx on quotes(lead_id);
create index quotes_project_id_idx on quotes(project_id);

create trigger quotes_set_updated_at
  before update on quotes
  for each row execute function set_updated_at();

create table quote_line_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  section text not null check (section in ('Construction Documents', 'Renderings & Presentations', 'FFE', 'Construction Administration', 'Basic Services')),
  task_name text not null,
  hours numeric not null default 0,
  rate numeric not null default 200,
  amount numeric not null default 0,
  sequence_order int not null default 1
);

create index quote_line_items_quote_id_idx on quote_line_items(quote_id);

-- ---------------------------------------------------------------------------
-- selection catalog (reference data, seeded from the "List of Selections
-- from Scope" tab) + which items a given quote pulled in
-- ---------------------------------------------------------------------------

create table selection_catalog (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  item_name text not null,
  default_hours numeric not null default 1,
  sequence_order int not null default 1,
  active boolean not null default true
);

create table quote_selections (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  catalog_item_id uuid not null references selection_catalog(id) on delete restrict,
  qty numeric not null default 1,
  hours numeric not null default 0
);

create index quote_selections_quote_id_idx on quote_selections(quote_id);

insert into selection_catalog (category, item_name, default_hours, sequence_order) values
  ('Kitchen', 'Cabinet Design', 1, 1),
  ('Kitchen', 'Cabinet Finish', 1, 2),
  ('Kitchen', 'Countertops', 1, 3),
  ('Kitchen', 'Hardware', 1, 4),
  ('Kitchen', 'Sink', 1, 5),
  ('Kitchen', 'Faucet', 1, 6),
  ('Kitchen', 'Backsplash', 1, 7),
  ('Kitchen', 'Water Filler', 1, 8),
  ('Appliances', 'Refrigerator', 1, 9),
  ('Appliances', 'Dishwasher', 1, 10),
  ('Appliances', 'Oven', 1, 11),
  ('Appliances', 'Double Oven', 1, 12),
  ('Appliances', 'Microwave', 1, 13),
  ('Appliances', 'Hood', 1, 14),
  ('Bathroom', 'Toilet', 1, 15),
  ('Bathroom', 'Cabinet Design', 1, 16),
  ('Bathroom', 'Cabinet Finish', 1, 17),
  ('Bathroom', 'Countertop', 1, 18),
  ('Bathroom', 'Sink', 1, 19),
  ('Bathroom', 'Faucet', 1, 20),
  ('Bathroom', 'Mirror', 1, 21),
  ('Bathroom', 'Sconces', 1, 22),
  ('Bathroom', 'Tub Faucet', 1, 23),
  ('Bathroom', 'Shower Head', 1, 24),
  ('Bathroom', 'Drain', 1, 25),
  ('Bathroom', 'Bathroom Floor', 1, 26),
  ('Bathroom', 'Shower Floor', 1, 27),
  ('Bathroom', 'Shower Surround + Accent', 1, 28),
  ('Paint', 'Typical Walls', 1, 29),
  ('Paint', 'Trim', 1, 30),
  ('Paint', 'Accent', 1, 31),
  ('Paint', 'Ceiling', 1, 32),
  ('Flooring', 'Typical', 1, 33),
  ('Flooring', 'Accent', 1, 34),
  ('Lighting', 'Kitchen Pendants', 1, 35),
  ('Lighting', 'Chandeliers', 1, 36);

-- ---------------------------------------------------------------------------
-- contracts
-- ---------------------------------------------------------------------------

create table contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete restrict,
  quote_id uuid references quotes(id) on delete set null,
  template_variant text not null check (template_variant in ('Residential', 'Commercial', 'Furniture')),
  billing_method text not null check (billing_method in ('Fixed Fee', 'Hourly', 'Commission')),
  discount_type text check (discount_type in ('percent', 'fixed')),
  discount_value numeric,
  pm_hourly_rate numeric,
  pm_estimated_hours numeric,
  design_fee_total numeric,
  payment3_amount numeric,
  payment4_amount numeric,
  status text not null default 'draft' check (status in ('draft', 'sent', 'signed')),
  pdf_storage_path text,
  sent_at timestamptz,
  signed_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contracts_project_id_idx on contracts(project_id);

create trigger contracts_set_updated_at
  before update on contracts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS -- owner-only (Amy + Mariano), reusing is_owner() from 0014
-- ---------------------------------------------------------------------------

alter table quotes enable row level security;
alter table quote_line_items enable row level security;
alter table selection_catalog enable row level security;
alter table quote_selections enable row level security;
alter table contracts enable row level security;

create policy "quotes_owner" on quotes
  for all to authenticated using (is_owner()) with check (is_owner());
create policy "quote_line_items_owner" on quote_line_items
  for all to authenticated using (is_owner()) with check (is_owner());
create policy "selection_catalog_owner" on selection_catalog
  for all to authenticated using (is_owner()) with check (is_owner());
create policy "quote_selections_owner" on quote_selections
  for all to authenticated using (is_owner()) with check (is_owner());
create policy "contracts_owner" on contracts
  for all to authenticated using (is_owner()) with check (is_owner());

-- ---------------------------------------------------------------------------
-- Storage access -- generated quote/contract PDFs. Create a private bucket
-- named "documents" via the Supabase dashboard Storage UI before applying
-- this migration (same manual step as "system-backups" in 0014); these are
-- just the RLS policies on storage.objects for it.
-- ---------------------------------------------------------------------------

create policy "documents_bucket_owner_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and is_owner());

create policy "documents_bucket_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and is_owner());
