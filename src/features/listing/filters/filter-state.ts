import {
  emptyFilters,
  filterReducer,
  type Filters,
  type FilterUpdate,
} from "./model";
export function copyFilters(filters: Filters): Filters {
  return {
    ...filters,
    breeds: [...filters.breeds],
    regions: [...filters.regions],
    locations: [...filters.locations],
  };
}
export function changeDraft(filters: Filters, update: FilterUpdate): Filters {
  return filterReducer(
    { filters, page: 1, sort: "newest" },
    { kind: "filter", update },
  ).filters;
}
export function clearDraft(filters: Filters): Filters {
  return { ...emptyFilters(), q: filters.q };
}
