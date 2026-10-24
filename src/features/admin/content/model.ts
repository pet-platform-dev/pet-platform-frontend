import { z } from "zod";
export const sources = {
  LISTING: "Оголошення",
  MATING: "В’язка",
  OPERATOR_DRAFT: "Підготовлені чернетки",
};
export type ContentSource = keyof typeof sources;
export const kindLabels = {
  SALE: "Продаж",
  FREE: "Безкоштовно",
  ADOPTION: "Прилаштування",
  MATING: "В’язка",
};
export const statusLabels: Record<string, string> = {
  DRAFT: "Чернетка",
  PENDING: "На розгляді",
  ACTIVE: "Активне",
  SOLD: "Продано",
  TRANSFERRED: "Передано",
  ADOPTED: "Прилаштовано",
  ARCHIVED: "В архіві",
  REJECTED: "Відхилено",
  HIDDEN: "Приховано",
  CLOSED: "Завершено",
  READY_FOR_REVIEW: "Готова до перевірки",
  NOT_SUBMITTED: "Не надіслано",
  APPROVED: "Схвалено",
};
const ref = z.object({ id: z.uuid(), name: z.string() });
export const ownerSchema = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string().nullable(),
  accountType: z.enum(["SELLER", "BREEDER"]),
});
const location = z.object({
  id: z.uuid(),
  city: z.string(),
  region: z.string(),
  district: z.string().nullable(),
  community: z.string().nullable(),
  settlementType: z.enum(["CITY", "VILLAGE", "SETTLEMENT"]).nullable(),
});
export const petSchema = z.object({
  id: z.uuid(),
  name: z.string().nullable(),
  gender: z.enum(["MALE", "FEMALE", "UNKNOWN"]),
  birthDate: z.string().nullable(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
  createdAt: z.string(),
  updatedAt: z.string(),
  species: ref,
  breed: ref.extend({ nameUk: z.string().nullable() }).nullable(),
  owner: ownerSchema,
});
const image = z.object({
  id: z.uuid(),
  url: z
    .string()
    .url()
    .regex(/^https:\/\/res\.cloudinary\.com\/[a-zA-Z0-9_-]+\/image\/upload\//),
});
const audit = z.object({
  id: z.uuid(),
  actorId: z.uuid(),
  action: z.string(),
  reason: z.string().nullable(),
  changedFields: z.array(z.string()),
  revision: z.string(),
  createdAt: z.string(),
});
const base = {
  id: z.uuid(),
  title: z.string(),
  description: z.string(),
  type: z.enum(["SALE", "FREE", "ADOPTION", "MATING"]),
  status: z.string(),
  price: z.string().nullable(),
  currency: z.literal("UAH"),
  location: location.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  images: z.array(image),
  publicPath: z
    .string()
    .nullable()
    .refine(
      (p) => p === null || /^\/(listings|mating)\/[0-9a-f-]{36}$/.test(p),
    ),
  audit: z.array(audit).optional(),
};
export const contentSchema = z.discriminatedUnion("source", [
  z.object({
    ...base,
    source: z.literal("LISTING"),
    moderationStatus: z.string(),
    moderationReason: z.string().nullable(),
    owner: ownerSchema,
    pet: petSchema,
  }),
  z.object({
    ...base,
    source: z.literal("MATING"),
    moderationStatus: z.string(),
    moderationReason: z.string().nullable(),
    owner: ownerSchema,
    pet: petSchema,
    requirements: z.string().nullable(),
  }),
  z.object({
    ...base,
    source: z.literal("OPERATOR_DRAFT"),
    kind: z.enum(["SALE", "FREE", "ADOPTION", "MATING"]),
    speciesId: z.uuid().nullable(),
    breedId: z.uuid().nullable(),
    locationId: z.uuid().nullable(),
    breederDraftId: z.uuid().nullable(),
    species: ref.nullable(),
    breed: ref.extend({ nameUk: z.string().nullable() }).nullable(),
    requirements: z.string().nullable(),
    ownerReference: z.string().nullable(),
    createdById: z.uuid(),
    updatedById: z.uuid(),
  }),
]);
export type Content = z.infer<typeof contentSchema>;
export type Draft = Extract<Content, { source: "OPERATOR_DRAFT" }>;
export type ManagedPet = z.infer<typeof petSchema>;
const linked = z.object({
  id: z.uuid(),
  title: z.string(),
  status: z.string(),
  moderationStatus: z.string(),
});
export const petDetailSchema = petSchema.extend({
  listings: z.array(linked),
  matingListings: z.array(linked),
  _count: z.object({ listings: z.number(), matingListings: z.number() }),
});
export const metaSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  pages: z.number(),
});
export const ownerName = (o: z.infer<typeof ownerSchema>) =>
  [o.firstName, o.lastName].filter(Boolean).join(" ");
