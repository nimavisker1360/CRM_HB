import { requireSession } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { RealtimeEvent } from "@/models/RealtimeEvent";
import {
  canReceiveRealtimeEvent,
  subscribeRealtimeEvents,
  type CrmRealtimeEvent,
} from "@/services/realtime/realtime-bus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function encodeSse(event: CrmRealtimeEvent) {
  return `id: ${event.id}\nevent: crm\ndata: ${JSON.stringify(event)}\n\n`;
}

export async function GET(request: Request) {
  const session = await requireSession();
  await connectToDatabase();

  const lastEventId = request.headers.get("last-event-id");
  const lastEvent = lastEventId
    ? await RealtimeEvent.findOne({ eventId: lastEventId }).select("createdAt").lean()
    : null;
  let cursor = lastEvent?.createdAt || new Date(Date.now() - 10_000);
  const encoder = new TextEncoder();
  let cleanup = () => {};
  let closed = false;
  let polling = false;
  const seenEventIds = new Set<string>(lastEventId ? [lastEventId] : []);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      function enqueue(value: string) {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(value));
        } catch {
          cleanup();
        }
      }

      function close() {
        if (closed) return;
        closed = true;
        cleanup();
        try {
          controller.close();
        } catch {
          // The client may have already closed the stream.
        }
      }

      const unsubscribe = subscribeRealtimeEvents((event) => {
        if (canReceiveRealtimeEvent(session, event)) {
          seenEventIds.add(event.id);
          enqueue(encodeSse(event));
        }
      });
      const heartbeat = setInterval(() => enqueue(`: ping ${Date.now()}\n\n`), 25_000);

      async function pollPersistedEvents() {
        if (closed || polling) return;
        polling = true;

        try {
          const audienceQuery =
            session.role === "AGENT"
              ? {
                  $or: [
                    ...(session.agentId ? [{ agentId: session.agentId }] : []),
                    { userId: session.userId },
                  ],
                }
              : {};
          const events = await RealtimeEvent.find({
            ...audienceQuery,
            createdAt: { $gte: cursor },
          })
            .sort({ createdAt: 1, _id: 1 })
            .limit(200)
            .lean();

          for (const event of events) {
            const createdAt = new Date(event.createdAt);
            if (createdAt > cursor) cursor = createdAt;
            if (seenEventIds.has(event.eventId)) continue;

            const payload: CrmRealtimeEvent = {
              agentId: event.agentId || undefined,
              createdAt: createdAt.toISOString(),
              followUpId: event.followUpId || undefined,
              id: event.eventId,
              notificationId: event.notificationId || undefined,
              resource: event.resource || undefined,
              type: event.type,
              userId: event.userId || undefined,
            };

            if (canReceiveRealtimeEvent(session, payload)) {
              seenEventIds.add(payload.id);
              enqueue(encodeSse(payload));
            }
          }

          if (seenEventIds.size > 2_000) {
            const recentIds = [...seenEventIds].slice(-1_000);
            seenEventIds.clear();
            recentIds.forEach((id) => seenEventIds.add(id));
          }
        } catch (error) {
          console.error("Failed to poll realtime events", error);
        } finally {
          polling = false;
        }
      }

      const poller = setInterval(() => void pollPersistedEvents(), 1_000);

      cleanup = () => {
        clearInterval(heartbeat);
        clearInterval(poller);
        unsubscribe();
      };

      enqueue(
        encodeSse({
          createdAt: new Date().toISOString(),
          id: "connected",
          type: "connected",
        }),
      );
      void pollPersistedEvents();
      request.signal.addEventListener("abort", close, { once: true });
    },
    cancel() {
      closed = true;
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
