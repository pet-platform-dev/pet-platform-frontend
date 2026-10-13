import Link from "next/link";
import { SafeImage } from "@/shared/ui/safe-image";
import { listingPrice } from "@/entities/listing/model/presentation";
import { StarRating } from "@/features/reviews/star-rating";
import { feeLabel } from "@/entities/mating-listing/model";
import { typeLabels, type ModerationQueueItem } from "./model";
import { detailHref } from "./navigation";
import { ModerationBadge, moderationDate } from "./presentation";
export function ModerationQueueCard({
  row,
  returnTo,
}: {
  row: ModerationQueueItem;
  returnTo: string;
}) {
  const ad = row.type !== "REVIEW" ? row : null;
  const title =
    ad?.preview.title ??
    "Відгук про " +
      (row.type === "REVIEW" ? row.preview.targetUser.displayName : "");
  return (
    <article className="admin-queue-card">
      <Link
        prefetch={false}
        className="admin-card-link"
        href={detailHref(row.type, row.id, returnTo)}
        aria-label={"Переглянути: " + title}
      >
        <header>
          <span className="eyebrow">{typeLabels[row.type]}</span>
          <ModerationBadge status={row.moderationStatus} />
        </header>
        {ad && (
          <div className="admin-card-image">
            <SafeImage
              src={ad.preview.image ?? undefined}
              alt=""
              loading="lazy"
              fallback={
                <span className="admin-image-fallback">Фото ще не додано</span>
              }
            />
          </div>
        )}
        <h2>{title}</h2>
        {row.type === "REVIEW" ? (
          <>
            <StarRating value={row.preview.rating} />
            <p className="admin-excerpt">{row.preview.commentExcerpt}</p>
            <p className="muted">Автор: {row.author.displayName}</p>
            <p className="muted">Про: {row.preview.targetUser.displayName}</p>
          </>
        ) : (
          <>
            <p>
              {row.preview.pet.breed?.nameUk ??
                row.preview.pet.breed?.name ??
                row.preview.pet.species.name}
              {row.preview.pet.name ? " · " + row.preview.pet.name : ""}
            </p>
            {row.type === "MATING_LISTING" && (
              <p className="muted">
                {row.preview.pet.gender === "MALE"
                  ? "Самець"
                  : row.preview.pet.gender === "FEMALE"
                    ? "Самка"
                    : "Стать не вказано"}
              </p>
            )}
            <p className="muted">
              {row.preview.location.city}, {row.preview.location.region}
            </p>
            <p>
              {row.type === "MATING_LISTING"
                ? feeLabel(row.preview.fee)
                : listingPrice({
                    type: row.preview.listingType,
                    price: row.preview.price,
                  })}
            </p>
            <p className="muted">Власник: {row.owner.displayName}</p>
          </>
        )}
        <time dateTime={row.updatedAt} className="muted">
          Оновлено: {moderationDate(row.updatedAt)}
        </time>
        <span className="button secondary admin-card-cta">Переглянути</span>
      </Link>
    </article>
  );
}
