-- Client-level contact info, editable from the Clients detail page --
-- separate from a lead's own address, since one client can span many
-- leads/projects over time and should carry one canonical contact record.
alter table clients add column email text;
alter table clients add column phone text;
alter table clients add column address text;
alter table clients add column city text;
alter table clients add column state text;
alter table clients add column zip text;
