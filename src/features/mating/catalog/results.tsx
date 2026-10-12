import type { UseQueryResult } from "@tanstack/react-query";
import type { getPublicMating } from "@/entities/mating-listing/public-api";
import { ListingSkeletons } from "@/entities/listing/ui/listing-skeletons";
import { CatalogPagination } from "@/widgets/listings-catalog/catalog-pagination";
import { PublicMatingCard } from "./public-card";
import { matingHref, type MatingCatalogQuery } from "./query";
export function MatingCatalogResults({
  result,
  query,
  pending,
  invalid,
  filtered,
  onClear,
  onPage,
}: {
  result: UseQueryResult<Awaited<ReturnType<typeof getPublicMating>>, Error>;
  query: MatingCatalogQuery;
  pending: boolean;
  invalid: boolean;
  filtered: boolean;
  onClear: () => void;
  onPage: (page: number) => void;
}) {
  if (invalid)
    return (
      <section className="catalog-state">
        <h2>Перевірте діапазон оплати</h2>
        <p>Виправте позначені поля, щоб переглянути оголошення.</p>
      </section>
    );
  if (pending || result.isPending) return <ListingSkeletons />;
  if (result.isError)
    return (
      <section className="catalog-state" role="alert">
        <h2>Не вдалося завантажити оголошення.</h2>
        <button
          className="button secondary"
          onClick={() => result.refetch()}
          disabled={result.isFetching}
        >
          Спробувати ще раз
        </button>
      </section>
    );
  return (
    <>
      {result.data.data.length === 0 ? (
        <section className="catalog-state">
          <h2>
            {result.data.meta.total
              ? "На цій сторінці немає оголошень"
              : filtered
                ? "Оголошень не знайдено"
                : "Поки що немає оголошень про в’язку"}
          </h2>
          <p>
            {filtered
              ? "Спробуйте змінити фільтри або розширити параметри пошуку."
              : "Станьте першим, хто подасть оголошення для своєї тварини."}
          </p>
          {filtered && (
            <button className="button secondary" onClick={onClear}>
              Очистити фільтри
            </button>
          )}
        </section>
      ) : (
        <div className="listings-grid">
          {result.data.data.map((row) => (
            <PublicMatingCard key={row.id} row={row} />
          ))}
        </div>
      )}
      <CatalogPagination
        page={query.page}
        pages={result.data.meta.pages}
        sort={query.sort}
        onPage={onPage}
        hrefForPage={(page) => matingHref({ ...query, page })}
      />
    </>
  );
}
