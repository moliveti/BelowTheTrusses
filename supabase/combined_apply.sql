-- Below the Trusses — initial schema
-- Mirrors docs/02_DATA_MODEL.md. Enums are modeled as text + CHECK rather than
-- native Postgres ENUM types so values can be extended later with a simple
-- constraint migration instead of ALTER TYPE.

create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- profiles (thin wrapper around auth.users)
-- ---------------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'owner' check (role in ('owner', 'staff', 'subcontractor')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- New Supabase Auth users (invited by the owner — no public signup) get a
-- profile row automatically. Role defaults to 'owner' since v1 only invites
-- the owner and Amy Oliveti, both full-access; set role manually to
-- 'subcontractor' when Phase 4 invites limited-access users.
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- lookup / settings tables
-- ---------------------------------------------------------------------------

create table pipeline_stages (
  stage text primary key,
  default_probability numeric not null check (default_probability >= 0 and default_probability <= 1),
  sort_order int not null,
  updated_at timestamptz not null default now()
);

create trigger pipeline_stages_set_updated_at
  before update on pipeline_stages
  for each row execute function set_updated_at();

create table rate_settings (
  id uuid primary key default gen_random_uuid(),
  commercial_hourly_rate numeric not null default 120,
  residential_hourly_rate numeric not null default 200,
  residential_addon_hourly_rate numeric not null default 200,
  effective_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger rate_settings_set_updated_at
  before update on rate_settings
  for each row execute function set_updated_at();

create table tax_settings (
  id uuid primary key default gen_random_uuid(),
  service_tax_rate numeric not null default 0.30,
  furniture_tax_rate numeric not null default 0.00,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger tax_settings_set_updated_at
  before update on tax_settings
  for each row execute function set_updated_at();

create table scope_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null check (category in ('residential', 'commercial')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger scope_tags_set_updated_at
  before update on scope_tags
  for each row execute function set_updated_at();

create table referral_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  type text not null check (type in ('Past Client', 'Realtor', 'Vendor', 'Other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger referral_sources_set_updated_at
  before update on referral_sources
  for each row execute function set_updated_at();

create table subcontractors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  specialty text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subcontractors_set_updated_at
  before update on subcontractors
  for each row execute function set_updated_at();

create table milestone_templates (
  id uuid primary key default gen_random_uuid(),
  project_type text not null check (project_type in ('Residential', 'Commercial', 'Furniture')),
  name text not null,
  sequence_order int not null,
  percent_of_total numeric not null check (percent_of_total >= 0 and percent_of_total <= 1),
  offset_days int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger milestone_templates_set_updated_at
  before update on milestone_templates
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- clients / projects / milestones
-- ---------------------------------------------------------------------------

create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger clients_set_updated_at
  before update on clients
  for each row execute function set_updated_at();

create table projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete restrict,
  name text not null,
  type text not null check (type in ('Residential', 'Commercial', 'Furniture')),
  state text,
  referral_source_id uuid references referral_sources(id) on delete set null,
  pipeline_stage text not null default 'Signed' references pipeline_stages(stage),
  probability_override numeric check (probability_override is null or (probability_override >= 0 and probability_override <= 1)),
  contract_signed_date date,
  contract_value numeric,
  start_date date,
  target_completion_date date,
  actual_completion_date date,
  billing_method text not null check (billing_method in ('Fixed Fee', 'Hourly', 'Commission')),
  hourly_rate numeric,
  fixed_fee_amount numeric,
  addon_hours numeric,
  addon_hourly_rate numeric,
  furniture_commission_rate numeric,
  furniture_sale_total numeric,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, name)
);

create index projects_client_id_idx on projects(client_id);
create index projects_referral_source_id_idx on projects(referral_source_id);
create index projects_pipeline_stage_idx on projects(pipeline_stage);
create index projects_contract_signed_date_idx on projects(contract_signed_date);

create trigger projects_set_updated_at
  before update on projects
  for each row execute function set_updated_at();

create table milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  sequence_order int not null default 1,
  due_date date,
  amount_due numeric,
  paid_date date,
  amount_paid numeric,
  status text not null default 'Pending' check (status in ('Pending', 'Invoiced', 'Paid', 'Overdue')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, due_date, name)
);

create index milestones_project_id_idx on milestones(project_id);
create index milestones_paid_date_idx on milestones(paid_date);

create trigger milestones_set_updated_at
  before update on milestones
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- join tables
-- ---------------------------------------------------------------------------

create table project_subcontractors (
  project_id uuid not null references projects(id) on delete cascade,
  subcontractor_id uuid not null references subcontractors(id) on delete cascade,
  role_notes text,
  primary key (project_id, subcontractor_id)
);

create table subcontractor_hours (
  id uuid primary key default gen_random_uuid(),
  subcontractor_id uuid not null references subcontractors(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  week_start_date date not null,
  hours numeric not null check (hours >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subcontractor_id, project_id, week_start_date)
);

create trigger subcontractor_hours_set_updated_at
  before update on subcontractor_hours
  for each row execute function set_updated_at();

create table project_scope_tags (
  project_id uuid not null references projects(id) on delete cascade,
  scope_tag_id uuid not null references scope_tags(id) on delete cascade,
  amount numeric,
  primary key (project_id, scope_tag_id)
);

-- ---------------------------------------------------------------------------
-- SOW sent / lost pipeline
-- ---------------------------------------------------------------------------

create table sow_sent (
  id uuid primary key default gen_random_uuid(),
  date_sent date,
  prospect_name text not null,
  proposed_fee numeric,
  status text not null default 'Open' check (status in ('Open', 'On Hold', 'No Response', 'Declined', 'Converted')),
  notes text,
  converted_project_id uuid references projects(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sow_sent_status_idx on sow_sent(status);

create trigger sow_sent_set_updated_at
  before update on sow_sent
  for each row execute function set_updated_at();
-- Row Level Security
-- v1 access model: any authenticated user whose profile role is 'owner' or
-- 'staff' has full read/write access to all business data (per PRD 2 — the
-- owner and Amy Oliveti both get full access). 'subcontractor' role exists
-- in the schema now but has no policies yet — Phase 4 adds scoped policies
-- (their own subcontractor_hours + assigned projects only) when that access
-- tier ships.

create or replace function is_owner_or_staff()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('owner', 'staff')
  );
$$ language sql stable security definer set search_path = public;

alter table profiles enable row level security;
alter table pipeline_stages enable row level security;
alter table rate_settings enable row level security;
alter table tax_settings enable row level security;
alter table scope_tags enable row level security;
alter table referral_sources enable row level security;
alter table subcontractors enable row level security;
alter table milestone_templates enable row level security;
alter table clients enable row level security;
alter table projects enable row level security;
alter table milestones enable row level security;
alter table project_subcontractors enable row level security;
alter table subcontractor_hours enable row level security;
alter table project_scope_tags enable row level security;
alter table sow_sent enable row level security;

-- profiles: everyone authenticated can see the roster (for assignment UI);
-- only owner/staff can modify roles.
create policy "profiles_select_authenticated" on profiles
  for select to authenticated using (true);
create policy "profiles_write_owner_staff" on profiles
  for all to authenticated using (is_owner_or_staff()) with check (is_owner_or_staff());

-- Business tables: full CRUD for owner/staff.
create policy "pipeline_stages_owner_staff" on pipeline_stages
  for all to authenticated using (is_owner_or_staff()) with check (is_owner_or_staff());
create policy "rate_settings_owner_staff" on rate_settings
  for all to authenticated using (is_owner_or_staff()) with check (is_owner_or_staff());
create policy "tax_settings_owner_staff" on tax_settings
  for all to authenticated using (is_owner_or_staff()) with check (is_owner_or_staff());
create policy "scope_tags_owner_staff" on scope_tags
  for all to authenticated using (is_owner_or_staff()) with check (is_owner_or_staff());
create policy "referral_sources_owner_staff" on referral_sources
  for all to authenticated using (is_owner_or_staff()) with check (is_owner_or_staff());
create policy "subcontractors_owner_staff" on subcontractors
  for all to authenticated using (is_owner_or_staff()) with check (is_owner_or_staff());
create policy "milestone_templates_owner_staff" on milestone_templates
  for all to authenticated using (is_owner_or_staff()) with check (is_owner_or_staff());
create policy "clients_owner_staff" on clients
  for all to authenticated using (is_owner_or_staff()) with check (is_owner_or_staff());
create policy "projects_owner_staff" on projects
  for all to authenticated using (is_owner_or_staff()) with check (is_owner_or_staff());
create policy "milestones_owner_staff" on milestones
  for all to authenticated using (is_owner_or_staff()) with check (is_owner_or_staff());
create policy "project_subcontractors_owner_staff" on project_subcontractors
  for all to authenticated using (is_owner_or_staff()) with check (is_owner_or_staff());
create policy "subcontractor_hours_owner_staff" on subcontractor_hours
  for all to authenticated using (is_owner_or_staff()) with check (is_owner_or_staff());
create policy "project_scope_tags_owner_staff" on project_scope_tags
  for all to authenticated using (is_owner_or_staff()) with check (is_owner_or_staff());
create policy "sow_sent_owner_staff" on sow_sent
  for all to authenticated using (is_owner_or_staff()) with check (is_owner_or_staff());
-- Seed / reference data per docs/02_DATA_MODEL.md

insert into pipeline_stages (stage, default_probability, sort_order) values
  ('Lead', 0.10, 1),
  ('SOW Sent', 0.25, 2),
  ('Verbal', 0.60, 3),
  ('Signed', 1.00, 4),
  ('Lost', 0.00, 5)
on conflict (stage) do nothing;

insert into tax_settings (service_tax_rate, furniture_tax_rate)
select 0.30, 0.00
where not exists (select 1 from tax_settings);

insert into rate_settings (commercial_hourly_rate, residential_hourly_rate, residential_addon_hourly_rate, effective_date)
select 120, 200, 200, current_date
where not exists (select 1 from rate_settings);

insert into subcontractors (name, specialty) values
  ('Mariano Oliveti', 'Commercial projects'),
  ('Rachel Roberts', 'Plans and finishes'),
  ('Lee Mccoy', 'Plans and renderings'),
  ('Rusty Ragsdale', 'Architect')
on conflict (name) do nothing;

insert into scope_tags (name, category) values
  ('Furniture and Accessories', 'residential'),
  ('Covered Porch', 'residential'),
  ('Sunroom', 'residential'),
  ('Backyard Design', 'residential'),
  ('Kitchen Remodel', 'residential'),
  ('Bathroom Remodel', 'residential'),
  ('Exterior Finishes', 'residential'),
  ('Interior Finishes', 'residential')
on conflict (name) do nothing;

-- Placeholders — confirmed with owner in docs/02_DATA_MODEL.md as the
-- starting breakdown; editable in-app once Phase 2/3 settings UI exists.
insert into milestone_templates (project_type, name, sequence_order, percent_of_total, offset_days) values
  ('Residential', 'Deposit', 1, 0.30, 0),
  ('Residential', 'Design Development', 2, 0.30, 30),
  ('Residential', 'Construction Documents', 3, 0.20, 60),
  ('Residential', 'Final / Install', 4, 0.20, 90),
  ('Furniture', 'Payment', 1, 1.00, 0);

-- A starting set of known referral relationships — the import script upserts
-- any additional names it finds in the Excel "(Name)" convention, defaulting
-- type to 'Other' for the owner to reclassify later.
insert into referral_sources (name, type) values
  ('Dantzler', 'Past Client'),
  ('Cyr', 'Past Client'),
  ('Garnet', 'Past Client'),
  ('Realtor', 'Realtor'),
  ('Generation Homes', 'Vendor')
on conflict (name) do nothing;
