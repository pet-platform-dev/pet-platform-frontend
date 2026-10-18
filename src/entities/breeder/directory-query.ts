import { z } from "zod";

export type DirectoryQuery = {
  q?: string;
  species?: "dog" | "cat";
  breedId?: string;
  locationId?: string;
  page: number;
};
export function directoryPage(value: string | string[] | undefined): number {
  return typeof value === "string" &&
    /^[1-9]\d*$/.test(value) &&
    Number(value) <= 100000
    ? Number(value)
    : 1;
}
export function parseDirectoryQuery(
  params: Pick<URLSearchParams, "getAll">,
): DirectoryQuery {
  const one = (key: string) => {
    const values = params.getAll(key);
    return values.length === 1 ? values[0] : undefined;
  };
  const q = one("q")?.trim().slice(0, 100);
  const species = one("species");
  const id = (key: string) => z.uuid().safeParse(one(key)).data?.toLowerCase();
  return {
    ...(q ? { q } : {}),
    ...(species === "dog" || species === "cat" ? { species } : {}),
    ...(id("breedId") ? { breedId: id("breedId") } : {}),
    ...(id("locationId") ? { locationId: id("locationId") } : {}),
    page: directoryPage(one("page")),
  };
}
export function directoryParams(query: DirectoryQuery) {
  const params = new URLSearchParams();
  for (const key of ["q", "species", "breedId", "locationId"] as const)
    if (query[key]) params.set(key, query[key]!);
  if (query.page > 1) params.set("page", String(query.page));
  return params;
}
export function directoryHref(query: DirectoryQuery) {
  const params = directoryParams(query).toString();
  return "/breeders" + (params ? "?" + params : "");
}
export const hasDirectoryFilters = (query: DirectoryQuery) =>
  Boolean(query.q || query.species || query.breedId || query.locationId);
export function changeDirectorySpecies(
  query: DirectoryQuery,
  species: DirectoryQuery["species"],
  compatible: boolean,
): DirectoryQuery {
  return {
    ...query,
    species,
    breedId: !species || compatible ? query.breedId : undefined,
    page: 1,
  };
}
