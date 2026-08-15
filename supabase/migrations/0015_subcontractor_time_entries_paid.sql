-- Contractor payroll tracking — mirrors the existing milestones.paid_date
-- pattern exactly, just on the payroll (outgoing) side instead of the
-- collections (incoming) side. Nothing on subcontractor_time_entries
-- currently tracks whether a subcontractor was actually paid for logged
-- hours — this is what the "contractor hours due by Friday" Today signal
-- needs to distinguish paid from pending. Additive; no existing column
-- changes, no data migration (all existing rows start unpaid — NULL).

alter table subcontractor_time_entries add column paid_at date;
