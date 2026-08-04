-- Freeze the effective hourly rate on each time entry at the moment it's
-- logged, so a later rate change (default, per-type, or per-project
-- override) never retroactively re-costs hours already worked. Cost
-- reporting must read this column, not re-derive the rate live.

alter table subcontractor_time_entries add column hourly_rate numeric;

create or replace function set_time_entry_rate()
returns trigger as $$
declare
  v_rate numeric;
  v_project_type text;
begin
  -- 1. explicit per-project override
  select hourly_rate into v_rate
  from project_subcontractors
  where project_id = new.project_id and subcontractor_id = new.subcontractor_id;

  -- 2. per-project-type default for this subcontractor
  if v_rate is null then
    select type into v_project_type from projects where id = new.project_id;
    select hourly_rate into v_rate
    from subcontractor_type_rates
    where subcontractor_id = new.subcontractor_id and project_type = v_project_type;
  end if;

  -- 3. flat default rate
  if v_rate is null then
    select default_hourly_rate into v_rate from subcontractors where id = new.subcontractor_id;
  end if;

  new.hourly_rate := v_rate;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Only on insert — entries aren't edited in place today (deleted and
-- re-logged instead), and re-deriving on update would defeat the point.
create trigger time_entries_set_rate
  before insert on subcontractor_time_entries
  for each row execute function set_time_entry_rate();

-- Backfill existing rows (all test data by this point, but keep it correct)
-- using today's effective rate, same precedence as the trigger.
update subcontractor_time_entries e
set hourly_rate = coalesce(
  (select ps.hourly_rate from project_subcontractors ps where ps.project_id = e.project_id and ps.subcontractor_id = e.subcontractor_id),
  (select str.hourly_rate from subcontractor_type_rates str join projects p on p.id = e.project_id where str.subcontractor_id = e.subcontractor_id and str.project_type = p.type),
  (select s.default_hourly_rate from subcontractors s where s.id = e.subcontractor_id)
)
where e.hourly_rate is null;
