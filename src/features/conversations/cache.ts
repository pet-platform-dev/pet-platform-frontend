import type { QueryClient } from "@tanstack/react-query";
import type { User } from "@/entities/user/model";
import { refreshNotifications } from "@/features/notifications/cache";
export const conversationKeys = {
  root: (userId: string) => ["conversations", userId] as const,
  list: (userId: string, page: number) =>
    ["conversations", userId, "list", page] as const,
  detail: (userId: string, id: string) =>
    ["conversations", userId, "detail", id] as const,
  messages: (userId: string, id: string, page: number) =>
    ["conversations", userId, "messages", id, page] as const,
  history: (userId: string, id: string) =>
    ["conversations", userId, "history", id] as const,
  live: (userId: string, id: string) =>
    ["conversations", userId, "live", id] as const,
  unreadCount: (userId: string) =>
    ["conversations", userId, "unread-count"] as const,
};
export const currentConversationUser = (client: QueryClient, userId: string) =>
  client.getQueryData<User | null>(["current-user"])?.id === userId;
export async function refreshConversations(
  client: QueryClient,
  userId: string,
) {
  if (currentConversationUser(client, userId))
    await client.invalidateQueries({ queryKey: conversationKeys.root(userId) });
}
export async function refreshConversationRead(
  client: QueryClient,
  userId: string,
) {
  if (!currentConversationUser(client, userId)) return;
  await Promise.all([
    refreshConversations(client, userId),
    refreshNotifications(client, userId),
  ]);
}
