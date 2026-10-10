"use client";
import { useEffect, useRef, useState } from "react";

import { SafeImage } from "./safe-image";
export function lightboxUrl(url: string) {
  return url.replace(
    /\/image\/upload\/(?:f_auto,q_auto,c_limit,w_1200\/)?/,
    "/image/upload/f_auto,q_auto,c_limit,w_1800/",
  );
}
export type GalleryImage = { id: string; url: string; thumbnailUrl: string };
export function ImageGallery({
  images,
  heading,
  emptyFallback,
  failedFallback,
}: {
  images: GalleryImage[];
  heading: string;
  emptyFallback?: React.ReactNode;
  failedFallback?: React.ReactNode;
}) {
  const [selected, setSelected] = useState(0),
    [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    opener = useRef<HTMLButtonElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null),
    swiped = useRef(false);
  const thumbnailDrag = useRef<{
    pointerId: number;
    x: number;
    scrollLeft: number;
  } | null>(null);
  const suppressThumbnailClick = useRef(false);
  const count = images.length,
    index = Math.min(selected, Math.max(0, count - 1));

  function move(delta: number) {
    setSelected(
      (value) => (Math.min(value, count - 1) + delta + count) % count,
    );
  }
  useEffect(() => {
    if (!open || !count) return;
    const overflow = document.body.style.overflow;
    const viewer = dialog.current,
      trigger = opener.current;
    document.body.style.overflow = "hidden";
    viewer?.showModal();
    return () => {
      document.body.style.overflow = overflow;
      viewer?.close();
      trigger?.focus();
      swiped.current = false;
    };
  }, [open, count]);
  const gestures = {
    onPointerDown: (event: React.PointerEvent) => {
      if (event.pointerType !== "touch") return;
      swiped.current = false;
      touch.current = { x: event.clientX, y: event.clientY };
    },
    onPointerUp: (event: React.PointerEvent) => {
      const start = touch.current;
      touch.current = null;
      if (!start) return;
      const dx = event.clientX - start.x,
        dy = event.clientY - start.y;
      if (
        Math.abs(dx) < 10 &&
        Math.abs(dy) < 10 &&
        event.target instanceof Element &&
        event.target.closest(".gallery-open")
      ) {
        setOpen(true);
      } else if (
        count > 1 &&
        Math.abs(dx) >= 50 &&
        Math.abs(dx) > Math.abs(dy) * 1.5
      ) {
        swiped.current = true;
        move(dx < 0 ? 1 : -1);
      }
    },
    onPointerCancel: () => {
      touch.current = null;
    },
  };
  function keys(event: React.KeyboardEvent) {
    if (open && event.key === "Tab") {
      const controls = dialog.current?.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled)",
      );
      const first = controls?.[0],
        last = controls?.[controls.length - 1];
      if (
        first &&
        last &&
        ((!event.shiftKey && document.activeElement === last) ||
          (event.shiftKey && document.activeElement === first))
      ) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
      return;
    }
    if (count < 2 || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    move(event.key === "ArrowRight" ? 1 : -1);
  }
  function finishThumbnailDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (thumbnailDrag.current?.pointerId !== event.pointerId) return;
    thumbnailDrag.current = null;
    delete event.currentTarget.dataset.dragging;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }
  const arrows = () =>
    count > 1 && (
      <>
        <button
          className="gallery-arrow gallery-prev"
          type="button"
          aria-label="Попереднє фото"
          onClick={() => move(-1)}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <button
          className="gallery-arrow gallery-next"
          type="button"
          aria-label="Наступне фото"
          onClick={() => move(1)}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </>
    );
  if (!count) return emptyFallback ?? null;
  const image = images[index];
  return (
    <div className="listing-gallery" onKeyDown={keys}>
      <div className="gallery-stage gallery-main-image" {...gestures}>
        <button
          ref={opener}
          type="button"
          className="gallery-open"
          aria-label="Відкрити фото на весь екран"
          onClick={() => {
            if (swiped.current) {
              swiped.current = false;
              return;
            }
            setOpen(true);
          }}
        >
          <SafeImage
            fallback={failedFallback}
            className="listing-gallery-main"
            src={image.url}
            alt={`${heading} — фото ${index + 1}`}
            width="1200"
            height="900"
            fetchPriority="high"
          />
        </button>
        {arrows()}
        <span className="gallery-counter" role="status" aria-live="polite">
          {index + 1} / {count}
        </span>
      </div>
      {count > 1 && (
        <div
          className="listing-gallery-thumbnails"
          aria-label={`Фотографії: ${heading}`}
          onPointerDown={(event) => {
            if (event.pointerType !== "mouse" || event.button !== 0) return;
            suppressThumbnailClick.current = false;
            thumbnailDrag.current = {
              pointerId: event.pointerId,
              x: event.clientX,
              scrollLeft: event.currentTarget.scrollLeft,
            };
          }}
          onPointerMove={(event) => {
            const start = thumbnailDrag.current;
            if (!start || start.pointerId !== event.pointerId) return;
            if (event.buttons !== 1) {
              finishThumbnailDrag(event);
              return;
            }
            const delta = event.clientX - start.x;
            if (!suppressThumbnailClick.current && Math.abs(delta) < 6) return;
            suppressThumbnailClick.current = true;
            event.currentTarget.dataset.dragging = "true";
            event.currentTarget.setPointerCapture(event.pointerId);
            event.preventDefault();
            event.currentTarget.scrollLeft = start.scrollLeft - delta;
          }}
          onPointerUp={finishThumbnailDrag}
          onPointerCancel={finishThumbnailDrag}
          onPointerLeave={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId))
              finishThumbnailDrag(event);
          }}
          onLostPointerCapture={finishThumbnailDrag}
          onDragStart={(event) => event.preventDefault()}
          onClickCapture={(event) => {
            if (!suppressThumbnailClick.current || event.detail === 0) return;
            suppressThumbnailClick.current = false;
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          {images.map((image, i) => (
            <button
              type="button"
              key={image.id}
              aria-label={`Показати фото ${i + 1}`}
              aria-pressed={index === i}
              onClick={() => setSelected(i)}
            >
              <SafeImage
                fallback={failedFallback}
                src={image.thumbnailUrl}
                alt={`${heading} — фото ${i + 1}`}
                width="120"
                height="90"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
      <dialog
        ref={dialog}
        className="gallery-lightbox"
        aria-label={`Фотографії: ${heading}`}
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      >
        {open && (
          <>
            <button
              type="button"
              autoFocus
              className="gallery-close"
              aria-label="Закрити перегляд"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
            <div className="lightbox-stage" {...gestures}>
              <SafeImage
                fallback={failedFallback}
                className="lightbox-image"
                src={lightboxUrl(image.url)}
                alt={`${heading} — фото ${index + 1}`}
                width="1800"
                height="1350"
              />
              {arrows()}
              <span className="gallery-counter" role="status">
                {index + 1} / {count}
              </span>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
