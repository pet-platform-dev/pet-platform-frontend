import { publicRequest } from "@/shared/api/client";
import type { Paginated } from "@/shared/api/pagination";
import { listingsResponseSchema, type Listing } from "../model/listing";
import type { CatalogQuery } from "../model/catalog-query";
export async function getListings(
  query: CatalogQuery,
): Promise<Paginated<Listing>> {
  const params = new URLSearchParams({
    page: String(query.page),
    limit: String(query.limit),
    sort: query.sort,
  });
  const response = await publicRequest<unknown>(`/listings?${params}`, true);
  const result = listingsResponseSchema.safeParse(response);
  if (!result.success) throw new Error("Не вдалося завантажити оголошення.");
  return result.data;
}
