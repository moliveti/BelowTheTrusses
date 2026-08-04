-- Lightweight scope interest on leads (informal, pre-project — names only,
-- not a join to scope_tags with dollar amounts like project_scope_tags).
alter table leads add column scope_tags text[] not null default '{}';
