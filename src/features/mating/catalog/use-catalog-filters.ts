"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useFilterLabels } from "@/features/listing/filters/use-filter-labels";
import { useFilterInputs } from "@/features/listing/filters/use-filter-inputs";
import { parseMatingUrl, matingHref, type MatingCatalogQuery } from "./query";
import {
  matingValues,
  valuesQuery,
  updateValues,
  type MatingValues,
  type MatingUpdate,
} from "./filter-state";
export function useMatingFilters(initial: MatingCatalogQuery) {
  const params = useSearchParams(),
    query = params ? parseMatingUrl(params) : initial,
    href = matingHref(query),
    raw = params?.toString() ?? "";
  const refs = useFilterLabels(query.regionIds),
    applied = matingValues(query, refs.labels);
  useEffect(() => {
    const actual = raw ? "/mating?" + raw : "/mating";
    if (params && actual !== href) window.history.replaceState(null, "", href);
  }, [raw, href, params]);
  function navigate(
    next: MatingCatalogQuery,
    mode: "push" | "replace" = "push",
  ) {
    const target = matingHref(next);
    if (location.pathname + location.search !== target)
      window.history[mode === "push" ? "pushState" : "replaceState"](
        null,
        "",
        target,
      );
  }
  const inputs = useFilterInputs(href, applied, (v, mode) => {
    const next = valuesQuery({ ...applied, ...v }, query);
    navigate(next, mode);
    return { q: "", priceMin: next.feeMin ?? "", priceMax: next.feeMax ?? "" };
  });
  const values = { ...applied, ...inputs.values };
  function remember(v: MatingValues) {
    refs.remember({ field: "breeds", value: v.breeds });
    refs.remember({ field: "regions", value: v.regions });
    refs.remember({ field: "locations", value: v.locations });
  }
  function update(change: MatingUpdate) {
    if (change.field === "priceMin" || change.field === "priceMax") {
      inputs.update(change.field, change.value);
      return;
    }
    const next = updateValues(inputs.invalid ? applied : values, change);
    remember(next);
    navigate(valuesQuery(next, query));
  }
  function apply(v: MatingValues, cleared = false) {
    remember(v);
    navigate(
      valuesQuery(v, { ...query, sort: cleared ? "newest" : query.sort }),
    );
  }
  function clear() {
    inputs.reset({ q: "", priceMin: "", priceMax: "" });
    navigate({ page: 1, limit: 24, sort: "newest" });
  }
  function prepare() {
    const next =
      inputs.pending && !inputs.invalid ? valuesQuery(values, query) : query;
    if (inputs.pending && !inputs.invalid) navigate(next);
    return {
      values: matingValues(next, refs.labels),
      version: matingHref(next),
    };
  }
  return {
    query,
    href,
    values,
    applied,
    update,
    apply,
    clear,
    prepare,
    errors: inputs.errors,
    invalid: inputs.invalid,
    pending: inputs.pending,
    navigate,
    page: (page: number) => {
      navigate({ ...query, page });
      document
        .querySelector(".catalog-results")
        ?.scrollIntoView({ block: "start" });
    },
    sort: (sort: MatingCatalogQuery["sort"]) =>
      navigate({ ...query, sort, page: 1 }),
  };
}
