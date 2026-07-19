-- Phase 11 fix: break RLS infinite recursion between audit_tasks ↔ audit_issues
-- Error: 42P17 infinite recursion detected in policy for relation "audit_issues"
-- Cause: each policy EXISTS-subqueries the other table, re-entering RLS.
-- Fix: SECURITY DEFINER helpers bypass RLS for ownership / assignment checks.

create or replace function public.is_task_owner(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.audit_tasks t
    where t.id = p_task_id
      and t.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_assigned_issue_on_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.audit_issues i
    where i.task_id = p_task_id
      and i.assignee_id = (select auth.uid())
  );
$$;

create or replace function public.can_access_issue(p_issue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.audit_issues i
    where i.id = p_issue_id
      and (
        public.current_user_role() = 'auditor'
        or i.assignee_id = (select auth.uid())
        or public.is_task_owner(i.task_id)
      )
  );
$$;

revoke all on function public.is_task_owner(uuid) from public;
revoke all on function public.has_assigned_issue_on_task(uuid) from public;
revoke all on function public.can_access_issue(uuid) from public;
grant execute on function public.is_task_owner(uuid) to authenticated;
grant execute on function public.has_assigned_issue_on_task(uuid) to authenticated;
grant execute on function public.can_access_issue(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- audit_tasks
-- ---------------------------------------------------------------------------
drop policy if exists "audit_tasks_select_accessible" on public.audit_tasks;
create policy "audit_tasks_select_accessible"
  on public.audit_tasks for select
  to authenticated
  using (
    public.current_user_role() = 'auditor'
    or (select auth.uid()) = user_id
    or public.has_assigned_issue_on_task(id)
  );

-- ---------------------------------------------------------------------------
-- audit_issues
-- ---------------------------------------------------------------------------
drop policy if exists "audit_issues_select_accessible" on public.audit_issues;
create policy "audit_issues_select_accessible"
  on public.audit_issues for select
  to authenticated
  using (
    public.current_user_role() = 'auditor'
    or assignee_id = (select auth.uid())
    or public.is_task_owner(task_id)
  );

drop policy if exists "audit_issues_update_accessible" on public.audit_issues;
create policy "audit_issues_update_accessible"
  on public.audit_issues for update
  to authenticated
  using (
    public.current_user_role() = 'auditor'
    or assignee_id = (select auth.uid())
    or public.is_task_owner(task_id)
  )
  with check (
    public.current_user_role() = 'auditor'
    or assignee_id = (select auth.uid())
    or public.is_task_owner(task_id)
  );

-- ---------------------------------------------------------------------------
-- audit_reports
-- ---------------------------------------------------------------------------
drop policy if exists "audit_reports_select_accessible" on public.audit_reports;
create policy "audit_reports_select_accessible"
  on public.audit_reports for select
  to authenticated
  using (
    public.current_user_role() = 'auditor'
    or public.is_task_owner(task_id)
    or public.has_assigned_issue_on_task(task_id)
  );

-- ---------------------------------------------------------------------------
-- audit_issue_events
-- ---------------------------------------------------------------------------
drop policy if exists "audit_issue_events_select_accessible" on public.audit_issue_events;
create policy "audit_issue_events_select_accessible"
  on public.audit_issue_events for select
  to authenticated
  using (public.can_access_issue(issue_id));

drop policy if exists "audit_issue_events_insert_accessible" on public.audit_issue_events;
create policy "audit_issue_events_insert_accessible"
  on public.audit_issue_events for insert
  to authenticated
  with check (public.can_access_issue(issue_id));
