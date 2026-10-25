import { isUploadedBreederVideo } from "@/entities/breeder/uploaded-video";
import type { BreederVideo } from "@/entities/breeder/media";
import { PublicVideoPlayer } from "@/shared/ui/public-video-player";
export function BreederVideoPlayer({
  video,
  index,
}: {
  video: BreederVideo;
  index: number;
}) {
  if (isUploadedBreederVideo(video.url))
    return (
      <li className="public-video-item">
        <video
          controls
          preload="none"
          playsInline
          aria-label={`Відео розплідника ${index + 1}`}
          style={{ width: "100%", maxWidth: "100%", aspectRatio: "16 / 9" }}
        >
          <source
            src={video.url}
            type={video.url.endsWith(".webm") ? "video/webm" : "video/mp4"}
          />
          Ваш браузер не підтримує відтворення відео.
        </video>
      </li>
    );
  return (
    <PublicVideoPlayer video={video} index={index} label="Відео розплідника" />
  );
}
