"use client";
import { useState } from "react";

import { videoEmbedUrl } from "@/shared/lib/video-url";
export function PublicVideoPlayer({
  video,
  index,
  label,
  immediate = false,
}: {
  video: { url: string };
  label: string;
  immediate?: boolean;
  index: number;
}) {
  const [open, setOpen] = useState(false),
    embed = videoEmbedUrl(video.url);
  if (!embed) return null;
  return (
    <li>
      <div className="breeder-video-player">
        {immediate || open ? (
          <iframe
            src={embed}
            title={label + " " + (index + 1)}
            loading="lazy"
            allow="fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            type="button"
            className="button secondary"
            onClick={() => setOpen(true)}
          >
            Переглянути відео {index + 1}
          </button>
        )}
      </div>
      <a href={video.url} target="_blank" rel="noopener noreferrer">
        Відкрити відео {index + 1} на {new URL(video.url).hostname}
      </a>
    </li>
  );
}
