-- Client mailing address on leads, feeds through to quote/contract PDFs.
-- leads.state already exists as free text; the app now renders it as a
-- dropdown but no column change is needed for it.
alter table leads add column address text;
alter table leads add column city text;
alter table leads add column zip text;

-- Commercial scope categories (percent-of-revenue tracking) -- category
-- 'commercial' was already allowed by the check constraint but no rows
-- existed yet. Plus a new residential category.
insert into scope_tags (name, category) values
  ('Permit Drawings', 'commercial'),
  ('Furniture', 'commercial'),
  ('Space Planning', 'residential')
on conflict (name) do nothing;
