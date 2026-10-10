import type { Breeder } from "@/entities/breeder/model";
import { breederImageUrl } from "@/entities/breeder/media";
import { ImageGallery } from "@/shared/ui/image-gallery";
export function BreederMediaViewer({ profile }: { profile: Breeder }) {
  const images = profile.media?.gallery ?? [];
  if (!images.length) return null;
  return (
    <section
      className="listing-detail-panel breeder-public-gallery"
      aria-labelledby="breeder-public-gallery-title"
    >
      <h2 id="breeder-public-gallery-title">Фотогалерея</h2>
      <ImageGallery
        heading={profile.kennelName}
        images={images.map((image) => ({
          ...image,
          url: breederImageUrl(image.url, 1200),
        }))}
      />
    </section>
  );
}
