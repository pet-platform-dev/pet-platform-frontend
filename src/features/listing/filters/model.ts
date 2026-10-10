import type {
  CatalogQuery,
  CatalogSort,
} from "@/entities/listing/model/catalog-query";
import { selectionIds } from "@/entities/listing/model/catalog-query";
import type { Region } from "@/entities/location/regions";
import type { BreedChoice } from "@/features/pet/breed-selector";
import type { Location } from "@/entities/location/model";
export const agePresets = [
  { value: "0-3", label: "До 3 місяців", min: 0, max: 3 },
  { value: "3-6", label: "3–6 місяців", min: 3, max: 6 },
  { value: "6-12", label: "6–12 місяців", min: 6, max: 12 },
  { value: "12-24", label: "1–2 роки", min: 12, max: 24 },
  { value: "24-60", label: "2–5 років", min: 24, max: 60 },
  { value: "60+", label: "5+ років", min: 60, max: undefined },
] as const;
export type FilterBreed = BreedChoice & { species: "dog" | "cat" };
export type Filters = {
  q: string;
  species: "dog" | "cat" | undefined;
  breeds: FilterBreed[];
  regions: Region[];
  locations: Location[];
  type: CatalogQuery["type"];
  gender: CatalogQuery["gender"];
  age: string;
  priceMin: string;
  priceMax: string;
};
export const emptyFilters = (): Filters => ({
  q: "",
  species: undefined,
  breeds: [],
  regions: [],
  locations: [],
  type: undefined,
  gender: undefined,
  age: "",
  priceMin: "",
  priceMax: "",
});
export type FilterUpdate = {
  [K in keyof Filters]: { field: K; value: Filters[K] };
}[keyof Filters];
export type FilterState = { filters: Filters; page: number; sort: CatalogSort };
export type FilterAction =
  | { kind: "filter"; update: FilterUpdate }
  | { kind: "page"; page: number }
  | { kind: "sort"; sort: CatalogSort }
  | { kind: "clear" };
export function filterReducer(
  state: FilterState,
  action: FilterAction,
): FilterState {
  if (action.kind === "page") return { ...state, page: action.page };
  if (action.kind === "sort") return { ...state, sort: action.sort, page: 1 };
  if (action.kind === "clear")
    return { filters: emptyFilters(), page: 1, sort: "newest" };
  const { field, value } = action.update;
  const filters: Filters = { ...state.filters, [field]: value };
  if (field === "species" && value)
    filters.breeds = filters.breeds.filter((breed) => breed.species === value);
  if (field === "type" && (value === "FREE" || value === "ADOPTION")) {
    filters.priceMin = "";
    filters.priceMax = "";
  }
  return { ...state, filters, page: 1 };
}
export function filtersToQuery(state: FilterState): CatalogQuery {
  const f = state.filters,
    age = agePresets.find((item) => item.value === f.age);
  return {
    page: state.page,
    limit: 24,
    sort: state.sort,
    ...(f.q.trim() ? { q: f.q.trim() } : {}),
    ...(f.species ? { species: f.species } : {}),
    ...(f.breeds.length
      ? { breedIds: selectionIds(f.breeds.map((item) => item.id)) }
      : {}),
    ...(f.regions.length
      ? { regionIds: selectionIds(f.regions.map((item) => item.id)) }
      : {}),
    ...(f.locations.length
      ? { locationIds: selectionIds(f.locations.map((item) => item.id)) }
      : {}),
    ...(f.type ? { type: f.type } : {}),
    ...(f.gender ? { gender: f.gender } : {}),
    ...(age
      ? {
          ageMinMonths: age.min,
          ...(age.max === undefined ? {} : { ageMaxMonths: age.max }),
        }
      : {}),
    ...(f.priceMin.trim()
      ? { priceMin: f.priceMin.trim().replace(",", ".") }
      : {}),
    ...(f.priceMax.trim()
      ? { priceMax: f.priceMax.trim().replace(",", ".") }
      : {}),
  };
}
export function hasFilters(f: Filters) {
  return Boolean(
    f.q.trim() ||
    f.species ||
    f.breeds.length ||
    f.regions.length ||
    f.locations.length ||
    f.type ||
    f.gender ||
    f.age ||
    f.priceMin.trim() ||
    f.priceMax.trim(),
  );
}
