"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useSession } from "@/features/auth/session-provider";
import { ListingCard } from "@/entities/listing/ui/listing-card";
import { ListingSkeletons } from "@/entities/listing/ui/listing-skeletons";
import { getFavorites } from "./api";
import { favoritePagesKey } from "./cache";
import { favoriteLoginHref } from "./login-return";
function OwnerFavoritesPage({ userId }: { userId: string }) {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: [...favoritePagesKey(userId), page],
    queryFn: ({ signal }) => getFavorites(page, signal),
  });
  if (query.data && page > Math.max(1, query.data.meta.pages))
    setPage(Math.max(1, query.data.meta.pages));
  return (
    <>
      <div className="catalog-heading">
        <p className="eyebrow">Ваші збережені оголошення</p>
        <h1>Обране</h1>
      </div>
      {query.isPending ? (
        <ListingSkeletons />
      ) : query.isError ? (
        <div className="catalog-state">
          <p role="alert">Не вдалося завантажити обране.</p>
          <button className="button secondary" onClick={() => query.refetch()}>
            Спробувати ще раз
          </button>
        </div>
      ) : query.data.data.length === 0 ? (
        <section className="catalog-state">
          <h2>В обраному поки нічого немає.</h2>
          <p>Зберігайте оголошення, щоб швидко повернутися до них пізніше.</p>
          <Link className="button primary" href="/listings">
            Переглянути оголошення
          </Link>
        </section>
      ) : (
        <>
          <div className="listings-grid">
            {query.data.data.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
          {query.data.meta.pages > 1 && (
            <nav className="page-pagination" aria-label="Сторінки обраного">
              <button
                className="button secondary"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Назад
              </button>
              <span aria-live="polite">
                {page} / {query.data.meta.pages}
              </span>
              <button
                className="button secondary"
                disabled={page >= query.data.meta.pages}
                onClick={() => setPage(page + 1)}
              >
                Далі
              </button>
            </nav>
          )}
        </>
      )}
    </>
  );
}
export function FavoritesPage() {
  const session = useSession(),
    router = useRouter();
  useEffect(() => {
    if (session.isSuccess && !session.data)
      router.replace(favoriteLoginHref("/favorites"));
  }, [session.data, session.isSuccess, router]);
  if (session.isPending || (session.isSuccess && !session.data))
    return (
      <p className="status-panel" role="status">
        Перевіряємо сесію…
      </p>
    );
  if (session.isError)
    return (
      <div className="status-panel">
        <p role="alert">Не вдалося перевірити сесію.</p>
        <button className="button secondary" onClick={() => session.refetch()}>
          Спробувати ще раз
        </button>
      </div>
    );
  return session.data ? (
    <OwnerFavoritesPage key={session.data.id} userId={session.data.id} />
  ) : null;
}
