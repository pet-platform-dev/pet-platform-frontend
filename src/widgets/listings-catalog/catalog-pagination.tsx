import Link from "next/link";
import {
  catalogHref,
  catalogPageNumbers,
  type CatalogSort,
} from "@/entities/listing/model/catalog-query";
export function CatalogPagination({
  page,
  pages,
  sort,
}: {
  page: number;
  pages: number;
  sort: CatalogSort;
}) {
  if (pages <= 1 && page <= pages) return null;
  const numbers = catalogPageNumbers(page, pages);
  return (
    <nav className="catalog-pagination" aria-label="Сторінки оголошень">
      {page > 1 ? (
        <Link
          href={catalogHref(Math.min(page - 1, pages), sort)}
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
            href={catalogHref(number, sort)}
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
          href={catalogHref(page + 1, sort)}
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
