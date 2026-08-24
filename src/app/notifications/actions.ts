"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { firstParam, getAgentScope } from "@/lib/auth/agent-scope";
import { requireSession } from "@/lib/auth/session";
import {
  archiveNotification,
  markAllAsRead,
  markNotificationAsRead,
} from "@/services/notifications/notification.service";
import { safeNotificationActionUrl } from "@/services/notifications/notification-url";

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw : undefined;
}

function notificationScope(session: Awaited<ReturnType<typeof requireSession>>, agentId?: string) {
  return getAgentScope(session, firstParam(agentId));
}

export async function markNotificationReadAction(formData: FormData) {
  const session = await requireSession();
  const id = value(formData, "id");
  if (!id) return;
  const scope = notificationScope(session, value(formData, "agentId"));
  await markNotificationAsRead(id, { scope, session });
  revalidatePath("/notifications");
}

export async function archiveNotificationAction(formData: FormData) {
  const session = await requireSession();
  const id = value(formData, "id");
  if (!id) return;
  const scope = notificationScope(session, value(formData, "agentId"));
  await archiveNotification(id, { scope, session });
  revalidatePath("/notifications");
}

export async function markAllNotificationsReadAction(formData: FormData) {
  const session = await requireSession();
  const agentId = value(formData, "agentId");
  const scope = notificationScope(session, agentId);
  await markAllAsRead({ filters: { agentId }, scope, session });
  revalidatePath("/notifications");
}

export async function openNotificationAction(formData: FormData) {
  const session = await requireSession();
  const id = value(formData, "id");
  const actionUrl = safeNotificationActionUrl(value(formData, "actionUrl")) || "/notifications";
  if (id) {
    const scope = notificationScope(session, value(formData, "agentId"));
    await markNotificationAsRead(id, { scope, session });
  }
  revalidatePath("/notifications");
  redirect(actionUrl);
}
