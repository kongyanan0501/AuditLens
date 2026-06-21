-- AuditLens initial schema (Phase 1)
-- Run via Supabase SQL Editor or: supabase db push
-- After any schema change: update supabase/schema.md + types/database.ts (see .cursor/rules/database.mdc)

-- pgvector for knowledge_base embeddings (OpenAI text-embedding-3-small = 1536 dims)
create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- audit_tasks
-- ---------------------------------------------------------------------------
create table public.audit_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  file_name text not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed')),
  score integer check (score is null or (score >= 0 and score <= 100)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index audit_tasks_user_id_idx on public.audit_tasks (user_id);
create index audit_tasks_status_idx on public.audit_tasks (status);

-- ---------------------------------------------------------------------------
-- audit_issues
-- ---------------------------------------------------------------------------
create table public.audit_issues (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.audit_tasks (id) on delete cascade,
  type text not null,
  severity text not null check (severity in ('low', 'medium', 'high')),
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_issues_task_id_idx on public.audit_issues (task_id);

-- ---------------------------------------------------------------------------
-- audit_reports (one report per task)
-- ---------------------------------------------------------------------------
create table public.audit_reports (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.audit_tasks (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- knowledge_base (RAG policy snippets)
-- ---------------------------------------------------------------------------
create table public.knowledge_base (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  embedding extensions.vector (1536),
  category text,
  created_at timestamptz not null default now()
);

create index knowledge_base_category_idx on public.knowledge_base (category);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger audit_tasks_set_updated_at
  before update on public.audit_tasks
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.audit_tasks enable row level security;
alter table public.audit_issues enable row level security;
alter table public.audit_reports enable row level security;
alter table public.knowledge_base enable row level security;

-- audit_tasks: owner-only CRUD
create policy "audit_tasks_select_own"
  on public.audit_tasks for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "audit_tasks_insert_own"
  on public.audit_tasks for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "audit_tasks_update_own"
  on public.audit_tasks for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "audit_tasks_delete_own"
  on public.audit_tasks for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- audit_issues: via owning task
create policy "audit_issues_select_own"
  on public.audit_issues for select
  to authenticated
  using (
    exists (
      select 1
      from public.audit_tasks t
      where t.id = audit_issues.task_id
        and t.user_id = (select auth.uid())
    )
  );

create policy "audit_issues_insert_own"
  on public.audit_issues for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.audit_tasks t
      where t.id = audit_issues.task_id
        and t.user_id = (select auth.uid())
    )
  );

create policy "audit_issues_update_own"
  on public.audit_issues for update
  to authenticated
  using (
    exists (
      select 1
      from public.audit_tasks t
      where t.id = audit_issues.task_id
        and t.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.audit_tasks t
      where t.id = audit_issues.task_id
        and t.user_id = (select auth.uid())
    )
  );

create policy "audit_issues_delete_own"
  on public.audit_issues for delete
  to authenticated
  using (
    exists (
      select 1
      from public.audit_tasks t
      where t.id = audit_issues.task_id
        and t.user_id = (select auth.uid())
    )
  );

-- audit_reports: via owning task
create policy "audit_reports_select_own"
  on public.audit_reports for select
  to authenticated
  using (
    exists (
      select 1
      from public.audit_tasks t
      where t.id = audit_reports.task_id
        and t.user_id = (select auth.uid())
    )
  );

create policy "audit_reports_insert_own"
  on public.audit_reports for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.audit_tasks t
      where t.id = audit_reports.task_id
        and t.user_id = (select auth.uid())
    )
  );

create policy "audit_reports_update_own"
  on public.audit_reports for update
  to authenticated
  using (
    exists (
      select 1
      from public.audit_tasks t
      where t.id = audit_reports.task_id
        and t.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.audit_tasks t
      where t.id = audit_reports.task_id
        and t.user_id = (select auth.uid())
    )
  );

create policy "audit_reports_delete_own"
  on public.audit_reports for delete
  to authenticated
  using (
    exists (
      select 1
      from public.audit_tasks t
      where t.id = audit_reports.task_id
        and t.user_id = (select auth.uid())
    )
  );

-- knowledge_base: read-only for authenticated users (writes via service role / migrations)
create policy "knowledge_base_select_authenticated"
  on public.knowledge_base for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Grants (Data API access for authenticated role)
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;

grant select, insert, update, delete on public.audit_tasks to authenticated;
grant select, insert, update, delete on public.audit_issues to authenticated;
grant select, insert, update, delete on public.audit_reports to authenticated;
grant select on public.knowledge_base to authenticated;
