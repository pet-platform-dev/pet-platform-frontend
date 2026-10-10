"use client";
import { useState } from "react";
import type { BreederVideo } from "@/entities/breeder/media";
import { videoEmbedUrl } from "@/entities/breeder/video-url";
export function BreederVideoPlayer({
  video,
  index,
}: {
  video: BreederVideo;
  index: number;
}) {
  const [open, setOpen] = useState(false),
    embed = videoEmbedUrl(video.url);
  if (!embed) return null;
  return (
    <li>
      <div className="breeder-video-player">
        {open ? (
          <iframe
            src={embed}
            title={"Відео розплідника " + (index + 1)}
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
