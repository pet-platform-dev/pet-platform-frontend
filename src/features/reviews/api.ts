import { authenticatedRequest, publicRequest } from "@/shared/api/client";
import {
  reviewPageSchema,
  reviewSummarySchema,
  reviewEligibilitySchema,
  ownReviewSchema,
} from "@/entities/review/model";
import type { ReviewInput } from "./validation";
const path = (id: string) => `/sellers/${encodeURIComponent(id)}`;
export async function getReviews(
  id: string,
  page: number,
  signal?: AbortSignal,
) {
  return reviewPageSchema.parse(
    await publicRequest<unknown>(
      `${path(id)}/reviews?page=${page}&limit=20`,
      true,
      { signal },
    ),
  );
}
export async function getReviewSummary(id: string, signal?: AbortSignal) {
  return reviewSummarySchema.parse(
    await publicRequest<unknown>(`${path(id)}/review-summary`, false, {
      signal,
    }),
  );
}
export async function getOwnReview(id: string, signal?: AbortSignal) {
  return reviewEligibilitySchema.parse(
    await authenticatedRequest<unknown>(`${path(id)}/reviews/me`, { signal }),
  );
}
export async function createReview(id: string, input: ReviewInput) {
  return ownReviewSchema.parse(
    await authenticatedRequest<unknown>(`${path(id)}/reviews`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}
