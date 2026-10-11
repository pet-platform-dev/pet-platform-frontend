import { z } from "zod";
export const reviewSummarySchema = z.object({
  averageRating: z.number().min(1).max(5).nullable(),
  reviewCount: z.number().int().nonnegative(),
});
export type ReviewSummary = z.infer<typeof reviewSummarySchema>;
export const reviewSchema = z.object({
  id: z.uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string(),
  createdAt: z.iso.datetime(),
  author: z.object({ id: z.uuid(), displayName: z.string() }),
});
export type Review = z.infer<typeof reviewSchema>;
export const ownReviewSchema = reviewSchema.extend({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "HIDDEN"]),
  updatedAt: z.iso.datetime(),
});
export type OwnReview = z.infer<typeof ownReviewSchema>;
export const reviewEligibilitySchema = z.object({
  review: ownReviewSchema.nullable(),
  canReview: z.boolean(),
  hasReviewed: z.boolean(),
  isSelf: z.boolean(),
  reason: z.enum(["SELF_REVIEW", "ALREADY_REVIEWED"]).nullable(),
});
export type ReviewEligibility = z.infer<typeof reviewEligibilitySchema>;
export const reviewPageSchema = z.object({
  data: z.array(reviewSchema),
  meta: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    pages: z.number().int().nonnegative(),
  }),
});
export function reviewCountLabel(count: number) {
  const plural = new Intl.PluralRules("uk-UA").select(count);
  return `${count} ${plural === "one" ? "відгук" : plural === "few" ? "відгуки" : "відгуків"}`;
}
export function reviewDate(value: string) {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Kyiv",
  }).format(new Date(value));
}
