import { z } from "zod";
import {
  ApiError,
  publicRequest,
  authenticatedRequest,
} from "@/shared/api/client";
import { listingsResponseSchema } from "@/entities/listing/model/listing";
import { sellerSchema, type ProfileInput } from "./model";
export async function getSeller(id: string, signal?: AbortSignal) {
  if (!z.uuid().safeParse(id).success)
    throw new ApiError(404, "Продавця не знайдено");
  return sellerSchema.parse(
    await publicRequest<unknown>(`/sellers/${id}`, false, { signal }),
  );
}
export async function getSellerListings(
  id: string,
  page = 1,
  signal?: AbortSignal,
) {
  if (!z.uuid().safeParse(id).success)
    throw new ApiError(404, "Продавця не знайдено");
  return listingsResponseSchema.parse(
    await publicRequest<unknown>(
      `/sellers/${id}/listings?page=${page}&limit=24&sort=newest`,
      true,
      { signal },
    ),
  );
}
export async function getProfile(signal?: AbortSignal) {
  return sellerSchema.parse(
    await authenticatedRequest<unknown>("/profile", { signal }),
  );
}
export async function saveProfile(
  input: ProfileInput,
  locationId: string | null,
) {
  return sellerSchema.parse(
    await authenticatedRequest<unknown>("/profile", {
      method: "PATCH",
      body: JSON.stringify({ ...input, locationId }),
    }),
  );
}
