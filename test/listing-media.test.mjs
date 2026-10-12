import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "./helpers/render-with-session.mjs";
import { load } from "./helpers/load-frontend.mjs";
const { imageError, reorderImages, MAX_IMAGE_BYTES } = await load(
  "src/features/listing/create-listing/model/images.ts",
);
const { petFormSchema } = await load("src/features/pet/validation.ts");
const { unifiedListingPayload, createUnifiedListing } = await load(
  "src/features/listing/create-listing/api/create-listing.ts",
);
const { signIn, authenticatedRequest } = await load("src/shared/api/client.ts");
const { ListingGallery } = await load(
  "src/entities/listing/ui/listing-gallery.tsx",
);
const { ListingCard } = await load("src/entities/listing/ui/listing-card.tsx");
const { listingSchema } = await load("src/entities/listing/model/listing.ts");
const { createListingError } = await load(
  "src/features/listing/create-listing/model/presentation.ts",
);
const { ApiError } = await load("src/shared/api/client.ts");
test("known animal/session errors stay actionable without exposing unknown diagnostics", () => {
  const message = "Сесію завантаження не знайдено або завершено";
  assert.equal(createListingError(new ApiError(404, message)), message);
  assert.ok(
    !createListingError(new ApiError(400, "PRIVATE_PROVIDER_ERROR")).includes(
      "PRIVATE",
    ),
  );
});
const input = {
  petId: "b3281413-c333-4752-9031-6a2df9274b1a",
  locationId: "3bc6447a-98b0-4654-bf6b-a9162400fbbb",
  type: "SALE",
  title: "Тварина шукає родину",
  description: "Опис",
  price: "125.50",
};
const pet = petFormSchema.parse({
  name: "",
  speciesId: input.petId,
  breedId: "",
  gender: "UNKNOWN",
  birthDate: "",
  color: "",
  description: "",
  chipNumber: "",
  hasPassport: false,
  hasPedigree: false,
  vaccinated: false,
});
test("new Pet payload uses Phase 3 defaults, optional name and explicit owned-field whitelist", () => {
  const value = unifiedListingPayload({
    input,
    pet: { ...pet, ownerId: "evil", visibility: "PUBLIC" },
    imageIds: [],
  });
  assert.equal(value.pet.name, null);
  assert.equal(value.pet.birthDate, null);
  assert.ok(!("petId" in value));
  assert.ok(!("ownerId" in value.pet));
  assert.ok(!("visibility" in value.pet));
  assert.equal(value.price, "125.50");
});
test("existing Pet payload retains its ID without nested editable animal fields", () => {
  const value = unifiedListingPayload({ input, imageIds: [] });
  assert.equal(value.petId, input.petId);
  assert.ok(!("pet" in value));
});
for (const type of ["FREE", "ADOPTION"])
  test(`${type} excludes stale price and all server-derived fields`, () => {
    const value = unifiedListingPayload({
      input: { ...input, type, sellerId: "evil", status: "ACTIVE" },
      pet,
      imageIds: [],
    });
    assert.ok(!("price" in value));
    assert.ok(!("sellerId" in value));
    assert.ok(!("status" in value));
  });
test("upload session and image order remain explicit", () => {
  const value = unifiedListingPayload({
    input,
    pet,
    uploadSessionId: "session",
    imageIds: ["second", "first"],
  });
  assert.deepEqual(value.imageIds, ["second", "first"]);
  assert.equal(value.uploadSessionId, "session");
});
for (const type of ["image/jpeg", "image/png", "image/webp"])
  test(`${type} accepted at the size boundary`, () =>
    assert.equal(imageError({ type, size: MAX_IMAGE_BYTES }), null));
