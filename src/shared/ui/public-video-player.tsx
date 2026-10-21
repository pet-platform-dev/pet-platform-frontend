"use client";
import { useId, useState } from "react";

import { normalizedVideoUrl, videoEmbedUrl } from "@/shared/lib/video-url";
export function PublicVideoPlayer({
  video,
  index,
  label,
}: {
  video: { url: string };
  label: string;
  index: number;
}) {
  const embed = videoEmbedUrl(video.url),
    source = normalizedVideoUrl(video.url);
  if (!embed || !source) return null;
  return (
    <VideoActivation
      key={embed}
      embed={embed}
      source={source}
      title={`${label} ${index + 1}`}
    />
  );
}

// A normalized video identity gets its own activation state, including on swaps.
function VideoActivation({
  embed,
  source,
  title,
}: {
  embed: string;
  source: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const provider =
    new URL(source).hostname === "vimeo.com" ? "Vimeo" : "YouTube";
  return (
    <li className="public-video-item">
      <div
        id={id}
        className={`breeder-video-player${open ? "" : " public-video-placeholder-frame"}`}
      >
        {open ? (
          <iframe
            src={embed}
            title={title}
            loading="lazy"
            allow="fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <div className="public-video-placeholder">
            <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
              <circle
                cx="16"
                cy="16"
                r="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path d="m13 10 9 6-9 6Z" fill="currentColor" />
            </svg>
            <p className="public-video-title">{title}</p>
            <p>
              Для перегляду відео буде завантажено плеєр {provider}. Сторонній
              сервіс може отримати технічні дані про підключення.
            </p>
          </div>
        )}
      </div>
      <div className="public-video-actions">
        <button
          type="button"
          className="button secondary"
          aria-expanded={open}
          aria-controls={id}
          aria-label={`${open ? "Приховати" : "Завантажити"} відео: ${title}`}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Приховати відео" : "Завантажити відео"}
        </button>
        <a
          href={source}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Відкрити ${title} на ${provider} (нова вкладка)`}
        >
          Відкрити на {provider}
        </a>
      </div>
    </li>
  );
}
