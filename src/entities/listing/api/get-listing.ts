import { z } from "zod";
import { ApiError, publicRequest } from "@/shared/api/client";
import { listingSchema, type Listing } from "../model/listing";

export async function getListing(
  id: string,
  signal?: AbortSignal,
): Promise<Listing> {
  if (!z.uuid().safeParse(id).success)
    throw new ApiError(404, "Оголошення не знайдено");
  const data = await publicRequest<unknown>(
    `/listings/${encodeURIComponent(id)}`,
    false,
    { signal },
  );
  const result = listingSchema.safeParse(data);
  if (!result.success) throw new Error("Не вдалося завантажити оголошення");
  if (result.data.id.toLowerCase() !== id.toLowerCase())
    throw new Error("Не вдалося завантажити оголошення");
  return result.data;
}
