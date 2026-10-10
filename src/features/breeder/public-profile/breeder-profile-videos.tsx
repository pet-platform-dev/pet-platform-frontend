import type { Breeder } from "@/entities/breeder/model";
import { BreederVideoPlayer } from "./breeder-video-player";
export function BreederProfileVideos({
  videos,
}: {
  videos: Breeder["media"]["videos"];
}) {
  if (!videos?.length) return null;
  return (
    <section
      className="listing-detail-panel"
      aria-labelledby="breeder-public-video-title"
    >
      <h2 id="breeder-public-video-title">Відео</h2>
      <ul className="breeder-public-videos">
        {videos.map((video, index) => (
          <BreederVideoPlayer key={video.id} video={video} index={index} />
        ))}
      </ul>
    </section>
  );
}
