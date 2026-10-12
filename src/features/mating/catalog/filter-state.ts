import {
  urlFilterState,
  type FilterLabels,
} from "@/features/listing/filters/filter-url-state";
import {
  filtersToQuery,
  type Filters,
  type FilterUpdate,
} from "@/features/listing/filters/model";
import type { MatingCatalogQuery } from "./query";
import { matingAgeValue } from "./age-options";
export type MatingValues = Filters & {
  genders: NonNullable<MatingCatalogQuery["genders"]>;
  feeMode: MatingCatalogQuery["feeMode"];
};
export type MatingUpdate =
  | FilterUpdate
  | { field: "genders"; value: MatingValues["genders"] }
  | { field: "feeMode"; value: MatingValues["feeMode"] };
export function matingValues(
  query: MatingCatalogQuery,
  labels?: FilterLabels,
): MatingValues {
  const filters = urlFilterState(
    { ...query, priceMin: query.feeMin, priceMax: query.feeMax },
    labels,
  ).filters;
  return {
    ...filters,
    age: matingAgeValue(query),
    breeds: filters.breeds.map((b) =>
      labels?.breeds[b.id] ? b : { ...b, name: "Обрана порода" },
    ),
    locations: filters.locations.map((l) =>
      labels?.locations[l.id] ? l : { ...l, city: "Обраний населений пункт" },
    ),
    genders: query.genders ?? [],
    feeMode: query.feeMode,
  };
}
export function updateValues(
  values: MatingValues,
  change: MatingUpdate,
): MatingValues {
  const next = { ...values, [change.field]: change.value };
  if (change.field === "species" && change.value)
    next.breeds = values.breeds.filter(
      (b) => !b.species || b.species === change.value,
    );
  if (change.field === "feeMode" && change.value !== "fixed") {
    next.priceMin = "";
    next.priceMax = "";
  }
  return next;
}
export function valuesQuery(
  values: MatingValues,
  current: MatingCatalogQuery,
): MatingCatalogQuery {
  const base = filtersToQuery({ filters: values, page: 1, sort: current.sort });
  return {
    page: 1,
    limit: 24,
    sort: current.sort,
    ...(base.species ? { species: base.species } : {}),
    ...(base.breedIds ? { breedIds: base.breedIds } : {}),
    ...(base.regionIds ? { regionIds: base.regionIds } : {}),
    ...(base.locationIds ? { locationIds: base.locationIds } : {}),
    ...(base.ageMinMonths !== undefined
      ? { ageMinMonths: base.ageMinMonths }
      : {}),
    ...(base.ageMaxMonths !== undefined
      ? { ageMaxMonths: base.ageMaxMonths }
      : {}),
    ...(values.genders.length ? { genders: values.genders } : {}),
    ...(values.feeMode ? { feeMode: values.feeMode } : {}),
    ...(values.feeMode === "fixed" && base.priceMin !== undefined
      ? { feeMin: base.priceMin }
      : {}),
    ...(values.feeMode === "fixed" && base.priceMax !== undefined
      ? { feeMax: base.priceMax }
      : {}),
  };
}
export function matingFilterCount(v: MatingValues) {
  return (
    Number(Boolean(v.species)) +
    Number(Boolean(v.breeds.length)) +
    Number(Boolean(v.regions.length || v.locations.length)) +
    Number(Boolean(v.genders.length)) +
    Number(Boolean(v.age)) +
    Number(Boolean(v.feeMode))
  );
}
