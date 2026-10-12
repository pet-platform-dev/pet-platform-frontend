import { parseFilterUrl } from "@/features/listing/filters/filter-url-parser";
import { selectionIds } from "@/entities/listing/model/catalog-query";
export const matingSorts = ["newest", "price_asc", "price_desc"] as const;
export type MatingCatalogQuery = {
  page: number;
  limit: 1 | 24;
  sort: (typeof matingSorts)[number];
  species?: "dog" | "cat";
  breedIds?: string[];
  genders?: ("MALE" | "FEMALE")[];
  regionIds?: string[];
  locationIds?: string[];
  ageMinMonths?: number;
  ageMaxMonths?: number;
  feeMode?: "agreement" | "free" | "fixed";
  feeMin?: string;
  feeMax?: string;
};
export type MatingSearchParams =
  | Pick<URLSearchParams, "getAll">
  | Record<string, string | string[] | undefined>;
export function parseMatingUrl(input: MatingSearchParams): MatingCatalogQuery {
  const all = (key: string): string[] =>
    "getAll" in input && typeof input.getAll === "function"
      ? input.getAll(key)
      : typeof input[key as keyof typeof input] === "string"
        ? [input[key as keyof typeof input] as string]
        : ((input[key as keyof typeof input] as string[] | undefined) ?? []);
  const single = (key: string) =>
    all(key).length === 1 ? all(key)[0].trim() : undefined;
  // Share market validation for identifiers, age bounds and exact decimal ranges.
  const shared = parseFilterUrl({
    getAll: (key) =>
      all(key === "priceMin" ? "feeMin" : key === "priceMax" ? "feeMax" : key),
  });
  const query: MatingCatalogQuery = {
    page: shared.page,
    limit: 24,
    sort: matingSorts.find((value) => value === single("sort")) ?? "newest",
  };
  for (const key of [
    "species",
    "breedIds",
    "regionIds",
    "locationIds",
    "ageMinMonths",
    "ageMaxMonths",
  ] as const) {
    Object.assign(
      query,
      shared[key] === undefined ? {} : { [key]: shared[key] },
    );
  }
  const genders = selectionIds(
    all("genders")
      .flatMap((value) => value.split(","))
      .map((value) => value.trim()),
  ).filter(
    (value): value is "MALE" | "FEMALE" =>
      value === "MALE" || value === "FEMALE",
  );
  if (genders.length) query.genders = genders;
  const mode = single("feeMode");
  if (mode === "agreement" || mode === "free" || mode === "fixed")
    query.feeMode = mode;
  if (
    mode !== "agreement" &&
    mode !== "free" &&
    (shared.priceMin !== undefined || shared.priceMax !== undefined)
  ) {
    query.feeMode = "fixed";
    if (shared.priceMin !== undefined) query.feeMin = shared.priceMin;
    if (shared.priceMax !== undefined) query.feeMax = shared.priceMax;
  }
  return query;
}
export function normalizeMatingQuery(
  input: MatingCatalogQuery,
): MatingCatalogQuery {
  const params = Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      Array.isArray(value)
        ? value.join(",")
        : value === undefined
          ? undefined
          : String(value),
    ]),
  );
  return { ...parseMatingUrl(params), limit: input.limit === 1 ? 1 : 24 };
}
const filterKeys = [
  "species",
  "breedIds",
  "genders",
  "regionIds",
  "locationIds",
  "ageMinMonths",
  "ageMaxMonths",
  "feeMode",
  "feeMin",
  "feeMax",
] as const;
function filters(params: URLSearchParams, query: MatingCatalogQuery) {
  for (const key of filterKeys) {
    const value = query[key];
    if (value !== undefined)
      params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
}
export function serializeMatingQuery(input: MatingCatalogQuery): string {
  const query = normalizeMatingQuery(input),
    params = new URLSearchParams({
      page: String(query.page),
      limit: String(query.limit),
      sort: query.sort,
    });
  filters(params, query);
  return params.toString();
}
export function matingHref(input: MatingCatalogQuery): string {
  const query = normalizeMatingQuery(input),
    params = new URLSearchParams();
  filters(params, query);
  if (query.sort !== "newest") params.set("sort", query.sort);
  if (query.page !== 1) params.set("page", String(query.page));
  return `/mating${params.size ? `?${params}` : ""}`;
}
export const matingQueryKey = (query: MatingCatalogQuery) =>
  ["mating-public", normalizeMatingQuery(query)] as const;
