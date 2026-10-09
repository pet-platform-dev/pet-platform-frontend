import { z } from "zod";
import { authenticatedRequest, ApiError } from "@/shared/api/client";
import {
  createUnifiedListing,
  type UnifiedListingInput,
} from "../create-listing/api/create-listing";
import type { QueryClient } from "@tanstack/react-query";
import {
  ownListingSchema,
  type OwnListing,
  type Status,
  statusGroups,
  type StatusGroup,
} from "./model";
const pageSchema = z.object({
  data: z.array(ownListingSchema),
  meta: z.object({
    page: z.number().int().positive(),
    pages: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
  }),
});
export async function getOwnListings(
  group: StatusGroup,
  page: number,
  signal?: AbortSignal,
) {
  const statuses: readonly (Status | undefined)[] = statusGroups[group].statuses
    .length
    ? statusGroups[group].statuses
    : [undefined];
  const responses = await Promise.all(
    statuses.map((status) => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "24",
        sort: "newest",
      });
      if (status) params.set("status", status);
      return authenticatedRequest<unknown>(
        `/listings/me?${params}`,
        { signal },
        true,
      ).then((value) => pageSchema.parse(value));
    }),
  );
  return {
    data: responses.flatMap((response) => response.data),
    hasMore: responses.some((response) => response.meta.pages > page),
  };
}
export async function getOwnedListing(
  id: string,
  userId: string,
  signal?: AbortSignal,
): Promise<OwnListing> {
  if (!z.uuid().safeParse(id).success)
    throw new ApiError(404, "Оголошення не знайдено");
  const listing = ownListingSchema.parse(
    await authenticatedRequest<unknown>(`/listings/${id}`, { signal }),
  );
  if (listing.seller.id !== userId)
    throw new ApiError(404, "Оголошення не знайдено");
  return listing;
}
export async function updateListing(id: string, body: unknown) {
  return ownListingSchema.parse(
    await authenticatedRequest<unknown>(`/listings/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  );
}
export async function changeListingStatus(id: string, status: Status) {
  return ownListingSchema.parse(
    await authenticatedRequest<unknown>(`/listings/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  );
}
export async function createAndMaybePublish(
  value: UnifiedListingInput,
  publish: boolean,
) {
  const draft = await createUnifiedListing(value);
  if (!publish) return { ...draft, publishFailed: false };
  try {
    const result = await changeListingStatus(draft.id, "ACTIVE");
    return { id: result.id, status: result.status, publishFailed: false };
  } catch {
    return { ...draft, publishFailed: true };
  }
}
export async function invalidateListings(client: QueryClient, id: string) {
  await Promise.all(
    [["my-listings"], ["listings"], ["listing", id], ["owned-listing", id]].map(
      (queryKey) => client.invalidateQueries({ queryKey }),
    ),
  );
}
export function managementError(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.status === 401)
    return "Сесію завершено. Увійдіть знову.";
  if (error instanceof ApiError && [400, 409].includes(error.status)) {
    const known = [
      "Додайте щонайменше",
      "Активне оголошення",
      "Тип оголошення",
      "Завершене або",
      "Для продажу",
      "Оберіть",
      "Заповніть",
      "Недопустимий перехід",
      "Сесію завантаження",
    ];
    if (known.some((prefix) => error.message.startsWith(prefix)))
      return error.message;
  }
  return fallback;
}
