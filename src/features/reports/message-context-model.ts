import { z } from "zod";
const person = z.object({ id: z.uuid().nullable(), displayName: z.string() });
export const contextMessageSchema = z.object({
  id: z.uuid(),
  text: z.string().max(3000),
  createdAt: z.iso.datetime(),
  sender: person,
  isReported: z.boolean(),
});
export const messageReportContextSchema = z.object({
  conversationId: z.uuid(),
  listing: z.object({
    title: z.string(),
    breed: z.string().nullable(),
    imageUrl: z.string().nullable(),
  }),
  participants: z.array(person).length(2),
  message: contextMessageSchema.omit({ isReported: true }),
  available: z.boolean().optional(),
  messages: z.array(contextMessageSchema).max(21),
});
export const fullContextSchema = z.object({
  data: messageReportContextSchema,
  meta: z.object({
    page: z.number().int().positive(),
    limit: z.literal(20),
    total: z.number().int().nonnegative(),
    pages: z.number().int().nonnegative(),
  }),
});
export type MessageReportContext = z.infer<typeof messageReportContextSchema>;
