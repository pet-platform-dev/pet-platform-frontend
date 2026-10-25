"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { authenticatedRequest } from "@/shared/api/client";
import { envelope } from "./contracts";
import { HandoffReview } from "./review";
export function BreederHandoffs({ userId }: { userId: string }) {
  const session = useSession(),
    [page, setPage] = useState(1),
    [accepted, setAccepted] = useState<string[]>([]);
  const query = useQuery({
    queryKey: ["breeder-handoffs", userId, page],
    queryFn: async ({ signal }) =>
      envelope.parse(
        await authenticatedRequest(
          `/breeder-handoffs?page=${page}`,
          { signal },
          true,
        ),
      ),
    enabled:
      session.data?.id === userId && session.data?.accountType === "BREEDER",
    retry: false,
  });
  if (session.data?.id !== userId) return null;
  return (
    <section className="breeder-editor-content">
      <h2>Підготовлені оголошення від оператора</h2>
      {query.isPending ? (
        <p role="status">Завантажуємо передачі…</p>
      ) : query.isError ? (
        <p role="alert">
          Не вдалося завантажити.{" "}
          <button onClick={() => void query.refetch()}>Повторити</button>
        </p>
      ) : (
        query.data.data
          .filter((h) => !accepted.includes(h.id))
          .map((h) => (
            <HandoffReview
              key={`${userId}:${h.id}`}
              handoff={h}
              onAccepted={() => setAccepted((old) => [...old, h.id])}
            />
          ))
      )}
      {accepted.length > 0 && (
        <p role="status">
          Прийнято. Тварини й оголошення створені як приватні чернетки.
          Перевірте їх перед поданням на модерацію.
        </p>
      )}
      {query.data?.data.length === 0 && (
        <p className="muted">Нових пропозицій немає.</p>
      )}
      {(query.data?.meta.pages ?? 0) > 1 && (
        <nav aria-label="Сторінки передач">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Попередня
          </button>
          <button
            disabled={page >= query.data!.meta.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Наступна
          </button>
        </nav>
      )}
    </section>
  );
}
