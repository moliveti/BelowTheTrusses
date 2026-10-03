-- Subcontractors need to see their own committed/allocated hours per
-- project (not just the project name) to know how much is left to work --
-- extends the existing security-definer view rather than exposing
-- project_subcontractors directly, which also carries hourly_rate (owner/
-- staff only).
create or replace view my_assigned_projects as
select p.id, p.name, p.type, ps.allocated_hours
from projects p
join project_subcontractors ps on ps.project_id = p.id
join subcontractors s on s.id = ps.subcontractor_id
where s.user_id = auth.uid();
