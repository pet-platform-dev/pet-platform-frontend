import { z } from "zod";
import { detailSchema, contentTypes } from "@/features/admin/moderation/model";
export const reportReasons = [
  "SPAM",
  "SCAM",
  "INAPPROPRIATE_CONTENT",
  "MISLEADING_INFORMATION",
  "DUPLICATE",
  "OTHER",
] as const;
export const reportStatuses = ["OPEN", "RESOLVED", "DISMISSED"] as const;
export const reasonLabels = {
  SPAM: "Спам",
  SCAM: "Шахрайство",
  INAPPROPRIATE_CONTENT: "Неприйнятний контент",
  MISLEADING_INFORMATION: "Недостовірна інформація",
  DUPLICATE: "Дублікат",
  OTHER: "Інше",
};
export const statusLabels = {
  OPEN: "Відкриті",
  RESOLVED: "Опрацьовані",
  DISMISSED: "Відхилені",
};
export const typeLabels = {
  LISTING: "Оголошення",
  MATING_LISTING: "В’язка",
  REVIEW: "Відгуки",
};
export const businessLabels = {
  DRAFT: "Чернетка",
  PENDING: "На модерації",
  ACTIVE: "Активне",
  SOLD: "Продано",
  TRANSFERRED: "Передано",
  ADOPTED: "Прилаштовано",
  ARCHIVED: "В архіві",
  CLOSED: "Закрито",
  REJECTED: "Відхилено",
  HIDDEN: "Приховано",
};
export type ReportReason = (typeof reportReasons)[number];
export type ReportStatus = (typeof reportStatuses)[number];
export type ReportType = (typeof contentTypes)[number];
export const reportInputSchema = z
  .object({
    targetType: z.enum(contentTypes),
    targetId: z.uuid(),
    reason: z.enum(reportReasons),
    details: z.string().trim().max(1000).optional(),
  })
  .strict()
  .refine((x) => x.reason !== "OTHER" || (x.details?.length ?? 0) >= 10, {
    path: ["details"],
    message: "Для іншої причини додайте опис від 10 символів",
  });
export const reportCreatedSchema = z.object({
  id: z.uuid(),
  status: z.literal("OPEN"),
  createdAt: z.iso.datetime(),
});
const common = {
  id: z.uuid(),
  targetType: z.enum(contentTypes),
  targetId: z.uuid(),
  targetPreview: z.string().max(200),
  reason: z.enum(reportReasons),
  status: z.enum(reportStatuses),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  resolvedAt: z.iso.datetime().nullable(),
  reporter: z.object({
    id: z.uuid().nullable(),
    displayName: z.string().max(250),
  }),
};
export const reportRecordSchema = z.object({
  ...common,
  details: z.string().nullable(),
  resolutionReason: z.string().nullable(),
});
export const reportDetailSchema = reportRecordSchema.extend({
  target: detailSchema.nullable(),
});
export const reportsQueueSchema = z.object({
  data: z.array(z.object({ ...common, detailsExcerpt: z.string().nullable() })),
  meta: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive().max(100),
    total: z.number().int().nonnegative(),
    pages: z.number().int().nonnegative(),
  }),
});
export const reportDecisionSchema = z
  .object({
    expectedUpdatedAt: z.iso.datetime({ precision: 3 }),
    reason: z.string().trim().min(10).max(1000),
  })
  .strict();
export type ReportDetail = z.infer<typeof reportDetailSchema>;
export type ReportItem = z.infer<typeof reportsQueueSchema>["data"][number];
export function canReport(userId: string | undefined, ownerId: string) {
  return !userId || userId !== ownerId;
}
