import { z } from "zod";
const imageUrl = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password;
});
export const petCareSchema = z.object({
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
    .object({ id: z.uuid(), name: z.string(), nameUk: z.string().nullable() })
    .nullable(),
  profileImage: z
    .object({ url: imageUrl, thumbnailUrl: imageUrl })
    .nullable()
    .catch(null),
});
export type PetCare = z.infer<typeof petCareSchema>;
export const petCareKeys = {
  dashboard: (userId: string, petId: string) =>
    ["pet-care", userId, petId] as const,
};
export const petCareHref = (id: string) =>
  "/pets/" + encodeURIComponent(id) + "/care";
