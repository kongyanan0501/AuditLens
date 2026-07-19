-- Diagnose + force-add workflow columns. Run entire file in SQL Editor.

-- 1) What tables exist?
select 'tables' as kind, tablename as name
from pg_tables
where schemaname = 'public'
  and tablename like 'audit%'
order by tablename;

-- 2) Current columns on audit_issues
select 'columns' as kind, column_name as name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'audit_issues'
order by ordinal_position;
