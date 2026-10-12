import { publicRequest } from "@/shared/api/client";
import { publicMatingResponseSchema, type PublicMatingResponse } from "./model";
import {
  serializeMatingQuery,
  type MatingCatalogQuery,
} from "@/features/mating/catalog/query";
export { publicMatingSchema, publicMatingResponseSchema } from "./model";
export type { PublicMating, PublicMatingResponse } from "./model";
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
