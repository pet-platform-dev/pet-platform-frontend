"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/client";
import { getReminders } from "./api";
import { reminderKeys, type Reminder, type ReminderStatus } from "./model";
import { ViewedReminderCard } from "./viewed-reminder-card";
export function ReminderList({
  userId,
  petId,
  status,
  onEdit,
  onComplete,
  onDelete,
  pending,
}: {
  userId: string;
  petId: string;
  status: ReminderStatus;
  onEdit: (r: Reminder) => void;
  onComplete: (r: Reminder) => void;
  onDelete: (r: Reminder) => void;
  pending: boolean;
}) {
  const q = useInfiniteQuery({
    queryKey: reminderKeys.list(userId, petId, status),
    queryFn: ({ signal, pageParam }) =>
      getReminders(petId, status, pageParam, 20, signal),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.page < last.meta.pages ? last.meta.page + 1 : undefined,
    retry: false,
  });
  return (
    <section
      className="reminder-list-section"
      aria-label={
        status === "PENDING"
          ? "Заплановані нагадування"
          : "Виконані нагадування"
      }
    >
      <h2>{status === "PENDING" ? "Заплановані" : "Виконані"}</h2>
      {q.isPending ? (
        <p role="status">Завантажуємо нагадування…</p>
      ) : q.isError ? (
        <div role="alert">
          <p>
            {q.error instanceof ApiError && q.error.status === 404
              ? "Тварину не знайдено або у вас немає доступу."
              : "Не вдалося завантажити нагадування."}
          </p>
          <button className="button secondary" onClick={() => void q.refetch()}>
            Спробувати ще раз
          </button>
        </div>
      ) : (
        <>
          {q.data.pages[0].meta.total === 0 ? (
            <p className="muted">
              {status === "PENDING"
                ? "Нагадувань ще немає"
                : "Виконаних нагадувань ще немає"}
            </p>
          ) : (
            q.data.pages
              .flatMap((p) => p.data)
              .map((r) => (
                <ViewedReminderCard
                  key={r.id}
                  reminder={r}
                  onEdit={onEdit}
                  onComplete={onComplete}
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
