import { type ReactNode, useRef, useState } from "react";
import {
  BREEDER_MEDIA_LIMITS,
  type BreederMedia,
} from "@/entities/breeder/media";
import {
  breederVideoSchema,
  normalizedVideoUrl,
} from "@/entities/breeder/video-url";
import { BreederVideoPlayer } from "../public-profile/breeder-video-player";
export function BreederVideoEditor({
  videos,
  disabled,
  onAdd,
  onEdit,
  onRemove,
  onReorder,
  children,
}: {
  videos: BreederMedia["videos"];
  disabled: boolean;
  onAdd: (url: string) => Promise<boolean>;
  onEdit?: (id: string, url: string) => Promise<boolean>;
  onRemove: (id: string) => void;
  onReorder: (ids: string[]) => void;
  children?: ReactNode;
}) {
  const uid = "breeder-video",
    lock = useRef(false),
    [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [editing, setEditing] = useState<string | null>(null),
    [preview, setPreview] = useState(""),
    [shown, setShown] = useState<string | null>(null);
  const field = uid + "-url",
    blocked =
      disabled || (!editing && videos.length >= BREEDER_MEDIA_LIMITS.VIDEO);
  function parsed() {
    const value = breederVideoSchema.safeParse({ url });
    if (!value.success) {
      setError(value.error.issues[0].message);
      return null;
    }
    setError("");
    return value.data.url;
  }
  function clear() {
    setUrl("");
    setEditing(null);
    setError("");
    setPreview("");
  }
  return (
    <section className="breeder-media-section" aria-labelledby={uid + "-title"}>
      <h2 id={uid + "-title"}>Відео</h2>
      <p className="muted">
        До {BREEDER_MEDIA_LIMITS.VIDEO} публічних відео YouTube або Vimeo.
      </p>
      <label htmlFor={field}>Посилання на відео</label>
      <input
        id={field}
        value={url}
        inputMode="url"
        disabled={blocked}
        aria-invalid={Boolean(error)}
        aria-describedby={uid + "-error " + uid + "-feedback"}
        onChange={(e) => {
          setUrl(e.target.value);
          setError("");
          setPreview("");
        }}
      />
      <p
        id={uid + "-error"}
        className="field-error"
        role={error ? "alert" : undefined}
      >
        {error}
      </p>
      <div className="breeder-media-item-actions">
        <button
          type="button"
          className="button secondary"
          disabled={blocked}
          onClick={() => {
            const value = parsed();
            if (value) setPreview(value);
          }}
        >
          Переглянути відео
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={blocked}
          onClick={async () => {
            if (lock.current) return;
            const value = parsed();
            if (!value) return;
            lock.current = true;
            try {
              if (
                await (editing && onEdit
                  ? onEdit(editing, value)
                  : onAdd(value))
              )
                clear();
            } finally {
              lock.current = false;
            }
          }}
        >
          {editing ? "Зберегти посилання" : "Додати відео"}
        </button>
        {editing && (
          <button
            type="button"
            className="button secondary"
            disabled={disabled}
            onClick={clear}
          >
            Скасувати редагування
          </button>
        )}
      </div>
      {preview && (
        <ul className="breeder-public-videos">
          <BreederVideoPlayer
            video={{ id: "preview", type: "VIDEO", url: preview, position: 0 }}
            index={0}
          />
        </ul>
      )}
      <div id={uid + "-feedback"} className="breeder-section-feedback">
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
            {!normalizedVideoUrl(video.url) && (
              <p className="muted">
                Раніше завантажене відео. Доступні перегляд і видалення.
              </p>
            )}
            <div className="breeder-media-item-actions">
              <button
                type="button"
                className="button secondary"
                disabled={disabled}
                aria-label={"Переглянути відео " + (index + 1)}
                onClick={() => setShown(shown === video.id ? null : video.id)}
              >
                Переглянути
              </button>
              {onEdit && normalizedVideoUrl(video.url) && (
                <button
                  type="button"
                  className="button secondary"
                  disabled={disabled}
                  aria-label={"Редагувати відео " + (index + 1)}
                  onClick={() => {
                    setEditing(video.id);
                    setUrl(video.url);
                    setError("");
                    setPreview("");
                  }}
                >
                  Редагувати
                </button>
              )}
              <button
                type="button"
                className="button secondary"
                disabled={disabled || index === 0}
                aria-label={"Перемістити відео " + (index + 1) + " раніше"}
                onClick={() => {
                  const ids = videos.map((v) => v.id);
                  [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
                  onReorder(ids);
                }}
              >
                Раніше
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={disabled}
                aria-label={"Видалити відео " + (index + 1)}
                onClick={() => {
                  if (editing === video.id) clear();
                  onRemove(video.id);
                }}
              >
                Видалити
              </button>
            </div>
            {shown === video.id && (
              <ul className="breeder-public-videos">
                <BreederVideoPlayer video={video} index={index} />
              </ul>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
