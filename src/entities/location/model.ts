import { z } from "zod";
export const locationSchema = z.object({
  id: z.uuid(),
  countryCode: z.string(),
  region: z.string(),
  city: z.string(),
  district: z.string().nullable(),
  community: z.string().nullable(),
  settlementType: z.enum(["CITY", "SETTLEMENT", "VILLAGE"]).nullable(),
  katottgCode: z.string().nullable(),
});
export type Location = z.infer<typeof locationSchema>;
