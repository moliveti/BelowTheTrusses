-- Replace the free-text timeline field with a tentative start/end month
-- range (stored as the 1st of each month). No existing leads have a
-- timeline value set, so this is a safe drop-and-replace.
alter table leads drop column timeline;
alter table leads add column timeline_start_month date;
alter table leads add column timeline_end_month date;
