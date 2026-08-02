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
