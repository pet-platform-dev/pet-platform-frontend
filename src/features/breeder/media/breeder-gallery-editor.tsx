import type { ReactNode } from "react";
import { MediaUploadTrigger } from "./media-upload-trigger";
import {
  BREEDER_MEDIA_LIMITS,
  type BreederMedia,
} from "@/entities/breeder/media";
import { reorderImages } from "@/features/listing/create-listing/model/images";
import { BreederGalleryItem } from "./breeder-gallery-item";
export function BreederGalleryEditor({
  images,
  disabled,
  onAdd,
  onRemove,
  onReorder,
  children,
}: {
  children?: ReactNode;
  images: BreederMedia["gallery"];
  disabled: boolean;
  onAdd: (files: FileList | null) => void;
  onRemove: (id: string) => void;
  onReorder: (ids: string[]) => void;
}) {
  function move(from: number, to: number) {
    if (
      !Number.isInteger(from) ||
      !Number.isInteger(to) ||
      from === to ||
      from < 0 ||
      to < 0 ||
      from >= images.length ||
      to >= images.length
    )
      return;
    onReorder(reorderImages(images, from, to).map((image) => image.id));
  }
  return (
    <section
      className="breeder-media-section"
      aria-labelledby="breeder-gallery-title"
    >
      <h2 id="breeder-gallery-title">Фотогалерея</h2>
      <p>
        {images.length} / {BREEDER_MEDIA_LIMITS.IMAGE} фото
      </p>
      <p className="muted">
        Перетягніть фото на комп’ютері або скористайтеся кнопками «Раніше» /
        «Пізніше». JPEG/PNG/WebP до 8 MiB.
      </p>
      <div
        className={
          images.length ? "breeder-media-item-actions" : "breeder-upload-empty"
        }
      >
        {!images.length && (
          <p className="muted">Додайте фотографії розплідника</p>
        )}
        <MediaUploadTrigger
          id="breeder-gallery-upload"
          label="Додати фотографії"
          multiple
          disabled={disabled || images.length >= BREEDER_MEDIA_LIMITS.IMAGE}
          describedBy="breeder-gallery-feedback"
          onAdd={onAdd}
        />
      </div>
      <div id="breeder-gallery-feedback" className="breeder-section-feedback">
        {children}
      </div>
      {images.length >= BREEDER_MEDIA_LIMITS.IMAGE && (
        <p role="status">Досягнуто ліміт фотографій розплідника</p>
      )}
      <ol className="breeder-gallery-editor-list">
        {images.map((image, index) => (
          <BreederGalleryItem
            key={image.id}
            image={image}
            index={index}
            count={images.length}
            disabled={disabled}
            onMove={move}
            onDrop={move}
            onRemove={onRemove}
          />
        ))}
      </ol>
    </section>
  );
}
