export const catalogSorts = [
  "newest",
  "oldest",
  "price_asc",
  "price_desc",
] as const;
export type CatalogSort = (typeof catalogSorts)[number];
export type CatalogQuery = {
  page: number;
  limit: 1 | 24;
  sort: CatalogSort;
  q?: string;
  species?: "dog" | "cat";
  breedIds?: string[];
  regionIds?: string[];
  locationIds?: string[];
  type?: "SALE" | "FREE" | "ADOPTION";
  gender?: "MALE" | "FEMALE" | "UNKNOWN";
  ageMinMonths?: number;
  ageMaxMonths?: number;
  priceMin?: string;
  priceMax?: string;
};
export const selectionIds = (ids: readonly string[]) =>
  [...new Set(ids)].sort();
export function normalizeCatalogQuery(query: CatalogQuery): CatalogQuery {
  const result = { ...query };
  for (const key of ["breedIds", "regionIds", "locationIds"] as const) {
    if (query[key]?.length) result[key] = selectionIds(query[key]);
    else delete result[key];
  }
  return result;
}
export function serializeCatalogQuery(query: CatalogQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(normalizeCatalogQuery(query))) {
    if (value !== undefined && value !== "")
      params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  return params.toString();
}
export const listingsQueryKey = (query: CatalogQuery) =>
  ["listings", normalizeCatalogQuery(query)] as const;
export function catalogQuery(
  params: Record<string, string | string[] | undefined>,
): CatalogQuery {
  const value = params.page;
  const page =
    typeof value === "string" &&
    /^[1-9]\d*$/.test(value) &&
    Number(value) <= 100000
      ? Number(value)
      : 1;
  return {
    page,
    limit: 24,
    sort:
      typeof params.sort === "string" &&
      catalogSorts.includes(params.sort as CatalogSort)
        ? (params.sort as CatalogSort)
        : "newest",
  };
}
export function catalogHref(page: number, sort: CatalogSort): string {
  const safePage =
    Number.isInteger(page) && page >= 1 && page <= 100000 ? page : 1;
  return `/listings?${new URLSearchParams({ page: String(safePage), sort })}`;
}
export function catalogPageNumbers(page: number, pages: number): number[] {
  if (pages < 1) return [];
  const current = Math.min(Math.max(1, page), pages);
  const start = Math.max(1, Math.min(current - 2, pages - 4));
  return Array.from(
    { length: Math.min(5, pages) },
    (_, index) => start + index,
  );
}
