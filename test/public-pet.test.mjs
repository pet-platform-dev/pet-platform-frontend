import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const { publicPetSchema, getPublicPet } = await load(
  "src/entities/pet/public-profile.ts",
);
const { PublicPetContent, petProfileTitle } = await load(
  "src/features/pet/public/public-pet-content.tsx",
);
const { publicPetImages } = await load(
  "src/features/pet/public/pet-gallery.tsx",
);
const { PetGalleryEditor } = await load(
  "src/features/pet/media/pet-gallery-editor.tsx",
);
const { PetVideoEditor } = await load(
  "src/features/pet/media/pet-video-editor.tsx",
);
const { isSessionQuery, clearPrivateQueries } = await load(
  "src/features/auth/session-provider.tsx",
);
const { petFormSchema } = await load("src/features/pet/validation.ts");
const id = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
const image = {
  id: other,
  url: "https://res.cloudinary.com/demo/image/upload/v1/gallery.png",
  displayUrl:
    "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_1200/v1/gallery.png",
  thumbnailUrl:
    "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_fill,w_480,h_360/v1/gallery.png",
  position: 0,
};
const input = {
  id,
  name: null,
  species: { id, name: "Dog", slug: "dog" },
  breed: { id, name: "Malinois", nameUk: "Малінуа", slug: "malinois" },
  gender: "MALE",
  birthDate: "2020-01-01",
  description: "Спокійний\nДобре соціалізований",
  specialTraits: "Робочі якості",
  profileImage: null,
  gallery: [],
  videos: [],
  breederSummary: { id: other, kennelName: "Royal Malinois" },
  activeListingSummary: null,
};
const pet = publicPetSchema.parse(input);
const html = (value) =>
  renderToStaticMarkup(React.createElement(PublicPetContent, { pet: value }));
