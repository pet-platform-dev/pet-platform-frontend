import { filtersToQuery, type Filters } from "./model";
import {
  normalizeCatalogQuery,
  type CatalogQuery,
} from "@/entities/listing/model/catalog-query";
export function draftPreviewQuery(filters: Filters): CatalogQuery {
  return { ...filtersToQuery({ filters, page: 1, sort: "newest" }), limit: 1 };
}
export const draftPreviewKey = (query: CatalogQuery) =>
  ["listing-filter-preview", normalizeCatalogQuery(query)] as const;
export function applyResultLabel(total: number): string {
  const plural = new Intl.PluralRules("uk-UA").select(total);
  return `Показати ${new Intl.NumberFormat("uk-UA").format(total)} ${plural === "many" || plural === "other" ? "оголошень" : "оголошення"}`;
}
