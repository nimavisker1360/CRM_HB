import type { WhatsAppStatus } from "@/services/whatsapp/whatsapp.types";

export const allowedPreviousWhatsAppStatuses: Record<WhatsAppStatus, WhatsAppStatus[]> = {
  DELIVERED: ["QUEUED", "SENDING", "SENT", "DELIVERED"],
  FAILED: ["QUEUED", "SENDING", "SENT", "DELIVERED", "FAILED"],
  QUEUED: ["QUEUED"],
  READ: ["QUEUED", "SENDING", "SENT", "DELIVERED", "READ"],
  SENDING: ["QUEUED", "SENDING"],
  SENT: ["QUEUED", "SENDING", "SENT"],
};

export function mapMetaStatus(status?: string): WhatsAppStatus | null {
  const statuses: Record<string, WhatsAppStatus> = { delivered: "DELIVERED", failed: "FAILED", read: "READ", sent: "SENT" };
  return statuses[status?.toLowerCase() || ""] || null;
}

export function canApplyWhatsAppStatus(current: WhatsAppStatus, incoming: WhatsAppStatus) {
  return allowedPreviousWhatsAppStatuses[incoming].includes(current);
}
