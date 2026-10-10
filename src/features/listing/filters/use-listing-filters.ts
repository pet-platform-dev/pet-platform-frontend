"use client";
import type {
  CatalogQuery,
  CatalogSort,
} from "@/entities/listing/model/catalog-query";
import {
  filterReducer,
  filtersToQuery,
  type Filters,
  type FilterUpdate,
} from "./model";
import { urlFilterState } from "./filter-url-state";
import { useFilterUrl } from "./use-filter-url";
import { useFilterInputs } from "./use-filter-inputs";
import { useFilterLabels } from "./use-filter-labels";
export function useListingFilters(initial: CatalogQuery) {
  const url = useFilterUrl(initial),
    references = useFilterLabels(url.query.regionIds);
  const applied = urlFilterState(url.query, references.labels);
  const inputs = useFilterInputs(url.href, applied.filters, (values, mode) => {
    const next = filtersToQuery({
      ...applied,
      page: 1,
      filters: { ...applied.filters, ...values },
    });
    url.navigate(next, mode);
    return {
      q: next.q ?? "",
      priceMin: next.priceMin ?? "",
      priceMax: next.priceMax ?? "",
    };
  });
  const state = {
    ...applied,
    filters: { ...applied.filters, ...inputs.values },
  };
  function update(change: FilterUpdate) {
    references.remember(change);
    if (
      change.field === "q" ||
      change.field === "priceMin" ||
      change.field === "priceMax"
    ) {
      inputs.update(change.field, change.value);
      return;
    }
    const next = filterReducer(
      { ...applied, filters: inputs.invalid ? applied.filters : state.filters },
      { kind: "filter", update: change },
    );
    url.navigate(filtersToQuery(next));
  }
  function apply(draft: Filters, cleared = false) {
    for (const field of ["breeds", "regions", "locations"] as const)
      references.remember({ field, value: draft[field] } as FilterUpdate);
    url.navigate(
      filtersToQuery({
        filters: draft,
        page: 1,
        sort: cleared ? "newest" : applied.sort,
      }),
    );
  }
  function sort(value: CatalogSort) {
    url.navigate({ ...url.query, sort: value, page: 1 });
  }
  function page(value: number) {
    url.navigate({ ...url.query, page: value });
    document
      .querySelector(".catalog-results")
      ?.scrollIntoView({ block: "start" });
  }
  function clear() {
    inputs.reset({ q: "", priceMin: "", priceMax: "" });
    url.navigate({ page: 1, limit: 24, sort: "newest" });
  }
  return {
    state,
    applied,
    query: url.query,
    href: url.href,
    errors: inputs.errors,
    invalid: inputs.invalid,
    debouncing: inputs.pending,
    update,
    apply,
    page,
    sort,
    clear,
  };
}
