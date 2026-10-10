import type { UseQueryResult } from "@tanstack/react-query";
import Link from "next/link";
import type { Paginated } from "@/shared/api/pagination";
import type { Listing } from "@/entities/listing/model/listing";
import {
  catalogHref,
  type CatalogQuery,
} from "@/entities/listing/model/catalog-query";
import { ListingCard } from "@/entities/listing/ui/listing-card";
import { ListingSkeletons } from "@/entities/listing/ui/listing-skeletons";
import { CatalogPagination } from "./catalog-pagination";
export function CatalogResults({
  result,
  query,
  pending,
  invalid,
  filtered,
  onClear,
  onPage,
}: {
  result: UseQueryResult<Paginated<Listing>, Error>;
  query: CatalogQuery;
  pending: boolean;
  invalid: boolean;
  filtered: boolean;
  onClear: () => void;
  onPage: (page: number) => void;
}) {
  if (invalid)
    return (
      <section className="catalog-state">
        <h2>Перевірте діапазон ціни</h2>
        <p>Виправте позначені поля, щоб переглянути оголошення.</p>
        <button type="button" className="button secondary" onClick={onClear}>
          Очистити фільтри
        </button>
      </section>
    );
  if (pending || result.isPending) return <ListingSkeletons />;
  if (result.isError)
    return (
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
    );
  return (
    <>
      {result.data.data.length === 0 ? (
        <section className="catalog-state">
          <span className="catalog-state-line" aria-hidden="true" />
          <h2>
            {result.data.meta.total === 0
              ? filtered
                ? "За вибраними параметрами оголошень не знайдено."
                : "Поки що немає активних оголошень"
              : "На цій сторінці немає оголошень"}
          </h2>
          <p>
            {result.data.meta.total === 0
              ? filtered
                ? "Спробуйте змінити параметри пошуку."
                : "Нові оголошення з’являться тут після публікації."
              : "Перегляньте актуальні пропозиції на першій сторінці."}
          </p>
          {filtered && (
            <button
              type="button"
              className="button secondary"
              onClick={onClear}
            >
              Очистити фільтри
            </button>
          )}
          {query.page > 1 && (
            <Link
              href={catalogHref(1, query.sort)}
              onNavigate={() => onPage(1)}
              className="button secondary"
              scroll={false}
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
      {result.data.meta.pages > 0 && (
        <>
          <CatalogPagination
            page={result.data.meta.page}
            pages={result.data.meta.pages}
            sort={query.sort}
            onPage={onPage}
          />
          {result.data.meta.pages > 1 && (
            <p className="catalog-page-summary">
              Сторінка {result.data.meta.page} з {result.data.meta.pages}
            </p>
          )}
        </>
      )}
    </>
  );
}
