import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const {
  breederMediaSchema,
  emptyBreederMedia,
  BREEDER_MEDIA_LIMITS,
  breederImageUrl,
} = await load("src/entities/breeder/media.ts");
const { normalizedVideoUrl, videoEmbedUrl } = await load(
  "src/entities/breeder/video-url.ts",
);
const { BreederProfileHeader } = await load(
  "src/features/breeder/public-profile/breeder-profile-header.tsx",
);
const { BreederMediaViewer } = await load(
  "src/features/breeder/public-profile/breeder-media-viewer.tsx",
);
const { BreederProfileVideos } = await load(
  "src/features/breeder/public-profile/breeder-profile-videos.tsx",
);
const { BreederGalleryEditor } = await load(
  "src/features/breeder/media/breeder-gallery-editor.tsx",
);
const { updateBreederMediaCache } = await load(
  "src/features/breeder/media/cache.ts",
);
const id = "11111111-1111-4111-8111-111111111111";
const image = {
  id,
  type: "IMAGE",
  position: 0,
  url: "https://res.cloudinary.com/test/image/upload/v1/a.png",
  thumbnailUrl:
    "https://res.cloudinary.com/test/image/upload/f_auto,q_auto,c_fill,w_480,h_360/v1/a.png",
};
const profile = {
  id,
  userId: id,
  kennelName: "Розплідник",
  description: null,
  location: null,
  locationId: null,
  breedIds: [],
  breeds: [],
  startedYear: null,
  website: null,
  createdAt: "2026-10-10T00:00:00Z",
  updatedAt: "2026-10-10T00:00:00Z",
  media: emptyBreederMedia,
  contactPerson: {
    id,
    displayName: "Олександр Єпік",
    location: null,
    phone: null,
    telegram: null,
    viber: null,
    whatsapp: null,
    memberSince: "2026-10-10T00:00:00Z",
  },
};
const render = (component, props) =>
  renderToStaticMarkup(React.createElement(component, props));
test("empty optional media contract", () =>
  assert.deepEqual(
    breederMediaSchema.parse(emptyBreederMedia),
    emptyBreederMedia,
  ));
test("independent caps1/1/20/5", () =>
  assert.deepEqual(BREEDER_MEDIA_LIMITS, {
    LOGO: 1,
    COVER: 1,
    IMAGE: 20,
    VIDEO: 5,
  }));
test("safe projection strips injected storage and owner keys", () => {
  const data = breederMediaSchema.parse({
    ...emptyBreederMedia,
    gallery: [
      { ...image, assetId: "secret", ownerId: "secret", publicId: "secret" },
    ],
  });
  assert.deepEqual(data.gallery, [image]);
});
test("rejects arbitrary image host", () =>
  assert.equal(
    breederMediaSchema.safeParse({
      ...emptyBreederMedia,
      gallery: [{ ...image, url: "https://evil.test/a.png" }],
    }).success,
    false,
  ));
test("rejects incorrect logo slot", () =>
  assert.equal(
    breederMediaSchema.safeParse({ ...emptyBreederMedia, logo: image }).success,
    false,
  ));
test("gallery cap20", () => {
  assert.equal(
    breederMediaSchema.safeParse({
      ...emptyBreederMedia,
      gallery: Array(20).fill(image),
    }).success,
    true,
  );
  assert.equal(
    breederMediaSchema.safeParse({
      ...emptyBreederMedia,
      gallery: Array(21).fill(image),
    }).success,
    false,
  );
});
for (const url of [
  "javascript:alert(1)",
  "http://youtu.be/dQw4w9WgXcQ",
  "https://evil.test/a.mp4",
  "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ",
  "https://vimeo.com/123/secret",
  "https://user:pass@vimeo.com/123",
  "https://vimeo.com:444/123",
  "<iframe>bad</iframe>",
  "https://youtu.be/short",
  "https://vimeo.com/0",
  "https://vimeo.com/123?h=secret",
])
  test("reject unsafe embed " + url, () => {
    assert.equal(normalizedVideoUrl(url), null);
    assert.equal(videoEmbedUrl(url), null);
  });
test("YouTube canonical URL and privacy embed no autoplay", () => {
  assert.equal(
    normalizedVideoUrl("https://youtu.be/dQw4w9WgXcQ"),
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  );
  assert.equal(
    videoEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0&controls=1",
  );
});
test("Vimeo canonical public embed", () =>
  assert.equal(
    videoEmbedUrl("https://vimeo.com/123"),
    "https://player.vimeo.com/video/123?autoplay=0&dnt=1",
  ));
