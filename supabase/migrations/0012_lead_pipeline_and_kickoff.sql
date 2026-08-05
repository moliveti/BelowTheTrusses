-- Real sales pipeline for leads, replacing the placeholder enum (leads
-- table has zero real rows today, so this is a safe drop-and-replace),
-- plus named, multi-template milestone_templates so Residential and
-- Permit Set can coexist as separate starting points at project kickoff.

do $$
declare
  con_name text;
begin
  select con.conname into con_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'leads' and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%status%';
  if con_name is not null then
    execute format('alter table leads drop constraint %I', con_name);
  end if;
end $$;

alter table leads alter column status set default 'New Prospect';
alter table leads add constraint leads_status_check
  check (status in ('New Prospect', 'Quote Sent', 'Contract Submitted', 'Signed Contract', 'Lost', 'Business Not Materialized'));

alter table milestone_templates add column template_name text not null default 'Standard';

delete from milestone_templates;

insert into milestone_templates (project_type, template_name, name, sequence_order, percent_of_total, offset_days) values
  ('Residential', 'Standard', 'Day 1 of Signed Contract', 1, 0.25, 0),
  ('Residential', 'Standard', 'Construction Documents Sent to GC', 2, 0.25, 30),
  ('Residential', 'Standard', 'Electrical/Plumbing Walkthrough', 3, 0.25, 60),
  ('Residential', 'Standard', 'Final Punch', 4, 0.25, 90),
  ('Residential', 'Permit Set', 'Day 1', 1, 0.50, 0),
  ('Residential', 'Permit Set', 'Permit Issued', 2, 0.50, 30),
  ('Furniture', 'Standard', 'Payment', 1, 1.00, 0);
