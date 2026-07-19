/**
 * Supabase Database types for typed clients.
 * Keep in sync with supabase/migrations/*.sql
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: string;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_tasks: {
        Row: {
          id: string;
          user_id: string;
          file_name: string;
          status: string;
          score: number | null;
          rule_config_version: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          file_name: string;
          status?: string;
          score?: number | null;
          rule_config_version?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          file_name?: string;
          status?: string;
          score?: number | null;
          rule_config_version?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_issues: {
        Row: {
          id: string;
          task_id: string;
          type: string;
          severity: string;
          reason: string;
          metadata: Json;
          created_at: string;
          workflow_status: string;
          assignee_id: string | null;
          resolution_note: string | null;
          status_updated_at: string | null;
          status_updated_by: string | null;
          remediation_action: string | null;
          remediation_result: string | null;
          remediation_submitted_at: string | null;
          remediation_submitted_by: string | null;
        };
        Insert: {
          id?: string;
          task_id: string;
          type: string;
          severity: string;
          reason: string;
          metadata?: Json;
          created_at?: string;
          workflow_status?: string;
          assignee_id?: string | null;
          resolution_note?: string | null;
          status_updated_at?: string | null;
          status_updated_by?: string | null;
          remediation_action?: string | null;
          remediation_result?: string | null;
          remediation_submitted_at?: string | null;
          remediation_submitted_by?: string | null;
        };
        Update: {
          id?: string;
          task_id?: string;
          type?: string;
          severity?: string;
          reason?: string;
          metadata?: Json;
          created_at?: string;
          workflow_status?: string;
          assignee_id?: string | null;
          resolution_note?: string | null;
          status_updated_at?: string | null;
          status_updated_by?: string | null;
          remediation_action?: string | null;
          remediation_result?: string | null;
          remediation_submitted_at?: string | null;
          remediation_submitted_by?: string | null;
        };
        Relationships: [];
      };
      audit_issue_attachments: {
        Row: {
          id: string;
          issue_id: string;
          uploaded_by: string;
          kind: string;
          file_name: string;
          mime_type: string;
          byte_size: number;
          storage_path: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          issue_id: string;
          uploaded_by: string;
          kind: string;
          file_name: string;
          mime_type: string;
          byte_size: number;
          storage_path: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          issue_id?: string;
          uploaded_by?: string;
          kind?: string;
          file_name?: string;
          mime_type?: string;
          byte_size?: number;
          storage_path?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      audit_issue_events: {
        Row: {
          id: string;
          issue_id: string;
          actor_id: string | null;
          from_status: string | null;
          to_status: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          issue_id: string;
          actor_id?: string | null;
          from_status?: string | null;
          to_status: string;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          issue_id?: string;
          actor_id?: string | null;
          from_status?: string | null;
          to_status?: string;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      audit_rule_configs: {
        Row: {
          id: string;
          scope_key: string;
          amount_anomaly_multiplier: number;
          vendor_concentration_threshold: number;
          approval_required_min_amount: number;
          version: number;
          is_active: boolean;
          changed_by: string | null;
          change_note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          scope_key?: string;
          amount_anomaly_multiplier?: number;
          vendor_concentration_threshold?: number;
          approval_required_min_amount?: number;
          version: number;
          is_active?: boolean;
          changed_by?: string | null;
          change_note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          scope_key?: string;
          amount_anomaly_multiplier?: number;
          vendor_concentration_threshold?: number;
          approval_required_min_amount?: number;
          version?: number;
          is_active?: boolean;
          changed_by?: string | null;
          change_note?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      audit_reports: {
        Row: {
          id: string;
          task_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          content?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      knowledge_base: {
        Row: {
          id: string;
          content: string;
          embedding: string | null;
          category: string | null;
          policy_name: string | null;
          clause_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          content: string;
          embedding?: string | null;
          category?: string | null;
          policy_name?: string | null;
          clause_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          content?: string;
          embedding?: string | null;
          category?: string | null;
          policy_name?: string | null;
          clause_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_user_role: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

/** Map DB snake_case rows to domain types in types/audit.ts */
export function mapTaskRow(row: Database["public"]["Tables"]["audit_tasks"]["Row"]) {
  return {
    id: row.id,
    userId: row.user_id,
    fileName: row.file_name,
    status: row.status,
    score: row.score,
    ruleConfigVersion: row.rule_config_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapIssueRow(row: Database["public"]["Tables"]["audit_issues"]["Row"]) {
  return {
    id: row.id,
    taskId: row.task_id,
    type: row.type,
    severity: row.severity,
    reason: row.reason,
    metadata: row.metadata,
    createdAt: row.created_at,
    workflowStatus: row.workflow_status,
    assigneeId: row.assignee_id,
    resolutionNote: row.resolution_note,
    statusUpdatedAt: row.status_updated_at,
    statusUpdatedBy: row.status_updated_by,
    remediationAction: row.remediation_action,
    remediationResult: row.remediation_result,
    remediationSubmittedAt: row.remediation_submitted_at,
    remediationSubmittedBy: row.remediation_submitted_by,
  };
}

export function mapAttachmentRow(
  row: Database["public"]["Tables"]["audit_issue_attachments"]["Row"],
) {
  return {
    id: row.id,
    issueId: row.issue_id,
    uploadedBy: row.uploaded_by,
    kind: row.kind,
    fileName: row.file_name,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    storagePath: row.storage_path,
    createdAt: row.created_at,
  };
}

export function mapReportRow(row: Database["public"]["Tables"]["audit_reports"]["Row"]) {
  return {
    id: row.id,
    taskId: row.task_id,
    content: row.content,
    createdAt: row.created_at,
  };
}

export function mapRuleConfigRow(
  row: Database["public"]["Tables"]["audit_rule_configs"]["Row"],
) {
  return {
    id: row.id,
    scopeKey: row.scope_key,
    amountAnomalyMultiplier: row.amount_anomaly_multiplier,
    vendorConcentrationThreshold: row.vendor_concentration_threshold,
    approvalRequiredMinAmount: row.approval_required_min_amount,
    version: row.version,
    isActive: row.is_active,
    changedBy: row.changed_by,
    changeNote: row.change_note,
    createdAt: row.created_at,
  };
}

export function mapIssueEventRow(
  row: Database["public"]["Tables"]["audit_issue_events"]["Row"],
) {
  return {
    id: row.id,
    issueId: row.issue_id,
    actorId: row.actor_id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    note: row.note,
    createdAt: row.created_at,
  };
}
