"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { RequireSession } from "@/features/auth/require-session";
import { useSession } from "@/features/auth/session-provider";
import { ApiError } from "@/shared/api/client";
import {
  conversationKeys,
  currentConversationUser,
  refreshConversations,
  refreshConversationRead,
} from "./cache";
import {
  getConversation,
  getMessages,
  readConversation,
  sendMessage,
} from "./api";
import { ConversationContext } from "./conversation-context";
import { MessageComposer } from "./message-composer";
import { ScrollHistory } from "./scroll-history";
import { mergeHistory } from "./history-scroll";
import { MessagesLoading } from "./messages-loading";
import { useMessagingVisible } from "./page-visible";
import type { Message } from "./model";
export function ConversationDetail({ id }: { id: string }) {
  return (
    <RequireSession returnTo={"/messages/" + id}>
      <ConversationContent key={id} id={id} />
    </RequireSession>
  );
}
function ConversationContent({ id }: { id: string }) {
  const visible = useMessagingVisible();
  const userId = useSession().data!.id,
    client = useQueryClient(),
    [sentId, setSentId] = useState<string>(),
    readBoundary = useRef<string | null>(null);
  const detail = useQuery({
    queryKey: conversationKeys.detail(userId, id),
    queryFn: ({ signal }) => getConversation(id, signal),
    staleTime: 0,
    refetchOnWindowFocus: "always",
  });
  const history = useInfiniteQuery({
    queryKey: conversationKeys.history(userId, id),
    initialPageParam: 1,
    queryFn: ({ signal, pageParam }) => getMessages(id, pageParam, signal),
    getNextPageParam: (last) =>
      last.meta.page < last.meta.pages ? last.meta.page + 1 : undefined,
    enabled: detail.isSuccess,
    staleTime: 0,
    refetchOnWindowFocus: "always",
  });
  const live = useQuery<Message[]>({
    queryKey: conversationKeys.live(userId, id),
    queryFn: () => [],
    enabled: false,
  });
  const messages = mergeHistory([
    ...(history.data?.pages ?? []),
    { data: live.data ?? [] },
  ]);
  const read = useMutation({
    mutationKey: conversationKeys.root(userId),
    retry: false,
    mutationFn: (through: string) => {
      if (!currentConversationUser(client, userId))
        throw new DOMException("Session changed", "AbortError");
      return readConversation(id, through);
    },
    onSuccess: () => refreshConversationRead(client, userId),
  });
  const readId = history.isSuccess ? messages.at(-1)?.id : undefined;
  const incoming =
    history.isSuccess &&
    ((detail.data?.unreadCount ?? 0) > 0 ||
      messages.some((m) => !m.isOwn && !m.readAt));
  const markRead = read.mutate;
  const reading = read.isPending;
  useEffect(() => {
    if (
      visible &&
      !reading &&
      readId &&
      incoming &&
      readBoundary.current !== readId
    ) {
      const timer = setTimeout(() => {
        readBoundary.current = readId;
        markRead(readId);
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [readId, incoming, markRead, visible, reading]);
  const send = useMutation({
    mutationKey: conversationKeys.root(userId),
    retry: false,
    mutationFn: async (text: string) => {
      if (!currentConversationUser(client, userId))
        throw new DOMException("Session changed", "AbortError");
      const row = await sendMessage(id, text);
      if (!currentConversationUser(client, userId))
        throw new DOMException("Session changed", "AbortError");
      return row;
    },
    onSuccess: (message) => {
      if (!currentConversationUser(client, userId)) return;
      setSentId(message.id);
      return refreshConversations(client, userId);
    },
  });
  return (
    <main className="catalog-shell messages-page conversation-page">
      <Link className="conversation-back" href="/messages">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m12 19-7-7 7-7M5 12h14" />
        </svg>
        До повідомлень
      </Link>
      <h1>Розмова</h1>
      {detail.isPending ? (
        <MessagesLoading kind="conversation" />
      ) : detail.isError ? (
        <section className="messages-panel" role="alert">
          <p>
            {detail.error instanceof ApiError && detail.error.status === 404
              ? "Розмова недоступна."
              : "Не вдалося завантажити розмову."}
          </p>
          <button
            className="button secondary"
            onClick={() => void detail.refetch()}
          >
            Спробувати ще раз
          </button>
        </section>
      ) : (
        <>
          <ConversationContext conversation={detail.data} />
          {history.isPending ? (
            <MessagesLoading kind="history" />
          ) : history.isError && !history.data ? (
            <div className="messages-panel" role="alert">
              <p>Не вдалося завантажити повідомлення.</p>
              <button
                className="button secondary"
                onClick={() => void history.refetch()}
              >
                Спробувати ще раз
              </button>
            </div>
          ) : (
            <ScrollHistory
              messages={messages}
              hasOlder={history.hasNextPage}
              loadingOlder={history.isFetchingNextPage}
              loadOlder={() => {
                if (!history.isFetching)
                  void history.fetchNextPage({ cancelRefetch: false });
              }}
              sentId={sentId}
            />
          )}
          {history.isFetchNextPageError && (
            <div className="message-history-error" role="alert">
              <p>Не вдалося завантажити попередні повідомлення.</p>
              <button
                type="button"
                className="button secondary"
                disabled={history.isFetching}
                onClick={() =>
                  void history.fetchNextPage({ cancelRefetch: false })
                }
              >
                Спробувати ще раз
              </button>
            </div>
          )}
          {read.isError && (
            <div className="messages-panel" role="alert">
              <p>Не вдалося позначити повідомлення прочитаними.</p>
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  if (readId) read.mutate(readId);
                }}
              >
                Спробувати ще раз
              </button>
            </div>
          )}
          {detail.data.canSend ? (
            <MessageComposer
              onSend={(text) => send.mutateAsync(text)}
              pending={send.isPending}
            />
          ) : (
            <p className="messages-panel">
              Співрозмовник більше недоступний. Історія розмови збережена.
            </p>
          )}
        </>
      )}
    </main>
  );
}
