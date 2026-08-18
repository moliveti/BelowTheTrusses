-- Weekly Market Intelligence Update — extends the GA-only bid radar
-- (government_opportunities/government_pursuits, migration 0016) into a
-- three-sector weekly digest: Opportunity Radar (deterministic bid data,
-- now GA + FL), Commercial BD Targets, and Public-Sector/Institutional
-- Pipeline (both discovered via a search API + deterministic relevance
-- scoring, sourced weekly rather than continuously). Additive; nothing
-- existing changes except the new fit_score column below.

-- Replaces binary keyword-match inclusion with a real relevance score
-- (positive/negative keyword weighting) so junk matches like a telecom
-- "architecture" hit or a sidewalk RFQ can be ranked low instead of
-- appearing indiscriminately.
alter table government_opportunities add column fit_score integer;

-- Commercial BD targets (companies/projects BTT should proactively
-- approach) and public-sector/institutional pipeline (early-stage public
-- opportunities worth developing before a bid exists) — grouped in one
-- table since both are "leads" in the same shape, unlike the structured
-- bid rows in government_opportunities.
create table market_intel_leads (
  id uuid primary key default gen_random_uuid(),
  sector text not null check (sector in ('commercial_bd_target', 'institutional_pipeline')),
  state text not null check (state in ('GA', 'FL')),
  title text not null,
  description text,
  -- [{name, role}], e.g. {"name": "Avant Construction", "role": "GC"}
  organizations jsonb not null default '[]'::jsonb,
  estimated_value numeric,
  location text,
  why_btt_fits text,
  source_url text not null,
  fit_score integer not null,
  -- The Monday this lead was surfaced in — one weekly snapshot, not a
  -- continuously-changing feed like government_opportunities.
  week_of date not null,
  discovered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index market_intel_leads_week_idx on market_intel_leads(week_of);
create index market_intel_leads_sector_idx on market_intel_leads(sector);

alter table market_intel_leads enable row level security;

create policy "market_intel_leads_select_owner_staff" on market_intel_leads
  for select to authenticated
  using (is_owner_or_staff());

-- One row per Monday run — usage/cost tracking so the Admin cost panel
-- has something real to show, and so a run failure is visible instead of
-- silently leaving last week's snapshot stale with no explanation.
create table market_intel_runs (
  id uuid primary key default gen_random_uuid(),
  week_of date not null unique,
  search_requests integer not null default 0,
  ai_summary_calls integer not null default 0,
  estimated_cost_usd numeric not null default 0,
  status text not null default 'completed' check (status in ('running', 'completed', 'failed')),
  error_summary text,
  created_at timestamptz not null default now()
);

alter table market_intel_runs enable row level security;

create policy "market_intel_runs_select_owner_staff" on market_intel_runs
  for select to authenticated
  using (is_owner_or_staff());
