import { ImageGallery } from "@/shared/ui/image-gallery";
import { listingPrice } from "@/entities/listing/model/presentation";
import type { ModerationDetail } from "./model";
import { PetModerationInfo, LocationModerationInfo } from "./pet-info";
export function ListingModerationDetail({
  row,
}: {
  row: Extract<ModerationDetail, { type: "LISTING" }>;
}) {
  return (
    <div className="admin-detail-content">
      <section className="admin-panel">
        <h2>Фотографії оголошення</h2>
        <ImageGallery
          emptyFallback={<p className="muted">Фото ще не додано.</p>}
          failedFallback={<p className="muted">Фото тимчасово недоступне.</p>}
          images={row.images.map((image) => ({
            id: image.id,
            url: image.url,
            thumbnailUrl: image.url,
          }))}
          heading={row.title}
        />
      </section>
      <PetModerationInfo pet={row.pet} />
      <section className="admin-panel">
        <h2>Про оголошення</h2>
        <dl className="admin-facts">
          <div>
            <dt>Тип оголошення</dt>
            <dd>
              {row.listingType === "SALE"
                ? "Продаж"
                : row.listingType === "FREE"
                  ? "Безкоштовно"
                  : "Адопція"}
            </dd>
          </div>
          <div>
            <dt>Ціна</dt>
            <dd>{listingPrice({ type: row.listingType, price: row.price })}</dd>
          </div>
        </dl>
        <h3>Опис</h3>
        <p className="admin-full-text">{row.description}</p>
        <LocationModerationInfo location={row.location} />
      </section>
    </div>
  );
}
