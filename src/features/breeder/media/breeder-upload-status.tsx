import { SafeImage } from "@/shared/ui/safe-image";
import type { UploadItem } from "./use-breeder-media";
export function BreederUploadStatus({
  items,
  busy,
  retry,
  discard,
}: {
  items: UploadItem[];
  busy: boolean;
  retry: (item: UploadItem) => void;
  discard: (item: UploadItem) => void;
}) {
  if (!items.length) return null;
  return (
    <ul className="breeder-upload-list">
      {items.map((item) => (
        <li key={item.key}>
          <SafeImage
            src={item.preview}
            alt="Попередній перегляд обраної фотографії"
            width={160}
            height={120}
          />
          {item.status === "uploading" ? (
            <div role="status">
              <progress aria-label="Завантаження фотографії" />
              Завантажуємо…
            </div>
          ) : item.status === "waiting" ? (
            <p role="status">Очікує завантаження</p>
          ) : (
            <>
              <p role="alert" id={"breeder-upload-error-" + item.key}>
                {item.error}
              </p>
              <button
                type="button"
                className="button secondary"
                aria-describedby={"breeder-upload-error-" + item.key}
                disabled={busy}
                onClick={() => retry(item)}
              >
                Повторити
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => discard(item)}
              >
                Прибрати невдале фото
              </button>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
