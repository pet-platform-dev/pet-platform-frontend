import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const { clearPrivateQueries } = await load(
  "src/features/auth/session-provider.tsx",
);
const { getOwnedListing } = await load(
  "src/features/listing/manage-listing/api.ts",
);
const { ListingManagementSkeleton } = await load(
  "src/features/listing/manage-listing/listing-management-skeleton.tsx",
);
const { ListingImage } = await load(
  "src/entities/listing/ui/listing-image.tsx",
);

test("account changes remove every private listing/pet cache while preserving public data and requests", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  for (const key of ["my-pets", "pet", "my-listings", "owned-listing"])
    client.setQueryData([key, "old-user"], { private: true });
  client.setQueryData(["listing", "public-id"], { public: true });
  let finishPublic,
    aborted = false;
  const publicRequest = client.fetchQuery({
    queryKey: ["listings", "pending"],
    queryFn: () =>
      new Promise((resolve) => {
        finishPublic = resolve;
      }),
  });
  const privateRequest = client.fetchQuery({
    queryKey: ["my-listings", "pending"],
    queryFn: ({ signal }) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener("abort", () => {
          aborted = true;
          reject(new Error("aborted"));
        }),
      ),
  });
  const cancelled = assert.rejects(privateRequest);
  clearPrivateQueries(client);
  await cancelled;
  assert.equal(aborted, true);
  for (const key of ["my-pets", "pet", "my-listings", "owned-listing"])
    assert.equal(client.getQueryData([key, "old-user"]), undefined);
  finishPublic({ public: true });
  assert.deepEqual(await publicRequest, { public: true });
  assert.deepEqual(client.getQueryData(["listing", "public-id"]), {
    public: true,
  });
  client.clear();
});
test("invalid editor UUID has the same unavailable result without a backend request", async () => {
  await assert.rejects(
    () => getOwnedListing("invalid", "owner"),
    (error) =>
      error.status === 404 && error.message === "Оголошення не знайдено",
  );
});
test("management loading announcements use hidden layout skeletons for both routes", () => {
  for (const editor of [false, true]) {
    const html = renderToStaticMarkup(
      React.createElement(ListingManagementSkeleton, { editor }),
    );
    assert.match(html, /role="status"/);
    assert.match(html, /aria-hidden="true"/);
    assert.match(
      html,
      editor ? /owner-skeleton-input/ : /owner-listing-skeleton/,
    );
    assert.doesNotMatch(html, /Loading/);
  }
});
test("image component preserves optimized source and accessible text; absent delivery URL uses placeholder", () => {
  const html = renderToStaticMarkup(
    React.createElement(ListingImage, {
      species: "dog",
      src: "https://res.cloudinary.com/fixture/image/upload/c_fill,w_480/a.png",
      alt: "Тварина — фото 1",
      loading: "lazy",
      width: 480,
      height: 360,
    }),
  );
  assert.match(html, /w_480/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /Тварина — фото 1/);
  const empty = renderToStaticMarkup(
    React.createElement(ListingImage, { species: "dog", alt: "Тварина" }),
  );
  assert.match(empty, /listing-visual-dog/);
  assert.doesNotMatch(empty, /<img/);
});
