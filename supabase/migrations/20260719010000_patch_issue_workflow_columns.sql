-- Patch: ensure audit_issues workflow columns exist (Phase 11)
-- Run in Supabase SQL Editor if you see:
--   column audit_issues.workflow_status does not exist (42703)

alter table public.audit_issues
  add column if not exists workflow_status text;

alter table public.audit_issues
  add column if not exists assignee_id uuid references auth.users (id) on delete set null;

alter table public.audit_issues
  add column if not exists resolution_note text;

alter table public.audit_issues
  add column if not exists status_updated_at timestamptz;

alter table public.audit_issues
  add column if not exists status_updated_by uuid references auth.users (id) on delete set null;

update public.audit_issues
set workflow_status = 'pending_review'
where workflow_status is null;

alter table public.audit_issues
  alter column workflow_status set default 'pending_review';

alter table public.audit_issues
  alter column workflow_status set not null;

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

alter table public.audit_tasks
  add column if not exists rule_config_version integer;

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

-- Refresh PostgREST schema cache
notify pgrst, 'reload schema';