test("image delivery has explicit resize", () =>
  assert.equal(
    breederImageUrl(image.url, 1200),
    "https://res.cloudinary.com/test/image/upload/f_auto,q_auto,c_limit,w_1200/v1/a.png",
  ));
test("header absence has no empty cover or logo", () => {
  const html = render(BreederProfileHeader, { profile });
  assert.ok(html.includes("Олександр Єпік"));
  assert.ok(!html.includes("breeder-cover"));
});
test("header renders reserved cover and accessible logo", () => {
  const html = render(BreederProfileHeader, {
    profile: {
      ...profile,
      media: {
        ...emptyBreederMedia,
        logo: { ...image, type: "LOGO" },
        cover: { ...image, type: "COVER" },
      },
    },
  });
  assert.match(html, /width="96"/);
  assert.match(html, /height="480"/);
  assert.match(html, /Логотип Розплідник/);
});
test("empty gallery and videos omit sections", () => {
  assert.equal(render(BreederMediaViewer, { profile }), "");
  assert.equal(render(BreederProfileVideos, { videos: [] }), "");
});
test("breeder video iframe is immediately shown with lazy loading", () => {
  const html = render(BreederProfileVideos, {
    videos: [{ id, type: "VIDEO", position: 0, url: "https://vimeo.com/123" }],
  });
  assert.ok(html.includes("<iframe"));
  assert.ok(!html.includes("Переглянути відео"));
  assert.ok(html.includes("noopener noreferrer"));
});
test("editor exposes accessible reorder buttons and touch alternative", () => {
  const html = render(BreederGalleryEditor, {
    images: [image],
    disabled: false,
    onAdd() {},
    onRemove() {},
    onReorder() {},
  });
  assert.match(html, /Раніше/);
  assert.match(html, /Пізніше/);
  assert.match(html, /draggable="true"/);
});
test("media cache updates only current private/public breeder and keeps catalog", async () => {
  const client = new QueryClient();
  client.setQueryData(["current-user"], { id });
  client.setQueryData(["listings"], { stable: true });
  assert.equal(await updateBreederMediaCache(client, profile), true);
  assert.deepEqual(client.getQueryData(["listings"]), { stable: true });
  assert.deepEqual(client.getQueryData(["own-breeder", id]), profile);
  client.clear();
});
test("late response cannot populate a different account cache", async () => {
  const client = new QueryClient();
  client.setQueryData(["current-user"], { id: "other" });
  assert.equal(await updateBreederMediaCache(client, profile), false);
  assert.equal(client.getQueryData(["own-breeder", id]), undefined);
  client.clear();
});

const { BreederLogoField } = await load(
  "src/features/breeder/media/breeder-logo-field.tsx",
);
const { BreederCoverField } = await load(
  "src/features/breeder/media/breeder-cover-field.tsx",
);
for (const [Component, kind, noun] of [
  [BreederLogoField, "logo", "логотип"],
  [BreederCoverField, "cover", "обкладинку"],
]) {
  test(
    kind + " empty state has labelled hidden input and keyboard button",
    () => {
      const html = render(Component, {
        image: null,
        disabled: false,
        onAdd() {},
        onRemove() {},
      });
      assert.match(html, /class="breeder-visually-hidden"[^>]*tabindex="-1"/);
      assert.ok(html.includes('aria-controls="breeder-' + kind + '-upload"'));
      assert.ok(html.includes("Завантажити " + noun));
      assert.ok(!html.includes("Видалити " + noun));
    },
  );
  test(
    kind +
      " populated state has matching replace/delete actions and local feedback",
    () => {
      const html = render(Component, {
        image,
        disabled: true,
        onAdd() {},
        onRemove() {},
        children: React.createElement(
          "p",
          { role: "alert" },
          "Помилка завантаження",
        ),
      });
      assert.ok(html.includes("Замінити " + noun));
      assert.ok(html.includes("Видалити " + noun));
      assert.match(html, /class="button breeder-destructive" disabled=""/);
      assert.ok(html.includes('id="breeder-' + kind + '-feedback"'));
      assert.ok(html.includes("Помилка завантаження"));
    },
  );
}
test("empty gallery provides styled upload and clear count", () => {
  const html = render(BreederGalleryEditor, {
    images: [],
    disabled: false,
    onAdd() {},
    onRemove() {},
    onReorder() {},
  });
  assert.ok(html.includes("Додайте фотографії розплідника"));
  assert.ok(html.includes("0 / 20 фото"));
  assert.ok(html.includes('aria-controls="breeder-gallery-upload"'));
});
