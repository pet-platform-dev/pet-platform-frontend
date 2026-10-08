import { z } from "zod";
export const locationSchema = z.object({
  id: z.uuid(),
  countryCode: z.string(),
  region: z.string(),
  city: z.string(),
});
export type Location = z.infer<typeof locationSchema>;
