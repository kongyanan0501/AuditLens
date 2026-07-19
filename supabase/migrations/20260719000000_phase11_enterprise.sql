-- Phase 11: enterprise usability (roles, issue workflow, rule config, KB clauses)
-- After apply: update supabase/schema.md + types/database.ts
-- Idempotent: also ensures Phase 1 base tables exist (safe on partial / empty DBs).

-- ---------------------------------------------------------------------------
-- Repair: rename legacy tables that exist but miss required columns
-- (CREATE TABLE IF NOT EXISTS would otherwise skip and leave a broken shape)
-- ---------------------------------------------------------------------------
do $$
declare
  suffix text := to_char(now(), 'YYYYMMDDHH24MISS');
begin
  -- audit_reports without task_id
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'audit_reports'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'audit_reports'
      and column_name = 'task_id'
  ) then
    execute format(
      'alter table public.audit_reports rename to %I',
      'audit_reports_legacy_' || suffix
    );
  end if;

  -- audit_tasks without user_id
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'audit_tasks'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'audit_tasks'
      and column_name = 'user_id'
  ) then
    execute format(
      'alter table public.audit_tasks rename to %I',
      'audit_tasks_legacy_' || suffix
    );
  end if;

  -- audit_issues without task_id
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'audit_issues'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'audit_issues'
      and column_name = 'task_id'
  ) then
    execute format(
      'alter table public.audit_issues rename to %I',
      'audit_issues_legacy_' || suffix
    );
  end if;

  -- knowledge_base without content
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'knowledge_base'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'knowledge_base'
      and column_name = 'content'
  ) then
    execute format(
      'alter table public.knowledge_base rename to %I',
      'knowledge_base_legacy_' || suffix
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Phase 1 base (idempotent) — required before Phase 11 alters
-- ---------------------------------------------------------------------------
create extension if not exists vector with schema extensions;

create table if not exists public.audit_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  file_name text not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed')),
  score integer check (score is null or (score >= 0 and score <= 100)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists audit_tasks_user_id_idx on public.audit_tasks (user_id);
create index if not exists audit_tasks_status_idx on public.audit_tasks (status);

create table if not exists public.audit_issues (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.audit_tasks (id) on delete cascade,
  type text not null,
  severity text not null check (severity in ('low', 'medium', 'high')),
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_issues_task_id_idx on public.audit_issues (task_id);

create table if not exists public.audit_reports (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.audit_tasks (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_base (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  embedding extensions.vector (1536),
  category text,
  created_at timestamptz not null default now()
);

create index if not exists knowledge_base_category_idx on public.knowledge_base (category);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists audit_tasks_set_updated_at on public.audit_tasks;
create trigger audit_tasks_set_updated_at
  before update on public.audit_tasks
  for each row
  execute function public.set_updated_at();

alter table public.audit_tasks enable row level security;
alter table public.audit_issues enable row level security;
alter table public.audit_reports enable row level security;
alter table public.knowledge_base enable row level security;

-- Base owner policies (Phase 11 may replace select policies below)
drop policy if exists "audit_tasks_select_own" on public.audit_tasks;
create policy "audit_tasks_select_own"
  on public.audit_tasks for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "audit_tasks_insert_own" on public.audit_tasks;
create policy "audit_tasks_insert_own"
  on public.audit_tasks for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "audit_tasks_update_own" on public.audit_tasks;
create policy "audit_tasks_update_own"
  on public.audit_tasks for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "audit_tasks_delete_own" on public.audit_tasks;
create policy "audit_tasks_delete_own"
  on public.audit_tasks for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "audit_issues_select_own" on public.audit_issues;
create policy "audit_issues_select_own"
  on public.audit_issues for select
  to authenticated
  using (
    exists (
      select 1 from public.audit_tasks t
      where t.id = audit_issues.task_id and t.user_id = (select auth.uid())
    )
  );

drop policy if exists "audit_issues_insert_own" on public.audit_issues;
create policy "audit_issues_insert_own"
  on public.audit_issues for insert
  to authenticated
  with check (
    exists (
      select 1 from public.audit_tasks t
      where t.id = audit_issues.task_id and t.user_id = (select auth.uid())
    )
  );

drop policy if exists "audit_issues_update_own" on public.audit_issues;
create policy "audit_issues_update_own"
  on public.audit_issues for update
  to authenticated
  using (
    exists (
      select 1 from public.audit_tasks t
      where t.id = audit_issues.task_id and t.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.audit_tasks t
      where t.id = audit_issues.task_id and t.user_id = (select auth.uid())
    )
  );

drop policy if exists "audit_issues_delete_own" on public.audit_issues;
create policy "audit_issues_delete_own"
  on public.audit_issues for delete
  to authenticated
  using (
    exists (
      select 1 from public.audit_tasks t
      where t.id = audit_issues.task_id and t.user_id = (select auth.uid())
    )
  );

drop policy if exists "audit_reports_select_own" on public.audit_reports;
create policy "audit_reports_select_own"
  on public.audit_reports for select
  to authenticated
  using (
    exists (
      select 1 from public.audit_tasks t
      where t.id = audit_reports.task_id and t.user_id = (select auth.uid())
    )
  );

drop policy if exists "audit_reports_insert_own" on public.audit_reports;
create policy "audit_reports_insert_own"
  on public.audit_reports for insert
  to authenticated
  with check (
    exists (
      select 1 from public.audit_tasks t
      where t.id = audit_reports.task_id and t.user_id = (select auth.uid())
    )
  );

drop policy if exists "audit_reports_update_own" on public.audit_reports;
create policy "audit_reports_update_own"
  on public.audit_reports for update
  to authenticated
  using (
    exists (
      select 1 from public.audit_tasks t
      where t.id = audit_reports.task_id and t.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.audit_tasks t
      where t.id = audit_reports.task_id and t.user_id = (select auth.uid())
    )
  );

drop policy if exists "audit_reports_delete_own" on public.audit_reports;
create policy "audit_reports_delete_own"
  on public.audit_reports for delete
  to authenticated
  using (
    exists (
      select 1 from public.audit_tasks t
      where t.id = audit_reports.task_id and t.user_id = (select auth.uid())
    )
  );

drop policy if exists "knowledge_base_select_authenticated" on public.knowledge_base;
create policy "knowledge_base_select_authenticated"
  on public.knowledge_base for select
  to authenticated
  using (true);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.audit_tasks to authenticated;
grant select, insert, update, delete on public.audit_issues to authenticated;
grant select, insert, update, delete on public.audit_reports to authenticated;
grant select on public.knowledge_base to authenticated;

-- ---------------------------------------------------------------------------
-- profiles (auditor | business)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'auditor'
    check (role in ('auditor', 'business')),
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'auditor')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Backfill existing users
insert into public.profiles (id, role)
select id, 'auditor' from auth.users
on conflict (id) do nothing;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = (select auth.uid())),
    'auditor'
  );
$$;

-- ---------------------------------------------------------------------------
-- audit_tasks: rule config version snapshot at run time
-- ---------------------------------------------------------------------------
alter table public.audit_tasks
  add column if not exists rule_config_version integer;

-- ---------------------------------------------------------------------------
-- audit_issues workflow columns
-- ---------------------------------------------------------------------------
alter table public.audit_issues
  add column if not exists workflow_status text not null default 'pending_review',
  add column if not exists assignee_id uuid references auth.users (id) on delete set null,
  add column if not exists resolution_note text,
  add column if not exists status_updated_at timestamptz,
  add column if not exists status_updated_by uuid references auth.users (id) on delete set null;

alter table public.audit_issues
  drop constraint if exists audit_issues_workflow_status_check;

alter table public.audit_issues
  add constraint audit_issues_workflow_status_check
  check (
    workflow_status in (
      'pending_review',
      'confirmed',
      'false_positive',
      'remediating',
      'closed'
    )
  );

create index if not exists audit_issues_assignee_id_idx
  on public.audit_issues (assignee_id);

create index if not exists audit_issues_workflow_status_idx
  on public.audit_issues (workflow_status);

-- ---------------------------------------------------------------------------
-- audit_issue_events (audit trail)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_issue_events (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.audit_issues (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  from_status text,
  to_status text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists audit_issue_events_issue_id_idx
  on public.audit_issue_events (issue_id);

-- ---------------------------------------------------------------------------
-- audit_rule_configs (versioned thresholds; one active per scope)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_rule_configs (
  id uuid primary key default gen_random_uuid(),
  scope_key text not null default 'default',
  amount_anomaly_multiplier double precision not null default 5
    check (amount_anomaly_multiplier > 0),
  vendor_concentration_threshold double precision not null default 0.5
    check (
      vendor_concentration_threshold > 0
      and vendor_concentration_threshold <= 1
    ),
  approval_required_min_amount double precision not null default 0
    check (approval_required_min_amount >= 0),
  version integer not null,
  is_active boolean not null default true,
  changed_by uuid references auth.users (id) on delete set null,
  change_note text,
  created_at timestamptz not null default now(),
  unique (scope_key, version)
);

create unique index if not exists audit_rule_configs_one_active_per_scope
  on public.audit_rule_configs (scope_key)
  where is_active = true;

insert into public.audit_rule_configs (
  scope_key,
  amount_anomaly_multiplier,
  vendor_concentration_threshold,
  approval_required_min_amount,
  version,
  is_active,
  change_note
) values (
  'default',
  5,
  0.5,
  0,
  1,
  true,
  'Phase 11 default thresholds'
)
on conflict (scope_key, version) do nothing;

-- ---------------------------------------------------------------------------
-- knowledge_base policy clause fields
-- ---------------------------------------------------------------------------
alter table public.knowledge_base
  add column if not exists policy_name text,
  add column if not exists clause_id text;

-- ---------------------------------------------------------------------------
-- RLS: profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- RLS: replace task/issue/report policies for assignee visibility
-- ---------------------------------------------------------------------------
drop policy if exists "audit_tasks_select_own" on public.audit_tasks;
drop policy if exists "audit_tasks_select_accessible" on public.audit_tasks;
create policy "audit_tasks_select_accessible"
  on public.audit_tasks for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1
      from public.audit_issues i
      where i.task_id = audit_tasks.id
        and i.assignee_id = (select auth.uid())
    )
  );

drop policy if exists "audit_issues_select_own" on public.audit_issues;
drop policy if exists "audit_issues_select_accessible" on public.audit_issues;
create policy "audit_issues_select_accessible"
  on public.audit_issues for select
  to authenticated
  using (
    exists (
      select 1
      from public.audit_tasks t
      where t.id = audit_issues.task_id
        and t.user_id = (select auth.uid())
    )
    or assignee_id = (select auth.uid())
  );

drop policy if exists "audit_issues_update_own" on public.audit_issues;
drop policy if exists "audit_issues_update_accessible" on public.audit_issues;
create policy "audit_issues_update_accessible"
  on public.audit_issues for update
  to authenticated
  using (
    exists (
      select 1
      from public.audit_tasks t
      where t.id = audit_issues.task_id
        and t.user_id = (select auth.uid())
    )
    or assignee_id = (select auth.uid())
  )
  with check (
    exists (
      select 1
      from public.audit_tasks t
      where t.id = audit_issues.task_id
        and t.user_id = (select auth.uid())
    )
    or assignee_id = (select auth.uid())
  );

drop policy if exists "audit_reports_select_own" on public.audit_reports;
drop policy if exists "audit_reports_select_accessible" on public.audit_reports;
create policy "audit_reports_select_accessible"
  on public.audit_reports for select
  to authenticated
  using (
    exists (
      select 1
      from public.audit_tasks t
      where t.id = audit_reports.task_id
        and t.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.audit_issues i
      where i.task_id = audit_reports.task_id
        and i.assignee_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: issue events + rule configs
-- ---------------------------------------------------------------------------
alter table public.audit_issue_events enable row level security;
alter table public.audit_rule_configs enable row level security;

drop policy if exists "audit_issue_events_select_accessible" on public.audit_issue_events;
create policy "audit_issue_events_select_accessible"
  on public.audit_issue_events for select
  to authenticated
  using (
    exists (
      select 1
      from public.audit_issues i
      where i.id = audit_issue_events.issue_id
        and (
          i.assignee_id = (select auth.uid())
          or exists (
            select 1
            from public.audit_tasks t
            where t.id = i.task_id
              and t.user_id = (select auth.uid())
          )
        )
    )
  );

drop policy if exists "audit_issue_events_insert_accessible" on public.audit_issue_events;
create policy "audit_issue_events_insert_accessible"
  on public.audit_issue_events for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.audit_issues i
      where i.id = audit_issue_events.issue_id
        and (
          i.assignee_id = (select auth.uid())
          or exists (
            select 1
            from public.audit_tasks t
            where t.id = i.task_id
              and t.user_id = (select auth.uid())
          )
        )
    )
  );

drop policy if exists "audit_rule_configs_select_authenticated" on public.audit_rule_configs;
create policy "audit_rule_configs_select_authenticated"
  on public.audit_rule_configs for select
  to authenticated
  using (true);

drop policy if exists "audit_rule_configs_insert_auditor" on public.audit_rule_configs;
create policy "audit_rule_configs_insert_auditor"
  on public.audit_rule_configs for insert
  to authenticated
  with check (public.current_user_role() = 'auditor');

drop policy if exists "audit_rule_configs_update_auditor" on public.audit_rule_configs;
create policy "audit_rule_configs_update_auditor"
  on public.audit_rule_configs for update
  to authenticated
  using (public.current_user_role() = 'auditor')
  with check (public.current_user_role() = 'auditor');

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.audit_issue_events to authenticated;
grant select, insert, update on public.audit_rule_configs to authenticated;
