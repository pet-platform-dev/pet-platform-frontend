import { z } from "zod";
import { moderationSchema } from "@/shared/lib/moderation";
import { authenticatedRequest, publicRequest } from "@/shared/api/client";
const image = z.object({
  thumbnailUrl: z.url().refine((value) => {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password;
  }),
});
const offer = z.object({
  id: z.uuid(),
  type: z.enum(["SALE", "FREE", "ADOPTION"]),
  price: z.string().nullable(),
  currency: z.literal("UAH"),
  cover: image.nullable(),
});
const publicOffer = offer.transform((value) => ({
  ...value,
  href: "/listings/" + value.id,
}));
export const breederAnimalSchema = z.object({
  id: z.uuid(),
  name: z.string().nullable(),
  gender: z.enum(["MALE", "FEMALE", "UNKNOWN"]),
  birthDate: z.iso.date().nullable(),
  species: z.object({
    id: z.uuid(),
    name: z.string(),
    slug: z.enum(["dog", "cat"]),
  }),
  breed: z
    .object({
      id: z.uuid(),
      name: z.string(),
      nameUk: z.string().nullable(),
      slug: z.string(),
    })
    .nullable(),
  previewImage: image.nullable(),
  activeListing: publicOffer.nullable(),
});
export const ownBreederAnimalSchema = breederAnimalSchema.extend({
  activeMatingListing: z
    .object({
      id: z.uuid(),
      status: z.literal("ACTIVE"),
      moderationStatus: moderationSchema,
    })
    .nullable()
    .default(null),
  showOnBreederProfile: z.boolean(),
  currentListing: offer
    .extend({
      status: z.enum(["ACTIVE", "DRAFT", "PENDING", "REJECTED", "HIDDEN"]),
      moderationStatus: moderationSchema,
    })
    .transform((value) => ({ ...value, href: "/listings/" + value.id }))
    .nullable(),
});
export type BreederAnimal = z.infer<typeof breederAnimalSchema>;
export type OwnBreederAnimal = z.infer<typeof ownBreederAnimalSchema>;
const meta = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive().max(24),
  total: z.number().int().nonnegative(),
  pages: z.number().int().nonnegative(),
});
export const publicAnimalsPageSchema = z.object({
  data: z.array(breederAnimalSchema),
  meta,
});
export const ownAnimalsPageSchema = z.object({
  data: z.array(ownBreederAnimalSchema),
  meta,
});
export const ownAnimalsKey = (userId: string) =>
  ["breeder-animals", userId] as const;
export const publicAnimalsKey = (userId: string) =>
  ["public-breeder-animals", userId] as const;
export async function getBreederAnimals(
  userId: string,
  page: number,
  signal?: AbortSignal,
) {
  return publicAnimalsPageSchema.parse(
    await publicRequest<unknown>(
      "/breeders/" +
        encodeURIComponent(userId) +
        "/animals?page=" +
        page +
        "&limit=24",
      true,
      { signal },
    ),
  );
}
export async function getOwnBreederAnimals(page: number, signal?: AbortSignal) {
  return ownAnimalsPageSchema.parse(
    await authenticatedRequest<unknown>(
      "/breeders/me/animals?page=" + page + "&limit=24",
      { signal },
      true,
    ),
  );
}
export async function setBreederVisibility(
  id: string,
  showOnBreederProfile: boolean,
) {
  return z
    .object({ id: z.uuid(), showOnBreederProfile: z.boolean() })
    .parse(
      await authenticatedRequest<unknown>(
        "/pets/" + encodeURIComponent(id) + "/breeder-visibility",
        { method: "PATCH", body: JSON.stringify({ showOnBreederProfile }) },
      ),
    );
}
