import { z } from "zod";
import { authenticatedRequest, ApiError } from "@/shared/api/client";
import { ownMatingSchema, type OwnMating, type MatingAction } from "./model";
export type MatingFields = {
  description: string;
  locationId: string;
  fee: string | null;
};
export type OwnerStatusFilter =
  | "DRAFT"
  | "ACTIVE"
  | "CLOSED"
  | "ARCHIVED"
  | "PENDING"
  | "REJECTED"
  | "HIDDEN";
const pageSchema = z.object({
  data: z.array(ownMatingSchema),
  meta: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    pages: z.number(),
  }),
});
const safeId = (id: string) => {
  if (!z.uuid().safeParse(id).success)
    throw new ApiError(404, "Оголошення недоступне.");
  return id;
};
export async function getMyMating(
  page: number,
  status?: OwnerStatusFilter,
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({ page: String(page), limit: "24" });
  if (status && ["PENDING", "REJECTED", "HIDDEN"].includes(status))
    query.set("moderationStatus", status);
  else if (status) {
    query.set("status", status);
    if (status === "ACTIVE") query.set("moderationStatus", "APPROVED");
    if (status === "DRAFT") query.set("moderationStatus", "NOT_SUBMITTED");
  }
  return pageSchema.parse(
    await authenticatedRequest<unknown>(
      `/mating-listings/me?${query}`,
      { signal },
      true,
    ),
  );
}
export async function getActiveMating(
  signal?: AbortSignal,
): Promise<OwnMating[]> {
  const result: OwnMating[] = [];
  let page = 1;
  while (true) {
    const response = pageSchema.parse(
      await authenticatedRequest<unknown>(
        `/mating-listings/me?status=ACTIVE&page=${page}&limit=100`,
        { signal },
        true,
      ),
    );
    result.push(...response.data);
    if (page >= response.meta.pages) return result;
    page++;
  }
}
export async function getOwnedMating(
  id: string,
  userId: string,
  signal?: AbortSignal,
) {
  const row = ownMatingSchema.parse(
    await authenticatedRequest<unknown>(`/mating-listings/${safeId(id)}`, {
      signal,
    }),
  );
  if (row.owner.id !== userId)
    throw new ApiError(404, "Оголошення недоступне.");
  return row;
}
export async function createMating(input: MatingFields & { petId: string }) {
  return ownMatingSchema.parse(
    await authenticatedRequest<unknown>("/mating-listings", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}
export async function updateMating(id: string, input: MatingFields) {
  return ownMatingSchema.parse(
    await authenticatedRequest<unknown>(`/mating-listings/${safeId(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  );
}
export async function actOnMating(id: string, action: MatingAction) {
  if (action === "delete") {
    await authenticatedRequest<void>(`/mating-listings/${safeId(id)}`, {
      method: "DELETE",
    });
    return null;
  }
  return ownMatingSchema.parse(
    await authenticatedRequest<unknown>(
      `/mating-listings/${safeId(id)}/${action === "publish" ? "submit" : action}`,
      { method: "POST" },
    ),
  );
}
