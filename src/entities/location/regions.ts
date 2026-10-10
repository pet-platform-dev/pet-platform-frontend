import { z } from "zod";
import { publicRequest } from "@/shared/api/client";
const regionSchema = z.object({
  id: z.string().regex(/^UA\d{2}$/),
  name: z.string(),
});
export type Region = z.infer<typeof regionSchema>;
export async function getRegions() {
  return z
    .array(regionSchema)
    .parse(await publicRequest<unknown>("/locations/regions"));
}
