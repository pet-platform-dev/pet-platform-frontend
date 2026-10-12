"use client";
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { SelectDropdown } from "@/shared/ui/select-dropdown";
import { getPublicMating } from "@/entities/mating-listing/public-api";
import { useCatalogLabels } from "@/features/listing/filters/use-filter-labels";
import { resultCount } from "@/features/listing/filters/price-validation";
import { useMatingFilters } from "./use-catalog-filters";
import { MatingFilterControls } from "./filter-controls";
import { MatingMobileDrawer } from "./mobile-drawer";
import { MatingCatalogResults } from "./results";
import {
  matingFilterCount,
  matingValues,
  updateValues,
  type MatingValues,
  type MatingUpdate,
} from "./filter-state";
import { matingQueryKey, type MatingCatalogQuery } from "./query";
export function MatingCatalog({
  query: initial,
}: {
  query: MatingCatalogQuery;
}) {
  const filters = useMatingFilters(initial),
    [session, setSession] = useState<{
      values: MatingValues;
      version: string;
      cleared: boolean;
    } | null>(null),
    close = useCallback(() => setSession(null), [setSession]);
  if (session && session.version !== filters.href) setSession(null);
  const draft = session?.version === filters.href ? session : null;
  const result = useQuery({
    queryKey: matingQueryKey(filters.query),
    queryFn: ({ signal }) => getPublicMating(filters.query, signal),
    enabled: !filters.invalid && !filters.pending,
  });
  useCatalogLabels(result.data?.data);
  const count = matingFilterCount(filters.values),
    invalid = filters.invalid,
    status = invalid
      ? "Перевірте параметри оплати"
      : filters.pending || result.isPending
        ? "Шукаємо актуальні пропозиції…"
        : result.isError
          ? "Актуальні пропозиції"
          : resultCount(result.data.meta.total);
  function updateDraft(c: MatingUpdate) {
    setSession((s) => (s ? { ...s, values: updateValues(s.values, c) } : null));
  }
  return (
    <main className="catalog-shell mating-public-catalog">
      <header className="catalog-intro">
        <p className="eyebrow">Для власників і розплідників</p>
        <h1>В’язка</h1>
        <p>
          Знайдіть пару для своєї тварини серед оголошень власників і
          розплідників.
        </p>
      </header>
      <div className="account-actions mating-catalog-actions">
        <Link href="/mating/new" className="button">
          Подати оголошення
        </Link>
        <Link href="/mating/my" className="button secondary">
          Мої оголошення
        </Link>
      </div>
      <div className="catalog-layout">
        {!draft && (
          <aside
            className="listing-filters-panel"
            aria-label="Фільтри оголошень про в’язку"
          >
            <div className="filter-heading">
              <h2>Фільтри</h2>
              <p>Оберіть параметри пошуку пари.</p>
            </div>
            <MatingFilterControls
              values={filters.values}
              errors={filters.errors}
              onChange={filters.update}
            />
            {count > 0 && (
              <button className="catalog-clear" onClick={filters.clear}>
                Очистити фільтри
              </button>
            )}
          </aside>
        )}
        <section className="catalog-results" aria-label="Результати пошуку">
          <div className="catalog-filter-sort mating-catalog-sort">
            <button
              className="button secondary mobile-filters-trigger"
              aria-haspopup="dialog"
              onClick={() => {
                const prepared = filters.prepare();
                setSession({
                  values: prepared.values,
                  version: prepared.version,
                  cleared: false,
                });
              }}
            >
              {count ? "Фільтри (" + count + ")" : "Фільтри"}
            </button>
            <div className="catalog-sort">
              <span className="catalog-sort-label">Сортування</span>
              <SelectDropdown<MatingCatalogQuery["sort"]>
                label="Сортування"
                value={filters.query.sort}
                options={[
                  { value: "newest", label: "Спочатку нові" },
                  { value: "price_asc", label: "Ціна: від нижчої" },
                  { value: "price_desc", label: "Ціна: від вищої" },
                ]}
                onChange={filters.sort}
              />
            </div>
          </div>
          <div className="catalog-toolbar">
            <p className="catalog-count" role="status">
              {status}
            </p>
            {count > 0 && (
              <button className="catalog-clear" onClick={filters.clear}>
                Очистити фільтри
              </button>
            )}
          </div>
          <MatingCatalogResults
            result={result}
            query={filters.query}
            pending={filters.pending}
            invalid={invalid}
            filtered={count > 0}
            onClear={filters.clear}
            onPage={filters.page}
          />
        </section>
      </div>
      {draft && (
        <MatingMobileDrawer
          values={draft.values}
          query={filters.query}
          onChange={updateDraft}
          onClose={close}
          onClear={() =>
            setSession((s) =>
              s
                ? {
                    ...s,
                    values: matingValues({
                      page: 1,
                      limit: 24,
                      sort: "newest",
                    }),
                    cleared: true,
                  }
                : null,
            )
          }
          onApply={() => {
            filters.apply(draft.values, draft.cleared);
            close();
          }}
        />
      )}
    </main>
  );
}
