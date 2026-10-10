import Link from "next/link";
import {
  catalogPageNumbers,
  type CatalogQuery,
  type CatalogSort,
} from "@/entities/listing/model/catalog-query";
import { filterHref } from "@/features/listing/filters/filter-url-serializer";
export function CatalogPagination({
  page,
  pages,
  sort,
  onPage,
  query = { page, sort, limit: 24 },
}: {
  page: number;
  pages: number;
  sort: CatalogSort;
  onPage?: (page: number) => void;
  query?: CatalogQuery;
}) {
  if (pages <= 1 && page <= pages) return null;
  const numbers = catalogPageNumbers(page, pages);
  return (
    <nav className="catalog-pagination" aria-label="Сторінки оголошень">
      {page > 1 ? (
        <Link
          href={filterHref({
            ...query,
            page: Math.max(1, Math.min(page - 1, pages)),
          })}
          onNavigate={(event) => {
            if (onPage) {
              event.preventDefault();
              onPage(Math.max(1, Math.min(page - 1, pages)));
            }
          }}
          className="catalog-page-direction"
          aria-label="Попередня сторінка"
          scroll={false}
        >
          ← <span>Назад</span>
        </Link>
      ) : (
        <span
          className="catalog-page-direction is-disabled"
          aria-disabled="true"
        >
          ← <span>Назад</span>
        </span>
      )}
      <div className="catalog-page-numbers">
        {numbers.map((number) => (
          <Link
            key={number}
            href={filterHref({ ...query, page: number })}
            onNavigate={(event) => {
              if (onPage) {
                event.preventDefault();
                onPage(number);
              }
            }}
            aria-label={`Сторінка ${number}`}
            aria-current={number === page ? "page" : undefined}
            scroll={false}
          >
            {number}
          </Link>
        ))}
      </div>
      {page < pages ? (
        <Link
          href={filterHref({ ...query, page: page + 1 })}
          onNavigate={(event) => {
            if (onPage) {
              event.preventDefault();
              onPage(page + 1);
            }
          }}
          className="catalog-page-direction"
          aria-label="Наступна сторінка"
          scroll={false}
        >
          <span>Далі</span> →
        </Link>
      ) : (
        <span
          className="catalog-page-direction is-disabled"
          aria-disabled="true"
        >
          <span>Далі</span> →
        </span>
      )}
    </nav>
  );
}
