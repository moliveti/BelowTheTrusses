-- Critical fix: subcontractors could never actually see or log their own
-- time entries. `time_entries_own` on subcontractor_time_entries (0004)
-- checks `exists (select 1 from subcontractors where user_id =
-- auth.uid())` -- but that subquery is itself subject to RLS on
-- `subcontractors`, which so far only grants owner/staff access. So the
-- check silently evaluated false for every real subcontractor, on both
-- the read side (their own logged hours never showed up) and the write
-- side (inserting a new entry was rejected outright). The
-- my_subcontractor / my_assigned_projects views masked this for months --
-- they're security-definer and bypass RLS entirely -- until a real
-- subcontractor login was tested end-to-end for the first time today.
create policy "subcontractors_own_row" on subcontractors
  for select to authenticated
  using (user_id = auth.uid());
