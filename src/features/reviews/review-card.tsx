import type { Review } from "@/entities/review/model";
import { reviewDate } from "@/entities/review/model";
import { StarRating } from "./star-rating";
export function ReviewCard({ review }: { review: Review }) {
  return (
    <article className="review-card">
      <h3>{review.author.displayName}</h3>
      <div className="review-card-meta">
        <StarRating value={review.rating} />
        <time dateTime={review.createdAt}>{reviewDate(review.createdAt)}</time>
      </div>
      <p className="review-comment">{review.comment}</p>
    </article>
  );
}
