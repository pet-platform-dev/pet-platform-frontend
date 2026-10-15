import type { BreederVideo } from "@/entities/breeder/media";
import { PublicVideoPlayer } from "@/shared/ui/public-video-player";
export function BreederVideoPlayer({
  video,
  index,
}: {
  video: BreederVideo;
  index: number;
}) {
  return (
    <PublicVideoPlayer
      immediate
      video={video}
      index={index}
      label="Відео розплідника"
    />
  );
}
