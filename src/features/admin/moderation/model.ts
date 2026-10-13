import { z } from "zod";
export const contentTypes = ["LISTING", "MATING_LISTING", "REVIEW"] as const;
export const queueStatuses = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "HIDDEN",
] as const;
export type ContentType = (typeof contentTypes)[number];
export type QueueStatus = (typeof queueStatuses)[number];
export type ModerationAction = "approve" | "reject" | "hide";
const identity = z.object({ id: z.uuid(), displayName: z.string() });
const imageUrl = z
  .url()
  .regex(/^https:\/\/res\.cloudinary\.com\/[a-zA-Z0-9_-]+\/image\/upload\//);
const reference = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
});
const pet = z.object({
  id: z.uuid(),
  name: z.string().nullable(),
  gender: z.enum(["MALE", "FEMALE", "UNKNOWN"]),
  birthDate: z.string().nullable(),
  species: reference,
  breed: reference.extend({ nameUk: z.string().nullable() }).nullable(),
  profileImage: z.object({ url: imageUrl, thumbnailUrl: imageUrl }).nullable(),
});
const location = z.object({
  id: z.uuid(),
  city: z.string(),
  region: z.string(),
  district: z.string().nullable(),
  community: z.string().nullable(),
  settlementType: z.string().nullable(),
});
const revision = z.iso.datetime({ precision: 3 });
const queueBase = {
  id: z.uuid(),
  submittedAt: revision,
  updatedAt: revision,
  moderationStatus: z.enum(queueStatuses),
};
export const queueItemSchema = z.discriminatedUnion("type", [
  z.object({
    ...queueBase,
    type: z.literal("LISTING"),
    owner: identity,
    preview: z.object({
      title: z.string(),
      pet,
      location,
      price: z.string().nullable(),
      listingType: z.enum(["SALE", "FREE", "ADOPTION"]),
      image: imageUrl.nullable(),
    }),
  }),
  z.object({
    ...queueBase,
    type: z.literal("MATING_LISTING"),
    owner: identity,
    preview: z.object({
      title: z.string(),
      pet,
      location,
      fee: z.string().nullable(),
      image: imageUrl.nullable(),
    }),
  }),
  z.object({
    ...queueBase,
    type: z.literal("REVIEW"),
    author: identity,
    preview: z.object({
      rating: z.number().int().min(1).max(5),
      commentExcerpt: z.string(),
      targetUser: identity,
    }),
  }),
]);
export const queueEnvelopeSchema = z.object({
  data: z.array(queueItemSchema),
  meta: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().min(1).max(100),
    total: z.number().int().nonnegative(),
    pages: z.number().int().nonnegative(),
  }),
});
const detailBase = {
  id: z.uuid(),
  updatedAt: revision,
  submittedAt: revision,
  moderationReason: z.string().nullable(),
  moderatedAt: revision.nullable(),
};
const publication = {
  ...detailBase,
  title: z.string(),
  description: z.string(),
  currency: z.literal("UAH"),
  moderationStatus: z.enum(["NOT_SUBMITTED", ...queueStatuses]),
  pet,
  location,
  owner: identity,
};
export const detailSchema = z.discriminatedUnion("type", [
  z.object({
    ...publication,
    type: z.literal("LISTING"),
    status: z.enum([
      "DRAFT",
      "ACTIVE",
      "SOLD",
      "TRANSFERRED",
      "ADOPTED",
      "ARCHIVED",
    ]),
    listingType: z.enum(["SALE", "FREE", "ADOPTION"]),
    price: z.string().nullable(),
    images: z.array(
      z.object({
        id: z.uuid(),
        url: imageUrl,
        position: z.number().int().nonnegative(),
      }),
    ),
  }),
  z.object({
    ...publication,
    type: z.literal("MATING_LISTING"),
    status: z.enum(["DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"]),
    fee: z.string().nullable(),
    requirements: z.string().nullable(),
  }),
  z.object({
    ...detailBase,
    type: z.literal("REVIEW"),
    status: z.enum(queueStatuses),
    moderationStatus: z.enum(queueStatuses),
    rating: z.number().int().min(1).max(5),
    comment: z.string(),
    interactionContext: z.string().nullable(),
    createdAt: revision,
    author: identity,
    targetUser: identity,
  }),
]);
const resultBase = {
  id: z.uuid(),
  updatedAt: revision,
  moderationReason: z.string().nullable(),
  moderatedAt: revision.nullable(),
};
export const advertisementResultSchema = z.object({
  ...resultBase,
  status: z.enum(["DRAFT", "ACTIVE"]),
  moderationStatus: z.enum(queueStatuses),
  petId: z.uuid(),
  ownerId: z.uuid(),
});
export const reviewResultSchema = z.object({
  ...resultBase,
  status: z.enum(queueStatuses),
  targetUserId: z.uuid(),
});
export const reasonSchema = z
  .string()
  .trim()
  .min(10, "Вкажіть причину від 10 до 1000 символів.")
  .max(1000, "Не більше 1000 символів.");
export const decisionSchema = z
  .object({ expectedUpdatedAt: revision })
  .strict();
export const reasonDecisionSchema = decisionSchema
  .extend({ reason: reasonSchema })
  .strict();
export type ModerationQueueItem = z.infer<typeof queueItemSchema>;
export type ModerationQueue = z.infer<typeof queueEnvelopeSchema>;
export type ModerationDetail = z.infer<typeof detailSchema>;
export type ModerationResult =
  | ({ type: "LISTING" } & z.infer<typeof advertisementResultSchema>)
  | ({ type: "MATING_LISTING" } & z.infer<typeof advertisementResultSchema>)
  | ({ type: "REVIEW" } & z.infer<typeof reviewResultSchema>);
export const typeLabels: Record<ContentType, string> = {
  LISTING: "Оголошення",
  MATING_LISTING: "В’язка",
  REVIEW: "Відгук",
};
export const statusLabels = {
  NOT_SUBMITTED: "Чернетка",
  PENDING: "На модерації",
  APPROVED: "Схвалено",
  REJECTED: "Відхилено",
  HIDDEN: "Приховано",
};
export function availableActions(row: ModerationDetail): ModerationAction[] {
  if (row.type !== "REVIEW" && !["DRAFT", "ACTIVE"].includes(row.status))
    return [];
  return row.moderationStatus === "PENDING"
    ? ["approve", "reject"]
    : row.moderationStatus === "APPROVED"
      ? ["hide"]
      : [];
}
