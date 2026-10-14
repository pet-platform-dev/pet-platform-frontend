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
export const messageDate = (stamp: string) =>
  new Intl.DateTimeFormat("uk-UA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(stamp));
