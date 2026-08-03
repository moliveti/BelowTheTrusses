-- Contracted work / subcontractor hour-logging.
--
-- Supersedes the placeholder `subcontractor_hours` table from
-- 02_DATA_MODEL.md (one row per subcontractor+project+week) with the
-- actual workflow: subcontractors currently email a weekly breakdown of
-- hours worked per day, per project, per task (e.g. "10 hrs elevations,
-- Carlitos House; 3.5 hrs furniture counts, RGB government building"),
-- in 15-minute increments. This table captures that directly instead of
-- pre-aggregating to a week, and a subcontractor logs it themselves via
-- their own login instead of emailing it in.

drop table if exists subcontractor_hours;

alter table subcontractors add column user_id uuid references auth.users(id) unique;

create table subcontractor_time_entries (
  id uuid primary key default gen_random_uuid(),
  subcontractor_id uuid not null references subcontractors(id) on delete cascade,
  project_id uuid not null references projects(id) on delete restrict,
  work_date date not null,
  hours numeric not null check (hours > 0 and hours <= 24 and (hours * 4) = floor(hours * 4 + 0.001)),
  work_description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subcontractor_time_entries_subcontractor_idx on subcontractor_time_entries(subcontractor_id);
create index subcontractor_time_entries_project_idx on subcontractor_time_entries(project_id);
create index subcontractor_time_entries_work_date_idx on subcontractor_time_entries(work_date);

create trigger subcontractor_time_entries_set_updated_at
  before update on subcontractor_time_entries
  for each row execute function set_updated_at();

alter table subcontractor_time_entries enable row level security;

-- Subcontractors may only touch their own entries; owner/staff see everything
-- (needed for invoicing).
create policy "time_entries_owner_staff" on subcontractor_time_entries
  for all to authenticated
  using (is_owner_or_staff())
  with check (is_owner_or_staff());

create policy "time_entries_own" on subcontractor_time_entries
  for all to authenticated
  using (
    exists (
      select 1 from subcontractors s
      where s.id = subcontractor_time_entries.subcontractor_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from subcontractors s
      where s.id = subcontractor_time_entries.subcontractor_id and s.user_id = auth.uid()
    )
  );

-- Subcontractors need to know their own subcontractor_id and which
-- projects they're allowed to log against, without seeing the financial
-- columns on `projects` (contract_value, billing_method, rates, etc.) or
-- other subcontractors' assignments. Both views are created with default
-- (definer-side) privileges so they bypass RLS on the underlying tables
-- and instead do their own auth.uid()-scoped filtering — the standard
-- Supabase pattern for exposing a safe column subset to a limited role.

create view my_subcontractor as
select id, name, specialty
from subcontractors
where user_id = auth.uid();

grant select on my_subcontractor to authenticated;

create view my_assigned_projects as
select p.id, p.name, p.type
from projects p
join project_subcontractors ps on ps.project_id = p.id
join subcontractors s on s.id = ps.subcontractor_id
where s.user_id = auth.uid();

grant select on my_assigned_projects to authenticated;
