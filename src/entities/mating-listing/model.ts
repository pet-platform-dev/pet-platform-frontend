import { z } from "zod";
import { locationSchema } from "@/entities/location/model";
const classification = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
});
export const matingPetSchema = z.object({
  id: z.uuid(),
  name: z.string().nullable(),
  gender: z.enum(["MALE", "FEMALE", "UNKNOWN"]),
  birthDate: z.string().nullable(),
  species: classification,
  breed: classification.extend({ nameUk: z.string().nullable() }).nullable(),
  profileImage: z
    .object({ url: z.string(), thumbnailUrl: z.string() })
    .nullable(),
});
export const ownMatingSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string(),
  fee: z.string().nullable(),
  currency: z.literal("UAH"),
  status: z.enum([
    "DRAFT",
    "ACTIVE",
    "CLOSED",
    "ARCHIVED",
    "PENDING",
    "REJECTED",
    "HIDDEN",
  ]),
  location: locationSchema.extend({
    katottgCode: z.string().nullable().default(null),
  }),
  pet: matingPetSchema,
  owner: z.object({
    id: z.uuid(),
    displayName: z.string(),
    href: z.string(),
    breeder: z.object({ kennelName: z.string() }).nullable(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
  publishedAt: z.string().nullable(),
  closedAt: z.string().nullable(),
});
export type OwnMating = z.infer<typeof ownMatingSchema>;
export type MatingPet = z.infer<typeof matingPetSchema>;
export type MatingStatus = OwnMating["status"];
export type MatingAction = "publish" | "close" | "archive" | "delete";
export const statusLabels: Record<MatingStatus, string> = {
  DRAFT: "Чернетка",
  ACTIVE: "Активне",
  CLOSED: "Завершено",
  ARCHIVED: "Архів",
  PENDING: "На модерації",
  REJECTED: "Відхилено",
  HIDDEN: "Приховано",
};
export const canEdit = (status: MatingStatus) =>
  status === "DRAFT" || status === "ACTIVE";
export function matingActions(
  row: Pick<OwnMating, "status" | "publishedAt">,
): MatingAction[] {
  if (row.status === "DRAFT")
    return [
      "publish",
      "archive",
      ...(row.publishedAt === null ? ["delete" as const] : []),
    ];
  if (row.status === "ACTIVE") return ["close", "archive"];
  return row.status === "CLOSED" ? ["archive"] : [];
}
export function feeLabel(fee: string | null): string {
  if (fee === null) return "За домовленістю";
  if (/^0(?:\.0{1,2})?$/.test(fee)) return "Безкоштовно";
  const [whole, fraction = ""] = fee.split(".");
  return (
    new Intl.NumberFormat("uk-UA").format(BigInt(whole)) +
    (fraction.replace(/0+$/, "") ? "," + fraction.replace(/0+$/, "") : "") +
    " ₴"
  );
}

const publicProfileImageUrl = z
  .url()
  .regex(/^https:\/\/res\.cloudinary\.com\/[a-zA-Z0-9_-]+\/image\/upload\//);
export const publicMatingSchema = z.object({
  id: z.uuid(),
  status: z.literal("ACTIVE"),
  fee: z
    .string()
    .regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/)
    .nullable(),
  currency: z.literal("UAH"),
  createdAt: z.string(),
  location: ownMatingSchema.shape.location,
  pet: matingPetSchema.extend({
    profileImage: z
      .object({
        url: publicProfileImageUrl,
        thumbnailUrl: publicProfileImageUrl,
      })
      .nullable(),
  }),
  owner: z.object({ id: z.uuid(), displayName: z.string() }),
});
export type PublicMating = z.infer<typeof publicMatingSchema>;
export const publicMatingDetailSchema = publicMatingSchema.extend({
  title: z.string(),
  description: z.string(),
});
export type PublicMatingDetail = z.infer<typeof publicMatingDetailSchema>;
export const publicMatingResponseSchema = z
  .object({
    data: z.array(publicMatingSchema),
    meta: z.object({
      page: z.number().int().positive().max(100000),
      limit: z.number().int().positive().max(100),
      total: z.number().int().nonnegative(),
      pages: z.number().int().nonnegative(),
    }),
  })
  .refine(({ meta }) => meta.pages === Math.ceil(meta.total / meta.limit));
export type PublicMatingResponse = z.infer<typeof publicMatingResponseSchema>;
