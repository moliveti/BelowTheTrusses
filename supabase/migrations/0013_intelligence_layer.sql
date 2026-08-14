-- Intelligence layer foundation: (1) a lightweight, AI-layer-only
-- recommendations table (never duplicates business data — actions always
-- write to the real leads/sow_sent/milestones/projects rows, this table
-- only tracks the recommendation's own lifecycle), and (2) a generic
-- append-only activity/audit log for meaningful changes to canonical
-- records, since none exists today. Both are purely additive; nothing
-- existing is touched. History starts from whenever this is applied —
-- no attempt is made to backfill events for changes that already happened.

-- ---------------------------------------------------------------------------
-- recommendations
-- ---------------------------------------------------------------------------
-- One row per (type, source_table, source_id) — regenerating intelligence
-- upserts on that key so re-running the generator on every Today/Week/Month
-- load refreshes the descriptive fields without creating duplicates or
-- clobbering a user's dismiss/snooze/handle decision. `type` and
-- `source_table` are intentionally free text (not CHECK-constrained) so new
-- recommendation kinds — including future government-opportunity-sourced
-- ones — never require a migration. `severity`/`status` are constrained
-- because the ranking/filtering logic branches on those exact values.
--
-- `condition_fingerprint` is computed deterministically in the application
-- from the business fields that define the condition (e.g. a lead's status
-- plus a coarse staleness bucket — not the raw day count, so it doesn't
-- drift on every calendar day) — never from AI-generated text. The intended
-- upsert lifecycle, implemented in the intelligence service, not here:
--   * no existing row                                  -> insert as 'active'
--   * existing row is 'active'                         -> refresh fields only
--   * existing row is 'dismissed'/'snoozed'/'handled',
--     fingerprint unchanged from fingerprint_at_action  -> preserve status
--   * existing row is 'dismissed'/'snoozed'/'handled',
--     fingerprint changed                               -> restart lifecycle
--     (status -> 'active', clear the action timestamps, log an
--     activity_event noting the condition changed)
--   * existing row is 'resolved' and the condition is
--     seen again in a run                               -> reactivate to 'active'
-- Every run also updates `last_seen_at` on every fact it (re)confirms.
-- A separate reconciliation pass — after each generation run — moves any
-- 'active'/'snoozed' row whose `last_seen_at` predates the run (i.e. the
-- deterministic logic no longer produces it) to 'resolved', so nothing
-- stays active forever just because the underlying condition went away
-- some other way (e.g. the lead was contacted from the Leads tab directly,
-- not via a Today action).

create table recommendations (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  source_table text not null,
  source_id uuid not null,
  title text not null,
  reason text not null,
  severity text not null check (severity in ('critical', 'high', 'medium', 'low')),
  severity_at_action text check (severity_at_action in ('critical', 'high', 'medium', 'low')),
  condition_fingerprint text not null,
  fingerprint_at_action text,
  metric_value numeric,
  metric_label text,
  context jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'dismissed', 'snoozed', 'handled', 'resolved')),
  snoozed_until date,
  dismissed_at timestamptz,
  handled_at timestamptz,
  resolved_at timestamptz,
  action_taken text,
  action_taken_by uuid references profiles(id) on delete set null,
  generated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (type, source_table, source_id)
);

create index recommendations_status_idx on recommendations(status);
create index recommendations_source_idx on recommendations(source_table, source_id);
create index recommendations_last_seen_idx on recommendations(last_seen_at);

create trigger recommendations_set_updated_at
  before update on recommendations
  for each row execute function set_updated_at();

alter table recommendations enable row level security;

create policy "recommendations_owner_staff" on recommendations
  for all to authenticated
  using (is_owner_or_staff())
  with check (is_owner_or_staff());

-- ---------------------------------------------------------------------------
-- activity_events
-- ---------------------------------------------------------------------------
-- Append-only log of meaningful business-record changes (not indiscriminate
-- row-level auditing of every UPDATE) — action propagation, "what changed,"
-- and reversibility all read from here. entity_table/entity_id point at the
-- real canonical row (e.g. 'leads' / a lead's id); prior_value/new_value are
-- small concise payloads (e.g. {"status": "New Prospect"} -> {"status":
-- "Quote Sent"}), never full row dumps. recommendation_id is optional —
-- set when the change originated from acting on a Today/Week/Month
-- recommendation, null for normal UI edits.

create table activity_events (
  id uuid primary key default gen_random_uuid(),
  entity_table text not null,
  entity_id uuid not null,
  event_type text not null,
  summary text not null,
  prior_value jsonb,
  new_value jsonb,
  actor_id uuid references profiles(id) on delete set null,
  source text not null default 'ui',
  recommendation_id uuid references recommendations(id) on delete set null,
  created_at timestamptz not null default now()
);

create index activity_events_entity_idx on activity_events(entity_table, entity_id, created_at desc);
create index activity_events_created_at_idx on activity_events(created_at desc);
create index activity_events_recommendation_idx on activity_events(recommendation_id) where recommendation_id is not null;

-- Force actor_id to the authenticated caller server-side — a client can
-- never claim to be someone else. Under a service-role/system context
-- (auth.uid() is null) the caller-supplied value passes through as-is,
-- which is how a future scheduled/system-sourced event would attribute
-- itself (or leave actor_id null for a non-user-attributable event).
create or replace function set_activity_actor()
returns trigger as $$
begin
  if auth.uid() is not null then
    new.actor_id := auth.uid();
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger activity_events_set_actor
  before insert on activity_events
  for each row execute function set_activity_actor();

alter table activity_events enable row level security;

-- Deliberately narrower than every other table's RLS policy in this app:
-- owner/staff can read and insert, but never update or delete. An audit
-- log whose rows can be edited after the fact isn't an audit log.
create policy "activity_events_select_owner_staff" on activity_events
  for select to authenticated using (is_owner_or_staff());
create policy "activity_events_insert_owner_staff" on activity_events
  for insert to authenticated with check (is_owner_or_staff());
