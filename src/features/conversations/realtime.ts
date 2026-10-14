import { z } from "zod";
import { refreshNotifications } from "@/features/notifications/cache";
import { io, type Socket } from "socket.io-client";
import type { QueryClient } from "@tanstack/react-query";
import {
  currentSessionGeneration,
  messagingAccessToken,
} from "@/shared/api/client";
import { currentConversationUser } from "./cache";
import {
  newMessageEvent,
  readEvent,
  patchRealtimeMessage,
  reconcileRealtime,
  refreshRealtimeSummaries,
} from "./realtime-cache";

export function messagingSocketUrl(apiBase: string, origin: string) {
  const api = new URL(apiBase, origin);
  if (
    !["https:", "http:"].includes(api.protocol) ||
    api.username ||
    api.password
  )
    throw Error("Invalid API URL");
  return api.origin + "/messaging";
}
export function startMessagingRealtime(
  client: QueryClient,
  userId: string,
  options: {
    socket?: Socket;
    url?: string;
    token?: () => Promise<string>;
    generation?: () => number;
  } = {},
) {
  const generation = options.generation ?? currentSessionGeneration;
  const version = generation();
  let alive = true,
    retries = 0;
  let refresh: ReturnType<typeof setTimeout> | undefined,
    reconnect: ReturnType<typeof setTimeout> | undefined;
  let notificationRefresh: ReturnType<typeof setTimeout> | undefined;
  const seen = new Set<string>();
  const current = () =>
    alive &&
    generation() === version &&
    currentConversationUser(client, userId);
  const socket =
    options.socket ??
    io(options.url!, {
      autoConnect: false,
      forceNew: true,
      transports: ["websocket"],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
  socket.auth = (callback) => {
    void (options.token ?? (() => messagingAccessToken(userId)))().then(
      (token) => {
        if (current()) callback({ token });
      },
      () => {
        if (current()) callback({ token: "" });
      },
    );
  };
  const summaries = () => {
    if (refresh) return;
    refresh = setTimeout(() => {
      refresh = undefined;
      if (current()) void refreshRealtimeSummaries(client, userId);
    }, 60);
  };
  const message = (input: unknown) => {
    if (!current()) return;
    const parsed = newMessageEvent.safeParse(input);
    if (!parsed.success || seen.has(parsed.data.message.id)) return;
    seen.add(parsed.data.message.id);
    if (seen.size > 256) seen.delete(seen.values().next().value!);
    patchRealtimeMessage(client, userId, parsed.data);
    summaries();
  };
  const read = (input: unknown) => {
    if (current() && readEvent.safeParse(input).success)
      void reconcileRealtime(client, userId);
  };
  const notificationsChanged = (input: unknown) => {
    if (
      !current() ||
      !z.strictObject({}).safeParse(input).success ||
      notificationRefresh
    )
      return;
    notificationRefresh = setTimeout(() => {
      notificationRefresh = undefined;
      if (current()) void refreshNotifications(client, userId);
    }, 60);
  };
  const connected = () => {
    retries = 0;
    if (current()) void reconcileRealtime(client, userId);
  };
  const retry = () => {
    if (!current() || reconnect || retries >= 3) return;
    reconnect = setTimeout(
      () => {
        reconnect = undefined;
        if (current()) socket.connect();
      },
      Math.min(30000, 2000 * 2 ** retries++),
    );
  };
  const disconnected = (reason: string) => {
    if (reason === "io server disconnect") retry();
  };
  // Transport failures already use the Manager's backoff. Only authentication
  // denials need an explicit bounded retry (Socket.IO leaves them inactive).
  const connectError = () => {
    if (!socket.active) retry();
  };
  const focus = () => {
    if (current()) {
      retries = 0;
      socket.connect();
    }
  };
  socket.on("notifications:changed", notificationsChanged);
  socket.on("message:new", message);
  socket.on("messages:read", read);
  socket.on("connect", connected);
  socket.on("connect_error", connectError);
  socket.on("disconnect", disconnected);
  if (typeof window !== "undefined") window.addEventListener("focus", focus);
  socket.connect();
  return () => {
    if (!alive) return;
    alive = false;
    clearTimeout(refresh);
    clearTimeout(notificationRefresh);
    clearTimeout(reconnect);
    seen.clear();
    socket.off("notifications:changed", notificationsChanged);
    socket.off("message:new", message);
    socket.off("messages:read", read);
    socket.off("connect", connected);
    socket.off("connect_error", connectError);
    socket.off("disconnect", disconnected);
    if (typeof window !== "undefined")
      window.removeEventListener("focus", focus);
    socket.disconnect();
  };
}
