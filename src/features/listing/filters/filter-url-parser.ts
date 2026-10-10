import { z } from "zod";
import {
  catalogSorts,
  selectionIds,
  type CatalogQuery,
} from "@/entities/listing/model/catalog-query";
import { priceErrors } from "./price-validation";
type Params =
  | Pick<URLSearchParams, "getAll">
  | Record<string, string | string[] | undefined>;
export function parseFilterUrl(params: Params): CatalogQuery {
  const all = (key: string): string[] =>
    "getAll" in params && typeof params.getAll === "function"
      ? params.getAll(key)
      : ((typeof params[key as keyof typeof params] === "string"
          ? [params[key as keyof typeof params] as string]
          : (params[key as keyof typeof params] as string[] | undefined)) ??
        []);
  const single = (key: string) => {
    const values = all(key);
    return values.length === 1 ? values[0].trim() : undefined;
  };
  const enumValue = <T extends string>(
    key: string,
    values: readonly T[],
  ): T | undefined => values.find((value) => value === single(key));
  const integer = (key: string, max: number) => {
    const value = single(key);
    return value && /^(?:0|[1-9]\d*)$/.test(value) && Number(value) <= max
      ? Number(value)
      : undefined;
  };
  const ids = (key: string, region = false) =>
    selectionIds(
      all(key)
        .flatMap((value) => value.split(","))
        .map((value) => (region ? value.trim() : value.trim().toLowerCase()))
        .filter((value) =>
          region ? /^UA\d{2}$/.test(value) : z.uuid().safeParse(value).success,
        ),
    ).slice(0, 50);
  const money = (key: string) => {
    const value = single(key)?.replace(",", ".");
    return value && !priceErrors(value, "").min ? value : undefined;
  };
  const query: CatalogQuery = {
    page: integer("page", 100000) || 1,
    limit: 24,
    sort: enumValue("sort", catalogSorts) ?? "newest",
  };
  const q = single("q");
  if (q) query.q = q.slice(0, 100);
  query.species = enumValue("species", ["dog", "cat"]);
  for (const key of ["breedIds", "regionIds", "locationIds"] as const) {
    const values = ids(key, key === "regionIds");
    if (values.length) query[key] = values;
  }
  query.type = enumValue("type", ["SALE", "FREE", "ADOPTION"]);
  query.gender = enumValue("gender", ["MALE", "FEMALE", "UNKNOWN"]);
  query.ageMinMonths = integer("ageMinMonths", 600);
  query.ageMaxMonths = integer("ageMaxMonths", 600);
  if (
    query.ageMinMonths !== undefined &&
    query.ageMaxMonths !== undefined &&
    query.ageMinMonths > query.ageMaxMonths
  ) {
    delete query.ageMinMonths;
    delete query.ageMaxMonths;
  }
  query.priceMin = money("priceMin");
  query.priceMax = money("priceMax");
  if (priceErrors(query.priceMin ?? "", query.priceMax ?? "").max) {
    delete query.priceMin;
    delete query.priceMax;
  }
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined),
  ) as CatalogQuery;
}
