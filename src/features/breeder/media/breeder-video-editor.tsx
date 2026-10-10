import { type ReactNode, useState } from "react";
import {
  BREEDER_MEDIA_LIMITS,
  type BreederMedia,
} from "@/entities/breeder/media";
import { breederVideoSchema } from "@/entities/breeder/video-url";
export function BreederVideoEditor({
  videos,
  disabled,
  onAdd,
  onRemove,
  onReorder,
  children,
}: {
  children?: ReactNode;
  videos: BreederMedia["videos"];
  disabled: boolean;
  onAdd: (url: string) => Promise<boolean>;
  onRemove: (id: string) => void;
  onReorder: (ids: string[]) => void;
}) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState("");
  return (
    <section
      className="breeder-media-section"
      aria-labelledby="breeder-video-title"
    >
      <h2 id="breeder-video-title">Відео</h2>
      <p className="muted">
        До {BREEDER_MEDIA_LIMITS.VIDEO} публічних відео YouTube або Vimeo.
        Відеофайли не завантажуються.
      </p>
      <label htmlFor="breeder-video-url">Посилання на відео</label>
      <input
        id="breeder-video-url"
        value={url}
        inputMode="url"
        disabled={disabled || videos.length >= BREEDER_MEDIA_LIMITS.VIDEO}
        aria-invalid={Boolean(error)}
        aria-describedby="breeder-video-error breeder-video-feedback"
        onChange={(event) => {
          setUrl(event.target.value);
          setError("");
        }}
      />
      <p id="breeder-video-error" className="field-error">
        {error}
      </p>
      <button
        type="button"
        className="button secondary"
        disabled={disabled || videos.length >= BREEDER_MEDIA_LIMITS.VIDEO}
        onClick={async () => {
          const parsed = breederVideoSchema.safeParse({ url });
          if (!parsed.success) {
            setError(parsed.error.issues[0].message);
            return;
          }
          if (await onAdd(parsed.data.url)) setUrl("");
        }}
      >
        Додати відео
      </button>
      <div id="breeder-video-feedback" className="breeder-section-feedback">
        {children}
      </div>
      {!videos.length && (
        <p className="breeder-empty-note muted">Ще немає відео розплідника.</p>
      )}
      <ol className="breeder-video-editor-list">
        {videos.map((video, index) => (
          <li key={video.id}>
            <a href={video.url} target="_blank" rel="noopener noreferrer">
              Відео {index + 1} — {new URL(video.url).hostname}
            </a>
            <div className="breeder-media-item-actions">
              <button
                type="button"
                className="button secondary"
                disabled={disabled || index === 0}
                aria-label={"Перемістити відео " + (index + 1) + " раніше"}
                onClick={() => {
                  const ids = videos.map((item) => item.id);
                  [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
                  onReorder(ids);
                }}
              >
                Раніше
              </button>
              <button
                type="button"
                disabled={disabled}
                aria-label={"Видалити відео " + (index + 1)}
                onClick={() => onRemove(video.id)}
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
