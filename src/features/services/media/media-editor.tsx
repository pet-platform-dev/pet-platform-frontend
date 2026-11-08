"use client";
import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getMedia,
  uploadMedia,
  removeMedia,
  reorderMedia,
  coverMedia,
  validateFile,
} from "@/entities/service-provider/api";
import type { ServiceMedia } from "@/entities/service-provider/model";
import { SafeImage } from "@/shared/ui/safe-image";
import { ImageGallery } from "@/shared/ui/image-gallery";
import { MediaUploadTrigger } from "@/shared/ui/media-upload-trigger";
import {
  useWorkspaceAction,
  useWorkspaceQuery,
  useWorkspaceScope,
  useWorkspaceBusy,
  invalidateWorkspace,
  currentWorkspace,
} from "../workspace/session";
import { Feedback, Loading, ConfirmButton } from "../workspace/ui";
type MediaType = "LOGO" | "COVER" | "IMAGE";
type Operation =
  | { kind: "upload"; files: File[]; type: MediaType; replacement?: string }
  | { kind: "remove"; id: string }
  | { kind: "move"; ids: string[] }
  | { kind: "cover"; id: string };
export function ServiceMediaEditor({
  providerId,
  offerId,
  readOnly = false,
}: {
  providerId: string;
  offerId?: string;
  readOnly?: boolean;
}) {
  const workspaceBusy = useWorkspaceBusy(providerId);
  const id = useId(),
    scope = useWorkspaceScope(),
    client = useQueryClient(),
    query = useWorkspaceQuery(
      [providerId, "media", offerId ?? "provider"],
      (signal) => getMedia(providerId, offerId, signal),
    );
  const [localError, setLocalError] = useState<Error | null>(null),
    [progress, setProgress] = useState("");
  const action = useWorkspaceAction(async (op: Operation) => {
    if (!query.data) throw Error("Спочатку завантажте актуальні фотографії");
    let result: ServiceMedia = query.data;
    try {
      if (op.kind === "upload") {
        op.files.forEach(validateFile);
        for (let i = 0; i < op.files.length; i++) {
          if (!currentWorkspace(client, scope))
            throw new DOMException("Session changed", "AbortError");
          setProgress(`Завантаження ${i + 1} / ${op.files.length}…`);
          result = await uploadMedia(
            providerId,
            offerId,
            op.files[i],
            op.type,
            result.updatedAt,
            op.replacement,
          );
        }
      } else if (op.kind === "remove")
        result = await removeMedia(
          providerId,
          offerId,
          op.id,
          result.updatedAt,
        );
      else if (op.kind === "move")
        result = await reorderMedia(
          providerId,
          offerId,
          op.ids,
          result.updatedAt,
        );
      else if (offerId)
        result = await coverMedia(providerId, offerId, op.id, result.updatedAt);
      return result;
    } catch (error) {
      // A batch may have committed earlier files: refresh target/status while
      // still pending, preserving the original failure and old attachments.
      await invalidateWorkspace(client, scope, providerId).catch(() => false);
      throw error;
    }
  }, providerId);
  async function run(op: Operation) {
    setLocalError(null);
    setProgress("");
    try {
      await action.mutateAsync(op);
    } catch {
      /* Existing media stays in the query; reload may reveal partial batch success. */
    } finally {
      if (currentWorkspace(client, scope)) {
        setProgress("");
      }
    }
  }
  function add(files: FileList | null, type: MediaType, replacement?: string) {
    if (!files?.length) return;
    const selected = Array.from(files);
    try {
      selected.forEach(validateFile);
      const count =
        query.data?.items.filter((i) => i.type === "IMAGE").length ?? 0;
      if (
        type === "IMAGE" &&
        !replacement &&
        count + selected.length > (offerId ? 10 : 20)
      )
        throw Error(`Доступно ще ${(offerId ? 10 : 20) - count} фото`);
      void run({ kind: "upload", files: selected, type, replacement });
    } catch (e) {
      setLocalError(e instanceof Error ? e : Error("Перевірте файли"));
    }
  }
  if (query.isPending) return <Loading />;
  if (query.isError)
    return (
      <Feedback error={query.error} onRefresh={() => void query.refetch()} />
    );
  const busy = workspaceBusy || action.isPending || readOnly,
    images = query.data.items
      .filter((i) => i.type === "IMAGE")
      .sort((a, b) => a.position - b.position);
  const singletons = offerId ? [] : (["LOGO", "COVER"] as const);
  function move(index: number, direction: number) {
    const ids = images.map((i) => i.id),
      target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void run({ kind: "move", ids });
  }
  return (
    <section className="workspace-panel" aria-labelledby={id + "heading"}>
      <h2 id={id + "heading"}>Фотографії {offerId ? "послуги" : "профілю"}</h2>
      <p className="muted">
        JPEG/PNG/WebP, до 3 MiB на файл.{" "}
        {offerId
          ? "До 10 фотографій; перша — обкладинка послуги."
          : "Логотип, банер та до 20 фотографій галереї."}{" "}
        Фотографії можуть стати публічними після схвалення. Не завантажуйте
        документи чи приватні дані.
      </p>
      <Feedback
        error={localError ?? action.error}
        onRefresh={() => void query.refetch()}
      />
      {progress && (
        <p role="status" aria-live="polite">
          {progress}
        </p>
      )}
      <div className="workspace-media-singletons">
        {singletons.map((type) => {
          const item = query.data.items.find((i) => i.type === type),
            label = type === "LOGO" ? "Логотип" : "Банер";
          return (
            <section key={type}>
              <h3>{label}</h3>
              {item ? (
                <SafeImage src={item.url} alt={label} loading="lazy" />
              ) : (
                <p className="muted">Ще не додано</p>
              )}
              <div className="workspace-actions">
                <MediaUploadTrigger
                  id={id + type}
                  label={`${item ? "Замінити" : "Додати"} ${label.toLowerCase()}`}
                  disabled={busy}
                  onAdd={(files) => add(files, type, item?.id)}
                />
                {item && (
                  <ConfirmButton
                    label={`Видалити ${label.toLowerCase()}`}
                    title="Видалити фотографію?"
                    description="Зображення буде вилучене з профілю. Попереднє фото зберігається, якщо нове завантаження не вдалося."
                    disabled={busy}
                    destructive
                    onConfirm={() => run({ kind: "remove", id: item.id })}
                  />
                )}
              </div>
            </section>
          );
        })}
      </div>
      <h3>
        Галерея · {images.length} / {offerId ? 10 : 20}
      </h3>
      <MediaUploadTrigger
        id={id + "gallery"}
        label="Додати фото галереї"
        multiple
        disabled={busy || images.length >= (offerId ? 10 : 20)}
        onAdd={(files) => add(files, "IMAGE")}
      />
      <ol className="workspace-media-grid">
        {images.map((item, index) => (
          <li key={item.id}>
            <SafeImage
              src={item.url}
              alt={`Фото ${index + 1}`}
              loading="lazy"
            />
            {item.isCover && offerId && (
              <span className="catalog-chip">Обкладинка</span>
            )}
            <div className="workspace-actions">
              <button
                type="button"
                className="button secondary compact"
                disabled={busy || index === 0}
                aria-label={`Фото ${index + 1}: раніше`}
                onClick={() => move(index, -1)}
              >
                Раніше
              </button>
              <button
                type="button"
                className="button secondary compact"
                disabled={busy || index === images.length - 1}
                aria-label={`Фото ${index + 1}: пізніше`}
                onClick={() => move(index, 1)}
              >
                Пізніше
              </button>
              {offerId && index > 0 && (
                <button
                  type="button"
                  className="button secondary compact"
                  disabled={busy}
                  onClick={() => void run({ kind: "cover", id: item.id })}
                >
                  Зробити обкладинкою
                </button>
              )}
              <MediaUploadTrigger
                id={id + item.id}
                label={`Замінити фото ${index + 1}`}
                disabled={busy}
                onAdd={(files) => add(files, "IMAGE", item.id)}
              />
              <ConfirmButton
                label={`Видалити фото ${index + 1}`}
                title="Видалити фото галереї?"
                description="Фотографію буде вилучено з цієї галереї."
                disabled={busy}
                destructive
                onConfirm={() => run({ kind: "remove", id: item.id })}
              />
            </div>
          </li>
        ))}
      </ol>
      {images.length > 0 && (
        <details>
          <summary>Переглянути галерею</summary>
          <ImageGallery
            heading="Перегляд фотографій"
            images={images.map((i) => ({
              id: i.id,
              url: i.url,
              thumbnailUrl: i.url,
            }))}
          />
        </details>
      )}
    </section>
  );
}
