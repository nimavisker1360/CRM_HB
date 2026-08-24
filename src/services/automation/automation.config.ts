import type { AutomationDefinition, AutomationJobType } from "@/services/automation/automation.types";
import { runDailyMatchingJob } from "@/services/automation/jobs/daily-matching.job";
import { runFollowupReminderJob } from "@/services/automation/jobs/followup-reminder.job";
import { runInactiveCustomerJob } from "@/services/automation/jobs/inactive-customer.job";
import { runNewPropertyMatchingJob } from "@/services/automation/jobs/new-property-matching.job";
import { runOverdueFollowupJob } from "@/services/automation/jobs/overdue-followup.job";
import { runPendingImportMatchingJob } from "@/services/automation/jobs/pending-import-matching.job";

function intFromEnv(name: string, fallback: number, min = 1) {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value) || value < min) return fallback;
  return Math.floor(value);
}

export const BUSINESS_TIME_ZONE = "Europe/Istanbul";
export const AUTOMATION_BATCH_SIZE = intFromEnv("AUTOMATION_BATCH_SIZE", 50);
export const AUTOMATION_MAX_ITEMS_PER_RUN = intFromEnv("AUTOMATION_MAX_ITEMS_PER_RUN", 50);
export const AUTOMATION_LOCK_TTL_MS = intFromEnv("AUTOMATION_LOCK_TTL_SECONDS", 9 * 60, 30) * 1000;
export const INACTIVE_CUSTOMER_DAYS = intFromEnv("INACTIVE_CUSTOMER_DAYS", 7);

export const AUTOMATION_DEFINITIONS: Record<AutomationJobType, AutomationDefinition> = {
  DAILY_MATCHING: {
    description: "محاسبه دوباره تطبیق مشتری‌هایی که وضعیت تطبیق آن‌ها در انتظار یا قدیمی است.",
    heavy: true,
    name: "تطبیق روزانه مشتری‌ها",
    run: runDailyMatchingJob,
    schedule: "0 0 * * *",
    type: "DAILY_MATCHING",
  },
  FOLLOWUP_REMINDER: {
    description: "آماده‌سازی یادآور داخلی برای پیگیری‌های امروز بر اساس زمان استانبول.",
    name: "یادآور پیگیری امروز",
    run: runFollowupReminderJob,
    schedule: "0 6 * * *",
    type: "FOLLOWUP_REMINDER",
  },
  INACTIVE_CUSTOMER_CHECK: {
    description: "شناسایی مشتری‌های فعال که اخیراً فعالیتی نداشته‌اند.",
    name: "بررسی مشتری‌های غیرفعال",
    run: runInactiveCustomerJob,
    schedule: "30 1 * * *",
    type: "INACTIVE_CUSTOMER_CHECK",
  },
  NEW_PROPERTY_MATCHING: {
    description: "پیدا کردن مشتری‌های مناسب برای ملک‌های فعال با وضعیت تطبیق در انتظار.",
    heavy: true,
    name: "تطبیق ملک‌های جدید",
    run: runNewPropertyMatchingJob,
    schedule: "30 0 * * *",
    type: "NEW_PROPERTY_MATCHING",
  },
  OVERDUE_FOLLOWUP_CHECK: {
    description: "شناسایی پیگیری‌های عقب‌افتاده و آماده‌سازی هشدار داخلی.",
    name: "بررسی پیگیری‌های عقب‌افتاده",
    run: runOverdueFollowupJob,
    schedule: "5 6 * * *",
    type: "OVERDUE_FOLLOWUP_CHECK",
  },
  PENDING_IMPORT_MATCHING: {
    description: "پردازش رکوردهای واردشده مشتری و ملک که منتظر تطبیق هستند.",
    heavy: true,
    name: "تطبیق داده‌های واردشده",
    run: runPendingImportMatchingJob,
    schedule: "0 */6 * * *",
    type: "PENDING_IMPORT_MATCHING",
  },
};
