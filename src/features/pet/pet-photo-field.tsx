"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { MediaUploadTrigger } from "@/shared/ui/media-upload-trigger";
export function petPhotoError(file: { type: string; size: number }) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    return "Оберіть JPEG, PNG або WebP.";
  if (!file.size || file.size > 8 * 1024 * 1024)
    return "Фото має бути не більше 8 МБ.";
  return null;
}
export function PetPhotoField({
  current,
  value,
  disabled,
  onChange,
  heading = "Фото тварини",
}: {
  current?: { url: string } | null;
  value: File | null | undefined;
  disabled: boolean;
  onChange: (file: File | null) => void;
  heading?: string;
}) {
  const [error, setError] = useState<string | null>(null),
    [preview, setPreview] = useState<string | null>(null);
  const objectUrl = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );
  const src = value === null ? null : (preview ?? current?.url);
  return (
    <section className="pet-photo-field" aria-labelledby="pet-photo-title">
      <h2 id="pet-photo-title">{heading}</h2>
      <p id="pet-photo-help" className="muted">
        Необов’язково. JPEG, PNG або WebP, до 8 МБ. Це власне фото тварини,
        незалежне від оголошень.
      </p>
      {src && (
        <Image
          className="pet-photo-preview"
          src={src}
          alt="Фото тварини"
          width={480}
          height={360}
          unoptimized
        />
      )}
      <div className="form-actions">
        <MediaUploadTrigger
          id="pet-photo-file"
          label={src ? "Замінити фото тварини" : "Додати фото тварини"}
          disabled={disabled}
          describedBy={
            error ? "pet-photo-help pet-photo-error" : "pet-photo-help"
          }
          invalid={Boolean(error)}
          onAdd={(files) => {
            const file = files?.[0];
            if (!file) return;
            const message = petPhotoError(file);
            setError(message);
            if (message) return;
            if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
            objectUrl.current = URL.createObjectURL(file);
            setPreview(objectUrl.current);
            onChange(file);
          }}
        />
        {src && (
          <button
            type="button"
            className="button secondary"
            disabled={disabled}
            onClick={() => {
              if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
              objectUrl.current = null;
              setPreview(null);
              setError(null);
              onChange(null);
            }}
          >
            Видалити фото тварини
          </button>
        )}
      </div>
      {error && (
        <p id="pet-photo-error" role="alert" className="field-error">
          {error}
        </p>
      )}
    </section>
  );
}
