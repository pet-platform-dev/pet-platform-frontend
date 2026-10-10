"use client";
import { useReducer } from "react";
import { useRouter } from "next/navigation";
import {
  catalogHref,
  type CatalogQuery,
  type CatalogSort,
} from "@/entities/listing/model/catalog-query";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import {
  emptyFilters,
  filterReducer,
  filtersToQuery,
  type FilterUpdate,
  type Filters,
} from "./model";
import { priceErrors } from "./price-validation";
export function useListingFilters(initial: CatalogQuery) {
  const router = useRouter();
  const [state, dispatch] = useReducer(filterReducer, {
    filters: emptyFilters(),
    page: initial.page,
    sort: initial.sort,
  });
  const q = useDebouncedValue(state.filters.q, 350),
    priceMin = useDebouncedValue(state.filters.priceMin, 350),
    priceMax = useDebouncedValue(state.filters.priceMax, 350);
  const errors = priceErrors(state.filters.priceMin, state.filters.priceMax);
  const invalid = Boolean(errors.min || errors.max);
  const debouncing =
    q !== state.filters.q ||
    priceMin !== state.filters.priceMin ||
    priceMax !== state.filters.priceMax;
  const query = filtersToQuery({
    ...state,
    filters: { ...state.filters, q, priceMin, priceMax },
  });
  function update(change: FilterUpdate) {
    dispatch({ kind: "filter", update: change });
    if (state.page !== 1)
      router.push(catalogHref(1, state.sort), { scroll: false });
  }
  function apply(draft: Filters) {
    dispatch({ kind: "apply", filters: draft });
    if (state.page !== 1)
      router.push(catalogHref(1, state.sort), { scroll: false });
  }
  function page(value: number) {
    dispatch({ kind: "page", page: value });
  }
  function sort(value: CatalogSort) {
    dispatch({ kind: "sort", sort: value });
    router.push(catalogHref(1, value), { scroll: false });
  }
  function clear() {
    dispatch({ kind: "clear" });
    router.push(catalogHref(1, "newest"), { scroll: false });
  }
  return {
    state,
    query,
    errors,
    invalid,
    debouncing,
    update,
    apply,
    page,
    sort,
    clear,
  };
}
