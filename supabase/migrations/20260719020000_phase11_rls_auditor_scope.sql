-- Phase 11 patch: auditor sees all; business sees assignee-only; profiles readable by auditor

-- ---------------------------------------------------------------------------
-- profiles: auditor can list all (for assign / demo)
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_accessible" on public.profiles;
create policy "profiles_select_accessible"
  on public.profiles for select
  to authenticated
  using (
    (select auth.uid()) = id
    or public.current_user_role() = 'auditor'
  );

-- ---------------------------------------------------------------------------
-- audit_tasks: auditor = all; else owner or has assigned issue
-- ---------------------------------------------------------------------------
drop policy if exists "audit_tasks_select_accessible" on public.audit_tasks;
create policy "audit_tasks_select_accessible"
  on public.audit_tasks for select
  to authenticated
  using (
    public.current_user_role() = 'auditor'
    or (select auth.uid()) = user_id
    or exists (
      select 1
      from public.audit_issues i
      where i.task_id = audit_tasks.id
        and i.assignee_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- audit_issues: auditor = all; else task owner or assignee
-- ---------------------------------------------------------------------------
drop policy if exists "audit_issues_select_accessible" on public.audit_issues;
create policy "audit_issues_select_accessible"
  on public.audit_issues for select
  to authenticated
  using (
    public.current_user_role() = 'auditor'
    or assignee_id = (select auth.uid())
    or exists (
      select 1
      from public.audit_tasks t
      where t.id = audit_issues.task_id
        and t.user_id = (select auth.uid())
    )
  );

drop policy if exists "audit_issues_update_accessible" on public.audit_issues;
create policy "audit_issues_update_accessible"
  on public.audit_issues for update
  to authenticated
  using (
    public.current_user_role() = 'auditor'
    or assignee_id = (select auth.uid())
    or exists (
      select 1
      from public.audit_tasks t
      where t.id = audit_issues.task_id
        and t.user_id = (select auth.uid())
    )
  )
  with check (
    public.current_user_role() = 'auditor'
    or assignee_id = (select auth.uid())
    or exists (
      select 1
      from public.audit_tasks t
      where t.id = audit_issues.task_id
        and t.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- audit_reports: auditor = all; task owner; assignee of any issue on task
-- ---------------------------------------------------------------------------
drop policy if exists "audit_reports_select_accessible" on public.audit_reports;
create policy "audit_reports_select_accessible"
  on public.audit_reports for select
  to authenticated
  using (
    public.current_user_role() = 'auditor'
    or exists (
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
-- issue events: follow issue visibility (auditor / owner / assignee)
-- ---------------------------------------------------------------------------
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
          public.current_user_role() = 'auditor'
          or i.assignee_id = (select auth.uid())
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
          public.current_user_role() = 'auditor'
          or i.assignee_id = (select auth.uid())
          or exists (
            select 1
            from public.audit_tasks t
            where t.id = i.task_id
              and t.user_id = (select auth.uid())
          )
        )
    )
  );
