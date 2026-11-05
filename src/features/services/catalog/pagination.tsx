"use client";
import { CatalogPagination } from "@/widgets/listings-catalog/catalog-pagination";
import { serviceHref, type ServiceQuery } from "@/entities/service-offer/query";
// Existing pagination installs Link event handlers; keep them inside a client boundary.
export function ServicePagination({
  base,
  query,
  pages,
  label = "Сторінки послуг",
}: {
  base: string;
  query: ServiceQuery;
  pages: number;
  label?: string;
}) {
  return (
    <CatalogPagination
      page={query.page}
      pages={pages}
      sort="newest"
      label={label}
      hrefForPage={(page) => serviceHref(base, { ...query, page })}
    />
  );
}
