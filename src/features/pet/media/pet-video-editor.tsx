import { useState } from "react";
import { PET_MEDIA_LIMITS, type PetMedia } from "@/entities/pet/media";
import { videoUrlSchema } from "@/shared/lib/video-url";
import { addPetVideo, removePetMedia, reorderPetMedia } from "./api";
export function PetVideoEditor({
  petId,
  media,
  disabled,
  command,
}: {
  petId: string;
  media: PetMedia;
  disabled: boolean;
  command: (action: () => Promise<PetMedia>) => Promise<boolean>;
}) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState("");
  return (
    <section className="breeder-media-section">
      <h2>Відео</h2>
      <p className="muted">
        До {PET_MEDIA_LIMITS.VIDEO} публічних відео YouTube або Vimeo.
        Відеофайли не завантажуються.
      </p>
      <label htmlFor="pet-video-url">Посилання на відео тварини</label>
      <input
        id="pet-video-url"
        value={url}
        onChange={(event) => {
          setUrl(event.target.value);
          setError("");
        }}
        disabled={disabled || media.videos.length >= PET_MEDIA_LIMITS.VIDEO}
        inputMode="url"
        aria-invalid={!!error}
        aria-describedby="pet-video-error"
      />
      <p id="pet-video-error" role={error ? "alert" : undefined}>
        {error}
      </p>
      <button
        type="button"
        className="button secondary"
        disabled={disabled || media.videos.length >= PET_MEDIA_LIMITS.VIDEO}
        onClick={async () => {
          const parsed = videoUrlSchema.safeParse({ url });
          if (!parsed.success) {
            setError(parsed.error.issues[0].message);
            return;
          }
          if (await command(() => addPetVideo(petId, parsed.data.url)))
            setUrl("");
        }}
      >
        Додати відео
      </button>
      <ol className="breeder-video-editor-list">
        {media.videos.map((video, index) => (
          <li key={video.id}>
            <a href={video.url} target="_blank" rel="noopener noreferrer">
              Відео {index + 1}
            </a>
            <div className="breeder-media-item-actions">
              <button
                type="button"
                className="button secondary"
                disabled={disabled || index === 0}
                aria-label={"Перемістити відео " + (index + 1) + " раніше"}
                onClick={() => {
                  const ids = media.videos.map((item) => item.id);
                  [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
                  void command(() => reorderPetMedia(petId, "VIDEO", ids));
                }}
              >
                Раніше
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={disabled}
                aria-label={"Видалити відео " + (index + 1)}
                onClick={() =>
                  void command(() => removePetMedia(petId, video.id))
                }
              >
                Видалити
              </button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
