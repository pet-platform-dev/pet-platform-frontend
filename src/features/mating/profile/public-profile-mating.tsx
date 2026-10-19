"use client";
import { useEffect, useId } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getSellerMating } from "@/entities/mating-listing/public-api";
import { matingKeys } from "../cache";
import { PublicMatingCard } from "../catalog/public-card";
import {
  profileMatingPage,
  profileMatingHref,
  recoverMatingPage,
} from "./profile-mating-query";
export function PublicProfileMating({ ownerId }: { ownerId: string }) {
  const params = useSearchParams(),
    titleId = useId();
  const page = profileMatingPage(params?.get("matingPage") ?? null);
  const query = useQuery({
    queryKey: matingKeys.publicSeller(ownerId, page),
    queryFn: ({ signal }) => getSellerMating(ownerId, page, signal),
    staleTime: 0,
  });
  const recovered =
    query.data && !query.isError
      ? recoverMatingPage(page, query.data.meta.pages)
      : page;
  function navigate(next: number, replace = false) {
    const url = new URL(window.location.href);
    if (next > 1) url.searchParams.set("matingPage", String(next));
    else url.searchParams.delete("matingPage");
    window.history[replace ? "replaceState" : "pushState"](
      null,
      "",
      url.pathname + url.search,
    );
  }
  useEffect(() => {
    if (recovered !== page && !query.isFetching) navigate(recovered, true);
  }, [recovered, page, query.isFetching]);
  if (query.isSuccess && !query.isFetching && query.data.meta.total === 0)
    return null;
  const loading = query.isPending || query.isFetching || recovered !== page;
  return (
    <section className="profile-mating-section" aria-labelledby={titleId}>
      <div className="profile-mating-heading">
        <h2 id={titleId}>Оголошення про в’язку</h2>
        {!loading && !query.isError && query.data && (
          <span className="muted">{query.data.meta.total}</span>
        )}
      </div>
      {loading ? (
        <p className="status-panel" role="status">
          Завантажуємо оголошення про в’язку…
        </p>
      ) : query.isError ? (
        <div className="status-panel">
          <p role="alert">Не вдалося завантажити оголошення про в’язку.</p>
          <button
            className="button secondary"
            onClick={() => void query.refetch()}
          >
            Спробувати ще раз
          </button>
        </div>
      ) : (
        query.data && (
          <>
            <div className="listings-grid">
              {query.data.data.map((row) => (
                <PublicMatingCard
                  key={row.id}
                  row={row}
                  showOwner={false}
                  headingLevel={3}
                  returnTo={profileMatingHref(ownerId, page)}
                />
              ))}
            </div>
            {query.data.meta.pages > 1 && (
              <nav
                className="page-pagination"
                aria-label="Сторінки оголошень про в’язку"
              >
                <button
                  className="button secondary"
                  disabled={page <= 1}
                  onClick={() => navigate(page - 1)}
                >
                  Назад
                </button>
                <span>
                  {page} / {query.data.meta.pages}
                </span>
                <button
                  className="button secondary"
                  disabled={page >= query.data.meta.pages}
                  onClick={() => navigate(page + 1)}
                >
                  Далі
                </button>
              </nav>
            )}
          </>
        )
      )}
    </section>
  );
}
