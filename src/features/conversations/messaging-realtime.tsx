"use client";
import { useEffect, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { messagingSocketUrl, startMessagingRealtime } from "./realtime";
import { currentSessionGeneration } from "@/shared/api/client";
const subscribeSession = (listener: () => void) => {
  window.addEventListener("pet-platform-session-changed", listener);
  return () =>
    window.removeEventListener("pet-platform-session-changed", listener);
};

export function MessagingRealtime() {
  const userId = useSession().data?.id,
    client = useQueryClient();
  const generation = useSyncExternalStore(
    subscribeSession,
    currentSessionGeneration,
    () => 0,
  );
  useEffect(() => {
    if (!userId) return;
    let stop: (() => void) | undefined;
    try {
      stop = startMessagingRealtime(client, userId, {
        url: messagingSocketUrl(
          process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1",
          window.location.origin,
        ),
      });
    } catch {
      /* HTTP fallback */
    }
    const changed = () => stop?.();
    window.addEventListener("pet-platform-session-changed", changed);
    return () => {
      window.removeEventListener("pet-platform-session-changed", changed);
      stop?.();
    };
  }, [client, userId, generation]);
  return null;
}
