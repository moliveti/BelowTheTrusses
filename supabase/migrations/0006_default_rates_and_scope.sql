-- Default hourly rates (so new assignments don't need the rate re-entered
-- every time), new scope categories, and percent-based scope entry.

-- ---------------------------------------------------------------------------
-- Default hourly rates
-- ---------------------------------------------------------------------------

alter table subcontractors add column default_hourly_rate numeric;

-- Per-project-type rate override — only Amy needs this today (Commercial vs
-- Residential), but it's general: any subcontractor can have a type-specific
-- rate that takes precedence over their flat default_hourly_rate.
create table subcontractor_type_rates (
  subcontractor_id uuid not null references subcontractors(id) on delete cascade,
  project_type text not null check (project_type in ('Residential', 'Commercial', 'Furniture')),
  hourly_rate numeric not null,
  primary key (subcontractor_id, project_type)
);

alter table subcontractor_type_rates enable row level security;

create policy "subcontractor_type_rates_owner_staff" on subcontractor_type_rates
  for all to authenticated
  using (is_owner_or_staff())
  with check (is_owner_or_staff());

update subcontractors set default_hourly_rate = 80 where name in ('Mariano Oliveti', 'Rachel Roberts', 'Rusty Ragsdale');
update subcontractors set default_hourly_rate = 70 where name = 'Lee Mccoy';

insert into subcontractor_type_rates (subcontractor_id, project_type, hourly_rate)
select id, 'Commercial', 120 from subcontractors where name = 'Amy Oliveti'
on conflict do nothing;

insert into subcontractor_type_rates (subcontractor_id, project_type, hourly_rate)
select id, 'Residential', 200 from subcontractors where name = 'Amy Oliveti'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Scope tags
-- ---------------------------------------------------------------------------

insert into scope_tags (name, category) values
  ('Procurement Management', 'residential'),
  ('Covered Patio', 'residential'),
  ('Home Addition', 'residential'),
  ('Covered Garage', 'residential'),
  ('Permit Sets', 'residential')
on conflict (name) do nothing;

-- Scope is being captured as a percentage of the project's revenue rather
-- than a dollar figure (dollar amount often isn't known/fixed up front).
-- Keep `amount` for when a dollar figure IS known/derived; percent is the
-- primary entry field going forward.
alter table project_scope_tags add column percent_of_revenue numeric check (percent_of_revenue is null or (percent_of_revenue >= 0 and percent_of_revenue <= 1));
