import type { QueryClient } from "@tanstack/react-query";
import type { User } from "@/entities/user/model";
import type {
  OwnReview,
  Review,
  ReviewEligibility,
} from "@/entities/review/model";
import { getReviewSummary } from "./api";
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
export async function refreshReviewPublicCache(
  client: QueryClient,
  targetId: string,
  removedId?: string,
) {
  await client.cancelQueries({ queryKey: ["seller-reviews", targetId] });
  if (removedId)
    client.setQueriesData<{
      data: Review[];
      meta: { total: number; pages: number; limit: number; page: number };
    }>({ queryKey: ["seller-reviews", targetId] }, (old) =>
      old
        ? { ...old, data: old.data.filter((row) => row.id !== removedId) }
        : old,
    );
  // Hide the stale rating while fetching the authoritative DB aggregate.
  await client.cancelQueries({ queryKey: reviewSummaryKey(targetId) });
  void client.invalidateQueries({
    queryKey: reviewSummaryKey(targetId),
    refetchType: "none",
  });
  await Promise.all([
    client.invalidateQueries({ queryKey: ["seller-reviews", targetId] }),
    client
      .fetchQuery({
        queryKey: reviewSummaryKey(targetId),
        queryFn: ({ signal }) => getReviewSummary(targetId, signal),
        staleTime: 0,
      })
      .then((summary) => {
        for (const family of ["seller", "breeder"])
          client.setQueryData<{ reviewSummary?: typeof summary }>(
            [family, targetId],
            (old) => (old ? { ...old, reviewSummary: summary } : old),
          );
      })
      // Retain the query error for scoped retry; never restore stale initialData.
      .catch(() => undefined),
    ...["seller", "breeder"].map((family) =>
      client.invalidateQueries({ queryKey: [family, targetId], exact: true }),
    ),
  ]);
}
