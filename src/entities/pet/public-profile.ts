import { z } from "zod";
import { breederAnimalSchema } from "@/entities/breeder/animals";
import { petMediaSchema } from "./media";
import { ApiError, publicRequest } from "@/shared/api/client";
export const publicPetSchema = breederAnimalSchema
  .omit({ previewImage: true, activeListing: true })
  .extend({
    description: z.string().nullable(),
    specialTraits: z.string().nullable(),
    profileImage: z
      .object({
        url: z.url().regex(/^https:\/\/res\.cloudinary\.com\//),
        thumbnailUrl: z.url(),
      })
      .nullable(),
    gallery: petMediaSchema.shape.gallery,
    videos: petMediaSchema.shape.videos,
    breederSummary: z
      .object({ id: z.uuid(), kennelName: z.string() })
      .transform((value) => ({ ...value, href: "/sellers/" + value.id })),
    activeListingSummary: breederAnimalSchema.shape.activeListing,
    activeMatingListing: z.object({ id: z.uuid() }).nullable().default(null),
  });
export type PublicPet = z.infer<typeof publicPetSchema>;
export { publicPetKey } from "./query-keys";
export async function getPublicPet(id: string, signal?: AbortSignal) {
  if (!z.uuid().safeParse(id).success)
    throw new ApiError(404, "Профіль тварини не знайдено");
  const pet = publicPetSchema.parse(
    await publicRequest("/pets/" + encodeURIComponent(id) + "/public", false, {
      signal,
    }),
  );
  if (pet.id.toLowerCase() !== id.toLowerCase())
    throw Error("Профіль тварини не знайдено");
  return pet;
}
