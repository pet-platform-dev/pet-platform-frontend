import type { QueryClient } from "@tanstack/react-query";
import type { User } from "@/entities/user/model";
import type { OwnReview, ReviewEligibility } from "@/entities/review/model";
export const reviewListKey = (id: string, page: number) =>
  ["seller-reviews", id, page] as const;
export const reviewSummaryKey = (id: string) =>
  ["seller-review-summary", id] as const;
export const ownReviewKey = (authorId: string, targetId: string) =>
  ["seller-review-me", authorId, targetId] as const;
export function acceptOwnReview(
  client: QueryClient,
  authorId: string,
  targetId: string,
  review: OwnReview,
) {
  if (client.getQueryData<User | null>(["current-user"])?.id !== authorId)
    return false;
  client.setQueryData<ReviewEligibility>(ownReviewKey(authorId, targetId), {
    review,
    canReview: false,
    hasReviewed: true,
    isSelf: false,
    reason: "ALREADY_REVIEWED",
  });
  return true;
}
