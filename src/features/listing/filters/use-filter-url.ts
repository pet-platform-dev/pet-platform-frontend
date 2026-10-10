"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { parseFilterUrl } from "./filter-url-parser";
import { filterHref } from "./filter-url-serializer";
import type { CatalogQuery } from "@/entities/listing/model/catalog-query";
export function useFilterUrl(initial: CatalogQuery) {
  const params = useSearchParams(),
    query = params ? parseFilterUrl(params) : initial,
    href = filterHref(query),
    raw = params?.toString() ?? filterHref(initial).split("?")[1] ?? "";
  useEffect(() => {
    if ((raw ? `/listings?${raw}` : "/listings") !== href)
      window.history.replaceState(null, "", href);
  }, [raw, href]);
  function navigate(next: CatalogQuery, mode: "push" | "replace" = "push") {
    const target = filterHref(next);
    if (window.location.pathname + window.location.search !== target)
      window.history[mode === "push" ? "pushState" : "replaceState"](
        null,
        "",
        target,
      );
  }
  return { query, href, navigate };
}
