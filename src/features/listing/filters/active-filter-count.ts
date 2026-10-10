import type { Filters } from "./model";
// Search and sort stay outside the drawer; geography is one OR group.
export function activeFilterCount(f: Filters): number {
  return [
    Boolean(f.species),
    f.breeds.length > 0,
    f.regions.length > 0 || f.locations.length > 0,
    Boolean(f.type),
    Boolean(f.gender),
    Boolean(f.age),
    Boolean(f.priceMin.trim() || f.priceMax.trim()),
  ].filter(Boolean).length;
}
