import type { CatalogQuery } from "@/entities/listing/model/catalog-query";
export function customAgeValue(query: CatalogQuery) {
  return query.ageMinMonths === undefined && query.ageMaxMonths === undefined
    ? ""
    : `range:${query.ageMinMonths ?? ""}:${query.ageMaxMonths ?? ""}`;
}
export function customAgeRange(
  value: string,
): Pick<CatalogQuery, "ageMinMonths" | "ageMaxMonths"> {
  const match = /^range:(\d{0,3}):(\d{0,3})$/.exec(value);
  if (!match) return {};
  return {
    ...(match[1] ? { ageMinMonths: Number(match[1]) } : {}),
    ...(match[2] ? { ageMaxMonths: Number(match[2]) } : {}),
  };
}
export function customAgeLabel(value: string) {
  const age = customAgeRange(value);
  return age.ageMinMonths === undefined
    ? `До ${age.ageMaxMonths} місяців`
    : age.ageMaxMonths === undefined
      ? `Від ${age.ageMinMonths} місяців`
      : `${age.ageMinMonths}–${age.ageMaxMonths} місяців`;
}
