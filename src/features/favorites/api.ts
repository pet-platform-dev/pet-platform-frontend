import { z } from "zod";
import { authenticatedRequest } from "@/shared/api/client";
import { listingsResponseSchema } from "@/entities/listing/model/listing";
export type FavoriteStates = Record<string, boolean>;
export async function getFavoriteStates(
  ids: string[],
  signal?: AbortSignal,
): Promise<FavoriteStates> {
  const parts = [];
  for (let offset = 0; offset < ids.length; offset += 100) {
    parts.push(
      authenticatedRequest<unknown>(
        "/favorites/state?" +
          new URLSearchParams({
            listingIds: ids.slice(offset, offset + 100).join(","),
          }),
        { signal },
      ),
    );
  }
  const results = await Promise.all(parts);
  return Object.assign(
    {},
    ...results.map((result) => z.record(z.uuid(), z.boolean()).parse(result)),
  );
}
export async function getFavorites(page: number, signal?: AbortSignal) {
  return listingsResponseSchema.parse(
    await authenticatedRequest<unknown>(
      `/favorites?page=${page}&limit=24`,
      { signal },
      true,
    ),
  );
}
export async function toggleFavorite(id: string, active: boolean) {
  return z.object({ listingId: z.uuid(), isFavorite: z.boolean() }).parse(
    await authenticatedRequest<unknown>("/favorites/" + id, {
      method: active ? "POST" : "DELETE",
      body: "{}",
    }),
  );
}
