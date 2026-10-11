import { SafeImage } from "@/shared/ui/safe-image";

export function GalleryEditorItem({
  image,
  altPrefix = "Фото розплідника",
  index,
  count,
  disabled,
  onMove,
  onRemove,
  onDrop,
}: {
  image: { id: string; thumbnailUrl: string };
  altPrefix?: string;
  index: number;
  count: number;
  disabled: boolean;
  onMove: (from: number, to: number) => void;
  onRemove: (id: string) => void;
  onDrop: (from: number, to: number) => void;
}) {
  return (
    <li
      draggable={!disabled}
      onDragStart={(event) => {
        event.dataTransfer.setData(
          "application/x-gallery-image",
          String(index),
        );
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(event) => {
        if (!disabled) event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        const from = event.dataTransfer.getData("application/x-gallery-image");
        if (!disabled && from !== "") onDrop(Number(from), index);
      }}
    >
      <SafeImage
        draggable={false}
        src={image.thumbnailUrl}
        alt={altPrefix + " " + (index + 1)}
        width={240}
        height={180}
        loading="lazy"
      />
      <p className="muted breeder-photo-order">Фото {index + 1}</p>
      <div className="breeder-media-item-actions">
        <button
          type="button"
          className="button secondary"
          disabled={disabled || index === 0}
          aria-label={"Перемістити фото " + (index + 1) + " раніше"}
          onClick={() => onMove(index, index - 1)}
        >
          Раніше
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={disabled || index === count - 1}
          aria-label={"Перемістити фото " + (index + 1) + " пізніше"}
          onClick={() => onMove(index, index + 1)}
        >
          Пізніше
        </button>
        <button
          type="button"
          className="button breeder-destructive"
          disabled={disabled}
          aria-label={"Видалити фото " + (index + 1)}
          onClick={() => onRemove(image.id)}
        >
          Видалити фото
        </button>
      </div>
    </li>
  );
}
