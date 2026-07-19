-- Online remediation verification (pending_verification + attachments)
-- File bytes are written by API with service_role; metadata table uses RLS.
-- Run in SQL Editor, then: notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- audit_issues: workflow status + remediation snapshot
-- ---------------------------------------------------------------------------
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
      'pending_verification',
      'closed'
    )
  );

alter table public.audit_issues
  add column if not exists remediation_action text;

alter table public.audit_issues
  add column if not exists remediation_result text;

alter table public.audit_issues
  add column if not exists remediation_submitted_at timestamptz;

alter table public.audit_issues
  add column if not exists remediation_submitted_by uuid references auth.users (id) on delete set null;

-- ---------------------------------------------------------------------------
-- audit_issue_attachments
-- ---------------------------------------------------------------------------
create table if not exists public.audit_issue_attachments (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.audit_issues (id) on delete cascade,
  uploaded_by uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('evidence', 'corrected_file')),
  file_name text not null,
  mime_type text not null,
  byte_size integer not null check (byte_size > 0 and byte_size <= 10485760),
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists audit_issue_attachments_issue_id_created_at_idx
  on public.audit_issue_attachments (issue_id, created_at);

alter table public.audit_issue_attachments enable row level security;

drop policy if exists "audit_issue_attachments_select_accessible" on public.audit_issue_attachments;
create policy "audit_issue_attachments_select_accessible"
  on public.audit_issue_attachments for select
  to authenticated
  using (public.can_access_issue(issue_id));

-- Inserts/deletes normally go through service_role in API; keep policies for safety.
drop policy if exists "audit_issue_attachments_insert_assignee" on public.audit_issue_attachments;
create policy "audit_issue_attachments_insert_assignee"
  on public.audit_issue_attachments for insert
  to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and public.can_access_issue(issue_id)
    and exists (
      select 1
      from public.audit_issues i
      where i.id = issue_id
        and i.assignee_id = (select auth.uid())
        and i.workflow_status = 'remediating'
    )
  );

drop policy if exists "audit_issue_attachments_delete_own_remediating" on public.audit_issue_attachments;
create policy "audit_issue_attachments_delete_own_remediating"
  on public.audit_issue_attachments for delete
  to authenticated
  using (
    uploaded_by = (select auth.uid())
    and exists (
      select 1
      from public.audit_issues i
      where i.id = issue_id
        and i.assignee_id = (select auth.uid())
        and i.workflow_status = 'remediating'
    )
  );

grant select, insert, delete on public.audit_issue_attachments to authenticated;

-- ---------------------------------------------------------------------------
-- Storage bucket (private). Preferred path: service_role upload from API.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'issue-remediation',
  'issue-remediation',
  false,
  10485760,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/csv'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
