import { StarRating } from "@/features/reviews/star-rating";
import { ModerationIdentity } from "./presentation";
import type { ModerationDetail } from "./model";
export function ReviewModerationDetail({
  row,
}: {
  row: Extract<ModerationDetail, { type: "REVIEW" }>;
}) {
  return (
    <div className="admin-detail-content">
      <section className="admin-panel">
        <h2>Відгук</h2>
        <StarRating value={row.rating} />
        <p className="admin-full-text">{row.comment}</p>
        {row.interactionContext && (
          <>
            <h3>Контекст взаємодії</h3>
            <p className="admin-full-text">{row.interactionContext}</p>
          </>
        )}
      </section>
      <ModerationIdentity person={row.author} label="Автор відгуку" />
      <ModerationIdentity person={row.targetUser} label="Про кого відгук" />
    </div>
  );
}
