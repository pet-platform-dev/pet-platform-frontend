"use client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getListings } from "@/entities/listing/api/get-listings";
import {
  catalogHref,
  type CatalogQuery,
} from "@/entities/listing/model/catalog-query";
import { ListingCard } from "@/entities/listing/ui/listing-card";
import { ListingSkeletons } from "@/entities/listing/ui/listing-skeletons";
import { CatalogPagination } from "./catalog-pagination";
export function ListingsCatalog({ query }: { query: CatalogQuery }) {
  const router = useRouter();
  const result = useQuery({
    queryKey: ["listings", query],
    queryFn: () => getListings(query),
  });
  return (
    <main className="catalog-shell">
      <header className="catalog-intro">
        <p className="eyebrow">Місце, де починається дружба</p>
        <h1>Оголошення про тварин</h1>
        <p>
          Знайдіть улюбленця або перегляньте актуальні пропозиції від власників.
        </p>
      </header>
      <div className="catalog-toolbar">
        <p className="catalog-count" aria-live="polite">
          {result.isPending
            ? "Шукаємо актуальні пропозиції…"
            : result.isError
              ? "Актуальні пропозиції"
              : `Активних оголошень: ${new Intl.NumberFormat("uk-UA").format(result.data.meta.total)}`}
        </p>
        <div className="catalog-sort">
          <label htmlFor="catalog-sort">Сортування</label>
          <select
            id="catalog-sort"
            value={query.sort}
            onChange={(event) =>
              router.push(
                catalogHref(
                  1,
                  event.target.value === "oldest" ? "oldest" : "newest",
                ),
                { scroll: false },
              )
            }
          >
            <option value="newest">Спочатку нові</option>
            <option value="oldest">Спочатку старі</option>
          </select>
        </div>
      </div>
      {result.isPending ? (
        <ListingSkeletons />
      ) : result.isError ? (
        <section className="catalog-state" role="alert">
          <span className="catalog-state-line" aria-hidden="true" />
          <h2>Не вдалося завантажити оголошення.</h2>
          <p>Перевірте з’єднання та спробуйте ще раз.</p>
          <button
            type="button"
            className="button primary"
            onClick={() => result.refetch()}
            disabled={result.isFetching}
          >
            {result.isFetching ? "Завантажуємо…" : "Спробувати ще раз"}
          </button>
        </section>
      ) : result.data.data.length === 0 ? (
        <section className="catalog-state">
          <span className="catalog-state-line" aria-hidden="true" />
          <h2>
            {result.data.meta.total === 0
              ? "Поки що немає активних оголошень"
              : "На цій сторінці немає оголошень"}
          </h2>
          <p>
            {result.data.meta.total === 0
              ? "Нові оголошення з’являться тут після публікації."
              : "Перегляньте актуальні пропозиції на першій сторінці."}
          </p>
          {query.page > 1 && (
            <Link
              href={catalogHref(1, query.sort)}
              className="button secondary"
            >
              На першу сторінку
            </Link>
          )}
        </section>
      ) : (
        <div className="listings-grid" aria-label="Активні оголошення">
          {result.data.data.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
      {result.isSuccess && result.data.meta.pages > 0 && (
        <>
          <CatalogPagination
            page={result.data.meta.page}
            pages={result.data.meta.pages}
            sort={query.sort}
          />
          {result.data.meta.pages > 1 && (
            <p className="catalog-page-summary">
              Сторінка {result.data.meta.page} з {result.data.meta.pages}
            </p>
          )}
        </>
      )}
    </main>
  );
}
