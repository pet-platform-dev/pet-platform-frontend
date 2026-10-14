import { z } from "zod";

export function safeNotificationHref(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length > 1000 ||
    /[\\\s\u0000-\u001f\u007f]/.test(value) ||
    /%(?:2f|5c|2e|25|0[0-9a-f]|1[0-9a-f]|7f)/i.test(value)
  )
    return null;
  if (
    !/^\/(?:account|my-listings|listings|mating|messages|pets|profile|favorites|sellers|breeders)(?:[/?#]|$)/.test(
      value,
    )
  )
    return null;
  const url = new URL(value, "https://application.invalid");
  if (
    url.origin !== "https://application.invalid" ||
    value.split(/[?#]/)[0] !== url.pathname
  )
    return null;
  return value;
}
export const notificationSchema = z.object({
  id: z.uuid(),
  type: z.enum([
    "MODERATION_APPROVED",
    "MODERATION_REJECTED",
    "MODERATION_HIDDEN",
    "NEW_MESSAGE",
    "REPORT_RESOLVED",
    "SYSTEM",
    "PET_REMINDER_DUE",
  ]),
  title: z.string().max(160),
  body: z.string().max(2000),
  href: z.string().nullable().transform(safeNotificationHref),
  readAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  dueAt: z.iso.datetime().optional(),
});
export type Notification = z.infer<typeof notificationSchema>;
export const notificationListSchema = z.object({
  data: z.array(notificationSchema).max(100),
  meta: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().min(1).max(100),
    total: z.number().int().nonnegative(),
    pages: z.number().int().nonnegative(),
  }),
});
export type NotificationList = z.infer<typeof notificationListSchema>;
export const countSchema = z.object({ count: z.number().int().nonnegative() });
export const readAllSchema = z.object({
  updatedCount: z.number().int().nonnegative(),
});
export const notificationCount = (count: number) =>
  count > 99 ? "99+" : count > 0 ? String(count) : "";
export const notificationLabel = (count: number) =>
  count > 0 ? `Сповіщення, непрочитаних: ${count}` : "Сповіщення";
export const notificationDate = (stamp: string) =>
  new Intl.DateTimeFormat("uk-UA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(stamp));

// Due date is an immutable snapshot, rendered in the current browser timezone.
export const notificationBody = (item: Notification) =>
  item.type === "PET_REMINDER_DUE" && item.dueAt
    ? item.body +
      " — " +
      new Intl.DateTimeFormat("uk-UA", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(item.dueAt))
    : item.body;
