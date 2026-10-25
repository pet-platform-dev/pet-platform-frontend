import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "./helpers/load-frontend.mjs";
const { videoSchema } = await load("src/entities/breeder/media.ts");
const { BreederVideoPlayer } = await load(
  "src/features/breeder/public-profile/breeder-video-player.tsx",
);
const video = {
  id: "33333333-3333-4333-8333-333333333333",
  type: "VIDEO",
  position: 0,
  url: "https://res.cloudinary.com/synthetic/video/upload/v1/pet-platform/breeders/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.mp4",
};
test("accepts managed breeder video and existing external sources, rejects arbitrary URLs", () => {
  assert.equal(videoSchema.safeParse(video).success, true);
  assert.equal(
    videoSchema.safeParse({
      ...video,
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    }).success,
    true,
  );
  for (const url of [
    "javascript:alert(1)",
    video.url.replace("res.cloudinary.com", "evil.test"),
    video.url + "?token=x",
  ])
    assert.equal(videoSchema.safeParse({ ...video, url }).success, false);
});
test("uploaded videos render native accessible controls without autoplay or preload", () => {
  const html = renderToStaticMarkup(
    React.createElement(BreederVideoPlayer, { video, index: 0 }),
  );
  assert.match(html, /<video[^>]*controls=""/);
  assert.match(html, /preload="none"/);
  assert.match(html, /aria-label="Відео розплідника 1"/);
  assert.doesNotMatch(html, /iframe|autoplay|autoPlay/);
});
