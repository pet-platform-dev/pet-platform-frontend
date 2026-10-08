import { z } from "zod";
const referenceSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});
export const listingSchema = z
  .object({
    id: z.string(),
    type: z.enum(["SALE", "FREE", "ADOPTION"]),
    status: z.literal("ACTIVE"),
    title: z.string(),
    description: z.string(),
    price: z
      .string()
      .regex(/^\d+\.\d{2}$/)
      .nullable(),
    currency: z.literal("UAH"),
    views: z.number().int().nonnegative(),
    publishedAt: z.string().nullable(),
    closedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    pet: z.object({
      id: z.string(),
      name: z.string().nullable(),
      gender: z.enum(["MALE", "FEMALE", "UNKNOWN"]),
      birthDate: z.string().nullable(),
      species: referenceSchema,
      breed: referenceSchema
        .extend({ nameUk: z.string().nullable() })
        .nullable(),
    }),
    location: z.object({
      id: z.string(),
      countryCode: z.string(),
      region: z.string(),
      city: z.string(),
      slug: z.string(),
    }),
    seller: z.object({
      id: z.string(),
      firstName: z.string(),
      lastName: z.string().nullable(),
      role: z.enum(["USER", "BREEDER", "MODERATOR", "ADMIN"]),
      verificationStatus: z.enum([
        "UNVERIFIED",
        "PENDING",
        "VERIFIED",
        "REJECTED",
      ]),
    }),
  })
  .refine((listing) =>
    listing.type === "SALE"
      ? listing.price !== null && Number(listing.price) > 0
      : listing.price === null,
  );
export const listingsResponseSchema = z
  .object({
    data: z.array(listingSchema),
    meta: z.object({
      page: z.number().int().positive().max(100000),
      limit: z.number().int().positive().max(100),
      total: z.number().int().nonnegative(),
      pages: z.number().int().nonnegative(),
    }),
  })
  .refine(({ meta }) => meta.pages === Math.ceil(meta.total / meta.limit));
export type Listing = z.infer<typeof listingSchema>;
