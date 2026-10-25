import { z } from "zod";
const draftSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string(),
  gender: z.enum(["MALE", "FEMALE", "UNKNOWN"]),
  birthDate: z.string().nullable(),
  price: z.string().nullable(),
  species: z.object({ name: z.string() }).nullable().optional(),
  breed: z
    .object({ name: z.string(), nameUk: z.string().nullable() })
    .nullable()
    .optional(),
  location: z
    .object({ city: z.string(), region: z.string() })
    .nullable()
    .optional(),
  images: z.array(z.object({ id: z.uuid(), url: z.url() })),
});
const handoffSchema = z.object({
  id: z.uuid(),
  expiresAt: z.string(),
  breederDraft: z.object({ kennelName: z.string().nullable() }),
  items: z.array(z.object({ revision: z.string(), draft: draftSchema })),
});
export const envelope = z.object({
  data: z.array(handoffSchema),
  meta: z.object({ pages: z.number() }),
});
export type Handoff = z.infer<typeof handoffSchema>;
