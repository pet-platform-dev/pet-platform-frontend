import { authenticatedRequest } from "@/shared/api/client";
import {
  countSchema,
  notificationListSchema,
  notificationSchema,
  readAllSchema,
} from "./model";
export async function getNotifications(page: number, signal?: AbortSignal) {
  return notificationListSchema.parse(
    await authenticatedRequest<unknown>(
      `/notifications?page=${page}&limit=20`,
      { signal },
      true,
    ),
  );
}
export async function getUnreadCount(signal?: AbortSignal) {
  return countSchema.parse(
    await authenticatedRequest<unknown>("/notifications/unread-count", {
      signal,
    }),
  );
}
export async function readNotification(id: string) {
  return notificationSchema.parse(
    await authenticatedRequest<unknown>(`/notifications/${id}/read`, {
      method: "POST",
      body: "{}",
    }),
  );
}
export async function readAllNotifications() {
  return readAllSchema.parse(
    await authenticatedRequest<unknown>("/notifications/read-all", {
      method: "POST",
      body: "{}",
    }),
  );
}

export async function readReminderNotifications(
  petId: string,
  reminderIds: string[],
  signal?: AbortSignal,
) {
  return readAllSchema.parse(
    await authenticatedRequest<unknown>("/notifications/read-reminders", {
      method: "POST",
      body: JSON.stringify({ petId, reminderIds }),
      signal,
    }),
  );
}
