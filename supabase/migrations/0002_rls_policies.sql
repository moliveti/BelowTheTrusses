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
