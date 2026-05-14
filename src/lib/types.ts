export type AppStatus = "active" | "experimental" | "paused" | "deprecated";
export type AppPriority = "P0" | "P1" | "P2" | "P3";

export interface AppRow {
  id: string;
  app_name: string;
  app_slug: string;
  app_url: string | null;
  github_repo_url: string | null;
  supabase_project_name: string | null;
  supabase_project_group: string | null;
  category: string | null;
  status: AppStatus;
  priority: AppPriority;
  description: string | null;
  notes: string | null;
  high_leverage: boolean;
  created_at: string;
  updated_at: string;
}

export interface UsageEventRow {
  id: string;
  app_id: string | null;
  app_slug: string;
  event_name: string;
  event_type: string | null;
  source_app: string | null;
  user_id: string | null;
  metadata: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
}

export interface WeeklySummaryRow {
  id: string;
  week_start: string;
  week_end: string;
  total_events: number;
  total_active_apps: number;
  top_apps: Array<{ app_slug: string; app_name: string; events: number; pct: number }>;
  dead_apps: Array<{ app_slug: string; app_name: string; last_used: string | null }>;
  ai_summary: string | null;
  sent_email: boolean;
  created_at: string;
}

export const STANDARD_EVENT_NAMES = [
  "app_opened",
  "page_viewed",
  "report_viewed",
  "recommendation_generated",
  "recommendation_accepted",
  "recommendation_ignored",
  "email_sent",
  "task_created",
  "decision_logged",
  "feedback_submitted",
] as const;

export type StandardEventName = (typeof STANDARD_EVENT_NAMES)[number];
