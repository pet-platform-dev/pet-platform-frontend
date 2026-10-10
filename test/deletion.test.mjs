import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const { PetList } = await load("src/features/pet/pet-list.tsx");
const { invalidateDeletedMarketplace, deleteListing } = await load(
  "src/features/listing/manage-listing/api.ts",
);
const { signIn } = await load("src/shared/api/client.ts");
const pet = {
  id: "pet",
  name: "Локі",
  gender: "MALE",
  birthDate: "2024-01-01",
  color: null,
  species: { id: "dog", slug: "dog", name: "Dog" },
  breed: {
    id: "breed",
    name: "Golden Retriever",
    nameUk: "Золотистий ретривер",
    slug: "golden",
    isActive: true,
  },
};
test("My Pets uses listing preview and accessible fallback with explicit cascade confirmation", () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["my-pets", { page: 1 }], {
    data: [
      {
        ...pet,
        previewImage: { thumbnailUrl: "https://example.invalid/cover.png" },
      },
      { ...pet, id: "empty", name: null, previewImage: null },
    ],
    meta: { page: 1, pages: 1, total: 2, limit: 24 },
  });
  const html = renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(PetList),
    ),
  );
  assert.match(html, /src="https:\/\/example.invalid\/cover.png"/);
  assert.match(html, /listing-visual-dog/);
  assert.match(html, /Золотистий ретривер/);
  assert.match(html, /Локі/);
  assert.match(html, /Видалити профіль тварини\?/);
  assert.match(
    html,
    /Буде видалено профіль тварини та всі пов’язані з нею оголошення\. Цю дію не можна скасувати\./,
  );
  assert.match(html, /Видалити тварину/);
  assert.doesNotMatch(html, /видалити не можна/);
  client.clear();
});
test("Listing deletion clears exact detail caches, refreshes Pet preview and seller/public/own lists", async () => {
  const client = new QueryClient();
  for (const key of [
    ["listing", "deleted"],
    ["owned-listing", "deleted", "owner"],
    ["listing", "kept"],
    ["my-listings", "owner"],
    ["my-pets", { page: 1 }],
    ["listings"],
    ["seller-listings", "owner"],
    ["seller", "owner"],
  ])
    client.setQueryData(key, { id: key[1] });
  await invalidateDeletedMarketplace(client, "deleted");
  assert.equal(client.getQueryData(["listing", "deleted"]), undefined);
  assert.equal(
    client.getQueryData(["owned-listing", "deleted", "owner"]),
    undefined,
  );
  assert.deepEqual(client.getQueryData(["listing", "kept"]), { id: "kept" });
  for (const key of [
    "my-listings",
    "my-pets",
    "listings",
    "seller-listings",
    "seller",
  ])
    assert.ok(
      client.getQueryCache().find({ queryKey: [key], exact: false }).state
        .isInvalidated,
    );
  await invalidateDeletedMarketplace(client);
  assert.equal(client.getQueryData(["listing", "kept"]), undefined);
  client.clear();
});
test("Listing delete sends authenticated DELETE with CSRF and accepts empty 204", async () => {
  const original = globalThis.fetch,
    calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith("/csrf"))
      return Response.json({ data: { csrfToken: "csrf" } });
    if (String(url).endsWith("/login"))
      return Response.json({
        data: { user: { id: "owner" }, accessToken: "access", expiresIn: 900 },
      });
    return new Response(null, { status: 204 });
  };
  try {
    await signIn("login", {});
    await deleteListing("deleted");
    const { url, options } = calls.at(-1);
    assert.ok(url.endsWith("/listings/deleted"));
    assert.equal(options.method, "DELETE");
    assert.equal(options.headers.Authorization, "Bearer access");
    assert.equal(options.headers["X-CSRF-Token"], "csrf");
  } finally {
    globalThis.fetch = original;
  }
});
