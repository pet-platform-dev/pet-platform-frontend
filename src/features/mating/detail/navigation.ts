import {
  matingHref,
  parseMatingUrl,
  type MatingCatalogQuery,
} from "../catalog/query";
export function safeMatingReturn(value: string | string[] | undefined): string {
  if (
    typeof value !== "string" ||
    value.length > 8192 ||
    /[\s\\#\p{Cc}]/u.test(value) ||
    (value !== "/mating" && !value.startsWith("/mating?"))
  )
    return "/mating";
  return matingHref(
    parseMatingUrl(new URLSearchParams(value.slice("/mating?".length))),
  );
}
export function matingDetailHref(id: string, query: MatingCatalogQuery) {
  return `/mating/${encodeURIComponent(id)}?${new URLSearchParams({ returnTo: matingHref(query) })}`;
}
