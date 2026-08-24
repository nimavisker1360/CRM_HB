"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { CrmRealtimeEvent } from "@/services/realtime/realtime-bus";

const REFRESHABLE_ROUTES = ["/dashboard", "/follow-ups", "/notifications", "/agents"];

export const CRM_REALTIME_EVENT = "crm:realtime";

function shouldRefreshPath(pathname: string, event: CrmRealtimeEvent) {
  if (event.type === "connected") return false;
  if (event.type === "agent.avatar.updated") return true;
  return REFRESHABLE_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function playNotificationChime(context: AudioContext) {
  const startedAt = context.currentTime;
  const notes = [
    { frequency: 659.25, offset: 0, duration: 0.13 },
    { frequency: 880, offset: 0.14, duration: 0.2 },
  ];

  for (const note of notes) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const noteStartedAt = startedAt + note.offset;
    const noteEndedAt = noteStartedAt + note.duration;

    oscillator.frequency.setValueAtTime(note.frequency, noteStartedAt);
    oscillator.type = "sine";
    gain.gain.setValueAtTime(0.0001, noteStartedAt);
    gain.gain.exponentialRampToValueAtTime(0.12, noteStartedAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteEndedAt);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(noteStartedAt);
    oscillator.stop(noteEndedAt);
  }
}

export function RealtimeBridge() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined" || typeof AudioContext === "undefined") return;

    let audioContext: AudioContext | null = null;

    function getAudioContext() {
      audioContext ??= new AudioContext();
      return audioContext;
    }

    async function unlockAudio() {
      const context = getAudioContext();
      if (context.state === "suspended") {
        await context.resume().catch(() => undefined);
      }
      if (context.state === "running") {
        window.removeEventListener("pointerdown", unlockAudio);
        window.removeEventListener("keydown", unlockAudio);
      }
    }

    async function handleRealtimeSound(event: Event) {
      const detail = (event as CustomEvent<CrmRealtimeEvent>).detail;
      if (detail?.type !== "notification.created") return;

      const context = getAudioContext();
      if (context.state === "suspended") {
        await context.resume().catch(() => undefined);
      }
      if (context.state === "running") {
        playNotificationChime(context);
      }
    }

    window.addEventListener("pointerdown", unlockAudio);
    window.addEventListener("keydown", unlockAudio);
    window.addEventListener(CRM_REALTIME_EVENT, handleRealtimeSound);

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      window.removeEventListener(CRM_REALTIME_EVENT, handleRealtimeSound);
      if (audioContext && audioContext.state !== "closed") {
        void audioContext.close();
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;

    const source = new EventSource("/api/realtime");
    source.addEventListener("crm", (message) => {
      try {
        const event = JSON.parse(message.data) as CrmRealtimeEvent;
        window.dispatchEvent(new CustomEvent<CrmRealtimeEvent>(CRM_REALTIME_EVENT, { detail: event }));
        if (shouldRefreshPath(pathname, event)) {
          router.refresh();
        }
      } catch {
        // Ignore malformed frames; EventSource keeps the live connection open.
      }
    });

    return () => source.close();
  }, [pathname, router]);

  return null;
}
