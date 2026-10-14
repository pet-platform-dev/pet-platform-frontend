import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { messageSchema, type Message } from "./model";
import {
  conversationKeys,
  currentConversationUser,
  refreshConversationRead,
} from "./cache";

export const newMessageEvent = z.strictObject({
  conversationId: z.uuid(),
  message: messageSchema,
});
export const readEvent = z.strictObject({ conversationId: z.uuid() });
type Page = {
  data: Message[];
  meta: { page: number; limit: number; pages: number; total: number };
};
export function patchRealtimeMessage(
  client: QueryClient,
  userId: string,
  input: unknown,
) {
  if (!currentConversationUser(client, userId)) return false;
  const parsed = newMessageEvent.safeParse(input);
  if (!parsed.success) return false;
  const { conversationId, message } = parsed.data;
  // Bounded overlay protects events racing an initial/refetch/older-page HTTP
  // response. HTTP read state wins when the same ID later arrives from history.
  if (
    client.getQueryCache().find({
      queryKey: conversationKeys.history(userId, conversationId),
      exact: true,
    })
  ) {
    client.setQueryData<Message[]>(
      conversationKeys.live(userId, conversationId),
      (live = []) =>
        live.some((m) => m.id === message.id)
          ? live
          : [...live, message].slice(-100),
    );
  }
  client.setQueryData<InfiniteData<Page>>(
    conversationKeys.history(userId, conversationId),
    (history) => {
      if (
        !history?.pages.length ||
        history.pages.some((page) => page.data.some((m) => m.id === message.id))
      )
        return history;
      return {
        ...history,
        pages: history.pages.map((page, i) => ({
          ...page,
          data:
            i === 0
              ? [...page.data, message].sort(
                  (a, b) =>
                    a.createdAt.localeCompare(b.createdAt) ||
                    a.id.localeCompare(b.id),
                )
              : page.data,
          meta: {
            ...page.meta,
            total: page.meta.total + 1,
            pages: Math.ceil((page.meta.total + 1) / page.meta.limit),
          },
        })),
      };
    },
  );
  return true;
}
export async function refreshRealtimeSummaries(
  client: QueryClient,
  userId: string,
) {
  if (!currentConversationUser(client, userId)) return;
  await Promise.all([
    client.invalidateQueries({
      predicate: ({ queryKey: key }) =>
        key[0] === "conversations" &&
        key[1] === userId &&
        key[2] !== "history" &&
        key[2] !== "messages",
    }),
    client.invalidateQueries({ queryKey: ["notifications", userId] }),
  ]);
}
export const reconcileRealtime = refreshConversationRead;
