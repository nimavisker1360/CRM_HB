import type { SessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { RealtimeEvent } from "@/models/RealtimeEvent";

export type CrmRealtimeEventType =
  | "connected"
  | "agent.avatar.updated"
  | "followup.created"
  | "followup.updated"
  | "notification.created";

export type CrmRealtimeEvent = {
  agentId?: string;
  createdAt: string;
  followUpId?: string;
  id: string;
  notificationId?: string;
  resource?: "agents" | "follow-ups" | "notifications";
  type: CrmRealtimeEventType;
  userId?: string;
};

type RealtimeSubscriber = (event: CrmRealtimeEvent) => void;

const GLOBAL_KEY = "__hbCrmRealtimeSubscribers";

function subscribers() {
  const globalWithSubscribers = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: Set<RealtimeSubscriber>;
  };
  if (!globalWithSubscribers[GLOBAL_KEY]) {
    globalWithSubscribers[GLOBAL_KEY] = new Set<RealtimeSubscriber>();
  }
  return globalWithSubscribers[GLOBAL_KEY];
}

function eventId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function publishRealtimeEvent(event: Omit<CrmRealtimeEvent, "createdAt" | "id">) {
  const payload: CrmRealtimeEvent = {
    ...event,
    createdAt: new Date().toISOString(),
    id: eventId(),
  };

  for (const subscriber of subscribers()) {
    subscriber(payload);
  }

  await connectToDatabase();
  await RealtimeEvent.create({
    agentId: payload.agentId,
    eventId: payload.id,
    followUpId: payload.followUpId,
    notificationId: payload.notificationId,
    resource: payload.resource,
    type: payload.type,
    userId: payload.userId,
  });

  return payload;
}

export function subscribeRealtimeEvents(subscriber: RealtimeSubscriber) {
  const currentSubscribers = subscribers();
  currentSubscribers.add(subscriber);
  return () => {
    currentSubscribers.delete(subscriber);
  };
}

export function canReceiveRealtimeEvent(session: SessionUser, event: CrmRealtimeEvent) {
  if (event.type === "connected") return true;
  if (session.role === "ADMIN" || session.role === "MANAGER") return true;
  if (event.agentId && session.agentId && event.agentId === session.agentId) return true;
  if (event.userId && event.userId === session.userId) return true;
  return false;
}
