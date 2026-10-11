import type { ReviewSummary } from "@/entities/review/model";
import { reviewCountLabel } from "@/entities/review/model";
import { StarRating } from "./star-rating";
export function ReviewSummaryView({ summary }: { summary: ReviewSummary }) {
  if (!summary.reviewCount || summary.averageRating === null)
    return <p className="review-empty">Ще немає відгуків.</p>;
  return (
    <div className="review-summary">
      <strong>
        {new Intl.NumberFormat("uk-UA", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(summary.averageRating)}
      </strong>
      <StarRating value={summary.averageRating} />
      <span>{reviewCountLabel(summary.reviewCount)}</span>
    </div>
  );
}
