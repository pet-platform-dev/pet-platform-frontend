"use client";
import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import { authenticatedRequest, ApiError } from "@/shared/api/client";
import { imageError, reorderImages } from "../model/images";
type Item = {
  key: string;
  file?: File;
  preview: string;
  status: "uploading" | "ready" | "failed";
  id?: string;
  existing?: boolean;
  error?: string;
};
export type ListingImagesHandle = {
  submission: () => {
    uploadSessionId?: string;
    imageIds: string[];
    images: ({ imageId: string } | { uploadId: string })[];
  } | null;
};
export function ListingImages({
  ref,
  onBusy,
  initialImages = [],
  active = false,
}: {
  ref: Ref<ListingImagesHandle>;
  onBusy: (busy: boolean) => void;
  initialImages?: { id: string; url: string }[];
  active?: boolean;
}) {
  const [items, setItems] = useState<Item[]>(() =>
      initialImages.map((image) => ({
        key: image.id,
        id: image.id,
        preview: image.url,
        status: "ready",
        existing: true,
      })),
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const session = useRef<string | undefined>(undefined),
    urls = useRef(new Set<string>()),
    locked = useRef(false),
    requests = useRef(new AbortController());
  useEffect(() => {
    requests.current = new AbortController();
    const controller = requests.current;
    const previews = urls.current;
    return () => {
      controller.abort();
      for (const url of previews) URL.revokeObjectURL(url);
    };
  }, []);
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);
  useImperativeHandle(
    ref,
    () => ({
      submission: () => {
        if (items.some((item) => item.status !== "ready") || locked.current) {
          setError(
            "Дочекайтеся завантаження. Невдалі фото можна повторити або видалити",
          );
          return null;
        }
        return {
          uploadSessionId: session.current,
          imageIds: items
            .filter((item) => !item.existing)
            .map((item) => item.id!),
          images: items.map((item) =>
            item.existing ? { imageId: item.id! } : { uploadId: item.id! },
          ),
        };
      },
    }),
    [items],
  );
  async function upload(batch: Item[]) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    onBusy(true);
    setError("");
    const signal = requests.current.signal;
    try {
      for (const item of batch) {
        if (signal.aborted) break;
        setItems((old) =>
          old.map((value) =>
            value.key === item.key
              ? { ...value, status: "uploading", error: undefined }
              : value,
          ),
        );
        try {
          session.current ??= (
            await authenticatedRequest<{ uploadSessionId: string }>(
              "/uploads/listings/session",
              { method: "POST", signal },
            )
          ).uploadSessionId;
          const body = new FormData();
          body.append("file", item.file!);
          const asset = await authenticatedRequest<{ id: string }>(
            `/uploads/listings/${session.current}/images`,
            { method: "POST", body, signal },
          );
          setItems((old) =>
            old.map((value) =>
              value.key === item.key
                ? { ...value, status: "ready", id: asset.id }
                : value,
            ),
          );
        } catch (error) {
          setItems((old) =>
            old.map((value) =>
              value.key === item.key
                ? {
                    ...value,
                    status: "failed",
                    error:
                      error instanceof ApiError
                        ? error.message
                        : "Не вдалося завантажити фото. Спробуйте ще раз",
                  }
                : value,
            ),
          );
        }
      }
    } finally {
      locked.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  function add(files: FileList | null) {
    if (!files) return;
    const selected = [...files];
    if (items.length + selected.length > 10) {
      setError("Можна додати не більше 10 фотографій");
      return;
    }
    const invalid = selected.map(imageError).find(Boolean);
    if (invalid) {
      setError(invalid);
      return;
    }
    const batch = selected.map((file) => {
      const preview = URL.createObjectURL(file);
      urls.current.add(preview);
      return {
        key: crypto.randomUUID(),
        file,
        preview,
        status: "uploading" as const,
      };
    });
    setItems((old) => [...old, ...batch]);
    void upload(batch);
  }
  async function remove(item: Item) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      if (
        active &&
        items.filter((value) => value.status === "ready").length <= 1 &&
        item.status === "ready"
      ) {
        setError("Активне оголошення повинно мати щонайменше одну фотографію");
        return;
      }
      if (item.id && !item.existing)
        await authenticatedRequest(
          `/uploads/listings/${session.current}/images/${item.id}`,
          { method: "DELETE", signal: requests.current.signal },
        );
      setItems((old) => old.filter((value) => value.key !== item.key));
      if (!item.existing) URL.revokeObjectURL(item.preview);
      urls.current.delete(item.preview);
    } catch (error) {
      setError(
        error instanceof ApiError
          ? error.message
          : "Не вдалося видалити фото. Спробуйте ще раз",
      );
    } finally {
      locked.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <section className="listing-photo-section" aria-labelledby="photos-heading">
      <h2 id="photos-heading">Фотографії</h2>
      <p className="form-hint">
        Додайте до 10 фотографій. Перше фото буде головним. JPEG, PNG або WebP,
        до 8 MB кожне. Фото допоможуть знайти нову родину.
      </p>
      <label className="button secondary photo-add">
        + Додати фото
        <input
          aria-label="Додати фото"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={busy || items.length >= 10}
          onChange={(event) => {
            add(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <ol className="listing-photo-grid">
        {items.map((item, index) => (
          <li key={item.key}>
            {/* Local object URLs are revoked on removal and unmount. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.preview}
              alt={`Попередній перегляд — фото ${index + 1}`}
              width="240"
              height="180"
            />
            <p>{index === 0 ? "Головне фото" : `Фото ${index + 1}`}</p>
            <p role="status">
              {item.status === "uploading"
                ? "Завантажуємо…"
                : item.status === "ready"
                  ? "Завантажено"
                  : item.error}
            </p>
            <div className="photo-controls">
              <button
                type="button"
                disabled={busy || index === 0}
                aria-label={`Перемістити фото ${index + 1} ліворуч`}
                onClick={() =>
                  setItems((old) => reorderImages(old, index, index - 1))
                }
              >
                ←
              </button>
              <button
                type="button"
                disabled={busy || index === items.length - 1}
                aria-label={`Перемістити фото ${index + 1} праворуч`}
                onClick={() =>
                  setItems((old) => reorderImages(old, index, index + 1))
                }
              >
                →
              </button>
              {index > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    setItems((old) => reorderImages(old, index, 0))
                  }
                >
                  Зробити головним
                </button>
              )}
              {item.status === "failed" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void upload([item])}
                >
                  Повторити
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                aria-label={`Видалити фото ${index + 1}`}
                onClick={() => void remove(item)}
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
