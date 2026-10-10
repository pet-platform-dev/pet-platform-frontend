"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { getListings } from "@/entities/listing/api/get-listings";
import {
  listingsQueryKey,
  type CatalogQuery,
} from "@/entities/listing/model/catalog-query";
import { useListingFilters } from "@/features/listing/filters/use-listing-filters";
import { ListingFiltersPanel } from "@/features/listing/filters/listing-filters-panel";
import { useMobileFilters } from "@/features/listing/filters/use-mobile-filters";
import { MobileFiltersTrigger } from "@/features/listing/filters/mobile-filters-trigger";
import { MobileFiltersDrawer } from "@/features/listing/filters/mobile-filters-drawer";
import { hasFilters } from "@/features/listing/filters/model";
import { resultCount } from "@/features/listing/filters/price-validation";
import { CatalogSearchSort } from "./catalog-search-sort";
import { CatalogResults } from "./catalog-results";
export function ListingsCatalog({ query: initial }: { query: CatalogQuery }) {
  const filters = useListingFilters(initial);
  const mobile = useMobileFilters(filters.state.filters, filters.apply);
  const result = useQuery({
    queryKey: listingsQueryKey(filters.query),
    queryFn: ({ signal }) => getListings(filters.query, signal),
    enabled: !filters.invalid && !filters.debouncing,
  });
  const count = filters.invalid
    ? "Перевірте параметри ціни"
    : filters.debouncing || result.isPending
      ? "Шукаємо актуальні пропозиції…"
      : result.isError
        ? "Актуальні пропозиції"
        : resultCount(result.data.meta.total);
  return (
    <main className="catalog-shell">
      <header className="catalog-intro">
        <p className="eyebrow">Місце, де починається дружба</p>
        <h1>Оголошення про тварин</h1>
        <p>
          Знайдіть улюбленця або перегляньте актуальні пропозиції від власників.
        </p>
      </header>
      <Link
        href="/listings/new"
        className="button secondary catalog-create-link"
      >
        Створити оголошення
      </Link>
      <div className="catalog-layout">
        {!mobile.draft && (
          <ListingFiltersPanel
            filters={filters.state.filters}
            errors={filters.errors}
            onChange={filters.update}
            onClear={filters.clear}
          />
        )}
        <section className="catalog-results" aria-label="Результати пошуку">
          <CatalogSearchSort
            search={filters.state.filters.q}
            sort={filters.state.sort}
            onSearch={(value) => filters.update({ field: "q", value })}
            onSort={filters.sort}
            filtersTrigger={
              <MobileFiltersTrigger
                filters={filters.state.filters}
                onOpen={mobile.open}
              />
            }
          />
          <div className="catalog-toolbar">
            <p className="catalog-count">{count}</p>
            {hasFilters(filters.state.filters) && (
              <button
                type="button"
                className="catalog-clear"
                onClick={filters.clear}
              >
                Очистити фільтри
              </button>
            )}
          </div>
          <CatalogResults
            result={result}
            query={filters.query}
            pending={filters.debouncing}
            invalid={filters.invalid}
            filtered={hasFilters(filters.state.filters)}
            onClear={filters.clear}
            onPage={filters.page}
          />
        </section>
      </div>
      {mobile.draft && (
        <MobileFiltersDrawer
          draft={mobile.draft}
          onChange={mobile.update}
          onClear={mobile.clear}
          onClose={mobile.close}
          onApply={mobile.apply}
        />
      )}
    </main>
  );
}
