import type { QueryClient } from "@tanstack/react-query";
import type { User } from "@/entities/user/model";
export const notificationKeys = {
  root: (userId: string) => ["notifications", userId] as const,
  list: (userId: string, page: number) =>
    ["notifications", userId, "list", page] as const,
  unreadCount: (userId: string) =>
    ["notifications", userId, "unread-count"] as const,
};
export async function refreshNotifications(
  client: QueryClient,
  userId: string,
) {
  if (client.getQueryData<User | null>(["current-user"])?.id !== userId) return;
  await client.invalidateQueries({ queryKey: notificationKeys.root(userId) });
}
