import {
  normalizeCatalogQuery,
  type CatalogQuery,
} from "@/entities/listing/model/catalog-query";
export function filterHref(input: CatalogQuery): string {
  const query = normalizeCatalogQuery(input),
    params = new URLSearchParams();
  for (const key of [
    "q",
    "species",
    "breedIds",
    "regionIds",
    "locationIds",
    "type",
    "gender",
    "ageMinMonths",
    "ageMaxMonths",
    "priceMin",
    "priceMax",
    "sort",
    "page",
  ] as const) {
    const value = query[key];
    if (
      value === undefined ||
      value === "" ||
      (key === "sort" && value === "newest") ||
      (key === "page" && value === 1)
    )
      continue;
    params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  return `/listings${params.size ? `?${params}` : ""}`;
}
