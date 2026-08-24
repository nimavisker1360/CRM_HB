import { NOTIFICATION_INTERNAL_ROUTES } from "@/services/notifications/notification.config";

export function safeNotificationActionUrl(value?: string) {
  if (!value) return undefined;
  if (!value.startsWith("/") || value.startsWith("//")) return undefined;
  if (value.includes("\\") || value.includes("\n") || value.includes("\r")) return undefined;
  const path = value.split("?")[0];
  if (!NOTIFICATION_INTERNAL_ROUTES.some((route) => path === route || path.startsWith(`${route}/`))) {
    return undefined;
  }
  return value;
}
