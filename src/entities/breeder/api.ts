import { z } from "zod";
import { ApiError, publicRequest } from "@/shared/api/client";
import { breederSchema } from "./model";
export async function getBreeder(id: string, signal?: AbortSignal) {
  if (!z.uuid().safeParse(id).success)
    throw new ApiError(404, "Профіль не знайдено");
  return breederSchema.parse(
    await publicRequest<unknown>("/breeders/" + id, false, { signal }),
  );
}
