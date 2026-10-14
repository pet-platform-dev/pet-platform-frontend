"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/client";
import { getHealth } from "./api";
import {
  healthKeys,
  healthEmpty,
  type HealthKind,
  type HealthRecord,
} from "./model";
import { RecordCard } from "./record-card";
export function RecordsLoading() {
  return (
    <div role="status" aria-label="Завантажуємо записи">
      <div className="history-skeleton" aria-hidden="true" />
      <div className="history-skeleton" aria-hidden="true" />
    </div>
  );
}
export function RecordList({
  uid,
  id,
  kind,
  onEdit,
  onDelete,
  pending,
}: {
  uid: string;
  id: string;
  kind: HealthKind;
  onEdit: (r: HealthRecord) => void;
  onDelete: (r: HealthRecord) => void;
  pending: boolean;
}) {
  const q = useInfiniteQuery({
    queryKey: healthKeys.list(uid, id, kind),
    queryFn: ({ signal, pageParam }) =>
      getHealth(id, kind, pageParam, 20, signal),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.page < last.meta.pages ? last.meta.page + 1 : undefined,
    retry: false,
  });
  return (
    <section aria-label="Приватні записи">
      <h2>Записи</h2>
      {q.isPending ? (
        <RecordsLoading />
      ) : q.isError ? (
        <div role="alert">
          <p>
            {q.error instanceof ApiError && q.error.status === 404
              ? "Тварину не знайдено або у вас немає доступу."
              : "Не вдалося завантажити записи."}
          </p>
          <button className="button secondary" onClick={() => void q.refetch()}>
            Спробувати ще раз
          </button>
        </div>
      ) : (
        <>
          {q.data.pages[0].meta.total === 0 ? (
            <p className="muted">{healthEmpty(kind)}</p>
          ) : (
            q.data.pages
              .flatMap((p) => p.data)
              .map((r) => (
                <RecordCard
                  key={r.id}
                  record={r}
                  pending={pending}
                  onEdit={onEdit}
                  onDelete={onDelete}
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
