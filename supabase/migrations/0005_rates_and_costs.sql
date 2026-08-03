-- Rate + allocated-hours capture per assignment, needed to compute
-- cost (hours logged x rate) per subcontractor and per project for
-- invoicing/budget tracking.

alter table project_subcontractors
  add column hourly_rate numeric,
  add column allocated_hours numeric;

-- Amy is company owner/principal, not a subcontractor, but she needs
-- the same hour-logging + rate-tracking mechanism (at her own premium
-- rate) for weeks she works billable hours. Reusing `subcontractors`
-- avoids a parallel table for what is otherwise identical machinery;
-- her row is linked to her existing auth account via a follow-up
-- update (not hardcoded here, since user ids are environment-specific).
insert into subcontractors (name, specialty)
select 'Amy Oliveti', 'Owner / Principal'
where not exists (select 1 from subcontractors where name = 'Amy Oliveti');
