import { z } from "zod";
import {
  servicePageMeta,
  serviceImageSchema,
} from "@/entities/service-offer/model";
export const lifecycleSchema = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
  moderationStatus: z.enum([
    "NOT_SUBMITTED",
    "PENDING",
    "APPROVED",
    "REJECTED",
    "HIDDEN",
  ]),
  moderationReason: z.string().nullable(),
  updatedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  publishedAt: z.iso.datetime().nullable(),
  moderatedAt: z.iso.datetime().nullable(),
});
export const ownedLocationSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["BASE", "SERVICE_AREA"]),
  isPrimary: z.boolean(),
  publicAddress: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  location: z.object({
    id: z.uuid(),
    city: z.string(),
    region: z.string(),
    district: z.string().nullable(),
    community: z.string().nullable(),
    katottgCode: z.string().nullable(),
    settlementType: z.string().nullable(),
    isActive: z.boolean(),
  }),
});
export const ownedProviderSchema = lifecycleSchema.extend({
  id: z.uuid(),
  kind: z.enum(["INDIVIDUAL", "ORGANIZATION"]),
  publicName: z.string(),
  description: z.string().nullable(),
  phone: z.string().nullable(),
  telegram: z.string().nullable(),
  viber: z.string().nullable(),
  whatsapp: z.string().nullable(),
  website: z.string().nullable(),
  contactRevision: z.number().int(),
  primaryLocation: ownedLocationSchema.nullable(),
});
export const ownedOfferSchema = lifecycleSchema.extend({
  id: z.uuid(),
  providerId: z.uuid(),
  categoryId: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  mode: z.enum(["ONSITE", "MOBILE", "REMOTE"]),
  price: z.object({
    mode: z.enum(["FIXED", "FROM", "ON_REQUEST"]),
    amount: z.string().nullable(),
    unit: z
      .enum(["SERVICE", "VISIT", "SESSION", "HOUR", "DAY", "TRIP", "KM"])
      .nullable(),
    currency: z.literal("UAH"),
  }),
  details: z.record(z.string(), z.json()),
  detailsVersion: z.literal(1),
  category: z.object({
    id: z.uuid(),
    slug: z.string(),
    nameUk: z.string(),
    isActive: z.boolean(),
  }),
  species: z.array(
    z.object({ id: z.uuid(), slug: z.enum(["dog", "cat"]), name: z.string() }),
  ),
  locations: z.array(ownedLocationSchema),
});
export const auditSchema = z.object({
  id: z.uuid(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.uuid(),
  changedFieldNames: z.array(z.string()),
  inspectedRevision: z.string().nullable(),
  createdAt: z.iso.datetime(),
  reason: z.string().nullable(),
  fromState: z.string().nullable(),
  toState: z.string().nullable(),
});
export const mediaSchema = z.object({
  updatedAt: z.iso.datetime(),
  coverMediaId: z.uuid().nullable(),
  items: z.array(
    serviceImageSchema.extend({
      isCover: z.boolean(),
      createdAt: z.iso.datetime(),
    }),
  ),
});
export function pageSchema<T extends z.ZodType>(row: T) {
  return z.object({ data: z.array(row), meta: servicePageMeta });
}
export type OwnedProvider = z.infer<typeof ownedProviderSchema>;
export type OwnedOffer = z.infer<typeof ownedOfferSchema>;
export type OwnedLocation = z.infer<typeof ownedLocationSchema>;
export type Lifecycle = z.infer<typeof lifecycleSchema>;
export type ServiceMedia = z.infer<typeof mediaSchema>;
export function editable(row: Lifecycle) {
  return row.status !== "ARCHIVED" && row.moderationStatus !== "HIDDEN";
}
export function canSubmit(row: Lifecycle) {
  return (
    editable(row) &&
    ["NOT_SUBMITTED", "REJECTED"].includes(row.moderationStatus)
  );
}
