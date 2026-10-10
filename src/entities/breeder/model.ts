import { breederMediaSchema, emptyBreederMedia } from "./media";
import { z } from "zod";
import { sellerSchema } from "@/entities/seller/model";
export const breederSchema = z.object({
  userId: z.uuid(),
  media: breederMediaSchema.default(emptyBreederMedia),
  kennelName: z.string().min(1).max(160),
  description: z.string().max(5000).nullable(),
  location: sellerSchema.shape.location,
  startedYear: z.number().int().min(1900).nullable(),
  website: z
    .url()
    .max(2048)
    .refine((value) => {
      const url = new URL(value);
      return (
        ["http:", "https:"].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        !value.includes(String.fromCharCode(92)) &&
        !Array.from(value).some((character) => !character.trim())
      );
    })
    .nullable(),
  breeds: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      nameUk: z.string().nullable(),
      slug: z.string(),
      isActive: z.boolean(),
      species: z.object({ id: z.uuid(), name: z.string(), slug: z.string() }),
    }),
  ),
  contactPerson: sellerSchema,
});
export type Breeder = z.infer<typeof breederSchema>;
export function breederTitle(kennelName: string) {
  return kennelName + " — профіль розплідника";
}
