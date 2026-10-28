"use client";
import { useState } from "react";
import { useSession } from "@/features/auth/session-provider";
import { usePreparedListings } from "./use-prepared-listings";
import { PreparedCard } from "./prepared-card";
export function PreparedListings({
  userId,
  profileId,
  offeredIds,
}: {
  userId: string;
  profileId: string;
  offeredIds: string[];
}) {
  const session = useSession(),
    [page, setPage] = useState(1);
  const query = usePreparedListings(userId, profileId, page);
  if (session.data?.id !== userId) return null;
  if (session.data.verificationStatus !== "VERIFIED")
    return <p>Підтвердьте пошту, щоб переглянути підготовлені оголошення.</p>;
  if (query.isPending)
    return <p role="status">Завантажуємо підготовлені оголошення…</p>;
  if (query.isError)
    return (
      <p role="alert">
        Не вдалося завантажити підготовлені оголошення.{" "}
        <button type="button" onClick={() => void query.refetch()}>
          Повторити завантаження
        </button>
      </p>
    );
  return (
    <section aria-label="Приватний перегляд підготовлених оголошень">
      <p>Підготовлено: {query.data.meta.total}</p>
      <p>
        Це приватні матеріали розплідника, вони ще не є вашими оголошеннями.
        Адміністратор вибирає матеріали для передачі, а ви окремо підтверджуєте
        прийняття нижче.
      </p>
      {query.data.data
        .filter((d) => !offeredIds.includes(d.id))
        .map((d) => (
          <PreparedCard
            key={`prepared:${d.id}`}
            draft={d}
            breederName={query.data.breeder.kennelName}
          />
        ))}
      {query.data.meta.pages > 1 && (
        <nav aria-label="Сторінки підготовлених оголошень">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Назад
          </button>
          <button
            type="button"
            disabled={page >= query.data.meta.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Далі
          </button>
        </nav>
      )}
    </section>
  );
}
