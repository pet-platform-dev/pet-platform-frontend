import {
  moderationSchema,
  type ModerationStatus,
} from "@/shared/lib/moderation";
import { z } from "zod";
import { listingSchema } from "@/entities/listing/model/listing";
export const statusLabels = {
  DRAFT: "Чернетка",
  ACTIVE: "Активне",
  SOLD: "Продано",
  TRANSFERRED: "Передано",
  ADOPTED: "Прилаштовано",
  ARCHIVED: "Архів",
  PENDING: "На модерації",
  REJECTED: "Відхилено",
  HIDDEN: "Приховано",
} as const;
export type Status = keyof typeof statusLabels;
export const ownListingSchema = z
  .object({
    ...listingSchema.shape,
    moderationStatus: moderationSchema,
    status: z.enum(Object.keys(statusLabels) as [Status, ...Status[]]),
  })
  .refine((listing) =>
    listing.type === "SALE"
      ? (["DRAFT", "ARCHIVED"].includes(listing.status) &&
          listing.price === null) ||
        (listing.price !== null && Number(listing.price) > 0)
      : listing.price === null,
  );
export type OwnListing = z.infer<typeof ownListingSchema>;
export const statusGroups = {
  all: { label: "Усі", statuses: [] },
  draft: { label: "Чернетки", statuses: ["DRAFT"] },
  active: { label: "Активні", statuses: ["ACTIVE"] },
  pending: { label: "На модерації", statuses: [] },
  rejected: { label: "Відхилені", statuses: [] },
  hidden: { label: "Приховані", statuses: [] },
  completed: {
    label: "Завершені",
    statuses: ["SOLD", "TRANSFERRED", "ADOPTED"],
  },
  archived: { label: "Архівні", statuses: ["ARCHIVED"] },
} as const;
export type StatusGroup = keyof typeof statusGroups;
export function editable(status: Status, moderationStatus?: ModerationStatus) {
  return (
    (status === "DRAFT" || status === "ACTIVE") && moderationStatus !== "HIDDEN"
  );
}
export function completion(type: OwnListing["type"]) {
  return {
    SALE: {
      status: "SOLD",
      label: "Позначити як продано",
      question: "Позначити тварину як продану?",
    },
    FREE: {
      status: "TRANSFERRED",
      label: "Позначити як передано",
      question: "Позначити тварину як передану?",
    },
    ADOPTION: {
      status: "ADOPTED",
      label: "Позначити як прилаштовано",
      question: "Позначити тварину як прилаштовану?",
    },
  }[type] as { status: Status; label: string; question: string };
}
export const noImagesMessage =
  "Додайте щонайменше одну фотографію перед публікацією.";
