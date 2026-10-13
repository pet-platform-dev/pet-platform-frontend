import { ImageGallery } from "@/shared/ui/image-gallery";
import { feeLabel } from "@/entities/mating-listing/model";
import type { ModerationDetail } from "./model";
import { PetModerationInfo, LocationModerationInfo } from "./pet-info";
export function MatingModerationDetail({
  row,
}: {
  row: Extract<ModerationDetail, { type: "MATING_LISTING" }>;
}) {
  return (
    <div className="admin-detail-content">
      <section className="admin-panel">
        <h2>Фотографія тварини</h2>
        <ImageGallery
          emptyFallback={<p className="muted">Фото ще не додано.</p>}
          failedFallback={<p className="muted">Фото тимчасово недоступне.</p>}
          images={
            row.pet.profileImage
              ? [{ id: row.pet.id, ...row.pet.profileImage }]
              : []
          }
          heading={row.pet.name ?? row.pet.species.name}
        />
      </section>
      <PetModerationInfo pet={row.pet} />
      <section className="admin-panel">
        <h2>Умови в’язки</h2>
        <p>{feeLabel(row.fee)}</p>
        <p className="admin-full-text">{row.description}</p>
        {row.requirements && (
          <>
            <h3>Додаткові умови</h3>
            <p className="admin-full-text">{row.requirements}</p>
          </>
        )}
        <LocationModerationInfo location={row.location} />
      </section>
    </div>
  );
}
