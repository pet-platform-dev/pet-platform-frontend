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
export async function getSellerMating(
  id: string,
  page: number,
  signal?: AbortSignal,
) {
  if (
    !z.uuid().safeParse(id).success ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 100000
  )
    throw new ApiError(404, "Оголошення недоступні.");
  const result = publicMatingResponseSchema.parse(
    await publicRequest(
      `/sellers/${id}/mating-listings?page=${page}&limit=24`,
      true,
      { signal },
    ),
  );
  if (
    result.data.some((row) => row.owner.id.toLowerCase() !== id.toLowerCase())
  )
    throw new ApiError(404, "Оголошення недоступні.");
  return result;
}
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
