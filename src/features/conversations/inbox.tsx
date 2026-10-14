"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RequireSession } from "@/features/auth/require-session";
import { useSession } from "@/features/auth/session-provider";
import { getInbox } from "./api";
import { conversationKeys } from "./cache";
import { ConversationCard } from "./conversation-context";
import { MessagesLoading } from "./messages-loading";
export function Inbox() {
  return (
    <RequireSession returnTo="/messages">
      <InboxContent />
    </RequireSession>
  );
}
function InboxContent() {
  const user = useSession().data!,
    [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: conversationKeys.list(user.id, page),
    queryFn: ({ signal }) => getInbox(page, signal),
    staleTime: 0,
    refetchOnWindowFocus: "always",
  });
  return (
    <main className="catalog-shell messages-page">
      <h1>Повідомлення</h1>
      {query.isPending ? (
        <MessagesLoading kind="inbox" />
      ) : query.isError ? (
        <div className="messages-panel" role="alert">
          <p>Не вдалося завантажити повідомлення.</p>
          <button
            className="button secondary"
            onClick={() => void query.refetch()}
          >
            Спробувати ще раз
          </button>
        </div>
      ) : !query.data.data.length ? (
        <section className="messages-panel">
          <h2>У вас ще немає повідомлень</h2>
          <p>
            Коли ви напишете продавцю або хтось напише вам щодо оголошення,
            розмови з’являться тут.
          </p>
          <Link className="button secondary" href="/listings">
            Перейти до оголошень
          </Link>
        </section>
      ) : (
        <>
          <div className="conversation-list">
            {query.data.data.map((c) => (
              <ConversationCard key={c.id} conversation={c} />
            ))}
          </div>
          {query.data.meta.pages > 1 && (
            <div className="message-pagination" aria-label="Сторінки розмов">
              <button
                className="button secondary"
                disabled={page === 1 || query.isFetching}
                onClick={() => setPage(page - 1)}
              >
                Попередні
              </button>
              <span>
                {page} / {query.data.meta.pages}
              </span>
              <button
                className="button secondary"
                disabled={page >= query.data.meta.pages || query.isFetching}
                onClick={() => setPage(page + 1)}
              >
                Наступні
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
