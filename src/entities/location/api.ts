import { z } from "zod";
import { publicRequest } from "@/shared/api/client";
import { locationSchema } from "./model";
const pageSchema = z.object({
  data: z.array(locationSchema),
  meta: z.object({
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
    pages: z.number().int(),
  }),
});
export async function getLocations(search: string, page = 1) {
  const params = new URLSearchParams({
    search,
    page: String(page),
    limit: "50",
  });
  return pageSchema.parse(
    await publicRequest<unknown>(`/locations?${params}`, true),
  );
}
