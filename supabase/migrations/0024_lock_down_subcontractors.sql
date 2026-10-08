-- Lock down what a login can do unless it was deliberately made an owner.
--
-- Owners (Amy + Mariano) keep full access to everything. Subcontractors only
-- ever need their own page: log time, see their assigned projects and their
-- paid hours.

-- 1. New logins start with the LEAST access. profiles.role used to default to
--    'owner', so anyone who could create an auth account (public sign-up was
--    enabled) was an owner with full access. Owners are created through
--    Admin -> New User, which now sets the role explicitly.
alter table profiles alter column role set default 'subcontractor';

-- 2. A login can read only its own profile. It used to be readable by every
--    logged-in user (using (true)), so a subcontractor could list everyone's
--    name and role. Owners/staff still read all through
--    profiles_write_owner_staff (for all ... is_owner_or_staff()).
drop policy if exists "profiles_select_authenticated" on profiles;
create policy "profiles_select_own" on profiles
  for select to authenticated using (id = auth.uid());

-- 3. Subcontractors log hours and read their paid hours -- nothing more.
--    The time_entries_own policy lets them change any column of their own
--    rows, so straight against the API they could mark their own hours paid,
--    change a rate, or delete paid hours. This guard keeps them to:
--      - add an entry (unpaid, on a project they are assigned to)
--      - delete an entry that is not paid yet
--    Owners/staff and server-side (service role) writes are unrestricted.
create or replace function guard_time_entry_for_subcontractor()
returns trigger as $$
begin
  if auth.uid() is null or is_owner_or_staff() then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.paid_at is not null then
      raise exception 'New hours cannot be marked paid.' using errcode = '42501';
    end if;
    if not exists (
      select 1 from project_subcontractors ps
      where ps.project_id = new.project_id and ps.subcontractor_id = new.subcontractor_id
    ) then
      raise exception 'You are not assigned to that project.' using errcode = '42501';
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    raise exception 'Logged hours cannot be edited. Delete the entry and log it again.' using errcode = '42501';
  else
    if old.paid_at is not null then
      raise exception 'Paid hours cannot be removed.' using errcode = '42501';
    end if;
    return old;
  end if;
end;
$$ language plpgsql security definer set search_path = public;

-- Named so it fires before time_entries_set_rate (triggers on one event run alphabetically).
drop trigger if exists time_entries_guard_subcontractor on subcontractor_time_entries;
create trigger time_entries_guard_subcontractor
  before insert or update or delete on subcontractor_time_entries
  for each row execute function guard_time_entry_for_subcontractor();
