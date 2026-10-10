import type { CatalogQuery } from "@/entities/listing/model/catalog-query";
import { parseFilterUrl } from "../filters/filter-url-parser";
import { filterHref } from "../filters/filter-url-serializer";

export function safeCatalogReturn(
  value: string | string[] | undefined,
): string {
  if (
    typeof value !== "string" ||
    value.length > 8192 ||
    /[\s\\#\p{Cc}]/u.test(value) ||
    (value !== "/listings" && !value.startsWith("/listings?"))
  )
    return "/listings";
  return filterHref(
    parseFilterUrl(new URLSearchParams(value.slice("/listings?".length))),
  );
}

export function listingDetailHref(id: string, query: CatalogQuery): string {
  const params = new URLSearchParams({ returnTo: filterHref(query) });
  return `/listings/${encodeURIComponent(id)}?${params}`;
}
