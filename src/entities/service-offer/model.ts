import { z } from "zod";
export const categorySlugs = [
  "veterinary-care",
  "pet-transportation",
  "grooming",
  "dog-training",
  "pet-boarding",
  "pet-sitting",
  "pet-walking",
] as const;
export const categorySchema = z.object({
  id: z.uuid(),
  slug: z.enum(categorySlugs),
  nameUk: z.string(),
  description: z.string(),
  allowedProviderKinds: z.array(z.enum(["INDIVIDUAL", "ORGANIZATION"])),
});
export const serviceImageSchema = z.object({
  id: z.uuid(),
  type: z.enum(["LOGO", "COVER", "IMAGE"]),
  position: z.number().int().nonnegative(),
  url: z
    .string()
    .regex(
      /^https:\/\/res\.cloudinary\.com\/[A-Za-z0-9_-]+\/image\/upload\/v[1-9][0-9]*\/pet-platform\/services\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.(jpg|jpeg|png|webp)$/,
    ),
});
const phone = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/)
  .nullable();
const website = z
  .url()
  .refine((s) => {
    const u = new URL(s);
    return (
      ["https:", "http:"].includes(u.protocol) &&
      !u.username &&
      !u.password &&
      !/[\\\s]/.test(s)
    );
  })
  .nullable();
export const contactsSchema = z.object({
  phone,
  telegram: z
    .string()
    .regex(/^[A-Za-z][A-Za-z0-9_]{4,31}$/)
    .nullable(),
  viber: phone,
  whatsapp: phone,
  website,
});
export const serviceLocationSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["BASE", "SERVICE_AREA"]),
  publicAddress: z.string(),
  isPrimary: z.boolean(),
  location: z.object({
    id: z.uuid(),
    city: z.string(),
    region: z.string(),
    district: z.string().nullable(),
    community: z.string().nullable(),
    settlementType: z.string().nullable(),
  }),
});
export const providerSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["INDIVIDUAL", "ORGANIZATION"]),
  publicName: z.string(),
  description: z.string().nullable(),
  logo: serviceImageSchema.nullable(),
  cover: serviceImageSchema.nullable(),
  locations: z.array(serviceLocationSchema),
  gallery: z.array(serviceImageSchema).optional(),
  contacts: contactsSchema.optional(),
});
export const offerSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  category: categorySchema,
  mode: z.enum(["ONSITE", "MOBILE", "REMOTE"]),
  price: z.object({
    mode: z.enum(["FIXED", "FROM", "ON_REQUEST"]),
    amount: z
      .string()
      .regex(/^\d+\.\d{2}$/)
      .nullable(),
    unit: z
      .enum(["SERVICE", "VISIT", "SESSION", "HOUR", "DAY", "TRIP", "KM"])
      .nullable(),
    currency: z.literal("UAH"),
  }),
  species: z.array(
    z.object({ id: z.uuid(), slug: z.enum(["dog", "cat"]), label: z.string() }),
  ),
  locations: z.array(serviceLocationSchema),
  images: z.array(serviceImageSchema),
  provider: providerSchema,
  details: z.record(z.string(), z.unknown()).optional(),
  detailsVersion: z.number().optional(),
});
export const servicePageMeta = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  pages: z.number().int().nonnegative(),
});
export const offersPageSchema = z.object({
  data: z.array(offerSchema),
  meta: servicePageMeta,
});
export const providersPageSchema = z.object({
  data: z.array(providerSchema),
  meta: servicePageMeta,
});
export type ServiceCategory = z.infer<typeof categorySchema>;
export type ServiceOffer = z.infer<typeof offerSchema>;
export type ServiceProvider = z.infer<typeof providerSchema>;
export type ServiceLocation = z.infer<typeof serviceLocationSchema>;
export type ServiceContacts = z.infer<typeof contactsSchema>;
export type OffersPage = z.infer<typeof offersPageSchema>;
export type ProvidersPage = z.infer<typeof providersPageSchema>;
