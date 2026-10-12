import { z } from "zod";
import { ApiError, publicRequest } from "@/shared/api/client";
import { publicMatingDetailSchema } from "./model";
import { publicMatingResponseSchema, type PublicMatingResponse } from "./model";
import {
  serializeMatingQuery,
  type MatingCatalogQuery,
} from "@/features/mating/catalog/query";
export { publicMatingSchema, publicMatingResponseSchema } from "./model";
export type { PublicMating, PublicMatingResponse } from "./model";
export async function getPublicMatingDetail(id: string, signal?: AbortSignal) {
  if (!z.uuid().safeParse(id).success)
    throw new ApiError(404, "Оголошення недоступне.");
  const row = publicMatingDetailSchema.parse(
    await publicRequest(`/mating-listings/${id}/public`, false, { signal }),
  );
  if (row.id.toLowerCase() !== id.toLowerCase())
    throw new ApiError(404, "Оголошення недоступне.");
  return row;
}
export async function getPublicMating(
  query: MatingCatalogQuery,
  signal?: AbortSignal,
): Promise<PublicMatingResponse> {
  return publicMatingResponseSchema.parse(
    await publicRequest(
      `/mating-listings?${serializeMatingQuery(query)}`,
      true,
      { signal },
    ),
  );
}
