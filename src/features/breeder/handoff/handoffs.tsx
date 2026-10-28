"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { authenticatedRequest } from "@/shared/api/client";
import { envelope } from "./contracts";
import { RemainingPackage } from "../claim/remaining-package";
import { HandoffReview } from "./review";
export function BreederHandoffs({
  userId,
  profileId,
}: {
  userId: string;
  profileId?: string;
}) {
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
    <section id="prepared-listings" className="breeder-editor-content">
      {(query.isError || (query.data?.data.length ?? 0) > 0) && (
        <h2>Окремі пропозиції передачі</h2>
      )}
      {profileId && <RemainingPackage userId={userId} profileId={profileId} />}
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
              onAccepted={() => {
                setAccepted((old) => [...old, h.id]);
              }}
            />
          ))
      )}
      {accepted.length > 0 && (
        <p role="status">
          Прийнято. Тварини й оголошення створені як приватні чернетки.
          Перевірте їх перед поданням на модерацію.{" "}
          <Link href="/my-listings">Переглянути мої оголошення</Link>
        </p>
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
