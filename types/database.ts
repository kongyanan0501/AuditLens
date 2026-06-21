/**
 * Supabase Database types for typed clients.
 * Keep in sync with supabase/migrations/001_initial_schema.sql
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
      audit_tasks: {
        Row: {
          id: string;
          user_id: string;
          file_name: string;
          status: string;
          score: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          file_name: string;
          status?: string;
          score?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          file_name?: string;
          status?: string;
          score?: number | null;
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
        };
        Insert: {
          id?: string;
          task_id: string;
          type: string;
          severity: string;
          reason: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          type?: string;
          severity?: string;
          reason?: string;
          metadata?: Json;
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
          created_at: string;
        };
        Insert: {
          id?: string;
          content: string;
          embedding?: string | null;
          category?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          content?: string;
          embedding?: string | null;
          category?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
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
