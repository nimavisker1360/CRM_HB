import type { Types } from "mongoose";

export const AUTOMATION_JOB_TYPES = [
  "DAILY_MATCHING",
  "NEW_PROPERTY_MATCHING",
  "PENDING_IMPORT_MATCHING",
  "FOLLOWUP_REMINDER",
  "OVERDUE_FOLLOWUP_CHECK",
  "INACTIVE_CUSTOMER_CHECK",
] as const;

export const AUTOMATION_STATUSES = ["PENDING", "RUNNING", "SUCCESS", "PARTIAL", "FAILED", "CANCELLED"] as const;
export const AUTOMATION_TRIGGER_TYPES = ["CRON", "MANUAL", "SYSTEM"] as const;

export type AutomationJobType = (typeof AUTOMATION_JOB_TYPES)[number];
export type AutomationStatus = (typeof AUTOMATION_STATUSES)[number];
export type AutomationTriggerType = (typeof AUTOMATION_TRIGGER_TYPES)[number];

export type AutomationJobContext = {
  batchSize: number;
  inactiveCustomerDays: number;
  jobId: Types.ObjectId;
  maxItems: number;
  now: Date;
  runId: string;
};

export type AutomationJobResult = {
  batchCount?: number;
  errorDetails?: unknown;
  errorMessage?: string;
  failedCount?: number;
  hasMore?: boolean;
  metadata?: Record<string, unknown>;
  processedCount?: number;
  skippedCount?: number;
  successCount?: number;
};

export type AutomationDefinition = {
  description: string;
  heavy?: boolean;
  name: string;
  schedule?: string;
  type: AutomationJobType;
  run: (context: AutomationJobContext) => Promise<AutomationJobResult>;
};
