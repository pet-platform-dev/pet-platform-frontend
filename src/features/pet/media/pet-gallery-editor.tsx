import { PET_MEDIA_LIMITS, type PetMedia } from "@/entities/pet/media";
import { MediaUploadTrigger } from "@/shared/ui/media-upload-trigger";
import { GalleryEditorItem } from "@/shared/ui/gallery-editor-item";
import { SafeImage } from "@/shared/ui/safe-image";
import { usePetGalleryUpload } from "./use-pet-gallery-upload";
export function PetGalleryEditor({
  petId,
  media,
  disabled,
  canMutate,
  update,
  command,
}: {
  petId: string;
  media: PetMedia;
  disabled: boolean;
  canMutate: () => boolean;
  update: (value: PetMedia) => Promise<void>;
  command: (action: () => Promise<PetMedia>) => Promise<boolean>;
}) {
  const upload = usePetGalleryUpload(
    petId,
    media.gallery.length,
    () => !disabled && canMutate(),
    update,
  );
  const busy = disabled || upload.busy;
  async function move(from: number, to: number) {
    if (
      !Number.isInteger(from) ||
      !Number.isInteger(to) ||
      from < 0 ||
      from >= media.gallery.length ||
      to < 0 ||
      to >= media.gallery.length ||
      from === to
    )
      return;
    const ids = media.gallery.map((item) => item.id);
    [ids[from], ids[to]] = [ids[to], ids[from]];
    const { reorderPetMedia } = await import("./api");
    await command(() => reorderPetMedia(petId, "IMAGE", ids));
  }
  return (
    <section
      className="breeder-media-section"
      aria-labelledby="pet-gallery-title"
    >
      <h2 id="pet-gallery-title">Фотогалерея</h2>
      <p>
        Фотографії {media.gallery.length} / {PET_MEDIA_LIMITS.IMAGE}
      </p>
      <p className="muted">
        Додаткові фото не змінюють фото профілю. JPEG/PNG/WebP до 8 MiB.
        Перетягніть фото або використайте «Раніше» / «Пізніше».
      </p>
      <MediaUploadTrigger
        id="pet-gallery-upload"
        label="Додати фотографії тварини"
        multiple
        disabled={
          busy ||
          media.gallery.length + upload.items.length >= PET_MEDIA_LIMITS.IMAGE
        }
        onAdd={upload.add}
      />
      {upload.error && <p role="alert">{upload.error}</p>}
      <ol className="breeder-gallery-editor-list">
        {media.gallery.map((image, index) => (
          <GalleryEditorItem
            key={image.id}
            image={image}
            index={index}
            count={media.gallery.length}
            disabled={busy}
            altPrefix="Фото тварини"
            onMove={(from, to) => void move(from, to)}
            onDrop={(from, to) => void move(from, to)}
            onRemove={(id) =>
              void import("./api").then(({ removePetMedia }) =>
                command(() => removePetMedia(petId, id)),
              )
            }
          />
        ))}
      </ol>
      <ul className="breeder-gallery-editor-list">
        {upload.items.map((item) => (
          <li key={item.key}>
            <SafeImage
              src={item.preview}
              alt="Фото до завантаження"
              width={240}
              height={180}
            />
            <p role="status">
              {item.failed
                ? "Не вдалося завантажити фото."
                : "Завантажуємо фото…"}
            </p>
            {item.failed && (
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => upload.retry(item)}
              >
                Повторити завантаження
              </button>
            )}
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => upload.discard(item)}
            >
              Прибрати фото
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
