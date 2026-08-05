-- Scope tags now track each category's share of a project's total contract
-- value (a percentage, expected to sum to 100% per project) rather than a
-- standalone dollar amount. The percent_of_revenue column already exists;
-- the legacy dollar amount column has zero rows populated, so it's a safe drop.
alter table project_scope_tags drop column amount;
