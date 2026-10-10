import { publicRequest } from "@/shared/api/client";
import type { Paginated } from "@/shared/api/pagination";
import { listingsResponseSchema, type Listing } from "../model/listing";
import {
  serializeCatalogQuery,
  type CatalogQuery,
} from "../model/catalog-query";
export async function getListings(
  query: CatalogQuery,
  signal?: AbortSignal,
): Promise<Paginated<Listing>> {
  const response = await publicRequest<unknown>(
    `/listings?${serializeCatalogQuery(query)}`,
    true,
    { signal },
  );
  const result = listingsResponseSchema.safeParse(response);
  if (!result.success) throw new Error("Не вдалося завантажити оголошення.");
  return result.data;
}
