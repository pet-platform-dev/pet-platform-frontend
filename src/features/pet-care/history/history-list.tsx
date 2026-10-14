"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/client";
import { getHistory } from "./api";
import { historyKeys, type HistoryFilter, type CareEntry } from "./model";
import { HistoryCard } from "./history-card";
export function HistoryLoading() {
  return (
    <div role="status" aria-label="Завантажуємо історію">
      <div className="history-skeleton" aria-hidden="true" />
      <div className="history-skeleton" aria-hidden="true" />
    </div>
  );
}
export function HistoryList({
  uid,
  id,
  type,
  onEdit,
  onDelete,
  pending,
}: {
  uid: string;
  id: string;
  type: HistoryFilter;
  onEdit: (r: CareEntry) => void;
  onDelete: (r: CareEntry) => void;
  pending: boolean;
}) {
  const q = useInfiniteQuery({
    queryKey: historyKeys.list(uid, id, type),
    queryFn: ({ signal, pageParam }) =>
      getHistory(id, type, pageParam, 20, signal),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.page < last.meta.pages ? last.meta.page + 1 : undefined,
    retry: false,
  });
  return (
    <section aria-label="Записи історії догляду">
      <h2>Записи</h2>
      {q.isPending ? (
        <HistoryLoading />
      ) : q.isError ? (
        <div role="alert">
          <p>
            {q.error instanceof ApiError && q.error.status === 404
              ? "Тварину не знайдено або у вас немає доступу."
              : "Не вдалося завантажити історію."}
          </p>
          <button className="button secondary" onClick={() => void q.refetch()}>
            Спробувати ще раз
          </button>
        </div>
      ) : (
        <>
          {q.data.pages[0].meta.total === 0 ? (
            <>
              <p>
                {type === "ALL"
                  ? "Історія догляду порожня"
                  : "Записів цього типу ще немає"}
              </p>
              <p className="muted">
                Додайте перший запис про догляд або подію, яка вже відбулася.
              </p>
            </>
          ) : (
            q.data.pages
              .flatMap((p) => p.data)
              .map((r) => (
                <HistoryCard
                  key={r.id}
                  entry={r}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  pending={pending}
                />
              ))
          )}
          {q.hasNextPage && (
            <button
              className="button secondary"
              disabled={q.isFetchingNextPage}
              onClick={() => void q.fetchNextPage()}
            >
              {q.isFetchingNextPage ? "Завантажуємо…" : "Показати ще"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
