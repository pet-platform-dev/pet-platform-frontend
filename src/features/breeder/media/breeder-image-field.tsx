import type { ReactNode } from "react";
import { SafeImage } from "@/shared/ui/safe-image";
import { breederImageUrl, type BreederImage } from "@/entities/breeder/media";
import { MediaUploadTrigger } from "./media-upload-trigger";

export function BreederImageField({
  kind,
  image,
  disabled,
  onAdd,
  onRemove,
  children,
}: {
  kind: "logo" | "cover";
  image: BreederImage | null;
  disabled: boolean;
  onAdd: (files: FileList | null) => void;
  onRemove: (id: string) => void;
  children?: ReactNode;
}) {
  const logo = kind === "logo",
    noun = logo ? "логотип" : "обкладинку",
    id = "breeder-" + kind;
  return (
    <section className="breeder-media-section" aria-labelledby={id + "-title"}>
      <header className="breeder-section-heading">
        <h2 id={id + "-title"}>
          {logo ? "Логотип розплідника" : "Обкладинка профілю"}
        </h2>
        <p id={id + "-help"} className="muted">
          {logo
            ? "Необов’язково. Квадратне фото або логотип."
            : "Необов’язково. Горизонтальне фото, рекомендовані пропорції 3:1."}{" "}
          JPEG/PNG/WebP до 8 MiB.
        </p>
      </header>
      <div
        className={
          "breeder-image-control breeder-image-control-" +
          kind +
          (image ? "" : " breeder-upload-empty")
        }
      >
        {image && (
          <SafeImage
            className={"breeder-editor-preview breeder-editor-preview-" + kind}
            src={breederImageUrl(image.url, logo ? 240 : 1200)}
            alt={logo ? "Логотип розплідника" : "Обкладинка розплідника"}
            width={logo ? 120 : 1200}
            height={logo ? 120 : 400}
          />
        )}
        {!image && (
          <p className="muted">
            {logo
              ? "Додайте логотип розплідника"
              : "Додайте обкладинку профілю"}
          </p>
        )}
        <div className="breeder-media-item-actions">
          <MediaUploadTrigger
            id={id + "-upload"}
            label={(image ? "Замінити " : "Завантажити ") + noun}
            disabled={disabled}
            describedBy={id + "-help " + id + "-feedback"}
            onAdd={onAdd}
          />
          {image && (
            <button
              type="button"
              className="button breeder-destructive"
              disabled={disabled}
              onClick={() => onRemove(image.id)}
            >
              Видалити {noun}
            </button>
          )}
        </div>
      </div>
      <div id={id + "-feedback"} className="breeder-section-feedback">
        {children}
      </div>
    </section>
  );
}
