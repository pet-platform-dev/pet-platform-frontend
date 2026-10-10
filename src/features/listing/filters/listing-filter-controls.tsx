import { SpeciesFilter } from "./species-filter";
import { BreedFilter } from "./breed-filter";
import { RegionFilter } from "./region-filter";
import { LocationFilter } from "./location-filter";
import { ListingTypeFilter } from "./listing-type-filter";
import { GenderFilter } from "./gender-filter";
import { AgeFilter } from "./age-filter";
import { PriceFilter } from "./price-filter";
import type { Filters, FilterUpdate } from "./model";
export function ListingFilterControls({
  filters,
  errors,
  onChange,
}: {
  filters: Filters;
  errors: { min?: string; max?: string };
  onChange: (change: FilterUpdate) => void;
}) {
  return (
    <>
      <SpeciesFilter
        value={filters.species}
        onChange={(value) => onChange({ field: "species", value })}
      />
      <BreedFilter
        species={filters.species}
        selected={filters.breeds}
        onChange={(value) => onChange({ field: "breeds", value })}
      />
      <RegionFilter
        selected={filters.regions}
        onChange={(value) => onChange({ field: "regions", value })}
      />
      <LocationFilter
        selected={filters.locations}
        onChange={(value) => onChange({ field: "locations", value })}
      />
      <ListingTypeFilter
        value={filters.type}
        onChange={(value) => onChange({ field: "type", value })}
      />
      <GenderFilter
        value={filters.gender}
        onChange={(value) => onChange({ field: "gender", value })}
      />
      <AgeFilter
        value={filters.age}
        onChange={(value) => onChange({ field: "age", value })}
      />
      <PriceFilter
        filters={filters}
        errors={errors}
        onChange={(field, value) => onChange({ field, value })}
      />
    </>
  );
}
