import type { CatalogQuery } from "@/entities/listing/model/catalog-query";
import {
  agePresets,
  emptyFilters,
  type FilterBreed,
  type FilterState,
} from "./model";
import type { Location } from "@/entities/location/model";
import type { Region } from "@/entities/location/regions";
import { customAgeValue } from "./filter-age-range";
export type FilterLabels = {
  breeds: Record<string, FilterBreed>;
  regions: Record<string, Region>;
  locations: Record<string, Location>;
};
export function urlFilterState(
  query: CatalogQuery,
  labels: FilterLabels = { breeds: {}, regions: {}, locations: {} },
): FilterState {
  const age = agePresets.find(
    (item) =>
      item.min === query.ageMinMonths && item.max === query.ageMaxMonths,
  );
  return {
    page: query.page,
    sort: query.sort,
    filters: {
      ...emptyFilters(),
      q: query.q ?? "",
      species: query.species,
      breeds: (query.breedIds ?? []).map(
        (id) =>
          labels.breeds[id] ?? {
            id,
            name: `Обрана порода (${id.slice(0, 8)})`,
            nameUk: null,
          },
      ),
      regions: (query.regionIds ?? []).map(
        (id) => labels.regions[id] ?? { id, name: `Обрана область (${id})` },
      ),
      locations: (query.locationIds ?? []).map(
        (id) =>
          labels.locations[id] ?? {
            id,
            city: `Обраний населений пункт (${id.slice(0, 8)})`,
            countryCode: "UA",
            region: "",
            district: null,
            community: null,
            settlementType: null,
            katottgCode: null,
          },
      ),
      type: query.type,
      gender: query.gender,
      age: age?.value ?? customAgeValue(query),
      priceMin: query.priceMin ?? "",
      priceMax: query.priceMax ?? "",
    },
  };
}
