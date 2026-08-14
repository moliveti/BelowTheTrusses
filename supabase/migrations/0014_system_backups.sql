-- Backup & Disaster Recovery metadata — Phase B proposal, NOT applied yet.
-- Stores only metadata about generated recovery packages; the archives
-- themselves live in a private Storage bucket (system-backups), never in
-- Postgres (no bytea archive storage). Additive; nothing existing changes.

create table system_backups (
  id uuid primary key default gen_random_uuid(),
  -- The Saturday (America/New_York) this backup belongs to, computed by the
  -- application — never inferred from created_at. See the cycle-calculation
  -- note in the accompanying assessment.
  backup_cycle_date date not null,
  backup_type text not null check (backup_type in ('scheduled', 'manual')),
  scheduled_for timestamptz,
  requested_at timestamptz not null default now(),
  requested_by uuid references profiles(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'generating', 'completed', 'failed')),
  storage_path text,
  filename text,
  size_bytes bigint,
  checksum text,
  database_included boolean not null default false,
  storage_included boolean not null default false,
  source_included boolean not null default false,
  git_commit text,
  migration_version text,
  error_summary text,
  downloaded_at timestamptz,
  downloaded_by uuid references profiles(id) on delete set null,
  verification_status text not null default 'not_verified' check (verification_status in ('not_verified', 'verified', 'failed')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index system_backups_cycle_idx on system_backups(backup_cycle_date);
create index system_backups_status_idx on system_backups(status);
create index system_backups_type_idx on system_backups(backup_type);

create trigger system_backups_set_updated_at
  before update on system_backups
  for each row execute function set_updated_at();

alter table system_backups enable row level security;

-- Backup archives contain essentially the entire company's data — narrower
-- than every other table in this app, which is owner-or-staff. This is the
-- first owner-only (not owner_or_staff) table, so it needs its own helper.
create or replace function is_owner()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'owner'
  );
$$ language sql stable security definer set search_path = public;

create policy "system_backups_owner" on system_backups
  for all to authenticated
  using (is_owner())
  with check (is_owner());