test("public Pet strips private/provider fields and constructs canonical internal context links", () => {
  const parsed = publicPetSchema.parse({
    ...input,
    email: "private",
    healthNotes: "private",
    storageKey: "private",
    ownerId: id,
    breederSummary: { ...input.breederSummary, href: "https://evil.invalid" },
  });
  assert.equal(parsed.email, undefined);
  assert.equal(parsed.ownerId, undefined);
  assert.equal(parsed.breederSummary.href, "/sellers/" + other);
});
test("public detail renders breed, gender, age/date, optional text and breeder with semantic h1", () => {
  const output = html(pet);
  for (const label of [
    "<h1>Малінуа</h1>",
    "Хлопчик",
    "Дата народження",
    "Про тварину",
    "Чим особлива",
    "Робочі якості",
    "Royal Malinois",
    'href="/sellers/' + other + '"',
  ])
    assert.ok(output.includes(label), label);
  assert.ok(!output.includes("Без імені"));
});
test("optional name and metadata title remain clear without fake name", () => {
  assert.equal(petProfileTitle(pet), "Малінуа — профіль тварини");
  assert.equal(petProfileTitle({ ...pet, name: "Тор" }), "Тор — Малінуа");
  assert.ok(html({ ...pet, name: "Тор" }).includes("Тор"));
});
test("empty description/traits and absent listing produce no empty cards/price UI", () => {
  const output = html({ ...pet, description: null, specialTraits: " " });
  for (const label of [
    "Про тварину",
    "Чим особлива",
    "Активне оголошення",
    "Переглянути оголошення",
    "не продається",
  ])
    assert.ok(!output.includes(label));
});
test("ACTIVE summary produces canonical listing CTA; injected href cannot redirect", () => {
  const parsed = publicPetSchema.parse({
    ...input,
    activeListingSummary: {
      id: other,
      type: "SALE",
      price: "1200.00",
      currency: "UAH",
      cover: null,
      href: "https://evil.invalid",
    },
  });
  assert.equal(parsed.activeListingSummary.href, "/listings/" + other);
  const output = html(parsed);
  assert.ok(output.includes("Тварина має активне оголошення"));
  assert.ok(output.includes('href="/listings/' + other + '"'));
});
test("public image order: primary then gallery, exact asset duplicates omitted; ACTIVE final fallback only", () => {
  const profile = { url: image.url, thumbnailUrl: image.thumbnailUrl };
  const images = publicPetImages({
    ...pet,
    profileImage: profile,
    gallery: [
      image,
      {
        ...image,
        id,
        url: image.url + "?other",
        displayUrl: image.displayUrl + "?other",
      },
    ],
  });
  assert.equal(images.length, 2);
  assert.equal(images[0].id, "profile-" + id);
  assert.ok(images[0].url.includes("w_1200"));
  assert.equal(publicPetImages({ ...pet, gallery: [image] })[0].id, other);
  assert.equal(publicPetImages(pet).length, 0);
});
test("gallery SSR uses shared lightbox and labeled controls; video defers iframe until explicit activation", () => {
  const output = html({
    ...pet,
    gallery: [
      image,
      {
        ...image,
        id,
        url: image.url + "?other",
        displayUrl: image.displayUrl + "?other",
      },
    ],
  });
  assert.ok(output.includes("gallery-main-image"));
  assert.ok(output.includes('aria-label="Наступне фото"'));
  assert.ok(output.includes("gallery-thumbnails"));
  const videoHtml = html({
    ...pet,
    videos: [{ id, url: "https://vimeo.com/123", position: 0 }],
  });
  assert.ok(videoHtml.includes("Переглянути відео 1"));
  assert.ok(!videoHtml.includes("<iframe"));
});
test("gallery editor shows count, styled upload and accessible reorder/delete; videos separate", () => {
  const props = {
    petId: id,
    media: { gallery: [image], videos: [] },
    disabled: false,
    canMutate: () => true,
    update: async () => {},
    command: async () => true,
  };
  const output = renderToStaticMarkup(
    React.createElement(PetGalleryEditor, props),
  );
  for (const label of [
    "Фотографії 1 / 20",
    "Додати фотографії тварини",
    "Перемістити фото 1 раніше",
    "Видалити фото 1",
  ])
    assert.ok(output.includes(label));
  assert.ok(!output.includes("Choose File"));
  const videos = renderToStaticMarkup(
    React.createElement(PetVideoEditor, props),
  );
  assert.ok(videos.includes("Посилання на відео тварини"));
  assert.ok(videos.includes("Відеофайли не завантажуються"));
});
test("new profile text validates trims and keeps bounds without requiring traits", () => {
  const valid = {
    speciesId: id,
    breedId: "",
    gender: "UNKNOWN",
    birthDate: "",
    color: "",
    description: " Про тварину ",
    chipNumber: "",
    hasPassport: false,
    hasPedigree: false,
    vaccinated: false,
  };
  assert.equal(petFormSchema.parse(valid).specialTraits, null);
  assert.equal(
    petFormSchema.parse({ ...valid, specialTraits: "  Робочі якості  " })
      .specialTraits,
    "Робочі якості",
  );
  assert.equal(
    petFormSchema.safeParse({ ...valid, specialTraits: "x".repeat(3001) })
      .success,
    false,
  );
});
test("new media query is private and is removed at session boundary", () => {
  const client = new QueryClient();
  client.setQueryData(["pet-media", id, other], { gallery: [image] });
  assert.equal(isSessionQuery({ queryKey: ["pet-media", id, other] }), true);
  clearPrivateQueries(client);
  assert.equal(client.getQueryData(["pet-media", id, other]), undefined);
  client.clear();
});
test("public API missing/private loads reject 404 and malformed IDs make no request", async () => {
  const original = globalThis.fetch;
  let called = 0;
  globalThis.fetch = async () => {
    called++;
    return new Response(
      JSON.stringify({ message: "Профіль тварини не знайдено" }),
      { status: 404 },
    );
  };
  try {
    await assert.rejects(getPublicPet(id), (error) => error.status === 404);
    await assert.rejects(
      getPublicPet("invalid"),
      (error) => error.status === 404,
    );
    assert.equal(called, 1);
  } finally {
    globalThis.fetch = original;
  }
});