test("SVG/HEIC/non-image and oversized/empty files rejected early", () => {
  for (const type of ["image/svg+xml", "image/heic", "text/plain"])
    assert.equal(
      imageError({ type, size: 10 }),
      "Формат зображення не підтримується",
    );
  for (const size of [0, MAX_IMAGE_BYTES + 1])
    assert.equal(imageError({ type: "image/png", size }), "Файл завеликий");
});
test("reordering changes the cover without mutating the original list", () => {
  const items = ["a", "b", "c"];
  assert.deepEqual(reorderImages(items, 2, 0), ["c", "a", "b"]);
  assert.deepEqual(reorderImages(items, 0, 1), ["b", "a", "c"]);
  assert.deepEqual(items, ["a", "b", "c"]);
  assert.equal(reorderImages(items, 0, -1), items);
});
const listing = {
  id: "listing",
  type: "FREE",
  price: null,
  currency: "UAH",
  title: "Оголошення",
  description: "Опис",
  publishedAt: null,
  createdAt: "2026-10-09",
  pet: {
    species: { slug: "dog" },
    breed: { name: "Malinois", nameUk: "Малінуа" },
    name: null,
    gender: "UNKNOWN",
    birthDate: null,
  },
  location: { city: "Київ", region: "Київ" },
  images: [
    {
      id: "a",
      url: "https://res.cloudinary.com/fixture/image/upload/f_auto,q_auto,w_1200/a.png",
      thumbnailUrl:
        "https://res.cloudinary.com/fixture/image/upload/f_auto,q_auto,w_480/a.png",
      sortOrder: 0,
    },
    {
      id: "b",
      url: "https://res.cloudinary.com/fixture/image/upload/b.png",
      thumbnailUrl:
        "https://res.cloudinary.com/fixture/image/upload/w_480/b.png",
      sortOrder: 1,
    },
  ],
};
test("catalog uses a lazy optimized cover with reserved aspect ratio and descriptive alt", () => {
  const html = renderToStaticMarkup(
    React.createElement(ListingCard, { listing }),
  );
  assert.ok(html.includes("w_480"));
  assert.ok(html.includes('loading="lazy"'));
  assert.ok(html.includes('width="480"'));
  assert.ok(html.includes("Малінуа — фото 1"));
});
test("gallery has a main image and accessible selected thumbnails", () => {
  const html = renderToStaticMarkup(
    React.createElement(ListingGallery, { listing }),
  );
  assert.ok(html.includes("w_1200"));
  assert.ok(html.includes("Показати фото 2"));
  assert.ok(html.includes('aria-pressed="true"'));
  assert.ok(!html.includes("filename"));
});
test("no-image gallery and catalog preserve honest placeholders", () => {
  for (const Component of [ListingGallery, ListingCard])
    assert.ok(
      renderToStaticMarkup(
        React.createElement(Component, { listing: { ...listing, images: [] } }),
      ).includes("<svg"),
    );
});
test("public image contract rejects arbitrary host and excessive images", () => {
  const fixture = {
    ...listing,
    status: "ACTIVE",
    moderationStatus: "APPROVED",
    views: 0,
    closedAt: null,
    updatedAt: "2026-10-09",
    pet: {
      ...listing.pet,
      id: "pet",
      species: { id: "dog", name: "Dog", slug: "dog" },
      breed: null,
    },
    location: {
      ...listing.location,
      id: "city",
      countryCode: "UA",
      slug: "kyiv",
    },
    seller: {
      id: "seller",
      displayName: "Тест",
      location: null,
      phone: null,
      telegram: null,
      viber: null,
      whatsapp: null,
      memberSince: "2026-10-01T00:00:00Z",
    },
  };
  assert.equal(listingSchema.safeParse(fixture).success, true);
  assert.equal(
    listingSchema.safeParse({
      ...fixture,
      images: [{ ...listing.images[0], url: "https://evil.example/x.png" }],
    }).success,
    false,
  );
  assert.equal(
    listingSchema.safeParse({
      ...fixture,
      images: Array(11).fill(listing.images[0]),
    }).success,
    false,
  );
});
test("new/existing endpoints and multipart requests reuse Bearer/CSRF without a JSON content type", async () => {
  const saved = globalThis.fetch,
    calls = [];
  const json = (data) =>
    new Response(JSON.stringify({ data }), {
      headers: { "Content-Type": "application/json" },
    });
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/auth/csrf")) return json({ csrfToken: "csrf" });
    if (url.endsWith("/auth/login"))
      return json({
        user: { id: "owner" },
        accessToken: "token",
        expiresIn: 900,
      });
    if (url.includes("/uploads/")) return json({ id: input.petId });
    return json({ id: input.petId, status: "DRAFT" });
  };
  try {
    await signIn("login", {});
    await createUnifiedListing({ input, pet, imageIds: [] });
    await createUnifiedListing({ input, imageIds: [] });
    const body = new FormData();
    body.append("file", new Blob(["fixture"], { type: "image/png" }));
    await authenticatedRequest("/uploads/listings/session/images", {
      method: "POST",
      body,
    });
    assert.ok(calls.some((call) => call.url.endsWith("/listings/with-pet")));
    assert.ok(calls.some((call) => call.url.endsWith("/listings")));
    const upload = calls.at(-1);
    assert.equal(upload.options.headers["Content-Type"], undefined);
    assert.equal(upload.options.headers.Authorization, "Bearer token");
    assert.equal(upload.options.headers["X-CSRF-Token"], "csrf");
  } finally {
    globalThis.fetch = saved;
  }
});
