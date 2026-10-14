"use client";
import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { runAdminRequest } from "@/features/admin/moderation/cache";
import { ApiError } from "@/shared/api/client";
import { reportKeys } from "./admin-cache";
import { getReportConversation } from "./api";
import { ContextSummary, ContextMessages } from "./message-report-context";
export function AdminConversationContext({ id }: { id: string }) {
  const user = useSession().data!,
    client = useQueryClient(),
    view = useRef<HTMLDivElement>(null);
  const position = useRef<{ height: number; top: number } | null>(null);
  const query = useInfiniteQuery({
    queryKey: reportKeys.conversation(user.id, id),
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      runAdminRequest(client, user.id, () =>
        getReportConversation(id, pageParam, signal),
      ),
    getNextPageParam: (last) =>
      last.meta.page < last.meta.pages ? last.meta.page + 1 : undefined,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const pages = query.data?.pages;
  useLayoutEffect(() => {
    const el = view.current;
    if (!el) return;
    const previous = position.current;
    el.scrollTop = previous
      ? previous.top + el.scrollHeight - previous.height
      : el.scrollHeight;
    position.current = null;
  }, [pages]);
  const first = pages?.[0]?.data;
  const messages = [
    ...new Map(
      (pages ?? []).flatMap((p) => p.data.messages).map((m) => [m.id, m]),
    ).values(),
  ].sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  return (
    <section className="admin-moderation">
      <Link
        className="admin-back-link"
        prefetch={false}
        href={"/admin/moderation/reports/" + id}
      >
        До скарги
      </Link>
      <h1>Контекст розмови за скаргою</h1>
      <p className="form-hint">
        Доступ до приватної розмови журналюється. Використовуйте її лише для
        перевірки цієї скарги.
      </p>
      {query.isPending ? (
        <p role="status">Завантажуємо контекст…</p>
      ) : query.isError && !pages ? (
        <div className="admin-empty" role="alert">
          <p>
            {query.error instanceof ApiError && query.error.status === 404
              ? "Контекст розмови недоступний."
              : "Не вдалося завантажити контекст розмови."}
          </p>
          <button
            className="button secondary"
            onClick={() => void query.refetch()}
          >
            Спробувати ще раз
          </button>
        </div>
      ) : (
        first && (
          <section className="admin-panel">
            <ContextSummary context={first} />
            <ContextMessages
              messages={[{ ...first.message, isReported: true }]}
            />
            <p className="form-hint">
              Прокрутіть угору, щоб завантажити попередні повідомлення.
            </p>
            <div
              ref={view}
              className="report-context-viewport"
              role="region"
              aria-label="Приватний контекст розмови"
              tabIndex={0}
              onScroll={(e) => {
                const el = e.currentTarget;
                if (
                  el.scrollTop <= 80 &&
                  query.hasNextPage &&
                  !query.isFetching
                ) {
                  position.current = {
                    height: el.scrollHeight,
                    top: el.scrollTop,
                  };
                  void query.fetchNextPage({ cancelRefetch: false });
                }
              }}
            >
              {query.isFetchingNextPage && (
                <p role="status">Завантаження попередніх повідомлень…</p>
              )}
              <ContextMessages messages={messages} />
            </div>
            {query.isFetchNextPageError && (
              <div role="alert">
                <p>Не вдалося завантажити контекст розмови.</p>
                <button
                  className="button secondary"
                  onClick={() => void query.fetchNextPage()}
                >
                  Спробувати ще раз
                </button>
              </div>
            )}
          </section>
        )
      )}
    </section>
  );
}
