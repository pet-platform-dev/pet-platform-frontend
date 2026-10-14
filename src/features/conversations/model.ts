import { z } from "zod";
export const canMessageListing = (
  status: string,
  userId: string | undefined,
  ownerId: string,
) => status === "ACTIVE" && userId !== ownerId;
export const messageInputSchema = z.strictObject({
  text: z
    .string()
    .trim()
    .min(1, "Введіть повідомлення")
    .max(3000, "Не більше 3000 символів"),
});
export const messageSchema = z.object({
  id: z.uuid(),
  text: z.string().max(3000),
  isOwn: z.boolean(),
  createdAt: z.iso.datetime(),
  readAt: z.iso.datetime().nullable(),
});
export type Message = z.infer<typeof messageSchema>;
const listingContextSchema = z
  .object({
    id: z.uuid(),
    title: z.string().max(200),
    imageUrl: z
      .string()
      .nullable()
      .transform((value) => {
        if (!value) return null;
        try {
          const u = new URL(value);
          return u.protocol === "https:" && !u.username && !u.password
            ? value
            : null;
        } catch {
          return null;
        }
      }),
    breed: z.string().nullable(),
    available: z.boolean(),
    href: z.string().nullable(),
  })
  .transform((row) => ({
    ...row,
    href: row.available && row.href === "/listings/" + row.id ? row.href : null,
  }));
export const conversationSchema = z.object({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  lastMessageAt: z.iso.datetime(),
  listing: listingContextSchema,
  otherParticipant: z.object({
    id: z.uuid().nullable(),
    displayName: z.string(),
  }),
  canSend: z.boolean(),
  unreadCount: z.number().int().nonnegative(),
  lastMessage: messageSchema.nullable(),
});
export type Conversation = z.infer<typeof conversationSchema>;
const metaSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().min(1).max(100),
  total: z.number().int().nonnegative(),
  pages: z.number().int().nonnegative(),
});
export const inboxSchema = z.object({
  data: z.array(conversationSchema).max(100),
  meta: metaSchema,
});
export const messagesSchema = z.object({
  data: z.array(messageSchema).max(100),
  meta: metaSchema,
});
export const unreadSchema = z.object({ count: z.number().int().nonnegative() });
export const readResultSchema = z.object({
  updatedCount: z.number().int().nonnegative(),
});
export const conversationHref = (id: string) =>
  "/messages/" + z.uuid().parse(id);
export const messageBadge = (count: number) =>
  count > 99 ? "99+" : count > 0 ? String(count) : "";
export const messageNavigationLabel = (count: number) =>
  count > 0 ? `Повідомлення, непрочитаних: ${count}` : "Повідомлення";
export const messagePreview = (text: string) =>
  text.replace(/\s+/gu, " ").trim();
const zone = "Europe/Kyiv";
export const messageDay = (stamp: string | Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(stamp));
export const messageTime = (stamp: string) =>
  new Intl.DateTimeFormat("uk-UA", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(stamp));
export function historyDay(stamp: string, now = new Date()) {
  const day = messageDay(stamp),
    today = messageDay(now);
  if (day === today) return "Сьогодні";
  const yesterday = new Date(today + "T12:00:00Z");
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (day === messageDay(yesterday)) return "Учора";
  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: zone,
    day: "numeric",
    month: "long",
    ...(day.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}),
  }).format(new Date(stamp));
}
export function inboxDate(stamp: string, now = new Date()) {
  if (messageDay(stamp) === messageDay(now)) return messageTime(stamp);
  const label = historyDay(stamp, now);
  if (label === "Учора") return label;
  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: zone,
    day: "numeric",
    month: "short",
    ...(messageDay(stamp).slice(0, 4) !== messageDay(now).slice(0, 4)
      ? { year: "numeric" }
      : {}),
  }).format(new Date(stamp));
}
export const messageDate = (stamp: string) =>
  new Intl.DateTimeFormat("uk-UA", {
    timeZone: zone,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(stamp));
