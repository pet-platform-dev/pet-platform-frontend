import { z } from "zod";
import { authenticatedRequest } from "@/shared/api/client";
import {
  conversationSchema,
  inboxSchema,
  messagesSchema,
  messageSchema,
  messageInputSchema,
  unreadSchema,
  readResultSchema,
} from "./model";
export async function getInbox(page: number, signal?: AbortSignal) {
  return inboxSchema.parse(
    await authenticatedRequest<unknown>(
      `/conversations?page=${page}&limit=20`,
      { signal },
      true,
    ),
  );
}
export async function getConversation(id: string, signal?: AbortSignal) {
  const row = conversationSchema.parse(
    await authenticatedRequest<unknown>(
      "/conversations/" + z.uuid().parse(id),
      { signal },
    ),
  );
  if (row.id !== id) throw Error("Invalid conversation");
  return row;
}
export async function getMessages(
  id: string,
  page: number,
  signal?: AbortSignal,
) {
  return messagesSchema.parse(
    await authenticatedRequest<unknown>(
      `/conversations/${z.uuid().parse(id)}/messages?page=${page}&limit=20`,
      { signal },
      true,
    ),
  );
}
export async function startConversation(listingId: string, text: string) {
  return conversationSchema.parse(
    await authenticatedRequest<unknown>(
      `/listings/${z.uuid().parse(listingId)}/conversation`,
      {
        method: "POST",
        body: JSON.stringify(messageInputSchema.parse({ text })),
      },
    ),
  );
}
export async function sendMessage(id: string, text: string) {
  return messageSchema.parse(
    await authenticatedRequest<unknown>(
      `/conversations/${z.uuid().parse(id)}/messages`,
      {
        method: "POST",
        body: JSON.stringify(messageInputSchema.parse({ text })),
      },
    ),
  );
}
export async function readConversation(id: string, throughMessageId: string) {
  return readResultSchema.parse(
    await authenticatedRequest<unknown>(
      `/conversations/${z.uuid().parse(id)}/read`,
      {
        method: "POST",
        body: JSON.stringify({
          throughMessageId: z.uuid().parse(throughMessageId),
        }),
      },
    ),
  );
}
export async function getConversationUnreadCount(signal?: AbortSignal) {
  return unreadSchema.parse(
    await authenticatedRequest<unknown>("/conversations/unread-count", {
      signal,
    }),
  );
}
